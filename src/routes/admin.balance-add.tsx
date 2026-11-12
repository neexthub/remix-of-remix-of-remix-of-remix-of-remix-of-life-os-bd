import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, Msg, DataTable, FilterBar, fmtDate, useAdmin } from "@/components/admin-kit";
import { adminApi } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/balance-add")({
  head: () => ({ meta: [{ title: "Balance Add — Life OS Admin" }, { name: "description", content: "Add audited balance to a member wallet and review every admin balance addition." }, { property: "og:title", content: "Balance Add — Life OS Admin" }, { property: "og:description", content: "Add audited balance to a member wallet and review every admin balance addition." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: BalanceAdd,
});

type Row = { trx_code: string; wallet: "DEPOSIT" | "ADJUSTMENT"; amount: number | string; note: string | null; created_at: string; life_id: string; phone: string | null; name: string | null };

const WALLET_LABEL: Record<string, string> = { DEPOSIT: "D Wallet", ADJUSTMENT: "E Wallet" };

function BalanceAdd() {
  const [form, setForm] = useState({ life_id: "", amount: "", note: "", wallet: "DEPOSIT" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string | null }>({ text: null });

  const [applied, setApplied] = useState({ from: "", to: "", q: "" });
  const [walletFilter, setWalletFilter] = useState("");
  const qs = new URLSearchParams();
  if (applied.from) qs.set("from", applied.from);
  if (applied.to) qs.set("to", applied.to);
  if (applied.q) qs.set("q", applied.q);
  if (walletFilter) qs.set("wallet", walletFilter);
  const path = "/balance-add" + (qs.toString() ? `?${qs}` : "");
  const report = useAdmin<Row[]>("balance-add-report", path);
  const rows = report.data ?? [];
  const sum = (w?: string) => rows.filter((r) => !w || r.wallet === w).reduce((s, r) => s + Number(r.amount), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: null });
    try {
      await adminApi("/balance-add", { body: { life_id: form.life_id.trim(), amount: Number(form.amount), note: form.note, wallet: form.wallet } });
      setMsg({ ok: true, text: `Balance updated for ${form.life_id.trim()}.` });
      setForm({ ...form, life_id: "", amount: "", note: "" });
      report.refetch();
    } catch (x) { setMsg({ text: (x as Error).message }); }
    setBusy(false);
  };

  return (
    <Page title="Balance Add" center>
      <Msg {...msg} />
      <form onSubmit={submit} style={{ maxWidth: 420, margin: "0 auto", textAlign: "left" }}>
        <p><b>Wallet:</b><br />
          <select value={form.wallet} onChange={(e) => setForm({ ...form, wallet: e.target.value })} style={{ width: "100%", padding: 6 }}>
            <option value="DEPOSIT">D Wallet (for Active New ID)</option>
            <option value="ADJUSTMENT">E Wallet (adjustment)</option>
          </select>
        </p>
        <p><b>Life ID:</b><br />
          <input required value={form.life_id} onChange={(e) => setForm({ ...form, life_id: e.target.value })} placeholder="LOS10001" style={{ width: "100%", padding: 6 }} />
        </p>
        <p><b>Amount (BDT):</b><br />
          <input required type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ width: "100%", padding: 6 }} />
        </p>
        <p><b>Note:</b><br />
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Reason (recorded in ledger)" style={{ width: "100%", padding: 6 }} />
        </p>
        <p style={{ textAlign: "center" }}>
          <button type="submit" disabled={busy} style={{ padding: "8px 28px" }}>{busy ? "Saving…" : "Add Balance"}</button>
        </p>
        <p style={{ fontSize: 12, color: "#555", textAlign: "center" }}>D Wallet balance can only be used to activate IDs; E Wallet adjustments are recorded in the bonus ledger.</p>
      </form>

      <h3 style={{ marginTop: 30, borderTop: "1px solid #ccc", paddingTop: 16 }}>Balance Add Report (All Transactions)</h3>
      <FilterBar value={applied} onChange={setApplied}>
        <b style={{ marginLeft: 16 }}>Wallet:</b>
        <select value={walletFilter} onChange={(e) => setWalletFilter(e.target.value)}>
          <option value="">All</option>
          <option value="DEPOSIT">D Wallet</option>
          <option value="ADJUSTMENT">E Wallet</option>
        </select>
      </FilterBar>
      {report.error ? <p style={{ color: "#C00", fontWeight: 600 }}>{(report.error as Error).message}</p> : (
        <>
          <DataTable
            head={["Sl", "Date & Time", "Trx ID", "Life ID", "Name", "Wallet", "Amount", "Note"]}
            rows={rows.map((r, i) => [
              i + 1, fmtDate(r.created_at), r.trx_code, r.life_id, r.name ?? "—", WALLET_LABEL[r.wallet] ?? r.wallet,
              <b key="a" style={{ color: Number(r.amount) < 0 ? "#C00" : "#009541" }}>{Number(r.amount).toFixed(2)}</b>,
              r.note ?? "—",
            ])}
          />
          {report.isLoading && <p>Loading…</p>}
          {!report.isLoading && rows.length === 0 && <Msg text="No balance additions found." />}
          {rows.length > 0 && (
            <p style={{ textAlign: "right", fontWeight: 700, paddingRight: 10 }}>
              Transactions: {rows.length} &nbsp;|&nbsp; D Wallet: {sum("DEPOSIT").toFixed(2)} &nbsp;|&nbsp; E Wallet: {sum("ADJUSTMENT").toFixed(2)} &nbsp;|&nbsp; Total: {sum().toFixed(2)}
            </p>
          )}
        </>
      )}
    </Page>
  );
}
