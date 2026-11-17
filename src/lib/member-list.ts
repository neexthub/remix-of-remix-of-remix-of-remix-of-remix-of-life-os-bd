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
