import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Clock, UserCheck, UserX, XCircle } from "lucide-react";
import supplierAPI, {
  type AccountRequestRecord,
  SupplierApiError,
} from "../services/supplierOnboardingAPI";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_BADGE: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  rejected:
    "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  active:
    "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRole(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Row action — approve or reject with optional note
// ---------------------------------------------------------------------------
function ActionPanel({
  request,
  onDone,
}: {
  request: AccountRequestRecord;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (request.registration_status !== "pending") return null;

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === "approve") {
        await supplierAPI.approveAccountRequest(
          request.id_identity,
          message || undefined,
        );
      } else {
        await supplierAPI.rejectAccountRequest(
          request.id_identity,
          message || undefined,
        );
      }
      onDone();
    } catch (err) {
      setError(
        err instanceof SupplierApiError ? err.message : "Action failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === "idle") {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("approve")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
        >
          <UserCheck size={13} />
          Approve
        </button>
        <button
          type="button"
          onClick={() => setMode("reject")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <UserX size={13} />
          Reject
        </button>
      </div>
    );
  }

  const isApprove = mode === "approve";
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          isApprove ? "Optional message to the user…" : "Optional reason…"
        }
        rows={2}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-800 dark:text-white"
      />
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60 ${
            isApprove
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          {isApprove ? <UserCheck size={13} /> : <UserX size={13} />}
          {isSubmitting
            ? "Processing…"
            : isApprove
            ? "Confirm approval"
            : "Confirm rejection"}
        </button>
        <button
          type="button"
          onClick={() => { setMode("idle"); setMessage(""); setError(null); }}
          className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AccountRequestsPage() {
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [requests, setRequests] = useState<AccountRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listAccountRequests(
        filter === "all" ? undefined : filter,
      );
      setRequests(res.data.items);
    } catch (err) {
      setError(
        err instanceof SupplierApiError
          ? err.message
          : "Failed to load account requests.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = requests.filter(
    (r) => r.registration_status === "pending",
  ).length;

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Account Requests
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review and manage user registration requests.
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Clock size={15} />
            {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-slate-800/60 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={[
              "rounded-xl px-4 py-1.5 text-sm font-semibold transition",
              filter === tab.key
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : requests.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Requested Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr
                    key={req.id_identity}
                    className="border-b border-slate-100 last:border-b-0 dark:border-white/[0.05]"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {req.full_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {req.email}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatRole(req.requested_role)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.registration_status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ActionPanel request={req} onDone={load} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-slate-400">
      Loading…
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <XCircle size={32} className="text-rose-400" />
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ filter }: { filter: StatusFilter }) {
  const labels: Record<StatusFilter, string> = {
    pending: "No pending requests",
    approved: "No approved requests",
    rejected: "No rejected requests",
    all: "No account requests yet",
  };
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <CheckCircle size={36} className="text-slate-300 dark:text-slate-600" />
      <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
        {labels[filter]}
      </p>
    </div>
  );
}
