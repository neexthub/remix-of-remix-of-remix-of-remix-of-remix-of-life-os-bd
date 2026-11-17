import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom as createZoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { Expand, Map as MapIcon, Maximize, Minus, Plus, RotateCcw, Shrink } from "lucide-react";
import { Msg, Page, useMember } from "@/components/member-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { memberApi } from "@/lib/member-api";
import { autoOpenCandidates, baseLevelsFor, layoutBinary, layoutExpandable, placeJoinPath, subtreeTotals, visibleMembers, type ExpandLayout, type TreeNode, type TreeRow } from "@/lib/binary-layout";
import { memberKitAsset } from "@/lib/member-kit-assets";
import "@/components/member/binary-tree.css";

export const Route = createFileRoute("/member/tree")({
  head: () => ({ meta: [{ title: "Binary Tree — Life OS Member" }, { name: "description", content: "Your Life OS binary team: readable member cards, zoom, auto-opening branches and + to add a member at any empty position." }, { property: "og:title", content: "Binary Tree — Life OS Member" }, { property: "og:description", content: "Your Life OS binary team: readable member cards, zoom, auto-opening branches and + to add a member at any empty position." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Tree,
});

type Overview = { root_id: number; members: TreeRow[] };
type Details = { full_name: string; sponsor_life_id: string; purchased: number; matched: number; active: boolean; left_active: number; right_active: number; left_points: number; right_points: number; left_carry: number; right_carry: number };
type View = { x: number; y: number; k: number };
type Pt = { x: number; y: number };
const integer = (n: number) => Number(n || 0).toLocaleString("en-US");
const SIZE_KEY = "lo_tree_member_size";
const MIN_K = 0.3, MAX_K = 2.2, CARD_MIN_K = 0.26, ANIM_MS = 420, MAX_DRAWN = 3500;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

function Tree() {
  const q = useMember<Overview>("binary-overview", "/tree/binary?overview=1");
  const rows = q.data?.members ?? [];
  const myId = q.data?.root_id ?? 0;
  const myLifeId = useMemo(() => rows.find((r) => r[0] === myId)?.[1] ?? "", [rows, myId]);
  const totals = useMemo(() => subtreeTotals(q.data?.members ?? []), [q.data]);
  const parentOf = useMemo(() => { const m = new Map<number, number>(); for (const r of rows) { if (r[4] !== null) m.set(r[4], r[0]); if (r[5] !== null) m.set(r[5], r[0]); } return m; }, [rows]);

  const root = useRef<HTMLDivElement>(null), box = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view); viewRef.current = view;
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [mode, setMode] = useState<"near" | "full">("near");
  const [focusId, setFocusId] = useState<number | null>(null);
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const [auto, setAuto] = useState(true);
  const [search, setSearch] = useState(""), [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<TreeNode | null>(null), [details, setDetails] = useState<Details | null>(null), [busy, setBusy] = useState(false);
  const [found, setFound] = useState<number | null>(null);
  const [isFull, setIsFull] = useState(false);
  const [pref, setPref] = useState<number | null>(null);
  const centerId = focusId ?? myId;
  const base = baseLevelsFor(size.width);

  const fullLayout = useMemo(() => mode === "full" ? layoutBinary(rows, myId, Infinity, totals) : null, [mode, rows, myId, totals]);
  const near = useMemo<ExpandLayout>(() => layoutExpandable(rows, centerId, base, open, true, totals), [rows, centerId, base, open, totals]);
  const layout: ExpandLayout = mode === "full" && fullLayout ? (fullLayout as ExpandLayout) : near;

  // ---- animation: members glide from where they were to their new place; new ones grow out of their parent ----
  const shownPos = useRef<Map<number, Pt>>(new Map());
  const anim = useRef<{ from: Map<number, Pt>; start: number } | null>(null);
  const anchor = useRef<{ id: number; at: Pt } | null>(null);
  const pendingCenter = useRef<number | null>(null);
  const [, setFrame] = useState(0);
  const prevLayout = useRef<ExpandLayout | null>(null);

  useLayoutEffect(() => {
    const before = prevLayout.current;
    prevLayout.current = layout;
    if (!before || mode === "full" || !layout.nodes.length) { anim.current = null; return; }
    const from = new Map(shownPos.current);
    const a = anchor.current; anchor.current = null;
    if (a) {
      const now = layout.byId.get(a.id);
      const el = box.current, behavior = controller.current;
      if (now && el && behavior) {
        const dx = now.x - a.at.x, dy = now.y - a.at.y;
        // Keep the opened member where it was on screen; shift remembered positions the same way.
        select(el).call(behavior.translateBy, -dx, -dy);
        for (const [id, p] of from) from.set(id, { x: p.x + dx, y: p.y + dy });
      }
    }
    anim.current = { from, start: performance.now() };
    let raf = 0;
    const step = () => { setFrame((f) => f + 1); if (anim.current && performance.now() - anim.current.start < ANIM_MS) raf = requestAnimationFrame(step); else { anim.current = null; setFrame((f) => f + 1); } };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [layout, mode]);

  const t = anim.current ? ease(Math.min(1, (performance.now() - anim.current.start) / ANIM_MS)) : 1;
  const pos = useCallback((n: TreeNode): Pt & { o: number } => {
    const a = anim.current;
    if (!a || t >= 1) return { x: n.x, y: n.y, o: 1 };
    const parent = n.slot ? n.slot.parentId : parentOf.get(n.row[0]);
    const f = a.from.get(n.row[0]) ?? (parent !== undefined ? a.from.get(parent) : undefined);
    if (!f) return { x: n.x, y: n.y, o: t };
    return { x: f.x + (n.x - f.x) * t, y: f.y + (n.y - f.y) * t, o: a.from.has(n.row[0]) ? 1 : t };
  }, [t, parentOf]);

  // Remember what is on screen this frame (used as the start of the next animation).
  const positions = useMemo(() => { const m = new Map<number, Pt & { o: number }>(); for (const n of layout.nodes) m.set(n.row[0], pos(n)); return m; }, [layout, pos]);
  useEffect(() => { shownPos.current = new Map([...positions].map(([id, p]) => [id, { x: p.x, y: p.y }])); }, [positions]);

  // ---- zoom / pan ----
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const behavior = createZoom<HTMLDivElement, unknown>().scaleExtent([0.0005, MAX_K])
      .extent(() => [[0, 0], [el.clientWidth, el.clientHeight]])
      .filter((event) => !event.target.closest?.("button,a,input") && !event.button)
      .on("zoom", (event) => setView({ x: event.transform.x, y: event.transform.y, k: event.transform.k }));
    controller.current = behavior;
    const selection = select(el);
    selection.call(behavior).on("dblclick.zoom", null);
    const observer = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    observer.observe(el);
    return () => { observer.disconnect(); selection.on(".zoom", null); controller.current = null; };
  }, []);
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(SIZE_KEY));
    setPref(saved >= MIN_K && saved <= MAX_K ? saved : window.innerWidth < 600 ? 0.8 : 1);
    const onFs = () => setIsFull(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Smoothly move the view to a target transform.
  const glide = useCallback((target: View, ms = 450) => {
    const el = box.current, behavior = controller.current;
    if (!el || !behavior) return;
    const from = viewRef.current, start = performance.now();
    const go = (v: View) => select(el).call(behavior.transform, zoomIdentity.translate(v.x, v.y).scale(v.k));
    const step = () => {
      const p = ease(Math.min(1, (performance.now() - start) / ms));
      go({ x: from.x + (target.x - from.x) * p, y: from.y + (target.y - from.y) * p, k: from.k + (target.k - from.k) * p });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);
  const centerOn = useCallback((n: { x: number; y: number }, k: number, top = false) => {
    const el = box.current;
    if (!el) return;
    glide({ k, x: el.clientWidth / 2 - n.x * k, y: top ? 26 + 62 * k - n.y * k : el.clientHeight / 2 - n.y * k });
  }, [glide]);
  const fitAll = useCallback(() => {
    const el = box.current;
    if (!el || !layout.nodes.length) return;
    const k = Math.max(mode === "full" ? 0.0005 : MIN_K, Math.min(1.2, (el.clientWidth - 40) / layout.width, (el.clientHeight - 40) / layout.height));
    glide({ k, x: (el.clientWidth - layout.width * k) / 2, y: 20 });
  }, [layout, mode, glide]);

  // New focus member (or first load): show it at the top in the comfortable size.
  const lastFocus = useRef<string>("");
  useEffect(() => {
    if (!layout.nodes.length || pref === null) return;
    const key = `${mode}:${centerId}`;
    if (lastFocus.current === key) return;
    lastFocus.current = key;
    if (mode === "full") { fitAll(); return; }
    const top = layout.byId.get(centerId);
    if (top) centerOn(top, pref, true);
  }, [layout, mode, centerId, pref, centerOn, fitAll]);

  // After a search opened the path, glide to the found member.
  useEffect(() => {
    const id = pendingCenter.current;
    if (id === null) return;
    const n = layout.byId.get(id);
    if (!n) return;
    pendingCenter.current = null;
    centerOn(n, Math.max(viewRef.current.k, pref ?? 1));
  }, [layout, centerOn, pref]);

  const openMembers = useCallback((ids: number[], anchorId?: number) => {
    if (!ids.length) return;
    const a = anchorId ?? ids[0]!;
    const p = shownPos.current.get(a) ?? layout.byId.get(a);
    if (p) anchor.current = { id: a, at: { x: p.x, y: p.y } };
    setOpen((cur) => { const n = new Set(cur); ids.forEach((id) => n.add(id)); return n; });
  }, [layout]);

  // Panning toward any side opens that side's collapsed members so the tree keeps growing into view.
  useEffect(() => {
    if (!auto || mode !== "near" || layout.nodes.length > MAX_DRAWN) return;
    const timer = window.setTimeout(() => {
      if (anim.current) return;
      const ids = autoOpenCandidates(layout, viewRef.current, size.width, size.height, 0.45, 6);
      if (ids.length) openMembers(ids);
    }, 380);
    return () => window.clearTimeout(timer);
  }, [view, layout, size, auto, mode, openMembers]);

  // ---- connectors and far-zoom dots on a canvas ----
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = size.width * dpr; el.height = size.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size.width, size.height);
    const css = getComputedStyle(el);
    const line = css.getPropertyValue("--bt-line").trim() || "#093F89", soft = css.getPropertyValue("--bt-line-soft").trim() || "#9fb4d6";
    const on = css.getPropertyValue("--bt-active").trim() || "#0a8a3a", off = css.getPropertyValue("--bt-inactive").trim() || "#8a94a3";
    ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.k, view.k);
    const lw = Math.max(1, 2 / Math.max(view.k, 0.5)) * (view.k < CARD_MIN_K ? 0.6 : 1);
    const cardH = view.k >= CARD_MIN_K ? 62 : 6;
    const inView = (ax: number, bx: number, ay: number, by: number) => !(Math.max(ax, bx) * view.k + view.x < -200 || Math.min(ax, bx) * view.k + view.x > size.width + 200 || by * view.k + view.y < -200 || ay * view.k + view.y > size.height + 200);
    const draw = (dashed: boolean) => {
      ctx.beginPath();
      ctx.strokeStyle = dashed ? soft : line; ctx.lineWidth = lw; ctx.setLineDash(dashed ? [6, 5] : []);
      for (const n of layout.nodes) {
        if (n.slot) continue;
        const pn = positions.get(n.row[0]) ?? n;
        const kids: { id: number }[] = [];
        for (const side of ["L", "R"] as const) {
          const id = n.row[side === "L" ? 4 : 5];
          if (id !== null && !dashed) kids.push({ id });
          if (id === null && dashed) kids.push({ id: -(n.row[0] * 2 + (side === "R" ? 1 : 0)) });
        }
        for (const { id } of kids) {
          const c = positions.get(id);
          if (!c || !inView(pn.x, c.x, pn.y, c.y)) continue;
          const mid = (pn.y + cardH + c.y - cardH) / 2;
          ctx.moveTo(pn.x, pn.y + cardH); ctx.lineTo(pn.x, mid); ctx.lineTo(c.x, mid); ctx.lineTo(c.x, c.y - cardH);
        }
      }
      ctx.stroke();
    };
    draw(false); if (mode === "near" && view.k >= CARD_MIN_K) draw(true);
    ctx.setLineDash([]);
    if (view.k < CARD_MIN_K) {
      for (const n of visibleMembers(layout, view, size.width, size.height)) {
        const tn = n as TreeNode;
        if (tn.slot) continue;
        ctx.fillStyle = n.row[3] ? on : off;
        ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(4, 2.2 / view.k), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }, [layout, positions, view, size, mode]);

  // ---- actions ----
  const zoomTo = (k: number, save = true) => {
    const el = box.current, behavior = controller.current;
    if (!el || !behavior) return;
    const nk = clampK(k);
    select(el).call(behavior.scaleTo, nk, [el.clientWidth / 2, el.clientHeight / 2]);
    if (save) { setPref(nk); window.localStorage.setItem(SIZE_KEY, String(nk)); }
  };
  const focusMember = (id: number) => { setMode("near"); setOpen(new Set()); setFocusId(id === myId ? null : id); };
  const pick = async (n: TreeNode) => {
    setSelected(n); setDetails(null); setBusy(true);
    try { setDetails(await memberApi<Details>(`/tree/binary?root=${encodeURIComponent(n.row[1])}&details=1`)); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  };
  const find = () => {
    const value = search.trim().toLowerCase();
    const r = value ? rows.find((r) => r[1].toLowerCase() === value || String(r[0]) === value) ?? rows.find((r) => r[2]?.toLowerCase().includes(value) || r[1].toLowerCase().includes(value)) : undefined;
    if (!r) { setMessage("Member not found in your tree"); return; }
    setMessage(null);
    // Open every member on the way down so the found member appears in place.
    const path: number[] = [];
    let cur = parentOf.get(r[0]), inFocus = false;
    while (cur !== undefined) { path.push(cur); if (cur === centerId) { inFocus = true; break; } cur = parentOf.get(cur); }
    if (!inFocus && r[0] !== centerId) { setFocusId(null); lastFocus.current = `near:${myId}`; }
    setMode("near");
    setOpen((o) => { const n = new Set(inFocus ? o : []); path.forEach((id) => n.add(id)); return n; });
    pendingCenter.current = r[0];
    setFound(r[0]); window.setTimeout(() => setFound(null), 3600);
  };
  const toggleFull = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen(); }
    catch { setMessage("Full screen is not available in this browser."); }
  };

  const showCards = view.k >= CARD_MIN_K;
  const shown = useMemo(() => (showCards ? visibleMembers(layout, view, size.width, size.height).slice(0, 700) as TreeNode[] : []), [layout, view, size, showCards]);
  const focusTotals = totals.get(centerId);
  const blank = memberKitAsset("/member-kit/neel/blank.png");

  return <Page title="Binary Tree">
    <div ref={root} className="bt2-root">
      <Msg text={q.error ? (q.error as Error).message : message} />
      <div className="bt2-bar">
        <form className="bt2-search" onSubmit={(e) => { e.preventDefault(); find(); }}>
          <input aria-label="Search Account ID or name" placeholder="Find Account ID or name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="submit" className="bt2-btn bt2-btn--primary">Find</button>
        </form>
        <div className="bt2-tools" role="group" aria-label="Tree controls">
          <button type="button" className="bt2-btn bt2-btn--icon" aria-label="Smaller members" title="Smaller" onClick={() => zoomTo(view.k / 1.25)}><Minus size={18} /></button>
          <label className="bt2-size" title="Member size">
            <span className="sr-only">Member size</span>
            <input type="range" min={MIN_K} max={MAX_K} step={0.05} value={clampK(view.k)} aria-label="Member size" onChange={(e) => zoomTo(Number(e.target.value))} />
            <output aria-live="polite">{view.k < 0.01 ? (view.k * 100).toFixed(2) : Math.round(view.k * 100)}%</output>
          </label>
          <button type="button" className="bt2-btn bt2-btn--icon" aria-label="Bigger members" title="Bigger" onClick={() => zoomTo(view.k * 1.25)}><Plus size={18} /></button>
          <button type="button" className="bt2-btn bt2-btn--icon" aria-label="Fit tree on screen" title="Fit on screen" onClick={fitAll}><Maximize size={18} /></button>
          <button type="button" className="bt2-btn bt2-btn--label" aria-pressed={mode === "full"} title="Whole network map" onClick={() => setMode(mode === "full" ? "near" : "full")}><MapIcon size={17} /><span>Full map</span></button>
          <button type="button" className="bt2-btn bt2-btn--label" title="Back to my tree" onClick={() => { focusMember(myId); lastFocus.current = ""; }}><RotateCcw size={17} /><span>My tree</span></button>
          <button type="button" className="bt2-btn bt2-btn--icon" aria-label={isFull ? "Exit full screen" : "Full screen"} title={isFull ? "Exit full screen" : "Full screen"} onClick={() => void toggleFull()}>{isFull ? <Shrink size={18} /> : <Expand size={18} />}</button>
        </div>
      </div>
      {q.data ? <div className="bt2-summary" aria-live="polite">
        <span><b>{integer(focusTotals?.all ?? 0)}</b> members</span>
        <span><b>{integer(focusTotals?.active ?? 0)}</b> active</span>
        <span className="bt2-legend"><i className="bt2-dot bt2-dot--on" /> Active</span>
        <span className="bt2-legend"><i className="bt2-dot bt2-dot--off" /> Inactive</span>
        {mode === "near" && <span className="bt2-legend"><i className="bt2-dot bt2-dot--slot" /> Empty position — tap + to add</span>}
        {mode === "near" && <label className="bt2-legend"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-open while moving</label>}
      </div> : <div className="bt2-summary" role="status">Loading your tree…</div>}

      <div ref={box} className="bt2-surface" role="region" aria-label="Binary tree. Drag to move, pinch or use the size slider to resize." tabIndex={0} onKeyDown={(e) => {
        if (!box.current || !controller.current) return;
        const move: Record<string, [number, number]> = { ArrowLeft: [120 / view.k, 0], ArrowRight: [-120 / view.k, 0], ArrowUp: [0, 120 / view.k], ArrowDown: [0, -120 / view.k] };
        const delta = move[e.key];
        if (delta) { e.preventDefault(); select(box.current).call(controller.current.translateBy, delta[0], delta[1]); }
        if (e.key === "+" || e.key === "=") zoomTo(view.k * 1.25);
        if (e.key === "-") zoomTo(view.k / 1.25);
      }}>
        <canvas ref={canvas} className="bt2-canvas" aria-hidden="true" />
        {shown.map((n) => {
          const p = positions.get(n.row[0]) ?? { x: n.x, y: n.y, o: 1 };
          const style = { transform: `translate(${view.x + p.x * view.k}px, ${view.y + p.y * view.k}px) scale(${view.k})`, opacity: p.o };
          if (n.slot) {
            const side = n.slot.side === "L" ? "Left" : "Right";
            return <div key={n.row[0]} className="bt2-node" style={style}>
              <Link className="bt2-slot" to="/join" search={{ ref: myLifeId, team: n.slot.side, place: n.slot.parentLifeId }} aria-label={`Add a new member on the ${side} of ${n.slot.parentLifeId}`} title={placeJoinPath(myLifeId, n.slot)}>
                <span className="bt2-ghost" aria-hidden="true" /><span className="bt2-plus" aria-hidden="true">+</span>
                <span className="bt2-slot-label">Add {side}</span>
                <span className="bt2-slot-sub">under {n.slot.parentLifeId}</span>
              </Link>
            </div>;
          }
          const on = !!n.row[3];
          return <div key={n.row[0]} className="bt2-node" style={style}>
            <div className={`bt2-card${on ? " bt2-card--on" : ""}${n.row[0] === myId ? " bt2-card--me" : ""}${found === n.row[0] ? " bt2-card--found" : ""}`}>
              <i className="bt2-status" title={on ? "Active" : "Inactive"} />
              <button type="button" className="bt2-main" onClick={() => void pick(n)} aria-label={`Details for ${n.row[2] || n.row[1]} (${n.row[1]})`}>
                <span className="bt2-avatar"><img src={blank} alt="" width={52} height={52} draggable={false} /></span>
                <span className="bt2-name" title={n.row[2] ?? ""}>{n.row[2] || "—"}</span>
                <span className="bt2-id">{n.row[1]}</span>
              </button>
              <div className="bt2-counts" aria-label="Active members on each side"><span>L <b>{integer(n.leftActive)}</b></span><span>R <b>{integer(n.rightActive)}</b></span></div>
              {mode === "near" && n.hiddenBelow > 0 && <button type="button" className="bt2-more" onClick={() => openMembers([n.row[0]])} aria-label={`Open ${integer(n.hiddenBelow)} members below ${n.row[1]}`}>▼ {integer(n.hiddenBelow)}</button>}
            </div>
          </div>;
        })}
        {!showCards && layout.nodes.length > 0 && <div className="bt2-hint">Zoom in to see names</div>}
        {!layout.nodes.length && <p className="bt2-empty">{q.isLoading ? "Loading…" : "No tree data"}</p>}
      </div>
    </div>

    <Dialog open={selected !== null} onOpenChange={(o) => { if (!o) setSelected(null); }}>
      <DialogContent className="bt-member-dialog"><DialogTitle>{selected?.row[2] || selected?.row[1]}</DialogTitle><DialogDescription>Account ID: {selected?.row[1]} · {selected?.row[3] ? "Active" : "Inactive"}</DialogDescription>
        <dl className="bt-member-details">
          <dt>Left Active Members</dt><dd>{integer(selected?.leftActive ?? 0)}</dd><dt>Right Active Members</dt><dd>{integer(selected?.rightActive ?? 0)}</dd>
          <dt>Left Total Members</dt><dd>{integer(selected?.leftTotal ?? 0)}</dd><dt>Right Total Members</dt><dd>{integer(selected?.rightTotal ?? 0)}</dd>
          {details && <><dt>Sponsored By</dt><dd>{details.sponsor_life_id || "—"}</dd><dt>Total Matching</dt><dd>{integer(details.matched)}</dd><dt>Left Total Points</dt><dd>{integer(details.left_points)}</dd><dt>Right Total Points</dt><dd>{integer(details.right_points)}</dd><dt>Purchased</dt><dd>{integer(details.purchased)}</dd><dt>Left Carry</dt><dd>{integer(details.left_carry)}</dd><dt>Right Carry</dt><dd>{integer(details.right_carry)}</dd></>}
        </dl>{busy && <p role="status">Loading…</p>}
        <Button variant="outline" onClick={() => { if (selected) focusMember(selected.row[0]); setSelected(null); }}>Show this member at the top</Button>
      </DialogContent>
    </Dialog>
  </Page>;
}
