import { Link } from "@tanstack/react-router";
import { DataTable, useMember } from "@/components/member-kit";
import { bdt } from "@/lib/member-api";

type Person = { life_id: string; name: string };
type MatchingPart = { old_site: number; new: number; amount: number };

export type MemberSummary = {
  member: Person & {
    sponsor: Person | null;
    placement: (Person & { side: "L" | "R" }) | null;
    active: boolean;
    status: string;
    joined_at: string | null;
    activation: {
      activation_code: string;
      payment_ref: string | null;
      payment_status: string | null;
      created_at: string | null;
      processed_at: string | null;
      activated_at?: string | null;
      business_date: string | null;
      closed: boolean;
    } | null;
  };
  genealogy: { directs: number; directs_active: number };
  matching: {
    binary: MatchingPart;
    enrollment: MatchingPart;
    total: number;
    rank_matching: number;
    last_closing: string | null;
    daily_approved: number;
    cap: number;
    cap_used: number;
    cap_remaining: number;
    left_carry: number;
    right_carry: number;
    major_side: "L" | "R";
    major_balance: number;
    minor_side: "L" | "R";
    minor_daily_count: number;
    today: string;
    today_left_new: number;
    today_right_new: number;
  };
  commission: {
    referral: number;
    generation: number;
    matching: number;
    other: number;
    cashback: number;
    pending: number;
    paid: number;
    generation_levels: {
      label: string;
      level: number;
      rate: number;
      count: number;
      amount: number;
    }[];
  };
  rank: { name: string; required_matchings: number } | null;
};

export type BinaryDetails = {
  left_total: number;
  right_total: number;
  left_active: number;
  right_active: number;
};

export function useMemberSummary() {
  return useMember<MemberSummary>("summary", "/summary");
}

const sideName = (side: "L" | "R" | undefined) =>
  side === "L" ? "Left" : side === "R" ? "Right" : "—";

const personName = (person: Person | null | undefined) =>
  person ? `${person.life_id} (${person.name})` : "—";

export function MatchingInformation() {
  const q = useMemberSummary();
  const d = q.data;
  const m = d?.matching;
  const split = (part: MatchingPart | undefined) =>
    part ? `Old site ${part.old_site} · New ${part.new}` : "—";

  return (
    <section>
      <h3>Matching Information</h3>
      {q.isPending && <p>Loading matching information…</p>}
      {q.error && <p role="alert">{q.error.message}</p>}
      {d && (
        <>
          <DataTable
            head={["Description", "Count / Balance", "Amount"]}
            rows={[
              ["Enrollment Matching", split(m?.enrollment), bdt(m?.enrollment.amount)],
              ["Binary Matching", split(m?.binary), bdt(m?.binary.amount)],
              [
                "Daily Approved Matching",
                m?.daily_approved ?? 0,
                `Last closing: ${m?.last_closing ?? "Not closed yet"}`,
              ],
              ["Daily Capping Used", bdt(m?.cap_used), `Cap: ${bdt(m?.cap)}`],
              ["Daily Remaining Cap", bdt(m?.cap_remaining), ""],
              ["Major Link Balance", m?.major_balance ?? 0, sideName(m?.major_side)],
              ["Minor Link Daily Count", m?.minor_daily_count ?? 0, sideName(m?.minor_side)],
              ["Carry Forward Balance", `Left ${m?.left_carry ?? 0}`, `Right ${m?.right_carry ?? 0}`],
              ["Total Matching", m?.total ?? 0, ""],
              ["Rank Matching", m?.rank_matching ?? 0, ""],
              ["Current Rank", d.rank?.name ?? "No Rank Yet", ""],
            ]}
          />
          <p>Minor Link Daily Count resets to 0 at 12:00 AM Bangladesh time.</p>
        </>
      )}
    </section>
  );
}

export function MemberDashboardSummary() {
  const q = useMemberSummary();
  const tree = useMember<BinaryDetails | null>(
    "binary-details",
    "/tree/binary?details=1",
  );
  const d = q.data;
  const member = d?.member;
  const activation = member?.activation;
  const commission = d?.commission;

  return (
    <>
      <section>
        <h3>Member Information</h3>
        {q.isPending && <p>Loading member information…</p>}
        {q.error && <p role="alert">{q.error.message}</p>}
        {d && (
          <DataTable
            head={["Description", "Details"]}
            rows={[
              ["Member ID", member?.life_id ?? "—"],
              ["Member Name", member?.name ?? "—"],
              ["Sponsor ID", personName(member?.sponsor)],
              [
                "Placement ID",
                member?.placement
                  ? `${personName(member.placement)} · ${sideName(member.placement.side)}`
                  : "—",
              ],
              ["Activation Status", member?.active ? "Active" : "Pending"],
              ["Joining Date", member?.joined_at ?? "—"],
              ["Activation Date", activation?.activated_at ?? activation?.processed_at ?? "—"],
              ["Transaction ID", activation?.payment_ref ?? "—"],
              ["Payment Status", activation?.payment_status ?? "—"],
            ]}
          />
        )}
      </section>

      <section>
        <h3>Genealogy Information</h3>
        {d && (
          <DataTable
            head={["Description", "Details"]}
            rows={[
              [
                "Direct Sponsored Members",
                `${d.genealogy?.directs ?? 0} total · ${d.genealogy?.directs_active ?? 0} active`,
              ],
              [
                "Left Team Count",
                tree.data
                  ? `${tree.data.left_total} total · ${tree.data.left_active} active`
                  : "—",
              ],
              [
                "Right Team Count",
                tree.data
                  ? `${tree.data.right_total} total · ${tree.data.right_active} active`
                  : "—",
              ],
            ]}
          />
        )}
        {tree.isPending && <p>Loading team counts…</p>}
        {tree.error && <p role="alert">{tree.error.message}</p>}
        <p>
          <Link to="/member/enrollment">Enrollment Tree</Link>
          {" · "}
          <Link to="/member/tree">Binary Tree</Link>
        </p>
      </section>

      <MatchingInformation />

      <section>
        <h3>Commission Information</h3>
        {commission && (
          <DataTable
            head={["Description", "Amount"]}
            rows={[
              ["Direct Referral", bdt(commission.referral)],
              ["Generation", bdt(commission.generation)],
              ["Matching", bdt(commission.matching)],
              ["Other Eligible", bdt(commission.other)],
              ["Pending (tonight's closing, estimated)", bdt(commission.pending)],
              ["Paid", bdt(commission.paid)],
            ]}
          />
        )}
        <p>
          Direct referral is paid instantly. Matching and generation are paid
          after the 12:00 AM (Bangladesh) daily closing.
        </p>
        <p><Link to="/member/commission">Commission History</Link></p>
      </section>
    </>
  );
}

export function GenerationCommission() {
  const q = useMemberSummary();

  return (
    <section>
      <h3>Generation Commission (10 levels)</h3>
      {q.isPending && <p>Loading generation commission…</p>}
      {q.error && <p role="alert">{q.error.message}</p>}
      {q.data && (
        <DataTable
          head={["Generation", "Rate (৳)", "Count", "Amount"]}
          rows={Array.from({ length: 10 }, (_, index) => {
            const level = index + 1;
            const row = q.data.commission?.generation_levels?.find(
              (entry) => Number(entry.level) === level,
            );
            return [
              `GEN-${String(level).padStart(2, "0")}`,
              bdt(row?.rate),
              row?.count ?? 0,
              bdt(row?.amount),
            ];
          })}
        />
      )}
    </section>
  );
}
