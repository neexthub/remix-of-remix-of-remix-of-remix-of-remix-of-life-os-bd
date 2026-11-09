import { createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { useState } from "react";
import { DataTable, fmtDateShort, Msg, Page, useAdmin } from "@/components/admin-kit";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { bdt } from "@/lib/member-api";

export const Route = createFileRoute("/admin/cashback-api")({
  head: () => ({ meta: [
    { title: "Cashback API Setup — Life OS Admin" },
    { name: "description", content: "Merchant API keys, cashback debit history and Life OS BD integration guide." },
    { property: "og:title", content: "Cashback API Setup — Life OS Admin" },
    { property: "og:description", content: "Merchant API keys, cashback debit history and Life OS BD integration guide." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CashbackApiSetup,
});

type Key = { id: number; name: string; key_prefix: string; status: string; created_at: string; last_used_at: string | null; revoked_at: string | null };
type Debit = { id: number; debit_code: string; request_id: string; life_id: string; amount: number; balance_after: number; created_at: string; merchant_name: string };
type Data = { enabled: boolean; endpoint: string; status_endpoint: string; keys: Key[]; debits: Debit[] };

function CashbackApiSetup() {
  const q = useAdmin<Data>("merchant-api", "/merchant-api");
  const [name, setName] = useState("Life OS BD Merchant App");
  const [newKey, setNewKey] = useState<{ api_key: string; notice: string } | null>(null);
  const [message, setMessage] = useState<{ ok?: boolean; text: string | null }>({ text: null });
  const [busy, setBusy] = useState(false);
  const data = q.data;

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage({ text: null });
    try { await action(); await q.refetch(); }
    catch (e) { setMessage({ text: (e as Error).message }); }
    finally { setBusy(false); }
  };
  const generate = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await adminApi<{ api_key: string; notice: string }>("/merchant-api/keys", { body: { name } });
      setNewKey(r); setMessage({ ok: true, text: "API key created. Save it in the merchant server now." });
    });
  };
  const toggle = () => run(async () => {
    await adminApi("/merchant-api/toggle", { body: { enabled: !data?.enabled } });
    setMessage({ ok: true, text: data?.enabled ? "Merchant API disabled." : "Merchant API enabled." });
  });
  const revoke = (id: number) => {
    if (!window.confirm("Revoke this API key? The merchant app will stop working until it receives a new key.")) return;
    void run(async () => { await adminApi(`/merchant-api/keys/${id}/revoke`, { method: "POST", body: {} }); setMessage({ ok: true, text: "API key revoked." }); });
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setMessage({ ok: true, text: "Copied." }); }
    catch { setMessage({ text: "Copy unavailable. Select and copy the value." }); }
  };
  const example = data ? `curl -X POST '${data.endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Merchant-Key: YOUR_API_KEY' \\
  -d '{"life_id":"LID-2026-ABC123","password":"MEMBER_PASSWORD","amount":100,"request_id":"ORDER-2026-000001"}'` : "";

  return <Page title="Cashback API Setup">
    <Msg text={q.error ? (q.error as Error).message : message.text} ok={message.ok} />
    <Button variant="outline" size="sm" onClick={() => void q.refetch()}><RefreshCw />Refresh</Button>
    {data && <div className="space-y-5 py-4 text-sm text-foreground">
      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">1. Connection status</h3>
        <p>Status: <b>{data.enabled ? "ON — approved merchant requests can debit cashback" : "OFF — every merchant debit is rejected"}</b></p>
        <p>Only Cashback wallet is used. E wallet and D wallet are never changed by this API.</p>
        <Button variant={data.enabled ? "outline" : "default"} disabled={busy} onClick={() => void toggle()}>{data.enabled ? "Disable Merchant API" : "Enable Merchant API"}</Button>
      </section>

      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">2. Generate an API key</h3>
        <form onSubmit={generate} className="flex flex-wrap items-end gap-2">
          <label>Merchant name<br /><input className="border border-border bg-background p-2" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} required /></label>
          <Button type="submit" disabled={busy}><KeyRound />Generate new key</Button>
        </form>
        {newKey && <div className="space-y-2 border border-border bg-muted p-3">
          <b>{newKey.notice}</b>
          <div className="flex items-start gap-2"><code className="min-w-0 flex-1 break-all">{newKey.api_key}</code><Button type="button" variant="outline" size="icon" aria-label="Copy new merchant API key" onClick={() => void copy(newKey.api_key)}><Copy /></Button></div>
          <p>Put it only in the merchant app’s private server configuration. Never put it in browser JavaScript, a mobile app, a screenshot or a public repository.</p>
        </div>}
        <DataTable head={["ID", "Merchant", "Key prefix", "Status", "Created", "Last used", "Action"]} rows={data.keys.map((k) => [k.id, k.name, k.key_prefix + "…", k.status, fmtDateShort(k.created_at), fmtDateShort(k.last_used_at) || "Never", k.status === "ACTIVE" ? <Button key={k.id} variant="outline" size="sm" disabled={busy} onClick={() => revoke(k.id)}>Revoke</Button> : fmtDateShort(k.revoked_at)])} />
        <p>Only a prefix and a one-way hash are stored. A lost key cannot be recovered: generate a replacement, update the merchant server, then revoke the old key.</p>
      </section>

      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">3. API URLs (current domain detected automatically)</h3>
        <UrlLine label="Debit URL" value={data.endpoint} copy={copy} />
        <UrlLine label="Status/recovery URL" value={data.status_endpoint + "?request_id=ORDER-2026-000001"} copy={copy} />
        <p>Use HTTPS on the live domain. Calls are server-to-server; the member password must travel only between the merchant server and this HTTPS URL.</p>
      </section>

      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">4. Request fields</h3>
        <DataTable head={["Field/header", "Required", "Meaning"]} rows={[
          ["X-Merchant-Key", "Yes", "The generated losm_… key. Authorization: Bearer YOUR_API_KEY is also accepted."],
          ["life_id", "Yes", "Member Life ID; dashed and dashless LID formats are accepted."],
          ["password", "Yes", "The member’s current website login password. It is checked but never stored or returned."],
          ["amount", "Yes", "Positive BDT amount, maximum 1,000,000 and up to 3 decimal places."],
          ["request_id", "Yes", "Your unique order ID: 8–80 letters/numbers plus . _ : -. Create it once per merchant order."],
        ]} />
        <h4 className="font-bold">Example call</h4><Code text={example} copy={copy} label="Copy merchant request example" />
      </section>

      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">5. Merchant-app order flow</h3>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Create one permanent request_id for the order in the merchant database.</li>
          <li>Send life_id, password, amount and that request_id to the Debit URL.</li>
          <li>Accept only HTTP 200 with ok=true and data.status=SUCCESS. Save the returned debit_code before crediting the merchant-app account.</li>
          <li>Credit the merchant user exactly once, using the same order/request_id as the merchant-side uniqueness key.</li>
          <li>On timeout or an uncertain network result, do not create a new request_id. Retry the identical body or call the Status/recovery URL.</li>
          <li>If duplicate=true, the original website debit already exists. Recover its debit_code; do not debit again, but still ensure the merchant-side credit completed once.</li>
        </ol>
        <p><b>Important:</b> this website confirms and records the cashback debit. The merchant server is responsible for adding the same amount to its own user account and keeping its own credit idempotent.</p>
      </section>

      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">6. Success and error handling</h3>
        <Code text={'{"ok":true,"data":{"status":"SUCCESS","debit_code":"MCB-…","request_id":"ORDER-2026-000001","life_id":"LID-2026-ABC123","amount":100,"cashback_balance_after":900,"duplicate":false}}'} copy={copy} label="Copy merchant success example" />
        <DataTable head={["HTTP", "Cause", "Merchant action"]} rows={[
          ["200", "Debit confirmed, or an identical retry recovered", "Credit once and save debit_code."],
          ["401", "Invalid API key or member credentials", "Do not credit. Check key or ask member to retry."],
          ["403", "API disabled, key revoked or member suspended", "Do not credit; resolve configuration/account status."],
          ["409", "request_id reused with another member/amount", "Stop; investigate the original order."],
          ["422", "Invalid amount/request or insufficient cashback", "Do not credit; correct request or use a smaller amount."],
          ["404 from status URL", "No debit exists for this key/request_id", "The original debit did not complete; a safe identical retry may be made."],
        ]} />
      </section>

      <section className="space-y-3 border border-border p-3">
        <h3 className="text-lg font-bold">7. Confirmed cashback debit history</h3>
        <DataTable head={["Date", "Debit code", "Request ID", "Member", "Merchant", "Amount", "Cashback after"]} rows={data.debits.map((d) => [fmtDateShort(d.created_at), d.debit_code, d.request_id, d.life_id, d.merchant_name, bdt(d.amount), bdt(d.balance_after)])} />
      </section>
    </div>}
  </Page>;
}

function UrlLine({ label, value, copy }: { label: string; value: string; copy: (s: string) => Promise<void> }) {
  return <div><b>{label}</b><div className="mt-1 flex items-start gap-2 border border-border bg-muted p-2"><code className="min-w-0 flex-1 break-all">{value}</code><Button type="button" variant="outline" size="icon" aria-label={`Copy ${label}`} onClick={() => void copy(value)}><Copy /></Button></div></div>;
}
function Code({ text, copy, label }: { text: string; copy: (s: string) => Promise<void>; label: string }) {
  return <div className="flex items-start gap-2 border border-border bg-muted p-2"><pre className="min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-all text-xs"><code>{text}</code></pre><Button type="button" variant="outline" size="icon" aria-label={label} onClick={() => void copy(text)}><Copy /></Button></div>;
}
