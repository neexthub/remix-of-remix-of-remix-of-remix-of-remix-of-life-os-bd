import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Page, Msg, fmtDateShort, useAdmin } from "@/components/admin-kit";
import { EMPTY_FILTERS, activeFilters, clampPage, memberListQuery, pageCount, serialNo, toCsv, type MemberFilters } from "@/lib/member-list";
import { adminApi } from "@/lib/admin-api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import "@/components/admin/member-list.css";

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

const STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"];
const statusClass = (s: string) => `ml-badge ml-badge--${s.toLowerCase() === "active" ? "active" : s.toLowerCase() === "pending" ? "pending" : "suspended"}`;

function MemberList() {
  const [draft, setDraft] = useState<MemberFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<MemberFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
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
  const ranks = data?.ranks ?? [];
  const pages = pageCount(counts?.total ?? 0, data?.per ?? Number(applied.per));
  const offset = data?.offset ?? 0;
  const tags = activeFilters(applied, ranks);

  const apply = (f: MemberFilters, p = 1) => { setApplied(f); setDraft(f); setPage(p); setPicked(new Set()); };
  const goPage = (p: number) => { setPage(clampPage(p, pages, page)); setPicked(new Set()); };
  const togglePick = (id: number) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); };
  const allPicked = rows.length > 0 && rows.every((m) => picked.has(m.id));
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(rows.map((m) => m.id)));

  const setStatus = async (m: Member, status: string) => {
    setMsg({ text: null });
    try {
      await adminApi(`/members/${m.id}/status`, { body: { status: status.toLowerCase() } });
      setMsg({ ok: true, text: `${m.life_id} set to ${status}.` });
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

  const copyId = async (id: string) => {
    try { await navigator.clipboard.writeText(id); setMsg({ ok: true, text: `Copied ${id}` }); } catch { setMsg({ text: "Copy not allowed in this browser." }); }
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
  const openPw = (m: Member) => { setPwFor(m); setPw(""); setPwErr(null); };

  const stat = (cls: string, label: string, n: number | undefined, f: Partial<MemberFilters>) => {
    const on = Object.entries(f).every(([k, v]) => applied[k as keyof MemberFilters] === v) && (Object.keys(f).length > 0 || (!applied.status && !applied.tree_active));
    return (
      <button type="button" className={`ml-stat ml-stat--${cls}`} aria-pressed={on} onClick={() => apply({ ...applied, status: "", tree_active: "", ...f })}>
        <span className="ml-stat__label">{label}</span>
        <span className="ml-stat__value">{counts ? (n ?? 0).toLocaleString() : "…"}</span>
      </button>
    );
  };

  const statusSelect = (m: Member, status: string) => (
    <select value="" aria-label={`Change status for ${m.life_id}`} onChange={(e) => { const v = e.target.value; if (v) void setStatus(m, v); }}>
      <option value="" disabled>Change…</option>
      {STATUSES.filter((s) => s !== status).map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
  const placement = (m: Member) => (m.placement_life_id ? `${m.placement_life_id} · ${m.placement_side === "L" ? "Left" : "Right"}` : "—");
  const loading = q.isFetching && <div className="ml-loading" role="status">Loading…</div>;

  return (
    <Page title="Member List" center>
      <div className="ml-root">
        <div className="ml-stats">
          {stat("total", "Total", counts?.total, {})}
          {stat("active", "Active", counts?.active, { status: "active" })}
          {stat("pending", "Pending", counts?.pending, { status: "pending" })}
          {stat("suspended", "Suspended", counts?.suspended, { status: "suspended" })}
          {stat("tree", "Tree Active", counts?.tree_active, { tree_active: "1" })}
        </div>

        <form className="ml-filters" onSubmit={(e) => { e.preventDefault(); apply(draft); }} aria-label="Member filters">
          <div className="ml-filters__main">
            <label className="ml-field ml-field--search">Search<input type="search" placeholder="Account ID / name / phone / email" value={draft.q} onChange={set("q")} /></label>
            <label className="ml-field">Status<select value={draft.status} onChange={set("status")}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}</select></label>
            <label className="ml-field">Sort<select value={draft.sort} onChange={set("sort")}><option value="new">Newest first</option><option value="old">Oldest first</option><option value="matching">Most matching</option><option value="directs">Most direct sponsors</option><option value="life_id">Account ID A–Z</option></select></label>
            <label className="ml-field">Per Page<select value={draft.per} onChange={set("per")}>{["25", "50", "100", "200", "500"].map((n) => <option key={n}>{n}</option>)}</select></label>
            <div className="ml-actions">
              <button type="submit" className="ml-btn ml-btn--primary">Search</button>
              <button type="button" className="ml-btn" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Fewer filters ▲" : "More filters ▼"}</button>
            </div>
          </div>
          {more && (
            <div className="ml-filters__more">
              <label className="ml-field">Tree Active<select value={draft.tree_active} onChange={set("tree_active")}><option value="">All</option><option value="1">Yes</option><option value="0">No</option></select></label>
              <label className="ml-field">Side<select value={draft.side} onChange={set("side")}><option value="">All</option><option value="L">Left</option><option value="R">Right</option></select></label>
              <label className="ml-field">Rank<select value={draft.rank} onChange={set("rank")}><option value="">All</option><option value="none">No rank</option>{ranks.map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}</select></label>
              <label className="ml-field">ID Type<select value={draft.id_format} onChange={set("id_format")}><option value="">All</option><option value="old">Old site (LID-2026-XXXXXX)</option><option value="new">New site (LID-2026-number)</option><option value="other">Other format</option></select></label>
              <label className="ml-field">Sponsor ID<input type="text" value={draft.sponsor} onChange={set("sponsor")} placeholder="LID-2026-…" /></label>
              <label className="ml-field">Min Matching<input type="number" min={0} value={draft.min_matching} onChange={set("min_matching")} /></label>
              <label className="ml-field">Joined From<input type="date" value={draft.from} onChange={set("from")} /></label>
              <label className="ml-field">Joined To<input type="date" value={draft.to} onChange={set("to")} /></label>
            </div>
          )}
          <div className="ml-filters__foot">
            <div className="ml-chips" aria-label="Active filters">
              {tags.map((t) => (
                <span key={t.key} className="ml-chip">{t.label}<button type="button" aria-label={`Remove ${t.label}`} onClick={() => apply({ ...applied, [t.key]: "" })}>×</button></span>
              ))}
              {tags.length > 0 && <button type="button" className="ml-link" onClick={() => apply({ ...EMPTY_FILTERS, sort: applied.sort, per: applied.per })}>Clear all</button>}
            </div>
            <div className="ml-actions">
              <button type="button" className="ml-btn" onClick={() => apply(EMPTY_FILTERS)}>Reset</button>
              <button type="button" className="ml-btn" disabled={busy} onClick={exportCsv}>{busy ? "Working…" : "⬇ Export CSV"}</button>
            </div>
          </div>
        </form>

        <div className="ml-toolbar">
          <div className="ml-bulk">
            <span><b>{picked.size}</b> selected</span>
            <select value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Bulk status"><option value="">Set status…</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <button type="button" className="ml-btn" disabled={!bulk || picked.size === 0 || busy} onClick={bulkStatus}>Apply</button>
          </div>
          <Pager page={page} pages={pages} onGo={goPage} />
        </div>

        <Msg {...msg} />
        {q.error ? <p className="ml-error">{(q.error as Error).message}</p> : (
          <>
            <div className="ml-tablewrap">
              {loading}
              <table className="ml-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" aria-label="Select all on this page" checked={allPicked} onChange={toggleAll} /></th>
                    <th className="num">Sl</th><th>Member</th><th>Contact</th><th>Sponsor / Placement</th>
                    <th className="num">Directs</th><th className="num">Matching</th><th>Rank</th><th>Tree</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && !q.isFetching && <tr><td colSpan={11} className="ml-empty">No member found for these filters.</td></tr>}
                  {rows.map((m, i) => {
                    const status = String(m.status ?? "").toUpperCase();
                    const active = Number(m.is_active) === 1;
                    return (
                      <tr key={m.id} className={picked.has(m.id) ? "is-picked" : undefined}>
                        <td><input type="checkbox" aria-label={`Select ${m.life_id}`} checked={picked.has(m.id)} onChange={() => togglePick(m.id)} /></td>
                        <td className="num">{serialNo(offset, i).toLocaleString()}</td>
                        <td>
                          <span className="ml-id">{m.life_id}<button type="button" className="ml-copy" aria-label={`Copy ${m.life_id}`} onClick={() => copyId(m.life_id)}>⧉</button></span>
                          <span className="ml-sub">{m.name ?? "—"} · {fmtDateShort(m.created_at)}</span>
                        </td>
                        <td className="nowrap">{m.phone}<span className="ml-sub">{m.email ?? "—"}</span></td>
                        <td className="nowrap">{m.sponsor_life_id ?? "—"}<span className="ml-sub">{placement(m)}</span></td>
                        <td className="num">{Number(m.directs).toLocaleString()}</td>
                        <td className="num">{Number(m.lifetime_matchings).toLocaleString()}</td>
                        <td>{m.rank_name ? <span className="ml-badge ml-badge--rank">{m.rank_name}</span> : "—"}</td>
                        <td><span className={`ml-badge ml-badge--${active ? "yes" : "no"}`}>{active ? "YES" : "NO"}</span></td>
                        <td><span className={statusClass(status)}>{status}</span></td>
                        <td>
                          <div className="ml-row-actions">
                            {statusSelect(m, status)}
                            <button type="button" className="ml-btn ml-btn--sm" onClick={() => openPw(m)} aria-label={`Set new password for ${m.life_id}`}>Password</button>
                            <button type="button" className="ml-btn ml-btn--sm ml-btn--primary" onClick={() => loginAs(m)} aria-label={`Login as ${m.life_id}`}>Login</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="ml-cards">
              {loading}
              {rows.length > 0 && <label className="ml-selectall"><input type="checkbox" checked={allPicked} onChange={toggleAll} /> Select all on this page</label>}
              {rows.length === 0 && !q.isFetching && <div className="ml-empty">No member found for these filters.</div>}
              {rows.map((m, i) => {
                const status = String(m.status ?? "").toUpperCase();
                const active = Number(m.is_active) === 1;
                return (
                  <article key={m.id} className={`ml-card${picked.has(m.id) ? " is-picked" : ""}`} aria-label={m.life_id}>
                    <div className="ml-card__top">
                      <input type="checkbox" aria-label={`Select ${m.life_id}`} checked={picked.has(m.id)} onChange={() => togglePick(m.id)} />
                      <div className="ml-card__who">
                        <div className="ml-card__sl">#{serialNo(offset, i).toLocaleString()} · {fmtDateShort(m.created_at)}</div>
                        <div className="ml-card__name">{m.name ?? "—"}</div>
                        <span className="ml-id">{m.life_id}<button type="button" className="ml-copy" aria-label={`Copy ${m.life_id}`} onClick={() => copyId(m.life_id)}>⧉</button></span>
                        <div className="ml-card__badges">
                          <span className={statusClass(status)}>{status}</span>
                          <span className={`ml-badge ml-badge--${active ? "yes" : "no"}`}>TREE {active ? "ACTIVE" : "INACTIVE"}</span>
                          {m.rank_name && <span className="ml-badge ml-badge--rank">{m.rank_name}</span>}
                        </div>
                      </div>
                    </div>
                    <dl className="ml-card__grid">
                      <div><dt>Phone</dt><dd>{m.phone}</dd></div>
                      <div><dt>Email</dt><dd>{m.email ?? "—"}</dd></div>
                      <div><dt>Sponsor</dt><dd>{m.sponsor_life_id ?? "—"}</dd></div>
                      <div><dt>Placement</dt><dd>{placement(m)}</dd></div>
                      <div><dt>Directs</dt><dd>{Number(m.directs).toLocaleString()}</dd></div>
                      <div><dt>Total Matching</dt><dd>{Number(m.lifetime_matchings).toLocaleString()}</dd></div>
                    </dl>
                    <div className="ml-card__actions">
                      {statusSelect(m, status)}
                      <button type="button" className="ml-btn" onClick={() => openPw(m)} aria-label={`Set new password for ${m.life_id}`}>Password</button>
                      <button type="button" className="ml-btn ml-btn--primary" onClick={() => loginAs(m)} aria-label={`Login as ${m.life_id}`}>Login</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="ml-toolbar">
          <span className="ml-summary">{counts ? `Showing ${counts.total ? serialNo(offset, 0).toLocaleString() : 0}–${(offset + rows.length).toLocaleString()} of ${counts.total.toLocaleString()}` : ""}</span>
          <Pager page={page} pages={pages} onGo={goPage} />
        </div>
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

function Pager({ page, pages, onGo }: { page: number; pages: number; onGo: (p: number) => void }) {
  const [jump, setJump] = useState("");
  const go = () => { if (jump.trim()) { onGo(clampPage(jump, pages, page)); setJump(""); } };
  return (
    <nav className="ml-pager" aria-label="Pages">
      <button type="button" className="ml-btn ml-pager__first" disabled={page <= 1} onClick={() => onGo(1)}>« First</button>
      <button type="button" className="ml-btn" disabled={page <= 1} onClick={() => onGo(page - 1)} aria-label="Previous page">‹ Prev</button>
      <span className="ml-pager__info">Page <b>{page.toLocaleString()}</b> of {pages.toLocaleString()}</span>
      <button type="button" className="ml-btn" disabled={page >= pages} onClick={() => onGo(page + 1)} aria-label="Next page">Next ›</button>
      <button type="button" className="ml-btn ml-pager__last" disabled={page >= pages} onClick={() => onGo(pages)}>Last »</button>
      <input type="number" min={1} max={pages} value={jump} onChange={(e) => setJump(e.target.value)} placeholder="Go to" aria-label="Go to page" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />
      <button type="button" className="ml-btn ml-btn--icon" onClick={go} aria-label="Go">→</button>
    </nav>
  );
}
