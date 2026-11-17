// Browser-safe helpers for the admin Member List (filters, serial numbers, CSV).
export type MemberFilters = {
  q: string; status: string; tree_active: string; side: string; rank: string; id_format: string;
  sponsor: string; min_matching: string; from: string; to: string; sort: string; per: string;
};

export const EMPTY_FILTERS: MemberFilters = {
  q: "", status: "", tree_active: "", side: "", rank: "", id_format: "", sponsor: "", min_matching: "", from: "", to: "", sort: "new", per: "50",
};

/** Query string for /member-list: only filled filters are sent. */
export function memberListQuery(f: MemberFilters, page: number, exportAll = false): string {
  const p = new URLSearchParams();
  (Object.keys(f) as (keyof MemberFilters)[]).forEach((k) => { const v = f[k].trim(); if (v !== "") p.set(k, v); });
  if (exportAll) p.set("export", "1"); else p.set("page", String(Math.max(1, page)));
  return p.toString();
}

/** Serial number continues across pages: page 3 with 50 per page starts at 101. */
export const serialNo = (offset: number, index: number) => offset + index + 1;

export const pageCount = (total: number, per: number) => Math.max(1, Math.ceil(total / Math.max(1, per)));

/** CSV with a header row; every cell quoted so commas, quotes and new lines stay intact. */
export function toCsv(head: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

const FILTER_LABELS: Record<Exclude<keyof MemberFilters, "sort" | "per">, string> = {
  q: "Search", status: "Status", tree_active: "Tree Active", side: "Side", rank: "Rank", id_format: "ID Type",
  sponsor: "Sponsor", min_matching: "Min Matching", from: "From", to: "To",
};
const VALUE_LABELS: Partial<Record<keyof MemberFilters, Record<string, string>>> = {
  status: { active: "Active", pending: "Pending", suspended: "Suspended" },
  tree_active: { "1": "Yes", "0": "No" }, side: { L: "Left", R: "Right" },
  id_format: { old: "Old site", new: "New site", other: "Other" },
};

/** Removable chips for every filled filter (sort and page size are not filters). */
export function activeFilters(f: MemberFilters, ranks: { id: number; name: string }[] = []): { key: keyof MemberFilters; label: string }[] {
  return (Object.keys(FILTER_LABELS) as (keyof typeof FILTER_LABELS)[])
    .filter((k) => f[k].trim() !== "")
    .map((k) => {
      const v = f[k].trim();
      const shown = k === "rank" ? (v === "none" ? "No rank" : ranks.find((r) => String(r.id) === v)?.name ?? v) : VALUE_LABELS[k]?.[v] ?? v;
      return { key: k, label: `${FILTER_LABELS[k]}: ${shown}` };
    });
}

/** Clamp a typed page number into 1..pages; anything unreadable stays on the current page. */
export function clampPage(input: string | number, pages: number, current: number): number {
  const n = Math.trunc(Number(input));
  if (!Number.isFinite(n) || String(input).trim() === "") return current;
  return Math.min(Math.max(1, pages), Math.max(1, n));
}
