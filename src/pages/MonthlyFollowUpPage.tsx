import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Save,
  AlertTriangle,
  X,
  CheckCircle2,
  Filter,
  CalendarDays,
  ListChecks,
  LayoutGrid,
} from "lucide-react";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";
import { PageIntro } from "../components/UI";

// ─── Types (subset of the opportunity payload we need here) ──────────────────
interface MonthlyRow {
  monthly_financial_id: number;
  financial_line_id: number;
  period_month?: string;
  expected_saving?: number;
  actual_saving?: number;
  delta_vs_expected?: number;
  forecast_eoy_saving?: number;
  comment?: string;
  monthly_outcome?: string;
}
interface FinLine {
  financial_line_id: number;
  line_name?: string;
  component_name?: string;
  status?: string;
  is_escalated?: boolean;
  escalation_reason?: string;
  recovery_status?: string;
  recovery_amount?: number;
  recovery_target_date?: string;
  recovery_note?: string;
  monthly_financials: MonthlyRow[];
}
interface Opp {
  opportunity_id: number;
  opportunity_name?: string;
  opportunity_type?: string;
  phase_status?: string;
  plant_name?: string;
  conversion_owner?: string;
  currency?: string;
  fx_rate_to_eur?: number;
  real_start_date?: string;
  planned_start_date?: string;
  financial_lines: FinLine[];
  budget_years?: { fiscal_year: number; budget_status?: string }[];
}
interface GridRow {
  oppId: number;
  oppName: string;
  oppType?: string;
  plantName?: string;
  conversionOwner?: string;
  budgetStatus?: string;
  currency?: string;
  fxRate: number; // rate to EUR for consolidated totals
  multiLine?: boolean; // true when the opportunity has more than one financial line in view
  line: FinLine;
  month: MonthlyRow;
}
interface Edit {
  actual_saving: string;
  forecast_eoy_saving: string;
  monthly_outcome: string;
  comment: string;
}

// ─── Shared style tokens (light + dark) ──────────────────────────────────────
const cardCls =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#0a1628]";
const cardHeadCls =
  "flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-white/[0.06]";
const labelCls =
  "text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";
const selectCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#0d1929] dark:text-slate-200";
const cellInputCls =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 tabular-nums outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.12] dark:bg-[#0d1929] dark:text-slate-200";
// Subtle tint marking the editable "entry zone" columns (vs read-only data)
const editColCls = "bg-sky-50/50 dark:bg-sky-400/[0.045]";
const editColEdge = "border-l border-slate-200/70 dark:border-white/[0.07]";

const OUTCOMES = ["", "Continue", "Recover", "Escalate"];

const fmt = (v?: number | null) =>
  v == null || (typeof v === "number" && isNaN(v))
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v);

// Currency-aware formatter for per-opportunity (transaction-currency) amounts
const CUR_SYMBOL: Record<string, string> = { EUR: "€", USD: "$", RMB: "¥", INR: "₹" };
const fmtCur = (v?: number | null, currency?: string | null) => {
  if (v == null || (typeof v === "number" && isNaN(v))) return "—";
  const sym = CUR_SYMBOL[currency ?? "EUR"] ?? `${currency} `;
  const body = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.abs(v));
  return `${v < 0 ? "-" : ""}${sym}${body}`;
};

const num = (s: string) => (s.trim() === "" ? undefined : parseFloat(s) || 0);
// API serialises Decimals as strings — coerce safely for arithmetic
const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);

function BudgetTag({ status }: { status?: string }) {
  if (status === "Budgeted")
    return (
      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
        Budgeted
      </span>
    );
  if (status === "Opportunity")
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        Opportunity
      </span>
    );
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500">
      Empty
    </span>
  );
}

