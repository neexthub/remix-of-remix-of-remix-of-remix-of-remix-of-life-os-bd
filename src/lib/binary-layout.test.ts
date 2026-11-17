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
  it("near view draws limited levels but keeps whole-team active totals", () => {
    const chain: TreeRow[] = Array.from({ length: 30 }, (_, i) => [i + 1, String(i + 1), null, i % 2, i < 29 ? i + 2 : null, null]);
    const l = layoutBinary(chain, 1, 4);
    expect(l.nodes).toHaveLength(5); expect(l.byId.get(1)?.leftActive).toBe(15); expect(l.byId.get(5)?.hiddenBelow).toBe(25);
  });
  it("reveals the area reached by zoom and pan", () => {
    const l = layoutBinary(rows, 1), deep = l.byId.get(4);
    expect(visibleMembers(l, { x: 0, y: 0, k: 1 }, 300, 100).some((n) => n.row[0] === 4)).toBe(false);
    expect(visibleMembers(l, { x: -(deep?.x ?? 0) + 150, y: -(deep?.y ?? 0) + 50, k: 1 }, 300, 100).some((n) => n.row[0] === 4)).toBe(true);
  });
});
import { autoOpenCandidates, baseLevelsFor, layoutExpandable, placeJoinPath, slotId } from "./binary-layout";
describe("expandable tree with empty positions", () => {
  const team: TreeRow[] = [[1, "ROOT", "Root", 1, 2, null], [2, "LEFT", "Left", 1, null, 3], [3, "LR", "Deep", 1, null, null]];
  it("shows an empty Right position beside a member that only has a Left member", () => {
    const l = layoutExpandable(team, 1, 1, new Set(), true);
    const empty = l.byId.get(slotId(1, "R"));
    expect(empty?.slot).toEqual({ parentId: 1, parentLifeId: "ROOT", side: "R" });
    expect(empty!.x).toBeGreaterThan(l.byId.get(2)!.x);
  });
  it("hides deeper members until opened, then shows them", () => {
    const closed = layoutExpandable(team, 1, 1, new Set(), true);
    expect(closed.byId.has(3)).toBe(false); expect(closed.byId.get(2)?.hiddenBelow).toBe(1);
    const opened = layoutExpandable(team, 1, 1, new Set([2]), true);
    expect(opened.byId.has(3)).toBe(true); expect(opened.byId.get(slotId(2, "L"))?.slot?.side).toBe("L");
  });
  it("opens only collapsed members that are well inside the screen at a readable size", () => {
    const l = layoutExpandable(team, 1, 1, new Set(), true), m = l.byId.get(2)!;
    const centred = { x: 400 - m.x, y: 300 - m.y, k: 1 };
    expect(autoOpenCandidates(l, centred, 800, 600)).toEqual([2]);
    expect(autoOpenCandidates(l, { ...centred, k: 0.2 }, 800, 600)).toEqual([]);
    expect(autoOpenCandidates(l, { x: -m.x - 500, y: 0, k: 1 }, 800, 600)).toEqual([]);
    expect(autoOpenCandidates(l, { ...centred, y: 560 - m.y }, 800, 600)).toEqual([]);
  });
  it("a member with nobody below shows both empty positions even beyond the first levels", () => {
    const l = layoutExpandable(team, 1, 1, new Set([2]), true);
    expect(l.byId.get(slotId(3, "L"))?.slot?.side).toBe("L"); expect(l.byId.get(slotId(3, "R"))?.slot?.side).toBe("R");
    expect(layoutExpandable(team, 1, 1, new Set([2]), false).byId.has(slotId(3, "L"))).toBe(false);
  });
  it("phones draw fewer first levels than computers", () => {
    expect(baseLevelsFor(390)).toBe(2); expect(baseLevelsFor(1280)).toBe(3);
  });
  it("the + link opens the Register Form at that exact position", () => {
    expect(placeJoinPath("LID-2026-937CCC", { parentId: 9, parentLifeId: "LID-2026-AAA", side: "R" })).toBe("/join?ref=LID-2026-937CCC&team=R&place=LID-2026-AAA");
  });
});
