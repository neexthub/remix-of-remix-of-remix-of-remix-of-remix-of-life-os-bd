import { createFileRoute } from "@tanstack/react-router";
import { Copy, Play, RefreshCw, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Page, Msg, useAdmin } from "@/components/admin-kit";
import { Button } from "@/components/ui/button";
import { ADMIN_API_BASE, adminApi } from "@/lib/admin-api";
import { settleDay, useTestLabAction } from "@/components/test-lab-actions";
import { bdt } from "@/lib/member-api";
import { MATCHING_TYPE_LABELS, MATCHING_TYPES, type MatchingSplit } from "@/lib/matching-split";

export const Route = createFileRoute("/admin/cron")({
  head: () => ({ meta: [{ title: "Cron Setup — Life OS Admin" }, { name: "description", content: "Commission scheduler status and cPanel cron setup for Life OS." }, { property: "og:title", content: "Cron Setup — Life OS Admin" }, { property: "og:description", content: "Commission scheduler status and cPanel cron setup for Life OS." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CronSetup,
});

type Status = { url: string | null; backend_base_url: string; url_source: "current-domain" | "configured"; endpoint_path: string; schedule: string; timezone: string; server_enabled: boolean; finance_approved: boolean; mode: string; cli_command: string; url_command: string; last_run: { at: string; result: { status: string; failed?: number } } | null; software_date?: string; matching_total?: MatchingSplit; matching_today?: MatchingSplit; matching_last_day?: MatchingSplit };
function CronSetup() {
  const q = useAdmin<Status>("cron", "/cron");
  const [message, setMessage] = useState<string | null>(null);
  const data = q.data;
  const lab = useTestLabAction();
  // Test Lab shortcuts: add one day of new sales, then settle that day with the real cron engine.
  const addSales = async () => {
    setMessage(null);
    try {
      const r = await lab.run("sales", (run_id) => adminApi<{ added: number; from: string; to: string; date: string; waiting: number }>("/test-lab/add-sales", { method: "POST", body: { run_id } }));
      setMessage(`${r.added} new sales added on ${r.date} (${r.from} … ${r.to}, password test1234). ${r.waiting} waiting — press Run 1 Day Settle.`);
      await q.refetch();
    } catch (e) { setMessage((e as Error).message); }
  };
  const runDay = async () => {
    setMessage(null);
    try {
      const r = await lab.run("run", settleDay);
      setMessage(`Settled ${r.settled_date}: ${r.processed} activations, ${r.statements_closed} statements closed, ${r.failed} failed. Software date is now ${r.next_date}.`);
      await q.refetch();
    } catch (e) { setMessage((e as Error).message); }
  };
  const cronUrl = data?.url ?? `${ADMIN_API_BASE}/public/cron/settle`;
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setMessage("Copied."); }
    catch { setMessage("Copy unavailable. Select and copy the value."); }
  };
  return <Page title="Cron Setup">
    <Msg text={q.error ? (q.error as Error).message : message} />
    <Button variant="outline" size="sm" onClick={() => void q.refetch()} title="Refresh scheduler status"><RefreshCw />Refresh</Button>
    {data && <div className="space-y-5 py-4 text-foreground">
      <dl className="grid grid-cols-[180px_1fr] gap-2">
        <dt>Payment execution</dt><dd>{data.server_enabled && data.finance_approved ? "Approved" : "Blocked — approval required"}</dd>
        <dt>URL mode</dt><dd>{data.mode}</dd><dt>Time zone</dt><dd>{data.timezone}</dd>
        <dt>Last URL invocation</dt><dd>{data.last_run ? `${data.last_run.at} — ${data.last_run.result.status}` : "No verified invocation"}</dd>
        <dt>Host schedule</dt><dd>Installation must be confirmed in cPanel.</dd>
      </dl>
      <div className="space-y-2 border border-border p-3">
        <h3 className="font-bold">Test Lab — 1 Day Sales &amp; Settlement (software date {data.software_date})</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={lab.running !== null} onClick={() => void addSales()}><ShoppingCart />Add 1 Day Sales (300)</Button>
          <Button disabled={lab.running !== null} onClick={() => void runDay()}><Play />Run 1 Day Settle</Button>
        </div>
        {lab.bar}
        <p className="text-sm">Add 1 Day Sales creates 300 new paid members and their ৳1,000 activation transactions on the software date, keeping all existing data; nothing is settled until Run 1 Day Settle.</p>
      </div>
      {data.matching_total && <>
        <h3>Matching by Type (cron settlement)</h3>
        <table className="w-full max-w-2xl border border-border text-sm"><thead><tr className="bg-primary text-primary-foreground"><th className="p-1 text-left">Matching Type</th><th className="p-1 text-right">Previous day</th><th className="p-1 text-right">Today ({data.software_date})</th><th className="p-1 text-right">All time</th><th className="p-1 text-right">Events (paid / flushed)</th></tr></thead>
          <tbody>{MATCHING_TYPES.map((m) => <tr key={m} className="border-t border-border"><td className="p-1">{MATCHING_TYPE_LABELS[m]}</td><td className="p-1 text-right">{bdt(data.matching_last_day?.[m].paid)}</td><td className="p-1 text-right">{bdt(data.matching_today?.[m].paid)}</td><td className="p-1 text-right"><b>{bdt(data.matching_total![m].paid)}</b></td><td className="p-1 text-right">{data.matching_total![m].paid_events} / {data.matching_total![m].flushed_events}</td></tr>)}</tbody></table>
      </>}
      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">1. Your automatic Cron URL</h3>
        <p>Detected from: <b>{data.url_source === "current-domain" ? "this admin page’s current domain" : "private cron_base_url configuration"}</b></p>
        <div className="flex items-start gap-2 border border-border bg-muted p-2"><code className="min-w-0 flex-1 break-all">{cronUrl}</code><Button variant="outline" size="icon" title="Copy cron URL" aria-label="Copy cron URL" onClick={() => void copy(cronUrl)}><Copy /></Button></div>
        <p>Schedule: <b>{data.schedule}</b> · Server timezone: <b>{data.timezone}</b> · HTTP mode: <b>{data.mode}</b></p>
        <p>The URL contains no password or signing key. Each call is signed by the server-side bridge. Opening it in a browser or sending an unsigned curl request must return 401; this is normal security.</p>
      </section>

      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">2. Complete cPanel setup guide</h3>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Take a full website and database backup. Complete historical reconciliation and obtain Finance/Admin approval before any live payout.</li>
          <li>Open <b>cPanel → Advanced → Cron Jobs</b>. Under Cron Email, use an address you monitor or a controlled log file; do not discard repeated errors.</li>
          <li>Under <b>Add New Cron Job</b>, choose <b>Once Per Minute</b>. The fields must be Minute <code>*</code>, Hour <code>*</code>, Day <code>*</code>, Month <code>*</code>, Weekday <code>*</code>.</li>
          <li>Paste the <b>Direct PHP command</b> below. Replace <code>/usr/local/bin/php</code> only if your host documents a different PHP 8.1+ CLI path. Replace the document-root path if the automatically detected server path differs on your hosting.</li>
          <li>Keep <b>--dry-run</b> initially. Click <b>Add New Cron Job</b>, wait two minutes, then press Refresh here and inspect the host log. Dry-run verifies work without paying it.</li>
          <li>Alternatively, use the <b>Signed URL command</b>. Its <b>--base-url</b> is already filled from the current domain; no URL secret or cron_base_url edit is needed.</li>
          <li>For actual payouts, the PHP configuration needs <b>commission_cron_enabled=true</b> and the approved admin setting <b>financial_release_approved=1</b>. The Signed URL method additionally needs <b>cron_http_execute=true</b>.</li>
          <li>After enabling, check Last URL invocation, pending activations, ledger totals and the log. Keep only one cron method active—never schedule both commands together.</li>
        </ol>
        <h4 className="font-bold">Direct PHP command</h4><Command text={data.cli_command} copy={copy} />
        <h4 className="font-bold">Signed URL command (domain filled automatically)</h4><Command text={data.url_command} copy={copy} />
      </section>

      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">3. Verification and troubleshooting</h3>
        <DataGuide rows={[
          ["401 / unsigned request", "Expected for browser/curl without a fresh signature. Use the Signed URL command, not the URL alone."],
          ["403 / approval required", "Dry-run is still available. Check commission_cron_enabled, cron_http_execute and financial_release_approved before execution."],
          ["No last-run update", "Confirm the cron exists, PHP CLI path is correct, and the command ran. Direct CLI status may appear only in its log; URL invocations update Last URL invocation."],
          ["Connection timeout", "Confirm HTTPS opens from the host, the current domain is correct, and no firewall blocks local server-to-server requests."],
          ["Failed items above zero", "Stop live execution and inspect the settlement/error log before retrying. Do not manually create replacement commission rows."],
        ]} />
        <p>Both methods process verified unprocessed payments with replay/concurrency protection. Daily statements close after Dhaka midnight. Merely passing time does not create commission, and existing paid history is not recalculated.</p>
      </section>
    </div>}
  </Page>;
}
function Command({ text, copy }: { text: string; copy: (text: string) => Promise<void> }) {
  return <div className="flex items-start gap-2 border border-border bg-muted p-3"><code className="min-w-0 flex-1 break-all">{text}</code><Button variant="outline" size="icon" title="Copy command" aria-label={`Copy ${text.includes("cron-http") ? "signed URL" : "direct PHP"} command`} onClick={() => void copy(text)}><Copy /></Button></div>;
}
