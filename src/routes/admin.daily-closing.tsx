import { createFileRoute } from "@tanstack/react-router";
import {
  DataTable,
  fmtDate,
  Msg,
  Page,
  useAdmin,
} from "@/components/admin-kit";
import { Button } from "@/components/ui/button";
import { bdt } from "@/lib/member-api";

export const Route = createFileRoute("/admin/daily-closing")({
  head: () => ({
    meta: [
      { title: "Daily Closing & Errors — Life OS Admin" },
      {
        name: "description",
        content: "Review Life OS daily closings, open activations, and system errors.",
      },
      { property: "og:title", content: "Daily Closing & Errors — Life OS Admin" },
      {
        property: "og:description",
        content: "Review Life OS daily closings, open activations, and system errors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DailyClosing,
});

type Closing = {
  closing_date: string;
  status: "RUNNING" | "DONE";
  activations: number;
  matching_events: number;
  matching_paid: number;
  generation_paid: number;
  started_at: string | null;
  finished_at: string | null;
};

type Closings = {
  closings: Closing[];
  open_today: number;
  waiting_payment_step: number;
};

type SystemError = {
  id: number;
  activation_id: number | null;
  user_id: number | null;
  life_id: string | null;
  code: string;
  message: string;
  created_at: string;
};

function DailyClosing() {
  const closings = useAdmin<Closings>("daily-closings", "/daily-closings");
  const errors = useAdmin<SystemError[]>("system-errors", "/system-errors");

  return (
    <Page title="Daily Closing & Errors">
      <Button
        variant="outline"
        size="sm"
        disabled={closings.isFetching || errors.isFetching}
        onClick={() => {
          void closings.refetch();
          void errors.refetch();
        }}
      >
        Refresh
      </Button>

      <h3>Open Counts</h3>
      <Msg text={closings.error?.message ?? null} />
      {closings.isPending && <p>Loading daily closings…</p>}
      {closings.data && (
        <>
          <DataTable
            head={["Description", "Count"]}
            rows={[
              ["Open Today", closings.data.open_today],
              ["Waiting Payment Step", closings.data.waiting_payment_step],
            ]}
          />
          <h3>Daily Closings</h3>
          <DataTable
            head={[
              "Closing Date",
              "Status",
              "Activations",
              "Matching Events",
              "Matching Paid",
              "Generation Paid",
              "Started",
              "Finished",
            ]}
            rows={(closings.data.closings ?? []).map((row) => [
              row.closing_date,
              row.status,
              row.activations,
              row.matching_events,
              bdt(row.matching_paid),
              bdt(row.generation_paid),
              row.started_at ? fmtDate(row.started_at) : "—",
              row.finished_at ? fmtDate(row.finished_at) : "—",
            ])}
          />
        </>
      )}

      <h3>System Error Log</h3>
      <Msg text={errors.error?.message ?? null} />
      {errors.isPending && <p>Loading system errors…</p>}
      {errors.data && (
        <DataTable
          head={[
            "ID",
            "Activation ID",
            "User ID",
            "Member ID",
            "Code",
            "Message",
            "Created",
          ]}
          rows={errors.data.map((row) => [
            row.id,
            row.activation_id ?? "—",
            row.user_id ?? "—",
            row.life_id ?? "—",
            row.code,
            row.message,
            fmtDate(row.created_at),
          ])}
        />
      )}
    </Page>
  );
}
