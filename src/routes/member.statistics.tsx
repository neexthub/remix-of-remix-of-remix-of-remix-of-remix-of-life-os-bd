import { createFileRoute } from "@tanstack/react-router";
import { DataTable, Page, useMember } from "@/components/member-kit";
import { MatchingInformation, useMemberSummary } from "@/components/member-summary";

export const Route = createFileRoute("/member/statistics")({
  head: () => ({ meta: [{ title: "Statistics View — Life OS Member" }, { name: "description", content: "Life OS team statistics." }, { property: "og:title", content: "Statistics View — Life OS Member" }, { property: "og:description", content: "Life OS team statistics." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Stats,
});

type Node = { left_total: number; right_total: number; left_active: number; right_active: number; left_carry: number; right_carry: number; left_points?: number; right_points?: number };

function Stats() {
  const t = useMember<Node | null>("tree", "/tree/binary").data ?? null;
  const rank = useMember<{ lifetime_matchings: number; current: { name?: string } | null; next?: { name?: string; required_matchings?: number } | null }>("rank", "/rank").data;
  const summary = useMemberSummary().data;
  const L = { all: t?.left_total ?? 0, active: t?.left_active ?? 0 }, R = { all: t?.right_total ?? 0, active: t?.right_active ?? 0 };
  return (
    <Page title="Statistics View">
      <DataTable
        style={{ marginTop: 10 }}
        caption={<u>Current Rank: {summary?.rank?.name ?? rank?.current?.name ?? "Free Member"}</u>}
        head={["On The Position", "Left Team", "Right Team"]}
        rows={[
          ["Total Members", L.all, R.all],
          ["Active Members", L.active, R.active],
          ["Inactive Members", L.all - L.active, R.all - R.active],
          ["Total Points (BV)", t?.left_points ?? 0, t?.right_points ?? 0],
          ["Carry Forward", t?.left_carry ?? 0, t?.right_carry ?? 0],
          ["Binary Matching", `Old site ${summary?.matching.binary.old_site ?? 0} · New ${summary?.matching.binary.new ?? 0}`, ""],
          ["Enrollment Matching", `Old site ${summary?.matching.enrollment.old_site ?? 0} · New ${summary?.matching.enrollment.new ?? 0}`, ""],
          ["Total Matching", summary?.matching.total ?? rank?.lifetime_matchings ?? 0, ""],
          ["Rank Matching", summary?.matching.rank_matching ?? rank?.lifetime_matchings ?? 0, ""],
        ]}
      />
      <p style={{ marginTop: 10 }}>
        Current Rank: {summary?.rank?.name ?? rank?.current?.name ?? "No Rank Yet"}.
        {rank?.next?.name ? ` Next Rank: ${rank.next.name} — ${rank.next.required_matchings ?? 0} total matching required.` : ""}
      </p>
      <MatchingInformation />
    </Page>
  );
}