function DeltaPill({ value, currency }: { value: number | null; currency?: string }) {
  if (value == null) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  const neg = value < 0;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
        neg
          ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
          : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
      }`}
    >
      {fmtCur(value, currency)}
    </span>
  );
}

export default function MonthlyFollowUpPage() {
  const { user } = useAuth();
  const userEmail = (user as { email?: string })?.email ?? "";
  // Purchasing Director / VP Conversion may enter real savings on any
  // opportunity, not just the ones they own — mirrors the backend, where
  // _PRIVILEGED clears the checks on PUT /monthly/{id}.
  const isPrivileged =
    user?.access_profile === "purchasing_director" ||
    user?.access_profile === "vp_conversion";

  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [owner, setOwner] = useState<string>("");
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Tabs: monthly entry grid vs. current-year per-opportunity overview
  const [tab, setTab] = useState<"monthly" | "year">("monthly");

  // Monthly-tab filters (on top of the conversion-owner filter above)
  const [filterMissing, setFilterMissing] = useState(false); // only rows with no actual entered
  const [filterOutcome, setFilterOutcome] = useState("All"); // Continue / Recover / Escalate / (empty)
  const [filterDelta, setFilterDelta] = useState<"All" | "Positive" | "Negative">("All"); // performance
  const [filterReporting, setFilterReporting] = useState<"All" | "On time" | "Late">("All"); // entry timeliness

  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [touched, setTouched] = useState<Set<number>>(new Set());

  const [recoveryLine, setRecoveryLine] = useState<FinLine | null>(null);
  const [escalateLine, setEscalateLine] = useState<FinLine | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listOpportunities();
      setOpps((res.data?.items as Opp[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const ownerOptions = useMemo(
    () =>
      [
        ...new Set(
          opps
            .filter((o) => ["Phase 3", "Phase 4", "Closed"].includes(o.phase_status ?? "") && o.conversion_owner)
            .map((o) => o.conversion_owner as string),
        ),
      ].sort(),
    [opps],
  );

  const rows = useMemo<GridRow[]>(() => {
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const out: GridRow[] = [];
    for (const o of opps) {
      if (!["Phase 3", "Phase 4", "Closed"].includes(o.phase_status ?? "")) continue;
      if (owner && o.conversion_owner !== owner) continue; // owner is an optional filter
      for (const line of o.financial_lines ?? []) {
        if (line.status && line.status !== "Active") continue;
        // "Missing only" bypasses the month selector: every monthly row up to the
        // CURRENT month (this month + past months) that has no actual entered.
        // Otherwise: just the selected month.
        const monthsForLine = (line.monthly_financials ?? []).filter((r) => {
          const mk = (r.period_month ?? "").slice(0, 7);
          if (!mk) return false;
          return filterMissing
            ? mk <= currentMonthKey && r.actual_saving == null
            : mk === month;
        });
        for (const m of monthsForLine) {
          const fy = parseInt((m.period_month ?? "").slice(0, 4)) || 0;
          const byStatus = o.budget_years?.find((b) => b.fiscal_year === fy)?.budget_status;
          out.push({
            oppId: o.opportunity_id,
            oppName: o.opportunity_name || `Opportunity ${o.opportunity_id}`,
            oppType: o.opportunity_type,
            plantName: o.plant_name,
            conversionOwner: o.conversion_owner,
            budgetStatus: byStatus,
            currency: o.currency || "EUR",
            fxRate: o.fx_rate_to_eur != null ? Number(o.fx_rate_to_eur) || 1 : 1,
            line,
            month: m,
          });
        }
      }
    }
    // Flag opportunities that have more than one DISTINCT financial line in view
    // (component lines) — not merely several months of the same line.
    const lineSets: Record<number, Set<number>> = {};
    out.forEach((r) => {
      (lineSets[r.oppId] ??= new Set()).add(r.line.financial_line_id);
    });
    out.forEach((r) => (r.multiLine = (lineSets[r.oppId]?.size ?? 0) > 1));
    // In missing mode, sort by month first so the oldest gaps surface at the top.
    return out.sort((a, b) => {
      if (filterMissing) {
        const ma = a.month.period_month ?? "";
        const mb = b.month.period_month ?? "";
        if (ma !== mb) return ma.localeCompare(mb);
      }
      return (
        a.oppName.localeCompare(b.oppName) ||
        a.line.financial_line_id - b.line.financial_line_id
      );
    });
  }, [opps, owner, month, filterMissing]);

  // Is the selected month strictly in the past? (used by the "Late" reporting filter)
  const monthIsPast = month < new Date().toISOString().slice(0, 7);

  // Filters apply on the SAVED values (not live edits) so a row never disappears
  // mid-typing. Reporting-late = a past month with no actual entered; performance
  // (delta) = actual vs expected once an actual exists.
  const filteredRows = useMemo<GridRow[]>(() => {
    return rows.filter((r) => {
      const hasActual = r.month.actual_saving != null;
      if (filterMissing && hasActual) return false;
      if (filterOutcome !== "All" && (r.month.monthly_outcome ?? "") !== filterOutcome)
        return false;
      if (filterDelta !== "All") {
        if (!hasActual) return false;
        const d = n(r.month.actual_saving) - n(r.month.expected_saving);
        if (filterDelta === "Positive" && d < 0) return false;
        if (filterDelta === "Negative" && d >= 0) return false;
      }
      if (filterReporting === "Late" && !(monthIsPast && !hasActual)) return false;
      if (filterReporting === "On time" && !hasActual) return false;
      return true;
    });
  }, [rows, filterMissing, filterOutcome, filterDelta, filterReporting, monthIsPast]);

  useEffect(() => {
    const seed: Record<number, Edit> = {};
    for (const r of rows) {
      seed[r.month.monthly_financial_id] = {
        actual_saving: r.month.actual_saving != null ? String(r.month.actual_saving) : "",
        forecast_eoy_saving:
          r.month.forecast_eoy_saving != null ? String(r.month.forecast_eoy_saving) : "",
        monthly_outcome: r.month.monthly_outcome ?? "",
        comment: r.month.comment ?? "",
      };
    }
    setEdits(seed);
    setTouched(new Set());
  }, [rows]);

  const setField = (monthId: number, field: keyof Edit, value: string) => {
    setEdits((prev) => ({ ...prev, [monthId]: { ...prev[monthId], [field]: value } }));
    setTouched((prev) => new Set(prev).add(monthId));
  };

  const totals = useMemo(() => {
    let expected = 0,
      actual = 0,
      eoy = 0,
      delta = 0;
    // Totals are consolidated in EUR (rows may be in EUR/USD/RMB/INR) via each row's fx rate.
    for (const r of filteredRows) {
      const e = edits[r.month.monthly_financial_id];
      const fx = r.fxRate || 1;
      const exp = n(r.month.expected_saving) * fx;
      const hasActual = e ? e.actual_saving.trim() !== "" : r.month.actual_saving != null;
      const act = (e?.actual_saving ? n(e.actual_saving) : n(r.month.actual_saving)) * fx;
      expected += exp;
      actual += act;
      eoy += (e?.forecast_eoy_saving ? n(e.forecast_eoy_saving) : n(r.month.forecast_eoy_saving)) * fx;
      // Δ only over rows where an actual is entered — matches the per-row Δ cells
      // (blank rows show "—" and must not count as a full miss).
      if (hasActual) delta += act - exp;
    }
    return { expected, actual, eoy, delta };
  }, [filteredRows, edits]);

  async function saveAll() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const ids = [...touched];
      for (const id of ids) {
        const e = edits[id];
        if (!e) continue;
        await supplierAPI.updateMonthlyActual(id, {
          actual_saving: num(e.actual_saving),
          forecast_eoy_saving: num(e.forecast_eoy_saving),
          monthly_outcome: e.monthly_outcome || undefined,
          comment: e.comment || undefined,
          updated_by: userEmail,
        });
      }
      await load();
      setNotice(`Saved ${ids.length} row(s).`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const monthLabel = (() => {
    const [y, m] = month.split("-");
    if (!y || !m) return month;
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  })();

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col gap-6">
      <PageIntro
        eyebrow="Purchasing Value"
        title="Monthly Follow-up"
        description="Phase 3 monthly entry — all Phase 3 opportunities for the chosen month. Filter by conversion owner if needed, then fill the actuals, EOY forecast and outcome."
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/[0.08]">
        {(
          [
            ["monthly", "Monthly entry", ListChecks],
            ["year", "Year overview", LayoutGrid],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Selection */}
      <div className={cardCls}>
        <div className={cardHeadCls}>
          <Filter size={13} className="text-slate-400 dark:text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Selection
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Conversion owner</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className={`${selectCls} min-w-[260px]`}>
              <option value="">All conversion owners</option>
              {ownerOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          {/* Month + extra filters — monthly entry tab only (Year overview has its own Year filter) */}
          {tab === "monthly" && (
            <>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Month</label>
                <input
                  type="month"
                  value={month}
                  max={new Date().toISOString().slice(0, 7)}
                  onChange={(e) => setMonth(e.target.value)}
                  className={selectCls}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Outcome</label>
                <select
                  value={filterOutcome}
                  onChange={(e) => setFilterOutcome(e.target.value)}
                  className={selectCls}
                >
                  <option value="All">All</option>
                  <option value="">— (empty)</option>
                  <option value="Continue">Continue</option>
                  <option value="Recover">Recover</option>
                  <option value="Escalate">Escalate</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Delta (performance)</label>
                <select
                  value={filterDelta}
                  onChange={(e) =>
                    setFilterDelta(e.target.value as "All" | "Positive" | "Negative")
                  }
                  className={selectCls}
                >
                  <option value="All">All</option>
                  <option value="Positive">Positive (≥ target)</option>
                  <option value="Negative">Negative (behind)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Reporting</label>
                <select
                  value={filterReporting}
                  onChange={(e) =>
                    setFilterReporting(e.target.value as "All" | "On time" | "Late")
                  }
                  className={selectCls}
                >
                  <option value="All">All</option>
                  <option value="On time">On time (filled)</option>
                  <option value="Late">Late (past, missing)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={filterMissing}
                  onChange={(e) => setFilterMissing(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Missing only
              </label>
              {(filterMissing ||
                filterOutcome !== "All" ||
                filterDelta !== "All" ||
                filterReporting !== "All") && (
                <button
                  onClick={() => {
                    setFilterMissing(false);
                    setFilterOutcome("All");
                    setFilterDelta("All");
                    setFilterReporting("All");
                  }}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/[0.1] dark:text-slate-300"
                >
                  <X size={12} /> Reset filters
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {tab === "monthly" && (
      <>
      <div className={`overflow-hidden ${cardCls}`}>
          {/* Toolbar — title + actions (totals live in the TOTAL row at the bottom) */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5 dark:border-white/[0.06] dark:from-white/[0.03] dark:to-transparent">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                <CalendarDays size={14} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-100">
                  {filterMissing ? "Missing entries — up to current month" : `Opportunities — ${monthLabel}`}
                </div>
                <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {filteredRows.length} line{filteredRows.length === 1 ? "" : "s"} · {owner || "all owners"}
                  {filterMissing && " · all months, current + past, not filled"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.04]"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button
                onClick={saveAll}
                disabled={saving || touched.size === 0}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500 active:scale-95 disabled:opacity-50"
              >
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                Save{touched.size > 0 ? ` (${touched.size})` : ""}
              </button>
            </div>
          </div>

          <div className="scroll-x-visible">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200/70 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Opportunity</th>
                  <th className="px-3 py-3 font-semibold">Conversion owner</th>
                  <th className="px-3 py-3 font-semibold">Budget</th>
                  <th className="px-3 py-3 text-right font-semibold">Expected</th>
                  <th className={`px-3 py-3 text-right font-semibold ${editColCls} ${editColEdge}`}>Actual</th>
                  <th className={`px-3 py-3 text-right font-semibold ${editColCls}`}>Δ</th>
                  <th className={`px-3 py-3 text-right font-semibold ${editColCls}`}>EOY forecast</th>
                  <th className={`px-3 py-3 font-semibold ${editColCls}`}>Outcome</th>
                  <th className={`px-3 py-3 font-semibold ${editColCls}`}>Comment</th>
                  <th className="px-3 py-3 font-semibold">Recovery / Escalate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500">
                      {filterMissing
                        ? `No unfilled month${owner ? ` for ${owner}` : ""} up to the current month — all caught up.`
                        : `No Phase 3 opportunity${owner ? ` for ${owner}` : ""} matching the filters in ${monthLabel}.`}
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredRows.map((r) => {
                    const e = edits[r.month.monthly_financial_id];
                    const rowEditable =
                      isPrivileged ||
                      (r.conversionOwner ?? "").trim().toLowerCase() ===
                        userEmail.trim().toLowerCase();
                    const actualNum = e?.actual_saving ? n(e.actual_saving) : null;
                    const delta = actualNum != null ? actualNum - n(r.month.expected_saving) : null;
                    return (
                      <tr
                        key={r.month.monthly_financial_id}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.025]"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{r.oppName}</span>
                            {filterMissing && r.month.period_month && (
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                {new Date(r.month.period_month).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
                              </span>
                            )}
                            {r.currency && r.currency !== "EUR" && (
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                                {r.currency}
                              </span>
                            )}
                            {r.multiLine && (
                              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
                                {r.line.component_name && r.line.component_name !== "Default"
                                  ? r.line.component_name
                                  : "Main line"}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {[
                              r.plantName,
                              !r.multiLine && r.line.component_name && r.line.component_name !== "Default"
                                ? r.line.component_name
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {r.multiLine && <span className="italic"> · same opportunity, component line</span>}
                            {r.line.is_escalated && (
                              <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-rose-50 px-1 text-[9px] font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                                <AlertTriangle size={8} /> escalated
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                          {r.conversionOwner || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <BudgetTag status={r.budgetStatus} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-500 dark:text-slate-400">
                          {fmtCur(r.month.expected_saving, r.currency)}
                        </td>
                        <td className={`px-3 py-2.5 text-right ${editColCls} ${editColEdge}`}>
                          <input
                            type="number"
                            step="0.01"
                            value={e?.actual_saving ?? ""}
                            onChange={(ev) => setField(r.month.monthly_financial_id, "actual_saving", ev.target.value)}
                            disabled={!rowEditable}
                            className={`w-24 text-right ${cellInputCls} disabled:cursor-not-allowed disabled:opacity-40`}
                          />
                        </td>
                        <td className={`px-3 py-2.5 text-right ${editColCls}`}>
                          <DeltaPill value={delta} currency={r.currency} />
                        </td>
                        <td className={`px-3 py-2.5 text-right ${editColCls}`}>
                          <input
                            type="number"
                            step="0.01"
                            value={e?.forecast_eoy_saving ?? ""}
                            onChange={(ev) =>
                              setField(r.month.monthly_financial_id, "forecast_eoy_saving", ev.target.value)
                            }
                            disabled={!rowEditable}
                            className={`w-24 text-right ${cellInputCls} disabled:cursor-not-allowed disabled:opacity-40`}
                          />
                        </td>
                        <td className={`px-3 py-2.5 ${editColCls}`}>
                          <select
                            value={e?.monthly_outcome ?? ""}
                            onChange={(ev) => setField(r.month.monthly_financial_id, "monthly_outcome", ev.target.value)}
                            disabled={!rowEditable}
                            className={`${cellInputCls} disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            {OUTCOMES.map((o) => (
                              <option key={o} value={o}>
                                {o || "—"}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={`px-3 py-2.5 ${editColCls}`}>
                          <input
                            value={e?.comment ?? ""}
                            onChange={(ev) => setField(r.month.monthly_financial_id, "comment", ev.target.value)}
                            placeholder={rowEditable ? "Note…" : "—"}
                            disabled={!rowEditable}
                            className={`w-40 ${cellInputCls} disabled:cursor-not-allowed disabled:opacity-40`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setRecoveryLine(r.line)}
                              className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                            >
                              {r.line.recovery_status ? `Recovery: ${r.line.recovery_status}` : "Recovery"}
                            </button>
                            <button
                              onClick={() => setEscalateLine(r.line)}
                              className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                            >
                              Escalate
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              {!loading && filteredRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-100/70 text-[13px] font-bold text-slate-800 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100">
                    <td className="px-4 py-3">TOTAL ({filteredRows.length}) · EUR</td>
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.expected)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${editColEdge}`}>{fmt(totals.actual)}</td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 tabular-nums ${
                          totals.delta < 0
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                        }`}
                      >
                        {fmt(totals.delta)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmt(totals.eoy)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
      </div>

      <p className="px-1 text-[11px] text-slate-400 dark:text-slate-500">
        Editing is allowed only in Phase 3. The EOY forecast must be ≥ the cumulated actual to
        date. Setting an outcome to <strong>Escalate</strong> flags the opportunity automatically.
        Per-opportunity amounts are in their own currency; the <strong>TOTAL row is consolidated
        in EUR</strong> (group reporting currency).
      </p>
      </>
      )}

      {tab === "year" && (
        <YearOverview opps={opps} owner={owner} loading={loading} />
      )}

      {recoveryLine && (
        <RecoveryModal
          line={recoveryLine}
          userEmail={userEmail}
          onClose={() => setRecoveryLine(null)}
          onSaved={() => {
            setRecoveryLine(null);
            load();
          }}
        />
      )}
      {escalateLine && (
        <EscalateModal
          line={escalateLine}
          userEmail={userEmail}
          onClose={() => setEscalateLine(null)}
          onSaved={() => {
            setEscalateLine(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── Recovery plan modal ─────────────────────────────────────────────────────
function RecoveryModal({
  line,
  userEmail,
  onClose,
  onSaved,
}: {
  line: FinLine;
  userEmail: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(line.recovery_status || "Planned");
  const [amount, setAmount] = useState(line.recovery_amount != null ? String(line.recovery_amount) : "");
  const [target, setTarget] = useState(line.recovery_target_date ?? "");
  const [note, setNote] = useState(line.recovery_note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await supplierAPI.setRecovery(line.financial_line_id, {
        recovery_status: status,
        recovery_amount: amount.trim() === "" ? undefined : parseFloat(amount) || 0,
        recovery_target_date: target || undefined,
        recovery_note: note || undefined,
        updated_by: userEmail,
      });
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Recovery plan — ${line.line_name || "line"}`} onClose={onClose}>
      {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{err}</p>}
      <label className={labelCls}>Status</label>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={`w-full ${selectCls}`}>
        {["Planned", "In Progress", "Done"].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <label className={labelCls}>Amount to recover (€)</label>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={`w-full ${selectCls}`} />
      <label className={labelCls}>Target date</label>
      <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className={`w-full ${selectCls}`} />
      <label className={labelCls}>Note</label>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`w-full ${selectCls}`} />
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/[0.1] dark:text-slate-300">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Save
        </button>
      </div>
    </Modal>
  );
}

// ─── Escalate modal ──────────────────────────────────────────────────────────
function EscalateModal({
  line,
  userEmail,
  onClose,
  onSaved,
}: {
  line: FinLine;
  userEmail: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState(line.escalation_reason ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go(deescalate: boolean) {
    setBusy(true);
    setErr(null);
    try {
      if (deescalate) {
        await supplierAPI.deescalateFinancialLine(line.financial_line_id);
      } else {
        if (reason.trim().length < 3) {
          setErr("Please enter a reason.");
          setBusy(false);
          return;
        }
        await supplierAPI.escalateFinancialLine(line.financial_line_id, {
          escalation_reason: reason,
          escalated_by: userEmail,
        });
      }
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Escalate — ${line.line_name || "line"}`} onClose={onClose}>
      {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{err}</p>}
      <label className={labelCls}>Reason</label>
      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this opportunity escalated?"
        className={`w-full ${selectCls}`}
      />
      <div className="flex justify-between gap-2 pt-1">
        {line.is_escalated ? (
          <button
            onClick={() => go(true)}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/[0.1] dark:text-slate-300 dark:hover:bg-white/[0.04]"
          >
            De-escalate
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/[0.1] dark:text-slate-300">
            Cancel
          </button>
          <button
            onClick={() => go(false)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? <RefreshCw size={12} className="animate-spin" /> : <AlertTriangle size={12} />} Escalate
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Shared modal shell ──────────────────────────────────────────────────────
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl dark:border-white/[0.08] dark:bg-[#0a1628]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Year overview tab ───────────────────────────────────────────────────────
// One row per opportunity active in the selected year, with its actual saving
// per month (EUR consolidated) and the min→max month window it spans that year.
const YEAR_NOW = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => YEAR_NOW - 3 + i);

// French "mois-année" label from a "YYYY-MM" key, e.g. "mai 25".
const fmtMonthYear = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
};
const fmtStart = (s?: string | null) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";
const nf0 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const nextKey = (key: string) => {
  let [y, m] = key.split("-").map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
};

interface YearRow {
  oppId: number;
  oppName: string;
  owner?: string;
  startDate?: string | null;
  perMonth: Record<string, number | null>; // "YYYY-MM" -> EUR actual (null = row, no actual)
  minKey: string | null;
  maxKey: string | null;
  total: number;
}

function YearOverview({
  opps,
  owner,
  loading,
}: {
  opps: Opp[];
  owner: string;
  loading: boolean;
}) {
  const [year, setYear] = useState(YEAR_NOW);

  const { rows, monthKeys } = useMemo(() => {
    const maxKey = `${year}-12`;
    const collected: {
      o: Opp;
      perMonth: Record<string, number | null>;
      firstKey: string | null;
      lastKey: string | null;
    }[] = [];
    let globalMin: string | null = null;

    for (const o of opps) {
      if (!["Phase 3", "Phase 4", "Closed"].includes(o.phase_status ?? "")) continue;
      if (owner && o.conversion_owner !== owner) continue;
      const fx = o.fx_rate_to_eur != null ? Number(o.fx_rate_to_eur) || 1 : 1;
      const perMonth: Record<string, number | null> = {};
      let firstKey: string | null = null;
      let lastKey: string | null = null;
      let activeInYear = false;
      for (const line of o.financial_lines ?? []) {
        if (line.status && line.status !== "Active") continue;
        for (const m of line.monthly_financials ?? []) {
          const pm = (m.period_month ?? "").slice(0, 7);
          if (!pm || pm > maxKey) continue; // cap at December of the selected year
          if (pm.slice(0, 4) === String(year)) activeInYear = true;
          if (!firstKey || pm < firstKey) firstKey = pm;
          if (!lastKey || pm > lastKey) lastKey = pm;
          if (m.actual_saving != null) {
            perMonth[pm] = (perMonth[pm] ?? 0) + n(m.actual_saving) * fx;
          } else if (!(pm in perMonth)) {
            perMonth[pm] = null;
          }
        }
      }
      // Only opportunities active during the selected year (a monthly row in that
      // year); their earlier residual months (prior year) are still shown.
      if (!activeInYear) continue;
      collected.push({ o, perMonth, firstKey, lastKey });
      if (firstKey && (!globalMin || firstKey < globalMin)) globalMin = firstKey;
    }

    // Columns span from the earliest active month across all opps to Dec(year).
    const monthKeys: string[] = [];
    if (globalMin) {
      for (let k = globalMin; k <= maxKey; k = nextKey(k)) monthKeys.push(k);
    }

    const rows: YearRow[] = collected
      .map((c) => ({
        oppId: c.o.opportunity_id,
        oppName: c.o.opportunity_name || `Opportunity ${c.o.opportunity_id}`,
        owner: c.o.conversion_owner,
        startDate: c.o.real_start_date ?? c.o.planned_start_date ?? null,
        perMonth: c.perMonth,
        minKey: c.firstKey,
        maxKey: c.lastKey,
        total: monthKeys.reduce((s, k) => s + (c.perMonth[k] ?? 0), 0),
      }))
      .sort((a, b) => a.oppName.localeCompare(b.oppName));

    return { rows, monthKeys };
  }, [opps, owner, year]);

  const monthTotals = monthKeys.map((k) =>
    rows.reduce((s, r) => s + (r.perMonth[k] ?? 0), 0),
  );
  const grandTotal = monthTotals.reduce((s, v) => s + v, 0);
  const colSpan = 6 + monthKeys.length; // Nom, Owner, Start, Mois début, [months], Mois fin, Total

  return (
    <div className={`overflow-hidden ${cardCls}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5 dark:border-white/[0.06] dark:from-white/[0.03] dark:to-transparent">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <LayoutGrid size={14} />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-100">
              Year overview — {year}
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {rows.length} opportunit{rows.length === 1 ? "y" : "ies"} · actual saving per month (EUR) · {owner || "all owners"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={labelCls}>Year</span>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className={selectCls}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="scroll-x-visible">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200/70 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Nom Opp</th>
              <th className="px-3 py-3 font-semibold">Opp owner</th>
              <th className="px-3 py-3 font-semibold">Starting date</th>
              <th className="px-3 py-3 font-semibold">Mois début</th>
              {monthKeys.map((k) => (
                <th key={k} className="px-2 py-3 text-right font-semibold whitespace-nowrap">
                  {fmtMonthYear(k)}
                </th>
              ))}
              <th className="px-3 py-3 font-semibold">Mois fin</th>
              <th className="px-3 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-white/[0.04]">
            {loading && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-8 text-center text-slate-400 dark:text-slate-500">
                  No opportunity{owner ? ` for ${owner}` : ""} active in {year}.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr
                  key={r.oppId}
                  className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.025]"
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {r.oppName}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {r.owner || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {fmtStart(r.startDate)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {r.minKey ? fmtMonthYear(r.minKey) : "—"}
                  </td>
                  {monthKeys.map((k) => {
                    const v = r.perMonth[k];
                    const inWindow =
                      r.minKey != null && r.maxKey != null && k >= r.minKey && k <= r.maxKey;
                    return (
                      <td
                        key={k}
                        className={`px-2 py-2.5 text-right tabular-nums ${
                          v != null
                            ? "text-slate-700 dark:text-slate-200"
                            : inWindow
                              ? "text-amber-500"
                              : "text-slate-300 dark:text-slate-600"
                        }`}
                      >
                        {v != null ? nf0.format(v) : inWindow ? "·" : "-"}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {r.maxKey ? fmtMonthYear(r.maxKey) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {fmt(r.total)}
                  </td>
                </tr>
              ))}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-100/70 text-[13px] font-bold text-slate-800 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100">
                <td className="px-4 py-3" colSpan={4}>
                  TOTAL ({rows.length}) · EUR
                </td>
                {monthTotals.map((v, i) => (
                  <td key={i} className="px-2 py-3 text-right tabular-nums">
                    {v ? nf0.format(v) : "-"}
                  </td>
                ))}
                <td className="px-3 py-3" />
                <td className="px-3 py-3 text-right tabular-nums">{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
