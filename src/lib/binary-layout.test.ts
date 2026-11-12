import { describe, expect, it } from "vitest";
import { layoutBinary, visibleMembers, type TreeRow } from "./binary-layout";

const rows: TreeRow[] = [[1, "ROOT", "Root", 1, 2, 3], [2, "LEFT", "Inactive parent", 0, 4, null], [3, "RIGHT", "Right", 1, null, null], [4, "DEEP", "Active child", 1, null, null]];
describe("full binary tree", () => {
  it("counts only active descendants including those below an inactive parent", () => {
    const l = layoutBinary(rows, 1), root = l.byId.get(1);
    expect(root?.leftActive).toBe(1); expect(root?.rightActive).toBe(1); expect(root?.leftTotal).toBe(2);
  });
  it("includes every member beyond seven levels without manual expansion", () => {
    const chain: TreeRow[] = Array.from({ length: 30 }, (_, i) => [i + 1, String(i + 1), null, 1, i < 29 ? i + 2 : null, null]);
    const l = layoutBinary(chain, 1);
    expect(l.nodes).toHaveLength(30); expect(l.byId.get(1)?.leftActive).toBe(29);
  });
  it("reveals the area reached by zoom and pan", () => {
    const l = layoutBinary(rows, 1), deep = l.byId.get(4);
    expect(visibleMembers(l, { x: 0, y: 0, k: 1 }, 300, 100).some((n) => n.row[0] === 4)).toBe(false);
    expect(visibleMembers(l, { x: -(deep?.x ?? 0) + 150, y: -(deep?.y ?? 0) + 50, k: 1 }, 300, 100).some((n) => n.row[0] === 4)).toBe(true);
  });
});