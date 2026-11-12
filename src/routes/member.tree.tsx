import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom as createZoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { Maximize, Minus, Plus, RotateCcw } from "lucide-react";
import { Msg, Page, useMember } from "@/components/member-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { memberApi } from "@/lib/member-api";
import { layoutBinary, subtreeTotals, visibleMembers, type TreeRow, type PositionedMember } from "@/lib/binary-layout";
import { memberKitAsset } from "@/lib/member-kit-assets";

export const Route = createFileRoute("/member/tree")({
  head: () => ({ meta: [{ title: "Full Binary Tree — Life OS Member" }, { name: "description", content: "Your complete Life OS binary team, member details and active team totals." }, { property: "og:title", content: "Full Binary Tree — Life OS Member" }, { property: "og:description", content: "Your complete Life OS binary team, member details and active team totals." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Tree,
});
type Overview = { root_id: number; members: TreeRow[] };
type Details = { full_name: string; sponsor_life_id: string; purchased: number; matched: number; active: boolean; left_active: number; right_active: number; left_points: number; right_points: number; left_carry: number; right_carry: number };
const integer = (n: number) => Number(n || 0).toLocaleString("en-US");
const NEAR_LEVELS = 4;

function Tree() {
  const q = useMember<Overview>("binary-overview", "/tree/binary?overview=1");
  const rows = q.data?.members ?? [];
  const totals = useMemo(() => subtreeTotals(q.data?.members ?? []), [q.data]);
  const layout = useMemo(() => layoutBinary(q.data?.members ?? [], q.data?.root_id ?? 0, Infinity, totals), [q.data, totals]);
  const box = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ width: 950, height: 620 });
  const [search, setSearch] = useState(""), [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<PositionedMember | null>(null), [details, setDetails] = useState<Details | null>(null);
  const [busy, setBusy] = useState(false);
  // Near view: a readable few levels around one member; Full view: the whole network map.
  const [mode, setMode] = useState<"near" | "full">("near");
  const [focusId, setFocusId] = useState<number | null>(null);
  const centerId = focusId ?? q.data?.root_id ?? 0;
  const currentLayout = useMemo(() => mode === "full" ? layout : layoutBinary(rows, centerId, NEAR_LEVELS, totals), [mode, layout, rows, centerId, totals]);
  const shown = useMemo(() => view.k >= 0.22 ? visibleMembers(currentLayout, view, size.width, size.height).slice(0, 650) : [], [currentLayout, view, size]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const behavior = createZoom<HTMLDivElement, unknown>().scaleExtent([0.0005, 2.5])
      .extent(() => [[0, 0], [el.clientWidth, el.clientHeight]])
      .filter((event) => !event.target.closest?.("button,a") && !event.button)
      .on("zoom", (event) => setView({ x: event.transform.x, y: event.transform.y, k: event.transform.k }));
    controller.current = behavior;
    const selection = select(el);
    selection.call(behavior).on("dblclick.zoom", null);
    const observer = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    observer.observe(el);
    return () => { observer.disconnect(); selection.on(".zoom", null); controller.current = null; };
  }, []);

  const fit = () => {
    const el = box.current, behavior = controller.current;
    if (!el || !behavior || !currentLayout.nodes.length) return;
    const k = Math.max(mode === "near" ? 0.3 : 0.0005, Math.min(1, (el.clientWidth - 40) / currentLayout.width, (el.clientHeight - 40) / currentLayout.height));
    select(el).call(behavior.transform, zoomIdentity.translate((el.clientWidth - currentLayout.width * k) / 2, 24).scale(k));
  };
  useEffect(() => { if (currentLayout.nodes.length) fit(); }, [currentLayout]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = size.width * dpr; el.height = size.height * dpr;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, size.width, size.height);
    const css = getComputedStyle(el);
    const line = css.getPropertyValue("--lo-tree-line").trim(), active = css.getPropertyValue("--lo-success").trim(), inactive = css.getPropertyValue("--lo-rule").trim();
    ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.k, view.k);
    ctx.strokeStyle = line; ctx.lineWidth = Math.max(1, 1 / view.k);
    ctx.beginPath();
    for (const n of currentLayout.nodes) {
      for (const id of [n.row[4], n.row[5]]) {
        const c = id === null ? undefined : currentLayout.byId.get(id);
        if (!c) continue;
        const ax = n.x * view.k + view.x, bx = c.x * view.k + view.x, ay = n.y * view.k + view.y, by = c.y * view.k + view.y;
        if (Math.max(ax, bx) < -100 || Math.min(ax, bx) > size.width + 100 || by < -100 || ay > size.height + 100) continue;
        ctx.moveTo(n.x, n.y + 20); ctx.lineTo(n.x, (n.y + c.y) / 2); ctx.lineTo(c.x, (n.y + c.y) / 2); ctx.lineTo(c.x, c.y - 28);
      }
    }
    ctx.stroke();
    for (const n of visibleMembers(currentLayout, view, size.width, size.height)) {
      ctx.fillStyle = n.row[3] ? active : inactive;
      ctx.beginPath(); ctx.arc(n.x, n.y, Math.max(4, 1.6 / view.k), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }, [currentLayout, view, size]);

  const openBranch = (n: PositionedMember) => { setFocusId(n.row[0]); setMode("near"); };
  const pick = async (n: PositionedMember) => {
    setSelected(n); setDetails(null); setBusy(true);
    try { setDetails(await memberApi<Details>(`/tree/binary?root=${encodeURIComponent(n.row[1])}&details=1`)); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  };
  // Buttons zoom toward the top member when it is on screen (the full map is mostly empty space elsewhere).
  const changeZoom = (factor: number) => {
    const el = box.current, behavior = controller.current;
    if (!el || !behavior) return;
    const top = currentLayout.byId.get(centerId);
    const px = top ? view.x + top.x * view.k : NaN, py = top ? view.y + top.y * view.k : NaN;
    const onScreen = px >= 0 && px <= el.clientWidth && py >= 0 && py <= el.clientHeight;
    select(el).call(behavior.scaleBy, factor, onScreen ? [px, py] : [el.clientWidth / 2, el.clientHeight / 2]);
  };
  const find = () => {
    const value = search.trim().toLowerCase();
    const n = layout.nodes.find((n) => n.row[1].toLowerCase() === value || String(n.row[0]) === value)
      ?? layout.nodes.find((n) => n.row[2]?.toLowerCase().includes(value));
    if (!n || !value) { setMessage("Member not found in your tree"); return; }
    setMessage(null); openBranch(n);
  };
  return <Page title="Binary View">
    <Msg text={q.error ? (q.error as Error).message : message} />
    <div className="bt-toolbar">
      <form onSubmit={(e) => { e.preventDefault(); find(); }}><input aria-label="Search Account ID or name" placeholder="Account ID / name" value={search} onChange={(e) => setSearch(e.target.value)} /><Button variant="reference" size="reference" type="submit">Find member</Button></form>
      <div className="bt-zoom" role="group" aria-label="Zoom">
        <Button variant="reference" size="reference" aria-label="Zoom out" title="Zoom out" onClick={() => changeZoom(1 / 1.5)}><Minus size={18} /></Button>
        <span aria-live="polite">{view.k < 0.01 ? (view.k * 100).toFixed(2) : Math.round(view.k * 100)}%</span>
        <Button variant="reference" size="reference" aria-label="Zoom in" title="Zoom in" onClick={() => changeZoom(1.5)}><Plus size={18} /></Button>
        <Button variant="reference" size="reference" aria-label="Full tree" title="Full tree" onClick={() => { if (mode === "full") fit(); else setMode("full"); }}><Maximize size={18} /></Button>
        <Button variant="reference" size="reference" aria-label="Back to my tree" title="My account" onClick={() => { setFocusId(null); setMode("near"); }}><RotateCcw size={18} /></Button>
      </div>
    </div>
    {q.data ? (() => { const t = totals.get(centerId); return <div className="bt-summary" aria-live="polite">{integer(t?.all ?? 0)} Members <span>{mode === "full" ? "Full tree — zoom in to see names" : `Showing ${NEAR_LEVELS} levels — tap an ID to go deeper`}</span><span>Active {integer(t?.active ?? 0)}</span></div>; })() : <div className="bt-summary" role="status">Loading full tree…</div>}
    <div ref={box} className="bt-surface" style={{ position: "relative", height: 760, width: "100%", overflow: "hidden", touchAction: "none" }} role="region" aria-label="Full binary tree" tabIndex={0} onKeyDown={(e) => {
      if (!box.current || !controller.current) return;
      const move: Record<string, [number, number]> = { ArrowLeft: [100 / view.k, 0], ArrowRight: [-100 / view.k, 0], ArrowUp: [0, 100 / view.k], ArrowDown: [0, -100 / view.k] };
      const delta = move[e.key];
      if (delta) { e.preventDefault(); select(box.current).call(controller.current.translateBy, delta[0], delta[1]); }
    }}>
      <canvas ref={canvas} className="bt-canvas" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true" />
      {shown.map((n) => <div key={n.row[0]} className={`bt-member ${n.row[3] ? "bt-active" : "bt-inactive"}`} style={{ position: "absolute", top: 0, left: 0, width: 120, margin: "-38px 0 0 -60px", transformOrigin: "60px 38px", display: "flex", flexDirection: "column", alignItems: "center", transform: `translate(${view.x + n.x * view.k}px, ${view.y + n.y * view.k}px) scale(${view.k})` }}>
        <Button variant="reference" size="reference" aria-label={`Details for ${n.row[1]}`} className="lo-tree-control" onClick={() => void pick(n)}><img src={memberKitAsset("/member-kit/neel/blank.png")} alt="" width={56} height={60} /></Button>
        <span className="bt-name" title={n.row[2] ?? ""}>{n.row[2] || "—"}</span>
        <Button variant="reference" size="reference" className="bt-id" onClick={() => openBranch(n)}>ID: {n.row[1]}</Button>
        {n.hiddenBelow > 0 && mode === "near" && <Button variant="reference" size="reference" className="bt-below" onClick={() => openBranch(n)}>▼ {integer(n.hiddenBelow)} below</Button>}
      </div>)}
      {!layout.nodes.length && <p className="bt-empty-note">{q.isLoading ? "Loading…" : "No tree data"}</p>}
    </div>
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="bt-member-dialog"><DialogTitle>{selected?.row[2] || selected?.row[1]}</DialogTitle><DialogDescription>Account ID: {selected?.row[1]} · {selected?.row[3] ? "Active" : "Inactive"}</DialogDescription>
        <dl className="bt-member-details">
          <dt>Left Active Members</dt><dd>{integer(selected?.leftActive ?? 0)}</dd><dt>Right Active Members</dt><dd>{integer(selected?.rightActive ?? 0)}</dd>
          {details && <><dt>Sponsored By</dt><dd>{details.sponsor_life_id || "—"}</dd><dt>Total Matching</dt><dd>{integer(details.matched)}</dd><dt>Left Total Points</dt><dd>{integer(details.left_points)}</dd><dt>Right Total Points</dt><dd>{integer(details.right_points)}</dd><dt>Purchased</dt><dd>{integer(details.purchased)}</dd><dt>Left Carry</dt><dd>{integer(details.left_carry)}</dd><dt>Right Carry</dt><dd>{integer(details.right_carry)}</dd></>}
        </dl>{busy && <p role="status">Loading…</p>}
        <Button variant="outline" onClick={() => { if (selected) openBranch(selected); setSelected(null); }}>View this member’s tree</Button>
      </DialogContent>
    </Dialog>
  </Page>;
}
