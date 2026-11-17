import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, DataTable, Msg, fmtDateShort, useAdmin } from "@/components/admin-kit";
import { EMPTY_FILTERS, memberListQuery, pageCount, serialNo, toCsv, type MemberFilters } from "@/lib/member-list";
import { adminApi } from "@/lib/admin-api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/member-list")({
  head: () => ({ meta: [{ title: "Member List — Life OS Admin" }, { name: "description", content: "Search, filter, sort, export and manage every member: status, password and one-click login." }, { property: "og:title", content: "Member List — Life OS Admin" }, { property: "og:description", content: "Search, filter, sort, export and manage every member: status, password and one-click login." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MemberList,
});

type Member = {
  id: number; life_id: string; username: string | null; name: string | null; phone: string; email: string | null;
  status: string; is_active: number; lifetime_matchings: number; placement_side: "L" | "R" | null;
  sponsor_life_id: string | null; placement_life_id: string | null; directs: number; rank_name: string | null; created_at: string;
};
type ListResponse = {
  rows: Member[]; page: number; per: number; offset: number;
  counts: { total: number; active: number; pending: number; suspended: number; tree_active: number };
  ranks: { id: number; name: string }[];
};

const btn = { padding: "3px 8px", cursor: "pointer", fontWeight: 700, border: "1px solid #007a35", borderRadius: 3 } as const;
const lbl = { display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2, margin: "4px 6px", fontWeight: 700, fontSize: 12 } as const;
const STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"];

function MemberList() {
  const [draft, setDraft] = useState<MemberFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<MemberFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [jump, setJump] = useState("");
  const q = useAdmin<ListResponse>("member-list", "/member-list?" + memberListQuery(applied, page));
  const [msg, setMsg] = useState<{ ok?: boolean; text: string | null }>({ text: null });
  const [pwFor, setPwFor] = useState<Member | null>(null);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const data = q.data;
  const rows = data?.rows ?? [];
  const counts = data?.counts;
  const pages = pageCount(counts?.total ?? 0, data?.per ?? Number(applied.per));

  const apply = (f: MemberFilters, p = 1) => { setApplied(f); setDraft(f); setPage(p); setPicked(new Set()); };
  const goPage = (p: number) => { setPage(Math.min(pages, Math.max(1, p))); setPicked(new Set()); };

  const setStatus = async (id: number, status: string) => {
    setMsg({ text: null });
    try {
      await adminApi(`/members/${id}/status`, { body: { status: status.toLowerCase() } });
      setMsg({ ok: true, text: "Status updated." });
      await q.refetch();
    } catch (x) { setMsg({ text: (x as Error).message }); }
  };

  const bulkStatus = async () => {
    if (!bulk || picked.size === 0) return;
    if (!window.confirm(`Set ${picked.size} selected member(s) to ${bulk}?`)) return;
    setBusy(true); setMsg({ text: null });
    try {
      const r = await adminApi<{ changed: number }>("/members/bulk-status", { body: { ids: [...picked], status: bulk.toLowerCase() } });
      setMsg({ ok: true, text: `${r.changed} member(s) set to ${bulk}.` });
      setPicked(new Set()); setBulk("");
      await q.refetch();
    } catch (x) { setMsg({ text: (x as Error).message }); } finally { setBusy(false); }
  };

  const exportCsv = async () => {
    setBusy(true); setMsg({ text: null });
    try {
      const r = await adminApi<{ rows: Member[] }>("/member-list?" + memberListQuery(applied, 1, true));
      const csv = toCsv(
        ["Sl", "Joined", "Account ID", "Name", "Phone", "Email", "Sponsor", "Placement", "Side", "Directs", "Total Matching", "Rank", "Tree Active", "Status"],
        r.rows.map((m, i) => [i + 1, m.created_at, m.life_id, m.name, m.phone, m.email, m.sponsor_life_id, m.placement_life_id, m.placement_side, m.directs, m.lifetime_matchings, m.rank_name ?? "", Number(m.is_active) ? "Yes" : "No", m.status]),
      );
      const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: `Exported ${r.rows.length} member(s)${r.rows.length >= 20000 ? " (first 20,000 — narrow the filter for the rest)" : ""}.` });
    } catch (x) { setMsg({ text: (x as Error).message }); } finally { setBusy(false); }
  };

  // Opens the member panel in a new tab; this admin tab stays signed in.
  const loginAs = async (m: Member) => {
    setMsg({ text: null });
    const tab = window.open("", "_blank");
    try {
      const r = await adminApi<{ token: string }>(`/members/${m.id}/login-as`, { method: "POST", body: {} });
      const url = `${import.meta.env.BASE_URL}member-access#t=${encodeURIComponent(r.token)}`;
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch (x) {
      tab?.close();
      setMsg({ text: (x as Error).message });
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwFor) return;
    if (pw.length < 6 || pw.length > 72) { setPwErr("Password must be 6–72 characters."); return; }
    setPwBusy(true); setPwErr(null);
    try {
      await adminApi(`/members/${pwFor.id}/password`, { body: { password: pw } });
      setMsg({ ok: true, text: `New password saved for ${pwFor.life_id}.` });
      setPwFor(null); setPw("");
    } catch (x) { setPwErr((x as Error).message); } finally { setPwBusy(false); }
  };

  const set = (k: keyof MemberFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft({ ...draft, [k]: e.target.value });
  const allPicked = rows.length > 0 && rows.every((m) => picked.has(m.id));
  const chip = (label: string, n: number | undefined, f: Partial<MemberFilters>) => (
    <button key={label} type="button" onClick={() => apply({ ...applied, status: "", tree_active: "", ...f })} style={{ ...btn, margin: 3, background: "#fff" }}>
      {label}: {(n ?? 0).toLocaleString()}
    </button>
  );

  return (
    <Page title="Member List" center>
      <form onSubmit={(e) => { e.preventDefault(); apply(draft); }} style={{ margin: "8px 0", textAlign: "left", border: "1px solid #ccc", padding: 6, borderRadius: 4 }} aria-label="Member filters">
        <label style={lbl}>Search<input type="text" placeholder="ID / name / phone / email" value={draft.q} onChange={set("q")} style={{ width: 190 }} /></label>
        <label style={lbl}>Status<select value={draft.status} onChange={set("status")}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}</select></label>
        <label style={lbl}>Tree Active<select value={draft.tree_active} onChange={set("tree_active")}><option value="">All</option><option value="1">Yes</option><option value="0">No</option></select></label>
        <label style={lbl}>Side<select value={draft.side} onChange={set("side")}><option value="">All</option><option value="L">Left</option><option value="R">Right</option></select></label>
        <label style={lbl}>Rank<select value={draft.rank} onChange={set("rank")}><option value="">All</option><option value="none">No rank</option>{(data?.ranks ?? []).map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}</select></label>
        <label style={lbl}>ID Type<select value={draft.id_format} onChange={set("id_format")}><option value="">All</option><option value="old">Old site (LID-2026-XXXXXX)</option><option value="new">New site (LID-2026-number)</option><option value="other">Other format</option></select></label>
        <label style={lbl}>Sponsor ID<input type="text" value={draft.sponsor} onChange={set("sponsor")} style={{ width: 130 }} /></label>
        <label style={lbl}>Min Matching<input type="number" min={0} value={draft.min_matching} onChange={set("min_matching")} style={{ width: 90 }} /></label>
        <label style={lbl}>Joined From<input type="date" value={draft.from} onChange={set("from")} /></label>
        <label style={lbl}>Joined To<input type="date" value={draft.to} onChange={set("to")} /></label>
        <label style={lbl}>Sort<select value={draft.sort} onChange={set("sort")}><option value="new">Newest first</option><option value="old">Oldest first</option><option value="matching">Most matching</option><option value="directs">Most direct sponsors</option><option value="life_id">Account ID A–Z</option></select></label>
        <label style={lbl}>Per Page<select value={draft.per} onChange={set("per")}>{["25", "50", "100", "200", "500"].map((n) => <option key={n}>{n}</option>)}</select></label>
        <span style={{ display: "inline-flex", gap: 6, margin: "4px 6px", verticalAlign: "bottom" }}>
          <input type="submit" value="Search" />
          <input type="button" value="Reset" onClick={() => apply(EMPTY_FILTERS)} />
          <input type="button" value={busy ? "Working…" : "Export CSV"} disabled={busy} onClick={exportCsv} />
        </span>
      </form>

      <div style={{ margin: "4px 0" }}>
        {chip("Total", counts?.total, {})}
        {chip("Active", counts?.active, { status: "active" })}
        {chip("Pending", counts?.pending, { status: "pending" })}
        {chip("Suspended", counts?.suspended, { status: "suspended" })}
        {chip("Tree Active", counts?.tree_active, { tree_active: "1" })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, margin: "6px 0" }}>
        <span>
          <b>{picked.size}</b> selected{" "}
          <select value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Bulk status"><option value="">Set status…</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>{" "}
          <button type="button" style={btn} disabled={!bulk || picked.size === 0 || busy} onClick={bulkStatus}>Apply</button>
        </span>
        <Pager page={page} pages={pages} onGo={goPage} jump={jump} setJump={setJump} />
      </div>

      <Msg {...msg} />
      {q.isFetching && <p role="status">Loading…</p>}
      {q.error ? <p style={{ color: "#C00", fontWeight: 600 }}>{(q.error as Error).message}</p> : (
        <div style={{ overflowX: "auto" }}>
          <DataTable
            head={["", "Sl", "Joined", "Account ID", "Name", "Phone", "Email", "Sponsor", "Placement", "Directs", "Matching", "Rank", "Tree Active", "Status", "Change Status", "Password", "Login"]}
            rows={rows.length === 0 ? [] : [
              [<input key="all" type="checkbox" aria-label="Select all on this page" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((m) => m.id)))} />, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
              ...rows.map((m, i) => {
                const status = String(m.status ?? "").toUpperCase();
                const active = Number(m.is_active) === 1;
                return [
                  <input key="c" type="checkbox" aria-label={`Select ${m.life_id}`} checked={picked.has(m.id)} onChange={() => { const n = new Set(picked); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); setPicked(n); }} />,
                  serialNo(data?.offset ?? 0, i), fmtDateShort(m.created_at), <b key="id">{m.life_id}</b>, m.name ?? "—", m.phone, m.email ?? "—",
                  m.sponsor_life_id ?? "—", m.placement_life_id ? `${m.placement_life_id} · ${m.placement_side === "L" ? "Left" : "Right"}` : "—",
                  Number(m.directs), Number(m.lifetime_matchings).toLocaleString(), m.rank_name ?? "—",
                  <b key="t" style={{ color: active ? "#009541" : "#C00" }}>{active ? "Yes" : "No"}</b>,
                  <b key="s" style={{ color: status === "ACTIVE" ? "#009541" : status === "PENDING" ? "#b36b00" : "#C00" }}>{status}</b>,
                  <select key="cs" defaultValue="" aria-label={`Change status for ${m.life_id}`} onChange={(e) => { const v = e.target.value; if (v) { e.target.value = ""; void setStatus(m.id, v); } }}>
                    <option value="" disabled>Change…</option>
                    {STATUSES.filter((s) => s !== status).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>,
                  <button key="p" type="button" style={{ ...btn, whiteSpace: "nowrap" }} onClick={() => { setPwFor(m); setPw(""); setPwErr(null); }} aria-label={`Set new password for ${m.life_id}`}>Set Password</button>,
                  <button key="l" type="button" style={{ ...btn, whiteSpace: "nowrap", background: "#009541", color: "#fff" }} onClick={() => loginAs(m)} aria-label={`Login as ${m.life_id}`}>Login</button>,
                ];
              }),
            ]}
          />
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0" }}>
        <span>{counts ? `Showing ${counts.total ? serialNo(data?.offset ?? 0, 0) : 0}–${(data?.offset ?? 0) + rows.length} of ${counts.total.toLocaleString()}` : ""}</span>
        <Pager page={page} pages={pages} onGo={goPage} jump={jump} setJump={setJump} />
      </div>

      <Dialog open={!!pwFor} onOpenChange={(o) => { if (!o) setPwFor(null); }}>
        <DialogContent>
          <form onSubmit={savePassword}>
            <DialogHeader>
              <DialogTitle>Set new password</DialogTitle>
              <DialogDescription>{pwFor ? `${pwFor.life_id} — ${pwFor.name ?? ""}` : ""}. The member will log in with this password from now on.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor="new-member-password">New login password</Label>
              <Input id="new-member-password" type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} maxLength={72} required />
              {pwErr && <p className="text-sm text-destructive">{pwErr}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwFor(null)}>Cancel</Button>
              <Button type="submit" disabled={pwBusy}>{pwBusy ? "Saving…" : "Save Password"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function Pager({ page, pages, onGo, jump, setJump }: { page: number; pages: number; onGo: (p: number) => void; jump: string; setJump: (v: string) => void }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <button type="button" style={btn} disabled={page <= 1} onClick={() => onGo(1)}>« First</button>
      <button type="button" style={btn} disabled={page <= 1} onClick={() => onGo(page - 1)}>‹ Prev</button>
      <span>Page <b>{page}</b> of {pages.toLocaleString()}</span>
      <button type="button" style={btn} disabled={page >= pages} onClick={() => onGo(page + 1)}>Next ›</button>
      <button type="button" style={btn} disabled={page >= pages} onClick={() => onGo(pages)}>Last »</button>
      <input type="number" min={1} max={pages} value={jump} onChange={(e) => setJump(e.target.value)} placeholder="Go to" aria-label="Go to page" style={{ width: 70 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (jump) onGo(Number(jump)); } }} />
    </span>
  );
}
