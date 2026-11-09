import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Msg, Page, useMember } from "@/components/member-kit";
import { bdt, memberApi } from "@/lib/member-api";

export const Route = createFileRoute("/member/wallet-swap")({
  head: () => ({ meta: [{ title: "E to D Wallet Swap — Life OS Member" }, { name: "description", content: "Move funds from your E wallet to your D wallet." }, { property: "og:title", content: "E to D Wallet Swap — Life OS Member" }, { property: "og:description", content: "Move funds from your E wallet to your D wallet." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: WalletSwap,
});

/** Display only; the server applies the same 4% charge. */
const SWAP_PCT = 4;

type Swap = { swap_code: string; amount: string; charge: string; credited: string; created_at: string };

function WalletSwap() {
  const w = useMember<{ withdrawable: number; deposit_balance: number }>("wallet", "/wallet");
  const hist = useMember<Swap[]>("wallet-swap", "/wallet-swap");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ amount: "", transaction_password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const amount = Number(f.amount || 0);
  const charge = Math.round(amount * SWAP_PCT * 10) / 1000;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(amount) || amount <= 0) return setMsg({ ok: false, t: "Enter a valid amount." });
    if (amount > Number(w.data?.withdrawable ?? 0)) return setMsg({ ok: false, t: "Amount is more than your E wallet balance." });
    setBusy(true);
    try {
      const r = await memberApi<{ credited: number; charge: number }>("/wallet-swap", { body: { amount, transaction_password: f.transaction_password } });
      setMsg({ ok: true, t: `${bdt(r.credited)} added to D wallet (charge ${bdt(r.charge)}).` });
      setF({ amount: "", transaction_password: "" });
      w.refetch(); hist.refetch();
    } catch (err) { setMsg({ ok: false, t: (err as Error).message }); }
    finally { setBusy(false); }
  };
  return (
    <Page title="E Wallet to D Wallet Swap">
      <form onSubmit={submit} autoComplete="off" style={{ maxWidth: 560 }}>
        <Msg ok={msg?.ok} text={msg?.t ?? (w.error ? (w.error as Error).message : null)} />
        <table width="100%" border={0} cellSpacing={5} cellPadding={0}>
          <tbody>
            <tr><td width="40%">E Wallet Balance</td><td width="2%">:</td><td>{bdt(w.data?.withdrawable)}</td></tr>
            <tr><td>D Wallet Balance</td><td>:</td><td>{bdt(w.data?.deposit_balance)}</td></tr>
            <tr><td>Swap Amount <sup>*</sup></td><td>:</td><td><input type="text" inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} style={{ width: 100, textAlign: "right" }} /></td></tr>
            <tr><td>Charge ({SWAP_PCT}%)</td><td>:</td><td style={{ color: "red" }}>{bdt(charge)}</td></tr>
            <tr><td>D Wallet Will Receive</td><td>:</td><td>{bdt(Math.max(0, amount - charge))}</td></tr>
            <tr><td>Your Transaction Password <sup>*</sup></td><td>:</td><td><input type="password" required value={f.transaction_password} onChange={(e) => setF({ ...f, transaction_password: e.target.value })} style={{ width: 90 }} /> <Link to="/member/transaction-pin" style={{ color: "#0577B5" }}>Set PIN</Link></td></tr>
            <tr><td></td><td>:</td><td><input type="submit" value={busy ? "Swapping…" : "Swap Now"} disabled={busy || !w.data} /></td></tr>
          </tbody>
        </table>
      </form>
      <br />
      <table width="100%" border={1} cellSpacing={0} cellPadding={5}>
        <thead><tr><th>Date</th><th>Code</th><th>Amount</th><th>Charge</th><th>Added to D</th></tr></thead>
        <tbody>
          {(hist.data ?? []).map((s) => (
            <tr key={s.swap_code}><td>{s.created_at}</td><td>{s.swap_code}</td><td>{bdt(s.amount)}</td><td>{bdt(s.charge)}</td><td>{bdt(s.credited)}</td></tr>
          ))}
          {hist.data && hist.data.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center" }}>No swaps yet</td></tr>}
        </tbody>
      </table>
    </Page>
  );
}
