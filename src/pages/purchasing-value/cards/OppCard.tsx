import { useState } from "react";
import { BadgeCheck, Bell, ChevronRight, Clock, Copy, Trash2, TrendingUp } from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import { useAuth } from "../../../context/AuthContext";
import type { Opp } from "../types";
import { EDITOR_PROFILES, OPPORTUNITY_DELETE_PROFILES, STATUS_COLORS, TYPE_COLORS } from "../constants";
import { fmt, pldColor } from "../utils";
import { DeleteOpportunityModal } from "../modals/DeleteOpportunityModal";
import { RemindModal } from "../modals/RemindModal";

export function OppCard({
  opp,
  onClick,
  onRefresh,
  onDeleted,
  onDuplicated,
  userEmail,
  compact = false,
}: {
  opp: Opp;
  onClick: () => void;
  onRefresh?: (o: Opp) => void;
  onDeleted?: (opportunityId: number) => void;
  onDuplicated?: (o: Opp) => void;
  userEmail?: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const canDelete = OPPORTUNITY_DELETE_PROFILES.includes(
    user?.access_profile ?? "",
  );
  const canDuplicate = EDITOR_PROFILES.includes(user?.access_profile ?? "");
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  function openConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteError(null);
    setConfirmOpen(true);
  }

  async function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    if (duplicating) return;
    setDuplicating(true);
    try {
      const res = await supplierAPI.duplicateOpportunity(opp.opportunity_id);
      onDuplicated?.(res.data as Opp);
    } catch {
      // Non-blocking: a failed duplicate leaves the board unchanged.
    } finally {
      setDuplicating(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await supplierAPI.deleteOpportunity(opp.opportunity_id);
      setConfirmOpen(false);
      onDeleted?.(opp.opportunity_id);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete opportunity.",
      );
    } finally {
      setDeleting(false);
    }
  }

  // Remind pending approvers straight from the card. Only meaningful while the
  // opportunity is awaiting a gate decision — the backend re-sends each pending
  // approver their existing link and skips anyone who already voted.
  const canRemind =
    (opp.status === "Awaiting Validation" ||
      opp.status === "Under Committee Review") &&
    EDITOR_PROFILES.includes(user?.access_profile ?? "");
  const [remindOpen, setRemindOpen] = useState(false);
  // Locally bump the sent count so the badge updates instantly after sending,
  // without waiting for the next board reload. send_reminders returns exactly
  // how many approvers were reminded this action.
  const [reminderBump, setReminderBump] = useState(0);
  const remindersSent = (opp.reminders_sent ?? 0) + reminderBump;
  const pendingApprovers = opp.pending_approvers ?? 0;
  function openRemind(e: React.MouseEvent) {
    e.stopPropagation();
    setRemindOpen(true);
  }
  const remindModal = remindOpen && canRemind && (
    <RemindModal
      oppName={opp.opportunity_name ?? `#${opp.opportunity_id}`}
      opportunityId={opp.opportunity_id}
      onClose={() => setRemindOpen(false)}
      onSent={(n) => setReminderBump((b) => b + n)}
    />
  );

  const deleteModal = confirmOpen && (
    <DeleteOpportunityModal
      oppName={opp.opportunity_name ?? `#${opp.opportunity_id}`}
      loading={deleting}
      error={deleteError}
      onConfirm={handleConfirmDelete}
      onCancel={() => setConfirmOpen(false)}
    />
  );

  const typeClass =
    TYPE_COLORS[opp.opportunity_type ?? ""] ??
    "bg-slate-100 text-slate-600 border-slate-200";
  const hasFinancial = opp.financial_lines.length > 0;
  const line = opp.financial_lines[0];

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="group flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 transition-all hover:border-blue-200 hover:bg-blue-50/40 dark:border-white/[0.08] dark:bg-[#111e30] dark:hover:border-blue-500/30 dark:hover:bg-[#152035]"
      >
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${typeClass}`}
        >
          {opp.opportunity_type?.slice(0, 3)}
        </span>
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-800 dark:text-slate-100">
          {opp.opportunity_name}
        </p>
        {opp.expected_annual_saving && (
          <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {fmt(opp.expected_annual_saving, opp.currency || "EUR")}
          </span>
        )}
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_COLORS[opp.status ?? ""] ?? "bg-slate-100 text-slate-500"}`}
        >
          {opp.status === "Awaiting Validation"
            ? "Awaiting"
            : opp.status === "Under Committee Review"
              ? "Committee"
              : opp.status === "Working on it"
                ? "Working"
                : opp.status === "Needs Rework"
                  ? "Rework"
                  : opp.status}
        </span>
        {canRemind && (
          <button
            onClick={openRemind}
            title={`${remindersSent} reminder${
              remindersSent === 1 ? "" : "s"
            } sent · ${pendingApprovers} approver${
              pendingApprovers === 1 ? "" : "s"
            } pending`}
            className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-1 text-amber-500 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-500/10"
          >
            <Bell size={12} />
            <span className="text-[9px] font-bold leading-none">
              {remindersSent}
            </span>
          </button>
        )}
        {canDuplicate && (
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            title="Duplicate opportunity"
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
          >
            <Copy size={12} />
          </button>
        )}
        {canDelete && (
          <button
            onClick={openConfirm}
            disabled={deleting}
            title="Delete opportunity"
            className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 size={12} />
          </button>
        )}
        {deleteModal}
        {remindModal}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-white/[0.08] dark:bg-[#111e30] dark:hover:border-blue-500/30 dark:hover:bg-[#152035]${canDelete || canDuplicate || canRemind ? " pb-9" : ""}`}
    >
      {canRemind && (
        <button
          onClick={openRemind}
          title={`${remindersSent} reminder${
            remindersSent === 1 ? "" : "s"
          } sent · ${pendingApprovers} approver${
            pendingApprovers === 1 ? "" : "s"
          } pending`}
          className={`absolute bottom-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-amber-400 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:text-amber-500 dark:hover:bg-amber-500/10 ${
            canDuplicate && canDelete
              ? "right-16"
              : canDuplicate || canDelete
                ? "right-9"
                : "right-2"
          }`}
        >
          <Bell size={12} />
          {remindersSent > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-bold leading-none text-white">
              {remindersSent}
            </span>
          )}
        </button>
      )}
      {canDuplicate && (
        <button
          onClick={handleDuplicate}
          disabled={duplicating}
          title="Duplicate opportunity"
          className={`absolute bottom-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:text-slate-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 ${canDelete ? "right-9" : "right-2"}`}
        >
          <Copy size={12} />
        </button>
      )}
      {canDelete && (
        <button
          onClick={openConfirm}
          disabled={deleting}
          title="Delete opportunity"
          className="absolute bottom-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-slate-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      )}
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="line-clamp-2 pr-3 text-[12.5px] font-bold leading-snug text-slate-800 dark:text-slate-100">
          {opp.opportunity_name}
        </p>
        <ChevronRight
          size={13}
          className="mt-0.5 shrink-0 text-slate-300 group-hover:text-blue-400 dark:text-slate-600 dark:group-hover:text-blue-400"
        />
      </div>
      <p className="mb-2 text-[10.5px] text-slate-400 dark:text-slate-500">
        {opp.idea_owner}
      </p>
      <div className="flex flex-wrap gap-1 mb-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${typeClass}`}
        >
          {opp.opportunity_type}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${STATUS_COLORS[opp.status ?? ""] ?? "bg-slate-100 text-slate-500"}`}
        >
          {opp.status}
        </span>
        {opp.validation_status === "Budgeted" && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9.5px] font-semibold text-violet-600 border border-violet-100">
            Validated
          </span>
        )}
      </div>
      {(opp.expected_annual_saving || opp.priority_category) && (
        <div className="flex items-center gap-3 border-t border-slate-50 pt-2 dark:border-white/[0.06]">
          {opp.expected_annual_saving && (
            <div className="flex items-center gap-1">
              <TrendingUp size={10} className="text-emerald-500" />
              <span className="text-[10.5px] font-semibold text-emerald-700">
                {fmt(opp.expected_annual_saving, opp.currency || "EUR")}
              </span>
            </div>
          )}
          {opp.priority_category && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${pldColor(opp.priority_category)}`}
            >
              {opp.priority_category}
            </span>
          )}
          {hasFinancial && line?.cumulated_real_saving != null && (
            <div className="flex items-center gap-1 ml-auto">
              <BadgeCheck size={10} className="text-blue-400" />
              <span className="text-[10.5px] text-blue-600 font-semibold">
                {fmt(line.cumulated_real_saving, opp.currency || "EUR")}
              </span>
            </div>
          )}
        </div>
      )}
      {/* Quick action for Assigned cards */}
      {opp.status === "Assigned" && onRefresh && userEmail && (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const res = await supplierAPI.startStudy(
                opp.opportunity_id,
                userEmail,
              );
              onRefresh(res.data as Opp);
            } catch {
              /* open drawer instead */ onClick();
            }
          }}
          className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
        >
          Start Phase 0 Study →
        </button>
      )}
      {(opp.status === "Awaiting Validation" ||
        opp.status === "Under Committee Review") && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold">
          <Clock size={10} /> {opp.status}
        </div>
      )}
      {deleteModal}
      {remindModal}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase Column
// ---------------------------------------------------------------------------
