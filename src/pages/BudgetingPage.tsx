import { useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  ClipboardList,
  X,
  Save,
  TrendingDown,
  TrendingUp,
  Lock,
} from "lucide-react";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BudgetYearItem {
  id: number;
  opportunity_id: number;
  opportunity_name?: string;
  opportunity_type?: string;
  plant_name?: string;
  purchasing_owner?: string;
  phase_status?: string;
  fiscal_year: number;
  applicable_amount?: number | null;
  currency?: string | null;
  fx_rate_to_eur?: number | null;
  applicable_amount_eur?: number | null;
  portion_kind?: string | null;
  budget_status?: string | null;
  suggested_status?: string | null;
  is_additional?: boolean;
  status_locked_at?: string | null;
  eoy_forecast_eur?: number | null;
  expected_annual_saving_eur?: number | null;
  actual_ytd_eur?: number | null;
  delta_ytd_eur?: number | null;
  delta_eoy_budget?: number | null;
  real_start_date?: string | null;
  duration_months?: number | null;
}

interface BudgetClosure {
  fiscal_year: number;
  closed_at: string;
  closed_by: string;
}

interface Summary {
  total: number;
  total_baseline: number;
  total_additional: number;
  baseline_budgeted_eur: number;
  additional_accepted_eur: number;
  total_budget_eur: number;
  additional_pending: number;
  additional_accepted: number;
  additional_rejected: number;
  total_applicable: number;
  total_budgeted: number;
  total_opportunity: number;
  total_empty: number;
  total_validated: number;
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
  s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDuration = (months?: number | null) => {
  if (months == null) return "—";
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
};

const CUR_SYMBOL: Record<string, string> = { EUR: "€", USD: "$", RMB: "¥", INR: "₹" };
const fmtCur = (n?: number | null, currency?: string | null) => {
  if (n == null) return "—";
  const sym = CUR_SYMBOL[currency ?? "EUR"] ?? `${currency} `;
  const body = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.abs(n));
  return `${n < 0 ? "-" : ""}${sym}${body}`;
};

const TYPE_COLORS: Record<string, string> = {
  Negotiation: "bg-blue-100 text-blue-700",
  Sourcing: "bg-purple-100 text-purple-700",
  "Technical Productivity": "bg-teal-100 text-teal-700",
  Cash: "bg-amber-100 text-amber-700",
};

const PORTION_COLORS: Record<string, string> = {
  Applicable: "bg-sky-100 text-sky-700",
  Total: "bg-emerald-100 text-emerald-700",
  Residual: "bg-orange-100 text-orange-700",
};

const _CY = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => _CY - 2 + i);

function budgetYearWindowLabel(year: number) {
  return `01 Jan ${year} – 31 Dec ${year}`;
}

function BudgetStatusBadge({ status, isAdditional }: { status?: string | null; isAdditional?: boolean }) {
  if (status === "Budgeted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
        <CheckCircle2 size={11} /> {isAdditional ? "Accepted" : "Budgeted"}
      </span>
    );
  }
  if (status === "Empty") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-500">
        {isAdditional ? "Rejected" : "Excluded"}
      </span>
    );
  }
  // Opportunity = Pending for additional, Opportunity for baseline
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      {isAdditional ? "Pending" : "Opportunity"}
    </span>
  );
}

// Shared table columns (used in both sections)
const COL_HEADER = "px-3 py-2.5 font-semibold";

