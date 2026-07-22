import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  Power,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import supplierAPI, {
  type AccessIdentityRecord,
  type AccountRequestRecord,
  SupplierApiError,
} from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";

type StatusFilter = "pending" | "approved" | "rejected" | "all";
type UserFilter = "active" | "inactive" | "all";
type TopTab = "requests" | "users" | "roles";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const USER_TABS: { key: UserFilter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "inactive", label: "Deactivated" },
  { key: "all", label: "All" },
];

// Access roles and what each one is permitted to do in the application.
// `description` is the one-line summary shown when assigning a role; `can`/`cannot`
// are the detailed capability lists shown in the Roles & Permissions reference.
// These mirror the backend authorization rules (NON_VIEWER / PRIVILEGED groups,
// VP-only and approver checks).
type RoleInfo = {
  value: string;
  label: string;
  description: string;
  can: string[];
  cannot?: string[];
};

const ROLES: RoleInfo[] = [
  {
    value: "vp_conversion",
    label: "VP Conversion",
    description:
      "Highest access. Full write, all privileged actions, plus supplier validation, committee reviews and account management.",
    can: [
      "Everything a writer can do (create/edit opportunities, suppliers, relations, evaluations, action plans)",
      "Apply gate decisions (Go / No-Go) and approve/reject STP baseline revisions",
      "Enter AND overwrite real savings on any opportunity; revise locked baselines",
      "Escalate/de-escalate financial lines; assign and close budget years",
      "Approve or reject supplier validation (VP only)",
      "Initiate committee reviews, record the final decision, manage committee members (VP only)",
      "Override relation status; approve/reject relation reviews (VP only)",
      "Create, edit and delete certifications",
      "Manage user accounts: approve requests, create/edit/deactivate/delete users, reset passwords, assign roles",
      "Send development-plan requests for global / strategic suppliers",
    ],
  },
  {
    value: "purchasing_director",
    label: "Purchasing Director",
    description:
      "Full write plus all privileged actions (gate decisions, budgets, real savings). No supplier-validation or committee powers.",
    can: [
      "Everything a writer can do (create/edit opportunities, suppliers, relations, evaluations, action plans)",
      "Apply gate decisions (Go / No-Go) and approve/reject STP baseline revisions",
      "Enter AND overwrite real savings on any opportunity; revise locked baselines",
      "Escalate/de-escalate financial lines; assign and close budget years",
      "Create, edit and delete certifications",
      "Manage user accounts (approve requests, create/edit users, reset passwords)",
      "Send development-plan requests for global / strategic suppliers",
    ],
    cannot: [
      "Approve/reject supplier validation (VP Conversion only)",
      "Initiate committee reviews or record final decisions (VP Conversion only)",
      "Override relation status / approve-reject relation reviews (VP Conversion only)",
    ],
  },
  {
    value: "purchasing_manager",
    label: "Purchasing Manager",
    description:
      "Standard writer. Creates/edits opportunities and supplier data; can approve account requests; manage any action plan.",
    can: [
      "Create and edit opportunities, suppliers, relations, contacts and evaluations",
      "Record the first real-saving entry on an opportunity",
      "Manage action plans (close actions, delete evidence) on any plan",
      "Approve or reject new account requests",
    ],
    cannot: [
      "Delete opportunities, apply gate decisions, manage budgets, edit STP baselines",
      "Overwrite an already-recorded real saving (Director / VP only)",
      "Manage certifications, supplier validation, committee reviews",
      "Send development-plan requests for global / strategic suppliers",
    ],
  },
  {
    value: "supplier_owner",
    label: "Supplier Owner",
    description:
      "Writer focused on supplier relations, evaluations and development plans; can approve account requests.",
    can: [
      "Create and edit opportunities, suppliers, relations, evaluations and development plans",
      "Record the first real-saving entry on an opportunity",
      "Approve or reject new account requests",
      "Manage action plans where they are the responsible / related owner",
    ],
    cannot: [
      "Any privileged action (gate decisions, budgets, baseline edits, overwrite actuals)",
      "Manage certifications, supplier validation or committee reviews",
      "Send development-plan requests for global / strategic suppliers",
    ],
  },
  {
    value: "global_purchaser",
    label: "Global Purchaser",
    description:
      "Standard writer across all plants; edits opportunities and supplier data.",
    can: [
      "Create and edit opportunities, suppliers, relations, contacts and evaluations",
      "Record the first real-saving entry on an opportunity",
      "Manage action plans they own",
    ],
    cannot: [
      "Any privileged action, account management, certifications, validation or committee reviews",
      "Send development-plan requests for global / strategic suppliers (local only)",
    ],
  },
  {
    value: "local_purchaser",
    label: "Local Purchaser",
    description:
      "Standard writer (same rights as Global Purchaser today); edits opportunities and supplier data.",
    can: [
      "Create and edit opportunities, suppliers, relations, contacts and evaluations",
      "Record the first real-saving entry on an opportunity",
      "Manage action plans they own",
    ],
    cannot: [
      "Any privileged action, account management, certifications, validation or committee reviews",
      "Send development-plan requests for global / strategic suppliers (local only)",
    ],
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access to dashboards and records — cannot edit.",
    can: [
      "View dashboards, KPIs, opportunities, suppliers and monitoring",
      "Receive and read their own notifications",
    ],
    cannot: ["Create, edit or delete any record"],
  },
];

