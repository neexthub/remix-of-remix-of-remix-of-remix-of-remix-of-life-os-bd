import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Msg, Page, useMember } from "@/components/member-kit";
import { Button } from "@/components/ui/button";
import { memberApi } from "@/lib/member-api";

export const Route = createFileRoute("/member/tree")({
  head: () => ({ meta: [{ title: "Binary Tree — Life OS Member" }, { name: "description", content: "Life OS binary tree." }, { property: "og:title", content: "Binary Tree — Life OS Member" }, { property: "og:description", content: "Life OS binary tree." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Tree,
});

type Node = {
  user_id: number; life_id: string; active: boolean; left_carry: number; right_carry: number;
  full_name?: string | null; sponsor_life_id?: string | null; purchased?: number; left_total?: number; right_total?: number; left_points?: number; right_points?: number; matched?: number;
  has_left?: boolean; has_right?: boolean;
  left: Node | null; right: Node | null;
};

const money = (v?: number) => (Number(v) || 0).toFixed(2);
const num = (v?: number) => String(Math.round(Number(v) || 0));
const ZMIN = 0.2, ZMAX = 2;
const clampZ = (z: number) => Math.min(ZMAX, Math.max(ZMIN, Math.round(z * 100) / 100));

type Ctx = {
  openId: number | null; setOpenId: (id: number | null) => void;
  onPick: (n: Node) => void;
  more: Record<string, Node>; loading: Record<string, boolean>; loadMore: (n: Node) => void;
};

/** One member: photo (tap shows the info box), then name and User ID underneath. */
function Person({ n, c }: { n: Node; c: Ctx }) {
  const open = c.openId === n.user_id;
  return (
    <span className={`lo-node${open ? " open" : ""}`}>
      <Button variant="reference" size="reference" type="button" className="lo-tree-control" aria-label={`Details for ${n.life_id}`} aria-expanded={open} aria-describedby={`tree-info-${n.user_id}`} onClick={() => c.setOpenId(open ? null : n.user_id)}>
        <img src="/member-kit/neel/blank.png" alt="" className="bt-photo" style={{ opacity: n.active ? 0.9 : 0.6 }} />
      </Button>
      <span className="bt-name" title={n.full_name ?? ""}>{n.full_name || "—"}</span>
      <a href="#" className="bt-id" onClick={(e) => { e.preventDefault(); c.setOpenId(null); c.onPick(n); }}>ID: {n.life_id}</a>
      <span className="tooltip" id={`tree-info-${n.user_id}`} role="tooltip" onClick={() => c.setOpenId(null)}>
        <b>Full Name: <span>{n.full_name ?? ""}</span></b><br />
        <b>Sponsored By: <span>{n.sponsor_life_id ?? ""}</span></b><br />
        <b>Purchased : <span>{money(n.purchased)}</span></b><br />
        <b>Left Total Points: <span>{num(n.left_points)}</span></b><br />
        <b>Right Total Points: <span>{num(n.right_points)}</span></b><br />
        <b>Left Members: <span>{num(n.left_total)}</span></b><br />
        <b>Right Members: <span>{num(n.right_total)}</span></b><br />
        <b>Total Matched: <span>{num(n.matched)}</span></b><br />
        <b>Left Carry: <span>{num(n.left_carry)}</span></b><br />
        <b>Right Carry: <span>{num(n.right_carry)}</span></b><br />
      </span>
    </span>
  );
}

function Register({ parent, side }: { parent: Node; side: "L" | "R" }) {
  const href = `/join?ref=${encodeURIComponent(parent.life_id)}&team=${side}`;
  return (
    <span className="lo-node bt-empty">
      <a href={href}><img src="/member-kit/neel/blank.png" alt="" className="bt-photo" style={{ opacity: 0.35 }} /></a>
      <a href={href} className="bt-id">Register</a>
    </span>
  );
}

/** Recursive branch: every loaded level is drawn; deeper levels load on tap ("Show more").
 * The <li> wrapper comes from the parent so empty slots and members share the same connector lines. */
function BranchInner({ n, c }: { n: Node; c: Ctx }) {
  const full = c.more[n.life_id] ?? n;
  const unloaded = (full.has_left && !full.left) || (full.has_right && !full.right);
  return (
    <>
      <Person n={full} c={c} />
      {unloaded ? (
        <div className="bt-more">
          <button type="button" onClick={() => c.loadMore(full)} disabled={!!c.loading[full.life_id]}>
            {c.loading[full.life_id] ? "Loading…" : "▼ Show more"}
          </button>
        </div>
      ) : (
        <ul>
          <li>{full.left ? <BranchInner n={full.left} c={c} /> : <Register parent={full} side="L" />}</li>
          <li>{full.right ? <BranchInner n={full.right} c={c} /> : <Register parent={full} side="R" />}</li>
        </ul>
      )}
    </>
  );
}

function Tree() {
  const q = useMember<Node | null>("tree", "/tree/binary");
  const [root, setRoot] = useState<Node | null>(null);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [more, setMore] = useState<Record<string, Node>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  // Tapping anywhere outside a member closes the open info box (touch screens have no hover-out).
  useEffect(() => {
    if (openId === null) return;
    const close = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.(".lo-node")) setOpenId(null); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenId(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [openId]);

  const top = root ?? q.data ?? null;

  /** Change zoom while keeping the point (px, py) inside the scroll box still. */
  const zoomTo = (next: number, px?: number, py?: number) => {
    const el = box.current;
    const z = zoomRef.current;
    const nz = clampZ(next);
    if (!el || nz === z) return;
    const ax = px ?? el.clientWidth / 2, ay = py ?? el.clientHeight / 2;
    const k = nz / z;
    const sl = (el.scrollLeft + ax) * k - ax, st = (el.scrollTop + ay) * k - ay;
    zoomRef.current = nz;
    setZoom(nz);
    requestAnimationFrame(() => { el.scrollLeft = sl; el.scrollTop = st; });
  };

  /** Fit the whole tree width into the box, then centre on the top member. */
  const fit = () => {
    const el = box.current, t = inner.current;
    if (!el || !t) return;
    const w = t.scrollWidth / zoomRef.current;
    const nz = clampZ(Math.min(1, (el.clientWidth - 16) / w));
    zoomRef.current = nz;
    setZoom(nz);
    requestAnimationFrame(() => { el.scrollTop = 0; el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; });
  };

  // Centre the top member horizontally whenever a new tree is shown.
  useEffect(() => {
    const el = box.current;
    if (!el || !top) return;
    requestAnimationFrame(() => { el.scrollTop = 0; el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; });
  }, [top?.life_id, q.dataUpdatedAt]);

  // Ctrl + wheel and trackpad pinch zoom the tree (not the page); two-finger pinch on touch screens.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const local = (x: number, y: number) => { const r = el.getBoundingClientRect(); const s = r.width / el.offsetWidth || 1; return [(x - r.left) / s, (y - r.top) / s] as const; };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const [x, y] = local(e.clientX, e.clientY);
      zoomTo(zoomRef.current * Math.exp(-dy * 0.002), x, y);
    };
    let pinch: { d: number; z: number } | null = null;
    const dist = (t: TouchList) => { const a = t.item(0), b = t.item(1); return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 1; };
    const onStart = (e: TouchEvent) => { if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoomRef.current }; };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const a = e.touches.item(0), b = e.touches.item(1);
      if (!a || !b) return;
      const [x, y] = local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
      zoomTo(pinch.z * (dist(e.touches) / pinch.d), x, y);
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinch = null; };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  const loadMore = async (n: Node) => {
    setLoading((s) => ({ ...s, [n.life_id]: true }));
    try {
      const sub = await memberApi<Node>(`/tree/binary?root=${encodeURIComponent(n.life_id)}`);
      if (sub) setMore((s) => ({ ...s, [n.life_id]: sub }));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading((s) => ({ ...s, [n.life_id]: false }));
    }
  };

  const view = async (id: string) => {
    setOpenId(null);
    if (!id) return;
    try {
      const sub = await memberApi<Node>(`/tree/binary?root=${encodeURIComponent(id)}`);
      setMsg(null);
      setRoot(sub);
    } catch {
      setMsg("User not found in your tree");
    }
  };

  const c: Ctx = { openId, setOpenId, onPick: (n) => { setSearch(n.life_id); void view(n.life_id); }, more, loading, loadMore };

  return (
    <Page title="Binary View">
      <Msg text={q.error ? (q.error as Error).message : msg} />
      <div className="bt-toolbar">
        <form onSubmit={(e) => { e.preventDefault(); void view(search.trim()); }}>
          <input type="text" aria-label="Search User ID" size={14} placeholder="User ID" value={search} onChange={(e) => setSearch(e.target.value)} />{" "}
          <input type="submit" value="View tree" />
        </form>
        <div className="bt-zoom" role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom out" onClick={() => zoomTo(zoomRef.current - 0.1)}>−</button>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => zoomTo(zoomRef.current + 0.1)}>+</button>
          <button type="button" onClick={fit}>Full tree</button>
          <button type="button" onClick={() => zoomTo(1)}>100%</button>
        </div>
      </div>
      <div className="bt-back">
        <Button variant="reference" size="reference" type="button" className="lo-tree-control" aria-label="Back to my tree" title="Back to my tree" onClick={() => { setRoot(null); setSearch(""); setMsg(null); setOpenId(null); }}><img className="link_img" src="/member-kit/neel/tree-arrow-down.png" alt="" style={{ width: 80 }} /></Button>
      </div>
      <div ref={box} className="bt-scroll" role="region" aria-label="Binary tree — scroll to see every member" tabIndex={0}>
        <div ref={inner} className="bt-tree" style={{ zoom }}>
          {!top ? (
            <p className="bt-empty-note">{q.isLoading ? "Loading…" : "No tree data yet."}</p>
          ) : (
            <ul><li><BranchInner n={top} c={c} /></li></ul>
          )}
        </div>
      </div>
      <p className="bt-hint">Scroll down and sideways to see the whole tree. Use + / − or pinch to zoom. Tap “Show more” to open deeper levels.</p>
    </Page>
  );
}
