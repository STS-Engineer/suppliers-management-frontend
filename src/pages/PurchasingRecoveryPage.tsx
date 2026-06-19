import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  TrendingDown,
  Filter,
  ExternalLink,
} from "lucide-react";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecoveryItem {
  financial_line_id: number;
  line_name?: string;
  opportunity_id?: number;
  opportunity_name?: string;
  opportunity_type?: string;
  plant_name?: string;
  follower?: string;
  purchasing_owner?: string;
  expected_annual_saving: number;
  cumulated_real_saving: number;
  delta_ytd: number;
  forecast_eoy_current: number;
  recovery_status: string;
  recovery_note?: string;
  recovery_target_date?: string;
  recovery_amount?: number;
  recovery_history?: string;
  recovery_updated_at?: string;
  is_overdue: boolean;
  days_to_target?: number;
  progress_pct?: number;
  is_escalated: boolean;
}

interface Summary {
  total: number;
  by_status: Record<string, number>;
  total_amount_to_recover: number;
  overdue_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n?: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n);

const fmtDate = (s?: string | null) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

const TYPE_COLORS: Record<string, string> = {
  Negotiation: "bg-blue-100 text-blue-700",
  Sourcing: "bg-purple-100 text-purple-700",
  "Technical Productivity": "bg-teal-100 text-teal-700",
  Cash: "bg-amber-100 text-amber-700",
};

const STATUS_CFG: Record<string, { color: string; icon: React.ReactNode }> = {
  Planned:     { color: "bg-amber-100 text-amber-700 border border-amber-200",   icon: <Clock size={10} /> },
  "In Progress": { color: "bg-blue-100 text-blue-700 border border-blue-200",   icon: <RefreshCw size={10} /> },
  Done:        { color: "bg-emerald-100 text-emerald-700 border border-emerald-200", icon: <CheckCircle2 size={10} /> },
};

// ─── Inline edit form ─────────────────────────────────────────────────────────

