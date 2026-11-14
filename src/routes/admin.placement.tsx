import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import {
  DataTable,
  fmtDate,
  Msg,
  Page,
  useAdmin,
} from "@/components/admin-kit";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/placement")({
  head: () => ({
    meta: [
      { title: "Placement Correction — Life OS Admin" },
      {
        name: "description",
        content: "Correct member placement or sponsor and review the correction audit.",
      },
      { property: "og:title", content: "Placement Correction — Life OS Admin" },
      {
        property: "og:description",
        content: "Correct member placement or sponsor and review the correction audit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Placement,
});

type Audit = {
  id: number;
  life_id: string;
  admin_name: string | null;
  old_parent: string | null;
  old_side: "L" | "R" | null;
  new_parent: string | null;
  new_side: "L" | "R" | null;
  old_sponsor: string | null;
  new_sponsor: string | null;
  reason: string;
  created_at: string;
};

type Correction = {
  member: string;
  target: string;
  side: "L" | "R";
  reason: string;
};

const emptyCorrection: Correction = {
  member: "",
  target: "",
  side: "L",
  reason: "",
};

function CorrectionForm({
  kind,
  onSaved,
}: {
  kind: "placement" | "sponsor";
  onSaved: () => Promise<void>;
}) {
  const placement = kind === "placement";
  const [form, setForm] = useState<Correction>({ ...emptyCorrection });
  const [review, setReview] = useState<Correction | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const snapshot = {
      ...form,
      member: form.member.trim(),
      target: form.target.trim(),
      reason: form.reason.trim(),
    };

    setMessage(null);
    if (!snapshot.member || !snapshot.target || !snapshot.reason) {
      setMessage({
        ok: false,
        text: "Member, destination, and reason are required.",
      });
      return;
    }
    setReview(snapshot);
  }

  async function confirm() {
    if (!review || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage(null);

    try {
      await adminApi(
        placement ? "/placement/move" : "/sponsor/change",
        {
          method: "POST",
          body: placement
            ? {
                member: review.member,
                parent: review.target,
                side: review.side,
                reason: review.reason,
              }
            : {
                member: review.member,
                sponsor: review.target,
                reason: review.reason,
              },
        },
      );
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Correction failed.",
      });
      setReview(null);
      setBusy(false);
      submitting.current = false;
      return;
    }

    setReview(null);
    setForm({ ...emptyCorrection });
    setMessage({
      ok: true,
      text: placement ? "Placement updated successfully." : "Sponsor updated successfully.",
    });

    try {
      await onSaved();
    } catch {
      setMessage({
        ok: true,
        text: "Correction saved. Refresh the page to reload the audit.",
      });
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  return (
    <section>
      <h3>{placement ? "Move Placement" : "Change Sponsor"}</h3>
      <Msg ok={message?.ok} text={message?.text ?? null} />

      {review ? (
        <div className="space-y-2 border border-border p-3">
          <h4>Confirm Correction</h4>
          <p>Member: {review.member}</p>
          <p>
            {placement ? "New Parent" : "New Sponsor"}: {review.target}
          </p>
          {placement && (
            <p>Side: {review.side === "L" ? "Left" : "Right"}</p>
          )}
          <p>Reason: {review.reason}</p>
          <div className="flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void confirm()}>
              {busy ? "Saving…" : "Confirm Correction"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Back
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="space-y-2">
            <label className="block">
              Member (Account ID or username)
              <input
                className="block"
                required
                value={form.member}
                onChange={(event) =>
                  setForm({ ...form, member: event.target.value })
                }
              />
            </label>
            <label className="block">
              {placement ? "New Parent" : "New Sponsor"} (Account ID or username)
              <input
                className="block"
                required
                value={form.target}
                onChange={(event) =>
                  setForm({ ...form, target: event.target.value })
                }
              />
            </label>
            {placement && (
              <label className="block">
                Side
                <select
                  className="block"
                  value={form.side}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      side: event.target.value === "R" ? "R" : "L",
                    })
                  }
                >
                  <option value="L">Left</option>
                  <option value="R">Right</option>
                </select>
              </label>
            )}
            <label className="block">
              Reason
              <textarea
                className="block"
                required
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
              />
            </label>
            <Button type="submit">Review Correction</Button>
          </fieldset>
        </form>
      )}
    </section>
  );
}

function Placement() {
  const audit = useAdmin<Audit[]>("placement-audit", "/placement/audit");
  const client = useQueryClient();

  async function refreshAfterSave() {
    await client.invalidateQueries({ queryKey: ["admin"] });
  }

  const position = (
    parent: string | null,
    side: "L" | "R" | null,
  ) => parent
    ? `${parent}${side ? ` · ${side === "L" ? "Left" : "Right"}` : ""}`
    : "—";

  return (
    <Page title="Placement Correction">
      <CorrectionForm kind="placement" onSaved={refreshAfterSave} />
      <CorrectionForm kind="sponsor" onSaved={refreshAfterSave} />

      <h3>Correction Audit</h3>
      <Button
        variant="outline"
        size="sm"
        disabled={audit.isFetching}
        onClick={() => void audit.refetch()}
      >
        Refresh Audit
      </Button>
      <Msg text={audit.error?.message ?? null} />
      {audit.isPending && <p>Loading correction audit…</p>}
      {audit.data && (
        <DataTable
          head={[
            "ID",
            "Member ID",
            "Admin",
            "Old Placement",
            "New Placement",
            "Old Sponsor",
            "New Sponsor",
            "Reason",
            "Created",
          ]}
          rows={audit.data.map((row) => [
            row.id,
            row.life_id,
            row.admin_name ?? "—",
            position(row.old_parent, row.old_side),
            position(row.new_parent, row.new_side),
            row.old_sponsor ?? "—",
            row.new_sponsor ?? "—",
            row.reason,
            fmtDate(row.created_at),
          ])}
        />
      )}
    </Page>
  );
}
