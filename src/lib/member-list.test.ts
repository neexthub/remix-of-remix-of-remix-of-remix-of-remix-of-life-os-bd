import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, memberListQuery, pageCount, serialNo, toCsv } from "./member-list";

describe("member list", () => {
  it("serial number continues across pages", () => {
    expect(serialNo(0, 0)).toBe(1);
    expect(serialNo(100, 0)).toBe(101);
    expect(serialNo(100, 49)).toBe(150);
  });
  it("page count covers every member", () => {
    expect(pageCount(73971, 50)).toBe(1480);
    expect(pageCount(0, 50)).toBe(1);
  });
  it("sends only filled filters", () => {
    expect(memberListQuery({ ...EMPTY_FILTERS, status: "pending", q: " LID " }, 2)).toBe("q=LID&status=pending&sort=new&per=50&page=2");
    expect(memberListQuery(EMPTY_FILTERS, 1, true)).toBe("sort=new&per=50&export=1");
  });
  it("csv keeps commas and quotes", () => {
    expect(toCsv(["A", "B"], [["x,y", 'say "hi"']])).toBe('"A","B"\r\n"x,y","say ""hi"""');
  });
});