export default function BudgetingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userEmail = (user as { email?: string })?.email ?? "";
  const isPrivileged = ["vp_conversion", "purchasing_director"].includes(
    (user as { access_profile?: string })?.access_profile ?? "",
  );

  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [items, setItems] = useState<BudgetYearItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [closure, setClosure] = useState<BudgetClosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-Budget mode — only for baseline rows (before closure)
  const [selectMode, setSelectMode] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Close Budget Year
  const [closing, setClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Additional decisions — inline edits on additional rows
  const [additionalDecisions, setAdditionalDecisions] = useState<Record<number, string>>({});
  const [savingAdditional, setSavingAdditional] = useState(false);

  const loadRequestRef = useRef(0);

  async function load(year: number) {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listBudgetYears(year);
      if (requestId !== loadRequestRef.current) return;
      const data = (res as { data: { items: BudgetYearItem[]; summary: Summary; closure: BudgetClosure | null } }).data;
      setItems(data.items);
      setSummary(data.summary);
      setClosure(data.closure ?? null);
      const baselineSeed: Record<number, string> = {};
      const additionalSeed: Record<number, string> = {};
      data.items.forEach((i) => {
        if (i.is_additional) additionalSeed[i.opportunity_id] = i.budget_status || "Opportunity";
        else baselineSeed[i.opportunity_id] = i.budget_status || "Opportunity";
      });
      setDecisions(baselineSeed);
      setAdditionalDecisions(additionalSeed);
    } catch (err: unknown) {
      if (requestId !== loadRequestRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load budget records");
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }

  async function closeYear() {
    setShowCloseConfirm(false);
    setClosing(true);
    setError(null);
    try {
      await supplierAPI.closeBudgetYear(fiscalYear);
      await load(fiscalYear);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to close budget year.");
    } finally {
      setClosing(false);
    }
  }

  useEffect(() => {
    load(fiscalYear);
    setSelectMode(false);
  }, [fiscalYear]);

  // ── Create Budget (baseline only) ─────────────────────────────────────────

  const baselineItems = items.filter((i) => !i.is_additional);
  const additionalItems = items.filter((i) => i.is_additional);

  const baselineBudgetedCount = baselineItems.filter((i) => decisions[i.opportunity_id] === "Budgeted").length;
  const baselineBudgetedTotal = baselineItems
    .filter((i) => decisions[i.opportunity_id] === "Budgeted")
    .reduce((s, i) => s + (i.applicable_amount_eur ?? i.applicable_amount ?? 0), 0);

  async function saveBudget() {
    setShowConfirm(false);
    setSaving(true);
    setError(null);
    try {
      const seen = new Set<number>();
      const payload = baselineItems
        .filter((i) => { if (seen.has(i.opportunity_id)) return false; seen.add(i.opportunity_id); return true; })
        .map((i) => ({ opportunity_id: i.opportunity_id, budget_status: decisions[i.opportunity_id] || "Opportunity" }));
      await supplierAPI.assignBudget(fiscalYear, payload, userEmail);
      await load(fiscalYear);
      setSelectMode(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save budget");
    } finally {
      setSaving(false);
    }
  }

  // ── Additional decisions ───────────────────────────────────────────────────

  const additionalChanged = additionalItems.some(
    (i) => additionalDecisions[i.opportunity_id] !== (i.budget_status || "Opportunity"),
  );

  async function saveAdditionalDecisions() {
    setSavingAdditional(true);
    setError(null);
    try {
      const seen = new Set<number>();
      const payload = additionalItems
        .filter((i) => { if (seen.has(i.opportunity_id)) return false; seen.add(i.opportunity_id); return true; })
        .map((i) => ({ opportunity_id: i.opportunity_id, budget_status: additionalDecisions[i.opportunity_id] || "Opportunity" }));
      await supplierAPI.assignBudget(fiscalYear, payload, userEmail);
      await load(fiscalYear);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save additional decisions");
    } finally {
      setSavingAdditional(false);
    }
  }

  // ── Table helpers ─────────────────────────────────────────────────────────

  function OppNameCell({ item }: { item: BudgetYearItem }) {
    return (
      <td className="px-3 py-2.5">
        <button
          onClick={() => navigate(`/purchasing-value?opp=${item.opportunity_id}`)}
          className="flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600"
        >
          {item.opportunity_name || `Opportunity ${item.opportunity_id}`}
          <ExternalLink size={10} className="text-slate-300" />
        </button>
        {item.purchasing_owner && <div className="text-[10px] text-slate-400">{item.purchasing_owner}</div>}
      </td>
    );
  }

  function CommonCells({ item }: { item: BudgetYearItem }) {
    return (
      <>
        <td className="px-3 py-2.5 text-slate-600">{item.plant_name || "—"}</td>
        <td className="px-3 py-2.5">
          {item.opportunity_type && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[item.opportunity_type] || "bg-slate-100 text-slate-600"}`}>
              {item.opportunity_type}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-slate-600">{item.phase_status || "—"}</td>
        <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{fmtDate(item.real_start_date)}</td>
        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{fmtDuration(item.duration_months)}</td>
        <td className="px-3 py-2.5">
          {item.portion_kind && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PORTION_COLORS[item.portion_kind] || "bg-slate-100 text-slate-600"}`}>
              {item.portion_kind}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
          {fmtCur(item.applicable_amount, item.currency)}
          {item.currency && item.currency !== "EUR" && item.applicable_amount_eur != null && (
            <div className="text-[10px] font-normal text-slate-400">= {fmt(item.applicable_amount_eur)}</div>
          )}
        </td>
        <td className="px-3 py-2.5 text-right text-slate-700">{fmt(item.eoy_forecast_eur)}</td>
        <td className="px-3 py-2.5 text-right">
          {item.delta_eoy_budget == null ? (
            <span className="text-slate-400">—</span>
          ) : item.delta_eoy_budget >= 0 ? (
            <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
              <TrendingUp size={11} />{fmt(item.delta_eoy_budget)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 font-semibold text-red-500">
              <TrendingDown size={11} />{fmt(item.delta_eoy_budget)}
            </span>
          )}
        </td>
      </>
    );
  }

  function TableHead({ showDecisionCol }: { showDecisionCol: boolean }) {
    return (
      <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
        <tr>
          {showDecisionCol && <th className={COL_HEADER}>Decision</th>}
          <th className={COL_HEADER}>Opportunity</th>
          <th className={COL_HEADER}>Plant</th>
          <th className={COL_HEADER}>Type</th>
          <th className={COL_HEADER}>Phase</th>
          <th className={COL_HEADER}>Deployment Start</th>
          <th className={COL_HEADER}>Savings Duration</th>
          <th className={COL_HEADER}>Portion</th>
          <th className={`${COL_HEADER} text-right`}>Saving FY {fiscalYear}</th>
          <th className={`${COL_HEADER} text-right`}>EOY Forecast</th>
          <th className={`${COL_HEADER} text-right`}>Δ EOY−Budget</th>
          {!showDecisionCol && <th className={COL_HEADER}>Status</th>}
        </tr>
      </thead>
    );
  }

  return (
    <div className="w-full space-y-6 px-6 py-8">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Budgeting</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {selectMode
              ? `Create Budget ${fiscalYear} — set Budgeted / Excluded / Opportunity for each baseline opportunity.`
              : `FY ${fiscalYear} · ${budgetYearWindowLabel(fiscalYear)} · Phase 3+ confirmed opps only`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            disabled={selectMode}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 disabled:opacity-50"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {!selectMode ? (
            <>
              <button onClick={() => load(fiscalYear)} disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              {!closure && (
                <span title={!isPrivileged ? "Purchasing Director or VP Conversion only" : undefined}
                  className={!isPrivileged ? "cursor-not-allowed" : undefined}>
                  <button onClick={() => setSelectMode(true)}
                    disabled={loading || !isPrivileged || baselineItems.length === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-40">
                    <ClipboardList size={12} /> Create Budget
                  </button>
                </span>
              )}
              {!closure && (
                <span title={!isPrivileged ? "Purchasing Director or VP Conversion only" : undefined}
                  className={!isPrivileged ? "cursor-not-allowed" : undefined}>
                  <button onClick={() => setShowCloseConfirm(true)}
                    disabled={loading || !isPrivileged || baselineItems.length === 0}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40">
                    <Lock size={12} /> Close Budget {fiscalYear}
                  </button>
                </span>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setSelectMode(false); load(fiscalYear); }} disabled={saving}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <X size={12} /> Cancel
              </button>
              <button onClick={() => setShowConfirm(true)}
                disabled={saving || baselineItems.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-40">
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Save Budget
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-bold text-slate-800">Confirm budget commitment</h3>
            <p className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              {baselineBudgetedCount} opportunit{baselineBudgetedCount === 1 ? "y" : "ies"} → Budgeted · {fmt(baselineBudgetedTotal)}
            </p>
            <p className="mb-5 text-xs text-slate-500">
              Decisions are saved but <strong>the budget is not closed yet</strong>. Use <em>Close Budget</em> to lock the baseline permanently.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={saveBudget}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">Confirm & save</button>
            </div>
          </div>
        </div>
      )}

      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-bold text-slate-800">Close Budget {fiscalYear}?</h3>
            <ul className="mb-4 space-y-1.5 text-xs text-slate-600 list-disc list-inside">
              <li>All <strong>Budgeted</strong> baseline rows are <strong>locked</strong> — the baseline cannot change.</li>
              <li>Any new Phase 3+ opp with real_start_date in {fiscalYear} will appear as <strong className="text-violet-700">Additional</strong>.</li>
              <li>This action is <strong>irreversible</strong>.</li>
            </ul>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCloseConfirm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={closeYear} disabled={closing}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                {closing ? <RefreshCw size={11} className="animate-spin" /> : <Lock size={11} />} Close Budget {fiscalYear}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Closure banner ── */}
      {closure && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <Lock size={14} className="shrink-0 text-emerald-600" />
          <span>
            Budget <strong>{closure.fiscal_year}</strong> officially closed on{" "}
            <strong>{new Date(closure.closed_at).toLocaleDateString("en-GB")}</strong> by{" "}
            <strong>{closure.closed_by}</strong>. Baseline is locked.
            New qualifying opportunities are automatically marked{" "}
            <span className="font-semibold text-violet-700">Additional</span>.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── 3 KPI Cards ── */}
      {summary && !selectMode && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Card 1 — Initial Baseline */}
          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Initial Baseline Budget
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{fmt(summary.baseline_budgeted_eur)}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {summary.total_baseline} opportunit{summary.total_baseline !== 1 ? "ies" : "y"} · Budgeted &amp; locked at closure
            </p>
          </div>

          {/* Card 2 — Additional */}
          <div className={`rounded-xl border p-4 shadow-sm ${summary.total_additional > 0 ? "border-violet-100 bg-violet-50/40" : "border-slate-100 bg-white"}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Additional (post-closure)
            </p>
            <p className={`mt-1 text-2xl font-bold ${summary.total_additional > 0 ? "text-violet-700" : "text-slate-300"}`}>
              {fmt(summary.additional_accepted_eur)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {summary.additional_accepted} accepted · {summary.additional_pending} pending · {summary.additional_rejected} rejected
            </p>
          </div>

          {/* Card 3 — Total Budget */}
          <div className="rounded-xl border border-slate-100 bg-slate-800 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Total Budget {fiscalYear}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">{fmt(summary.total_budget_eur)}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Baseline {fmt(summary.baseline_budgeted_eur)} + Additional {fmt(summary.additional_accepted_eur)}
            </p>
          </div>
        </div>
      )}

      {/* ── Create Budget live counter ── */}
      {selectMode && baselineItems.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm">
          <span className="text-blue-700">
            <strong>{baselineBudgetedCount}</strong> of {baselineItems.length} set to <strong>Budgeted</strong>
          </span>
          <span className="font-semibold text-blue-800">Total: {fmt(baselineBudgetedTotal)}</span>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <RefreshCw size={20} className="animate-spin text-slate-300" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No Phase 3+ opportunities with confirmed real start date in FY {fiscalYear}.
        </div>
      )}

      {/* ══ Section 1 — Baseline Budget ══════════════════════════════════════ */}
      {!loading && baselineItems.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Baseline Budget
            </span>
            {closure && <Lock size={10} className="text-slate-300" />}
            <span className="text-[11px] text-slate-400">— {baselineItems.length} opportunit{baselineItems.length !== 1 ? "ies" : "y"}</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <TableHead showDecisionCol={selectMode} />
              <tbody className="divide-y divide-slate-50">
                {baselineItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    {selectMode && (
                      <td className="px-3 py-2.5">
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400"
                          value={decisions[item.opportunity_id] || "Opportunity"}
                          onChange={(e) => setDecisions((p) => ({ ...p, [item.opportunity_id]: e.target.value }))}
                        >
                          <option value="Opportunity">Opportunity</option>
                          <option value="Budgeted">Budgeted</option>
                          <option value="Empty">Excluded</option>
                        </select>
                      </td>
                    )}
                    <OppNameCell item={item} />
                    <CommonCells item={item} />
                    {!selectMode && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <BudgetStatusBadge status={item.budget_status} isAdditional={false} />
                          {item.status_locked_at && <Lock size={10} className="text-slate-300" title="Locked" />}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Section 2 — Additional Opportunities ═════════════════════════════ */}
      {!loading && closure && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-violet-500">
                Additional Opportunities
              </span>
              {additionalItems.length > 0 ? (
                <span className="text-[11px] text-slate-400">
                  — {additionalItems.length} opportunit{additionalItems.length !== 1 ? "ies" : "y"} added after budget closure
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">— none yet</span>
              )}
              {summary && summary.additional_pending > 0 && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  {summary.additional_pending} pending decision
                </span>
              )}
            </div>
            {additionalChanged && isPrivileged && (
              <button
                onClick={saveAdditionalDecisions}
                disabled={savingAdditional}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {savingAdditional ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                Save decisions
              </button>
            )}
          </div>
          {additionalItems.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-violet-100 py-8 text-center">
              <p className="text-sm font-semibold text-violet-400">No additional opportunities yet</p>
              <p className="mt-1 text-[11px] text-slate-400">
                When a Phase 3+ opportunity with a {fiscalYear} real start date is confirmed after budget closure,
                it will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-violet-100 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <TableHead showDecisionCol={false} />
                <tbody className="divide-y divide-slate-50">
                  {additionalItems.map((item) => (
                    <tr key={item.id} className="hover:bg-violet-50/30">
                      <OppNameCell item={item} />
                      <CommonCells item={item} />
                      <td className="px-3 py-2.5">
                        {isPrivileged ? (
                          <select
                            className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:border-violet-400"
                            value={additionalDecisions[item.opportunity_id] || "Opportunity"}
                            onChange={(e) => setAdditionalDecisions((p) => ({ ...p, [item.opportunity_id]: e.target.value }))}
                          >
                            <option value="Opportunity">Pending</option>
                            <option value="Budgeted">Accepted</option>
                            <option value="Empty">Rejected</option>
                          </select>
                        ) : (
                          <BudgetStatusBadge status={item.budget_status} isAdditional={true} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-1 text-[10px] text-slate-400">
            Opportunities that reached Phase 3 after budget {fiscalYear} was closed.
            Accept to include their savings in the Additional total, Reject to exclude.
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Only <strong>Phase 3 / Phase 4 / Completed</strong> opportunities with a confirmed real start date appear here.
        Savings are split pro-rata by actual days across calendar years (01 Jan – 31 Dec).
        Amounts in transaction currency; KPI totals consolidated in <strong>EUR</strong>.
      </p>
    </div>
  );
}