function InlineEditForm({
  item,
  userEmail,
  onSaved,
  onCancel,
}: {
  item: RecoveryItem;
  userEmail: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    recovery_status: item.recovery_status,
    recovery_note: item.recovery_note ?? "",
    recovery_target_date: item.recovery_target_date ?? "",
    recovery_amount: item.recovery_amount?.toString() ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.setRecovery(item.financial_line_id, {
        recovery_status: form.recovery_status,
        recovery_note: form.recovery_note.trim() ? form.recovery_note : null,
        recovery_target_date: form.recovery_target_date || null,
        recovery_amount: form.recovery_amount ? parseFloat(form.recovery_amount) : null,
        updated_by: userEmail,
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
    >
      <p className="text-[10.5px] font-bold uppercase tracking-widest text-amber-700">
        Update Recovery Plan
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-[10px] font-semibold text-slate-500">Status *</label>
          <select
            required
            className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs outline-none"
            value={form.recovery_status}
            onChange={(e) => setForm((f) => ({ ...f, recovery_status: e.target.value }))}
          >
            <option>Planned</option>
            <option>In Progress</option>
            <option>Done</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold text-slate-500">Target date</label>
          <input
            type="date"
            className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs outline-none"
            value={form.recovery_target_date}
            onChange={(e) => setForm((f) => ({ ...f, recovery_target_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold text-slate-500">Amount to recover (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs outline-none"
            placeholder="e.g. 5000"
            value={form.recovery_amount}
            onChange={(e) => setForm((f) => ({ ...f, recovery_amount: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold text-slate-500">
          Note — what actions are planned / what was done?
        </label>
        <textarea
          rows={2}
          className="w-full resize-none rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs outline-none"
          placeholder="Renegotiate volume, accelerate deployment…"
          value={form.recovery_note}
          onChange={(e) => setForm((f) => ({ ...f, recovery_note: e.target.value }))}
        />
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {loading && <RefreshCw size={10} className="animate-spin" />} Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Recovery card ────────────────────────────────────────────────────────────

function RecoveryCard({
  item,
  userEmail,
  onRefresh,
}: {
  item: RecoveryItem;
  userEmail: string;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const statusCfg = STATUS_CFG[item.recovery_status] ?? STATUS_CFG["Planned"];

  const borderColor =
    item.recovery_status === "Done"
      ? "border-l-emerald-400"
      : item.is_overdue
      ? "border-l-red-400"
      : item.recovery_status === "In Progress"
      ? "border-l-blue-400"
      : "border-l-amber-400";

  return (
    <div className={`rounded-xl border border-slate-100 bg-white shadow-sm border-l-4 ${borderColor} p-4 space-y-3`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm truncate">
              {item.opportunity_name ?? item.line_name ?? "—"}
            </p>
            {item.opportunity_type && (
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${TYPE_COLORS[item.opportunity_type] ?? "bg-slate-100 text-slate-600"}`}>
                {item.opportunity_type}
              </span>
            )}
            {item.is_escalated && (
              <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-600">
                <AlertTriangle size={8} /> Escalated
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-400">
            {item.plant_name && <span>{item.plant_name}</span>}
            {item.follower && <span>Follower: <span className="text-slate-600 font-medium">{item.follower}</span></span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusCfg.color}`}>
            {statusCfg.icon} {item.recovery_status}
          </span>
          <button
            onClick={() =>
              item.opportunity_id &&
              navigate("/purchasing-value", {
                state: { openOpportunityId: item.opportunity_id },
              })
            }
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Open opportunity"
            disabled={!item.opportunity_id}
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
        <div>
          <p className="text-[10px] text-slate-400 font-semibold">Delta YTD</p>
          <p className={`font-bold ${item.delta_ytd >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {fmt(item.delta_ytd)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-semibold">Amount to Recover</p>
          <p className="font-bold text-amber-700">{fmt(item.recovery_amount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-semibold">Actual YTD</p>
          <p className="font-bold text-slate-700">{fmt(item.cumulated_real_saving)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-semibold">EOY Forecast</p>
          <p className="font-bold text-blue-700">{fmt(item.forecast_eoy_current)}</p>
        </div>
      </div>

      {/* Progress bar (only if recovery_amount set) */}
      {item.recovery_amount != null && item.recovery_amount > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>Recovery progress</span>
            <span className="font-semibold">
              {item.progress_pct != null ? `${item.progress_pct}%` : "—"}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (item.progress_pct ?? 0) >= 100
                  ? "bg-emerald-500"
                  : (item.progress_pct ?? 0) >= 50
                  ? "bg-blue-400"
                  : "bg-amber-400"
              }`}
              style={{ width: `${Math.min(item.progress_pct ?? 0, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Target date + note */}
      <div className="flex items-start justify-between gap-4 text-[11px]">
        <div className="space-y-0.5">
          {item.recovery_target_date && (
            <p className={`flex items-center gap-1 font-semibold ${item.is_overdue ? "text-red-600" : "text-slate-500"}`}>
              <Clock size={10} />
              {item.is_overdue
                ? `Overdue since ${fmtDate(item.recovery_target_date)}`
                : item.days_to_target != null && item.days_to_target <= 30
                ? `Due in ${item.days_to_target}d — ${fmtDate(item.recovery_target_date)}`
                : `Target: ${fmtDate(item.recovery_target_date)}`}
            </p>
          )}
          {item.recovery_note && (
            <p className="text-slate-500 italic max-w-md">{item.recovery_note}</p>
          )}
          {item.recovery_updated_at && (
            <p className="text-[10px] text-slate-300">
              Last updated: {fmtDate(item.recovery_updated_at)}
            </p>
          )}
          {/* History timeline */}
          {item.recovery_history && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] font-semibold text-slate-400 hover:text-slate-600 select-none">
                View history ({item.recovery_history.split("\n").filter(Boolean).length} update{item.recovery_history.split("\n").filter(Boolean).length > 1 ? "s" : ""})
              </summary>
              <div className="mt-2 space-y-1 border-l-2 border-amber-100 pl-3">
                {item.recovery_history.split("\n").filter(Boolean).reverse().map((entry, i) => (
                  <p key={i} className="text-[10px] text-slate-400 font-mono leading-relaxed">
                    {entry}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
        {item.recovery_status !== "Done" && (
          <button
            onClick={() => setEditing((v) => !v)}
            className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
          >
            {editing ? "Cancel" : "Update"}
          </button>
        )}
      </div>

      {editing && (
        <InlineEditForm
          item={item}
          userEmail={userEmail}
          onSaved={() => { setEditing(false); onRefresh(); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PurchasingRecoveryPage() {
  const { user } = useAuth();
  const userEmail = user?.email ?? "";

  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("Active");
  const [filterPlant, setFilterPlant] = useState<string>("All");
  const [filterFollower, setFilterFollower] = useState<string>("All");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.getRecoveryPlans();
      const data = (res as { data: { items: RecoveryItem[]; summary: Summary } }).data;
      setItems(data.items);
      setSummary(data.summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Derived filter options
  const plants = ["All", ...Array.from(new Set(items.map((i) => i.plant_name).filter(Boolean) as string[]))];
  const followers = ["All", ...Array.from(new Set(items.map((i) => i.follower).filter(Boolean) as string[]))];

  const filtered = items.filter((i) => {
    if (filterStatus === "Active" && i.recovery_status === "Done") return false;
    if (filterStatus !== "Active" && filterStatus !== "All" && i.recovery_status !== filterStatus) return false;
    if (filterPlant !== "All" && i.plant_name !== filterPlant) return false;
    if (filterFollower !== "All" && i.follower !== filterFollower) return false;
    return true;
  });

  // Sort: overdue first, then In Progress, then Planned, then Done
  const STATUS_SORT: Record<string, number> = { Planned: 2, "In Progress": 1, Done: 3 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    return (STATUS_SORT[a.recovery_status] ?? 9) - (STATUS_SORT[b.recovery_status] ?? 9);
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Recovery Plans</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Centralised tracking of all savings recovery actions
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total plans</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Overdue</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{summary.overdue_count}</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">In Progress</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{summary.by_status["In Progress"] ?? 0}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">Total to Recover</p>
            <p className="mt-1 text-lg font-bold text-amber-700">{fmt(summary.total_amount_to_recover)}</p>
          </div>
        </div>
      )}

      {/* Status breakdown bar */}
      {summary && summary.total > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Status breakdown
          </p>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {(["Planned", "In Progress", "Done"] as const).map((s) => {
              const count = summary.by_status[s] ?? 0;
              const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
              const colors = { Planned: "bg-amber-400", "In Progress": "bg-blue-400", Done: "bg-emerald-400" };
              return pct > 0 ? (
                <div key={s} className={`${colors[s]} transition-all`} style={{ width: `${pct}%` }} title={`${s}: ${count}`} />
              ) : null;
            })}
          </div>
          <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
            {(["Planned", "In Progress", "Done"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  s === "Done" ? "bg-emerald-400" : s === "In Progress" ? "bg-blue-400" : "bg-amber-400"
                }`} />
                {s} ({summary.by_status[s] ?? 0})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={13} className="text-slate-400" />
        <div className="flex gap-1 rounded-xl border border-slate-100 bg-white p-1 shadow-sm">
          {["Active", "All", "Planned", "In Progress", "Done"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors ${
                filterStatus === s
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          className="rounded-xl border border-slate-100 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm outline-none"
          value={filterPlant}
          onChange={(e) => setFilterPlant(e.target.value)}
        >
          {plants.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select
          className="rounded-xl border border-slate-100 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm outline-none"
          value={filterFollower}
          onChange={(e) => setFilterFollower(e.target.value)}
        >
          {followers.map((f) => <option key={f}>{f}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-slate-400">
          {sorted.length} plan{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Content */}
      {loading && (
        <div className="py-16 text-center text-sm text-slate-400">
          <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-slate-300" />
          Loading recovery plans…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="py-16 text-center">
          <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-300" />
          <p className="text-sm font-semibold text-slate-500">No recovery plans matching filters</p>
          <p className="text-xs text-slate-400 mt-1">
            Recovery plans appear here when a monthly outcome is set to "Recover".
          </p>
        </div>
      )}

      {!loading && !error && sorted.length > 0 && (
        <div className="space-y-3">
          {/* Overdue section */}
          {sorted.some((i) => i.is_overdue) && (
            <>
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-red-500" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-red-500">
                  Overdue ({sorted.filter((i) => i.is_overdue).length})
                </p>
              </div>
              {sorted.filter((i) => i.is_overdue).map((item) => (
                <RecoveryCard key={item.financial_line_id} item={item} userEmail={userEmail} onRefresh={load} />
              ))}
              <div className="flex items-center gap-2 pt-2">
                <TrendingDown size={12} className="text-slate-400" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  In progress / Planned ({sorted.filter((i) => !i.is_overdue && i.recovery_status !== "Done").length})
                </p>
              </div>
            </>
          )}
          {sorted.filter((i) => !i.is_overdue).map((item) => (
            <RecoveryCard key={item.financial_line_id} item={item} userEmail={userEmail} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
