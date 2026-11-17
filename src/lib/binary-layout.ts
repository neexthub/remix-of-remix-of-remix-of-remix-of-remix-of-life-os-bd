import { hierarchy, tree } from "d3-hierarchy";

export type TreeRow = [number, string, string | null, number, number | null, number | null];
export type PositionedMember = { row: TreeRow; x: number; y: number; leftActive: number; rightActive: number; leftTotal: number; rightTotal: number; hiddenBelow: number };
export type TreeLayout = { nodes: PositionedMember[]; byId: Map<number, PositionedMember>; width: number; height: number };
type Totals = Map<number, { all: number; active: number }>;

/** Full-subtree member/active totals for every member, independent of how many levels are drawn. */
export function subtreeTotals(rows: TreeRow[]): Totals {
  const data = new Map(rows.map((row) => [row[0], row]));
  const totals: Totals = new Map();
  for (const row of rows) {
    if (totals.has(row[0])) continue;
    const stack: [number, boolean][] = [[row[0], false]];
    const visiting = new Set<number>();
    while (stack.length) {
      const [id, done] = stack.pop()!;
      const r = data.get(id);
      if (!r || totals.has(id)) continue;
      if (done) {
        const a = r[4] === null ? undefined : totals.get(r[4]), b = r[5] === null ? undefined : totals.get(r[5]);
        totals.set(id, { all: 1 + (a?.all ?? 0) + (b?.all ?? 0), active: (r[3] ? 1 : 0) + (a?.active ?? 0) + (b?.active ?? 0) });
        continue;
      }
      if (visiting.has(id)) continue;
      visiting.add(id);
      stack.push([id, true]);
      for (const c of [r[4], r[5]]) if (c !== null && !totals.has(c) && !visiting.has(c)) stack.push([c, false]);
    }
  }
  return totals;
}

/** Tidy binary layout from rootId; maxDepth limits drawn levels (totals always cover the whole subtree). */
export function layoutBinary(rows: TreeRow[], rootId: number, maxDepth = Infinity, totals: Totals = subtreeTotals(rows)): TreeLayout {
  const data = new Map(rows.map((row) => [row[0], row]));
  const root = data.get(rootId);
  if (!root) return { nodes: [], byId: new Map(), width: 1, height: 1 };
  const seen = new Set<number>([root[0]]);
  const depthOf = new Map<number, number>([[root[0], 0]]);
  const h = hierarchy<TreeRow>(root, (row) => {
    const depth = depthOf.get(row[0]) ?? 0;
    if (depth >= maxDepth) return [];
    return [row[4], row[5]].flatMap((id) => {
      const child = id === null ? undefined : data.get(id);
      if (!child || seen.has(child[0])) return [];
      seen.add(child[0]); depthOf.set(child[0], depth + 1);
      return [child];
    });
  });
  tree<TreeRow>().nodeSize([142, 150])(h);
  const all = h.descendants();
  const minX = Math.min(...all.map((n) => n.x ?? 0));
  const maxX = Math.max(...all.map((n) => n.x ?? 0));
  const nodes = all.map((n) => {
    const l = n.data[4] === null ? undefined : totals.get(n.data[4]), r = n.data[5] === null ? undefined : totals.get(n.data[5]);
    // Keep one-child branches visibly on the correct side of their parent.
    const side = n.parent?.data[4] === n.data[0] ? -28 : 28;
    const hiddenBelow = n.children ? 0 : (l?.all ?? 0) + (r?.all ?? 0);
    return { row: n.data, x: (n.x ?? 0) - minX + 100 + (n.parent?.children?.length === 1 ? side : 0), y: (n.y ?? 0) + 72, leftActive: l?.active ?? 0, rightActive: r?.active ?? 0, leftTotal: l?.all ?? 0, rightTotal: r?.all ?? 0, hiddenBelow };
  });
  return { nodes, byId: new Map(nodes.map((n) => [n.row[0], n])), width: maxX - minX + 240, height: Math.max(...nodes.map((n) => n.y)) + 120 };
}

export function visibleMembers(layout: TreeLayout, view: { x: number; y: number; k: number }, width: number, height: number) {
  const left = (-view.x - 100) / view.k, right = (width - view.x + 100) / view.k;
  const top = (-view.y - 100) / view.k, bottom = (height - view.y + 100) / view.k;
  return layout.nodes.filter((n) => n.x >= left && n.x <= right && n.y >= top && n.y <= bottom);
}

/** An empty Left/Right position under a drawn member, shown as a faint "+" card. */
export type EmptySlot = { parentId: number; parentLifeId: string; side: "L" | "R" };
export type TreeNode = PositionedMember & { slot?: EmptySlot | undefined; depth: number };
export type ExpandLayout = { nodes: TreeNode[]; byId: Map<number, TreeNode>; width: number; height: number };

export const NODE_W = 150, NODE_H = 170;
/** Stable negative id for an empty slot so it can animate like a member. */
export const slotId = (parentId: number, side: "L" | "R") => -(parentId * 2 + (side === "R" ? 1 : 0));

/**
 * Expandable tidy layout: the first `baseLevels` levels below rootId plus every member in `open`
 * show their children. Drawn members with a free Left/Right position get an empty-slot card
 * (only when `slots` is on), so one-child members keep the child on its real side.
 */