const ROLE_MAP = new Map(ROLES.map((r) => [r.value, r]));

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

function roleLabel(role: string) {
  return ROLE_MAP.get(role)?.label ?? formatRole(role);
}

function roleDescription(role: string) {
  return ROLE_MAP.get(role)?.description ?? "";
}

const STATUS_BADGE: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  active: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
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

// ---------------------------------------------------------------------------
// Requests row action — approve or reject with optional note
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
      setError(err instanceof SupplierApiError ? err.message : "Action failed.");
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
          onClick={() => {
            setMode("idle");
            setMessage("");
            setError(null);
          }}
          className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Requests panel (original functionality)
// ---------------------------------------------------------------------------
function RequestsPanel() {
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

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-slate-800/60">
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

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : requests.length === 0 ? (
        <EmptyRequests filter={filter} />
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
                    <td
                      className="px-4 py-3 text-slate-600 dark:text-slate-300"
                      title={roleDescription(req.requested_role)}
                    >
                      {roleLabel(req.requested_role)}
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

// ---------------------------------------------------------------------------
// Users panel — manage active/deactivated users, roles and deletion
// ---------------------------------------------------------------------------
function UsersPanel() {
  const { user } = useAuth();
  const currentEmail = (user?.email ?? "").trim().toLowerCase();

  const [filter, setFilter] = useState<UserFilter>("active");
  const [items, setItems] = useState<AccessIdentityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listAccessIdentities();
      setItems(res.data.items ?? []);
    } catch (err) {
      setError(
        err instanceof SupplierApiError
          ? err.message
          : "Failed to load users.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      items.filter((u) =>
        filter === "all"
          ? true
          : filter === "active"
            ? u.is_active
            : !u.is_active,
      ),
    [items, filter],
  );
  const activeCount = useMemo(
    () => items.filter((u) => u.is_active).length,
    [items],
  );

  const replaceItem = (updated: AccessIdentityRecord) =>
    setItems((cur) =>
      cur.map((u) => (u.id_identity === updated.id_identity ? updated : u)),
    );

  const saveRole = async (item: AccessIdentityRecord) => {
    const nextRole = roleDrafts[item.id_identity];
    if (!nextRole || nextRole === item.access_profile) return;
    setBusyId(item.id_identity);
    setActionError(null);
    try {
      const res = await supplierAPI.updateAccessIdentity(item.id_identity, {
        access_profile: nextRole,
      });
      replaceItem(res.data);
      setRoleDrafts((cur) => {
        const next = { ...cur };
        delete next[item.id_identity];
        return next;
      });
    } catch (err) {
      setActionError(
        err instanceof SupplierApiError ? err.message : "Failed to change role.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (item: AccessIdentityRecord) => {
    setBusyId(item.id_identity);
    setActionError(null);
    try {
      const res = await supplierAPI.updateAccessIdentity(item.id_identity, {
        is_active: !item.is_active,
      });
      replaceItem(res.data);
    } catch (err) {
      setActionError(
        err instanceof SupplierApiError
          ? err.message
          : "Failed to update account status.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: AccessIdentityRecord) => {
    setBusyId(item.id_identity);
    setActionError(null);
    try {
      await supplierAPI.deleteAccessIdentity(item.id_identity);
      setItems((cur) => cur.filter((u) => u.id_identity !== item.id_identity));
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(
        err instanceof SupplierApiError ? err.message : "Failed to delete user.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-slate-800/60">
          {USER_TABS.map((tab) => (
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
        <div className="inline-flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
          <Users size={15} />
          {activeCount} active {activeCount === 1 ? "user" : "users"}
        </div>
      </div>

      {actionError && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Users size={36} className="text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
            No {filter === "all" ? "" : filter} users to show.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 w-[320px]">Access Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.email.trim().toLowerCase() === currentEmail;
                  const draftRole = roleDrafts[u.id_identity] ?? u.access_profile;
                  const roleChanged = draftRole !== u.access_profile;
                  const busy = busyId === u.id_identity;
                  return (
                    <tr
                      key={u.id_identity}
                      className="border-b border-slate-100 align-top last:border-b-0 dark:border-white/[0.05]"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {u.full_name}
                        {isSelf && (
                          <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
                            you
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={draftRole}
                          onChange={(e) =>
                            setRoleDrafts((cur) => ({
                              ...cur,
                              [u.id_identity]: e.target.value,
                            }))
                          }
                          disabled={busy}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                        >
                          {/* Keep an unknown existing role selectable */}
                          {!ROLE_MAP.has(u.access_profile) && (
                            <option value={u.access_profile}>
                              {formatRole(u.access_profile)}
                            </option>
                          )}
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                          {roleDescription(draftRole) ||
                            "No description available."}
                        </p>
                        {roleChanged && (
                          <button
                            type="button"
                            onClick={() => saveRole(u)}
                            disabled={busy}
                            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                          >
                            <ShieldCheck size={12} />
                            {busy ? "Saving…" : "Save role"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={u.is_active ? "active" : "rejected"}
                        />
                        {!u.is_active && (
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            deactivated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {formatDate(u.last_login_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleActive(u)}
                            disabled={busy || isSelf}
                            title={
                              isSelf
                                ? "You cannot change your own status"
                                : u.is_active
                                  ? "Deactivate account"
                                  : "Reactivate account"
                            }
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              u.is_active
                                ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                            }`}
                          >
                            <Power size={13} />
                            {u.is_active ? "Deactivate" : "Reactivate"}
                          </button>

                          {confirmDeleteId === u.id_identity ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => remove(u)}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                              >
                                <Trash2 size={13} />
                                {busy ? "Deleting…" : "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(u.id_identity)}
                              disabled={busy || isSelf}
                              title={
                                isSelf
                                  ? "You cannot delete your own account"
                                  : "Delete account permanently"
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/30 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-500/10"
                            >
                              <Trash2 size={13} />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AccountRequestsPage() {
  const [tab, setTab] = useState<TopTab>("requests");

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Account Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review registration requests and manage existing user accounts and
            their access roles.
          </p>
        </div>
      </div>

      {/* Top-level view switch */}
      <div className="flex w-fit gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={[
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
            tab === "requests"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          ].join(" ")}
        >
          <Clock size={15} />
          Requests
        </button>
        <button
          type="button"
          onClick={() => setTab("users")}
          className={[
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
            tab === "users"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          ].join(" ")}
        >
          <Users size={15} />
          Users
        </button>
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={[
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
            tab === "roles"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          ].join(" ")}
        >
          <ShieldCheck size={15} />
          Roles &amp; Permissions
        </button>
      </div>

      {tab === "requests" ? (
        <RequestsPanel />
      ) : tab === "users" ? (
        <UsersPanel />
      ) : (
        <RolesPanel />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roles & Permissions reference — what each access role can and cannot do
// ---------------------------------------------------------------------------
function RolesPanel() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        What each access role is permitted to do in the application. Assign roles
        from the <span className="font-semibold">Users</span> tab.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {ROLES.map((role) => (
          <div
            key={role.value}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-sky-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {role.label}
              </h3>
              <code className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">
                {role.value}
              </code>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {role.description}
            </p>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Can
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {role.can.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] text-slate-700 dark:text-slate-200"
                >
                  <CheckCircle
                    size={14}
                    className="mt-0.5 shrink-0 text-emerald-500"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {role.cannot && role.cannot.length > 0 && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400">
                  Cannot
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {role.cannot.map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                    >
                      <XCircle
                        size={14}
                        className="mt-0.5 shrink-0 text-rose-400"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared states
// ---------------------------------------------------------------------------
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-slate-400">
      Loading…
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
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

function EmptyRequests({ filter }: { filter: StatusFilter }) {
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
