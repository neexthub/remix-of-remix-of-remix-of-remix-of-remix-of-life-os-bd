import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Msg, Page, useMember } from "@/components/member-kit";
import { bdt, memberApi } from "@/lib/member-api";

export const Route = createFileRoute("/member/transaction")({
  head: () => ({ meta: [{ title: "Active New ID — Life OS Member" }, { name: "description", content: "Activate a member ID package from your Deposit wallet." }, { property: "og:title", content: "Active New ID — Life OS Member" }, { property: "og:description", content: "Activate a member ID package from your Deposit wallet." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ActiveNewId,
});

/** Package price is fixed by the plan; the server charges the same amount. */
const PACKAGE_FEE = 1000;

type Lookup = { life_id: string; username: string | null; name: string | null; district: string | null; photo: string | null; sponsor_life_id: string | null; joined: string; active: boolean };

/** Shows who the typed ID belongs to while the member types, so the right person gets the package. */
function useIdLookup(raw: string) {
  const [state, setState] = useState<{ data?: Lookup; error?: string; loading?: boolean }>({});
  useEffect(() => {
    const id = raw.trim();
    if (id.length < 3) { setState({}); return; }
    let live = true;
    setState({ loading: true });
    const t = setTimeout(() => {
      memberApi<Lookup>(`/activate-id/lookup?id=${encodeURIComponent(id)}`)
        .then((data) => { if (live) setState({ data }); })
        .catch((e) => { if (live) setState({ error: (e as Error).message }); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [raw]);
  return state;
}

function IdCard({ d }: { d: Lookup }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", border: "1px solid #c9d6e3", padding: 6, marginTop: 4, maxWidth: 320, background: "#f7fbff" }}>
      {d.photo
        ? <img src={d.photo} alt={d.name ?? d.life_id} width={56} height={56} style={{ objectFit: "cover", borderRadius: 4 }} />
        : <div aria-hidden style={{ width: 56, height: 56, borderRadius: 4, background: "#dde6ef", display: "grid", placeItems: "center", fontSize: 22, color: "#0577B5" }}>{(d.name ?? d.life_id).slice(0, 1).toUpperCase()}</div>}
      <div style={{ lineHeight: 1.5, fontSize: 12 }}>
        <b>{d.name || "—"}</b><br />
        ID: {d.life_id}{d.username && d.username !== d.life_id ? ` (${d.username})` : ""}<br />
        {d.sponsor_life_id && <>Sponsor: {d.sponsor_life_id}<br /></>}
        Joined: {String(d.joined).slice(0, 10)}{d.district ? ` · ${d.district}` : ""}<br />
        Status: <b style={{ color: d.active ? "#1a8a3a" : "#c0392b" }}>{d.active ? "Already Active" : "Not Active"}</b>
      </div>
    </div>
  );
}

function ActiveNewId() {
  const w = useMember<{ deposit_balance: number }>("wallet", "/wallet");
  const settings = useMember<Record<string, string>>("settings", "/settings");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ receiver: "", password: "", transaction_password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const look = useIdLookup(f.receiver);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await memberApi<{ activation_code: string; life_id: string }>("/activate-id", { body: f });
      setMsg({ ok: true, t: `ID ${r.life_id} activated (${r.activation_code}). The package is now active.` });
      setF({ ...f, receiver: "" });
      w.refetch();
    } catch (err) { setMsg({ ok: false, t: (err as Error).message }); }
    finally { setBusy(false); }
  };
  const disabled = settings.data?.["transfer_status"] !== "1";
  const low = Number(w.data?.deposit_balance ?? 0) < PACKAGE_FEE;
  return (
    <Page title="Active New ID">
      <form onSubmit={submit} autoComplete="off" style={{ maxWidth: 560 }}>
        <Msg ok={msg?.ok} text={msg?.t ?? (w.error ? (w.error as Error).message : disabled ? "Active New ID is currently disabled." : null)} />
        <table width="100%" border={0} cellSpacing={5} cellPadding={0}>
          <tbody>
            <tr><td width="40%">D Wallet Balance</td><td width="2%">:</td><td>{bdt(w.data?.deposit_balance)}</td></tr>
            <tr><td>User ID to Activate <sup>*</sup></td><td>:</td><td><input type="text" required maxLength={40} value={f.receiver} onChange={(e) => setF({ ...f, receiver: e.target.value })} />
              {look.loading && <div style={{ fontSize: 12, color: "#666" }}>Checking ID…</div>}
              {look.error && <div className="error" style={{ fontSize: 12 }}>{look.error}</div>}
              {look.data && <IdCard d={look.data} />}</td></tr>
            <tr><td>Package Amount</td><td>:</td><td><input type="text" readOnly value={PACKAGE_FEE.toFixed(2)} aria-label="Package amount" /></td></tr>
            <tr><td>Your Login Password <sup>*</sup></td><td>:</td><td><input type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} style={{ width: 90 }} /></td></tr>
            <tr><td>Your Transaction Password <sup>*</sup></td><td>:</td><td><input type="password" required value={f.transaction_password} onChange={(e) => setF({ ...f, transaction_password: e.target.value })} style={{ width: 90 }} /> <Link to="/member/transaction-pin" style={{ color: "#0577B5" }}>Set PIN</Link></td></tr>
            <tr><td></td><td>:</td><td><input type="submit" value={busy ? "Activating…" : "Confirm & Activate"} disabled={busy || !w.data || disabled || low || !look.data || look.data.active} /></td></tr>
            {low && w.data && <tr><td colSpan={3} className="error">D wallet needs at least {bdt(PACKAGE_FEE)}. Only the D wallet can be used.</td></tr>}
          </tbody>
        </table>
      </form>
    </Page>
  );
}