export function layoutExpandable(rows: TreeRow[], rootId: number, baseLevels: number, open: ReadonlySet<number>, slots: boolean, totals: Totals = subtreeTotals(rows)): ExpandLayout {
  const data = new Map(rows.map((row) => [row[0], row]));
  const root = data.get(rootId);
  if (!root) return { nodes: [], byId: new Map(), width: 1, height: 1 };
  type Item = { row: TreeRow; depth: number; slot?: EmptySlot };
  const seen = new Set<number>([root[0]]);
  const h = hierarchy<Item>({ row: root, depth: 0 }, (item) => {
    if (item.slot) return [];
    const { row, depth } = item;
    // Members with nobody below always show their two empty positions (+), at any depth.
    const leaf = row[4] === null && row[5] === null;
    if (!(depth < baseLevels || open.has(row[0]) || (slots && leaf))) return [];
    const kids: Item[] = [];
    (["L", "R"] as const).forEach((side, i) => {
      const id = row[4 + i] as number | null;
      const child = id === null ? undefined : data.get(id);
      if (child && !seen.has(child[0])) { seen.add(child[0]); kids.push({ row: child, depth: depth + 1 }); }
      else if (!child && slots) kids.push({ row: [slotId(row[0], side), "", null, 0, null, null], depth: depth + 1, slot: { parentId: row[0], parentLifeId: row[1], side } });
    });
    return kids;
  });
  tree<Item>().nodeSize([NODE_W, NODE_H]).separation((a, b) => (a.parent === b.parent ? 1 : 1.12))(h);
  const all = h.descendants();
  const minX = Math.min(...all.map((n) => n.x ?? 0));
  const maxX = Math.max(...all.map((n) => n.x ?? 0));
  const nodes: TreeNode[] = all.map((n) => {
    const r = n.data.row;
    const l = r[4] === null ? undefined : totals.get(r[4]), rt = r[5] === null ? undefined : totals.get(r[5]);
    const lone = !slots && n.parent?.children?.length === 1 ? (n.parent.data.row[4] === r[0] ? -32 : 32) : 0;
    const shownKids = (n.children ?? []).filter((c) => !c.data.slot).length;
    const hiddenBelow = n.data.slot || shownKids ? 0 : (l?.all ?? 0) + (rt?.all ?? 0);
    return { row: r, depth: n.data.depth, slot: n.data.slot, x: (n.x ?? 0) - minX + NODE_W + lone, y: (n.y ?? 0) + 90, leftActive: l?.active ?? 0, rightActive: rt?.active ?? 0, leftTotal: l?.all ?? 0, rightTotal: rt?.all ?? 0, hiddenBelow };
  });
  return { nodes, byId: new Map(nodes.map((n) => [n.row[0], n])), width: maxX - minX + NODE_W * 2, height: Math.max(...nodes.map((n) => n.y)) + NODE_H };
}

/**
 * Collapsed members (with hidden team below) that sit well inside the screen at a readable size.
 * Panning toward a side opens these so that side's tree grows into view automatically.
 */
export function autoOpenCandidates(layout: ExpandLayout, view: { x: number; y: number; k: number }, width: number, height: number, minK = 0.45, limit = 6): number[] {
  if (view.k < minK) return [];
  const my = height * 0.08;
  return layout.nodes
    .filter((n) => !n.slot && n.hiddenBelow > 0)
    .map((n) => ({ n, sx: view.x + n.x * view.k, sy: view.y + n.y * view.k }))
    // Its members below would appear on (or just above) the screen: horizontally near the screen and
    // with their row above the bottom edge. Members far above stay closed, matching staleOpen's margin
    // so a branch never opens and closes in a loop.
    .filter(({ sx, sy }) => sx >= -width * 0.3 && sx <= width * 1.3 && sy + NODE_H * view.k >= -height * 0.4 && sy + NODE_H * view.k * 0.9 <= height - my)
    .sort((a, b) => Math.abs(a.sx - width / 2) - Math.abs(b.sx - width / 2) || a.sy - b.sy)
    .slice(0, limit)
    .map(({ n }) => n.row[0]);
}

/**
 * Levels drawn first: as many as the screen can show at the member's size, so the bottom row
 * still fits across and every level fits down (at least 2, at most 6).
 */
export function baseLevelsFor(screenWidth: number, screenHeight = 10_000, k = 1): number {
  const across = Math.floor(Math.log2(Math.max(1, screenWidth / (NODE_W * k)))) + 1;
  const down = Math.floor((screenHeight - 40) / (NODE_H * k));
  return Math.max(2, Math.min(6, across, down));
}

/**
 * Opened members whose branch the member has moved away from: neither they nor anything drawn
 * under them is on (or within half a screen of) the screen. Closing them keeps only the area
 * being viewed built, so the old area is removed and the new one can grow.
 */
export function staleOpen(layout: ExpandLayout, open: ReadonlySet<number>, parentOf: ReadonlyMap<number, number>, view: { x: number; y: number; k: number }, width: number, height: number): number[] {
  if (!open.size) return [];
  const mx = width * 0.5, my = height * 0.5;
  const needed = new Set<number>();
  for (const n of layout.nodes) {
    const sx = view.x + n.x * view.k, sy = view.y + n.y * view.k;
    if (sx < -mx || sx > width + mx || sy < -my || sy > height + my) continue;
    let id: number | undefined = n.slot ? n.slot.parentId : n.row[0];
    while (id !== undefined && !needed.has(id)) { needed.add(id); id = parentOf.get(id); }
  }
  if (!needed.size) return [];
  return [...open].filter((id) => !needed.has(id));
}

/** Register Form link that puts the new member exactly into an empty tree position. */
export function placeJoinPath(sponsorLifeId: string, slot: EmptySlot) {
  return `/join?${new URLSearchParams({ ref: sponsorLifeId, team: slot.side, place: slot.parentLifeId }).toString()}`;
}
