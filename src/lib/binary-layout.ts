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
