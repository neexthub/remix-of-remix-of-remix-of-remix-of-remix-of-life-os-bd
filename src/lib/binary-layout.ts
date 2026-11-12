import { hierarchy, tree } from "d3-hierarchy";

export type TreeRow = [number, string, string | null, number, number | null, number | null];
export type PositionedMember = { row: TreeRow; x: number; y: number; leftActive: number; rightActive: number; leftTotal: number; rightTotal: number };
export type TreeLayout = { nodes: PositionedMember[]; byId: Map<number, PositionedMember>; width: number; height: number };

export function layoutBinary(rows: TreeRow[], rootId: number): TreeLayout {
  const data = new Map(rows.map((row) => [row[0], row]));
  const root = data.get(rootId);
  if (!root) return { nodes: [], byId: new Map(), width: 1, height: 1 };
  const seen = new Set<number>();
  const h = hierarchy<TreeRow>(root, (row) => {
    if (seen.has(row[0])) return [];
    seen.add(row[0]);
    return [row[4], row[5]].flatMap((id) => {
      const child = id === null ? undefined : data.get(id);
      return child && !seen.has(child[0]) ? [child] : [];
    });
  });
  tree<TreeRow>().nodeSize([142, 150])(h);
  const all = h.descendants();
  const minX = Math.min(...all.map((n) => n.x ?? 0));
  const maxX = Math.max(...all.map((n) => n.x ?? 0));
  const totals = new Map<number, { all: number; active: number }>();
  for (const n of [...all].reverse()) {
    const a = totals.get(n.data[4] ?? -1), b = totals.get(n.data[5] ?? -1);
    totals.set(n.data[0], { all: 1 + (a?.all ?? 0) + (b?.all ?? 0), active: (n.data[3] ? 1 : 0) + (a?.active ?? 0) + (b?.active ?? 0) });
  }
  const nodes = all.map((n) => {
    const l = totals.get(n.data[4] ?? -1), r = totals.get(n.data[5] ?? -1);
    // Keep one-child branches visibly on the correct side of their parent.
    const side = n.parent?.data[4] === n.data[0] ? -28 : 28;
    return { row: n.data, x: (n.x ?? 0) - minX + 100 + (n.parent?.children?.length === 1 ? side : 0), y: (n.y ?? 0) + 72, leftActive: l?.active ?? 0, rightActive: r?.active ?? 0, leftTotal: l?.all ?? 0, rightTotal: r?.all ?? 0 };
  });
  return { nodes, byId: new Map(nodes.map((n) => [n.row[0], n])), width: maxX - minX + 240, height: Math.max(...nodes.map((n) => n.y)) + 120 };
}

export function visibleMembers(layout: TreeLayout, view: { x: number; y: number; k: number }, width: number, height: number) {
  const left = (-view.x - 100) / view.k, right = (width - view.x + 100) / view.k;
  const top = (-view.y - 100) / view.k, bottom = (height - view.y + 100) / view.k;
  return layout.nodes.filter((n) => n.x >= left && n.x <= right && n.y >= top && n.y <= bottom);
}