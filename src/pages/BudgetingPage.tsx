import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, CheckCircle2, Clock, ClipboardList, X, Save } from "lucide-react";
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
  applicable_amount_eur?: number | null; // amount converted to EUR (group reporting)
  portion_kind?: string | null;
  budget_status?: string | null; // commit decision (manual): "Budgeted" | "Not budgeted"
  suggested_status?: string | null; // validation (auto, phase-derived): "Validate" | "In progress"
  status_locked_at?: string | null; // set once a manual Create-Budget decision is made
}

interface Summary {
  total: number;
  total_applicable: number;
  total_budgeted: number;
  total_opportunity: number;
  total_empty: number;
  total_validated: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// EUR formatter for consolidated (reporting) figures
const fmt = (n?: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n);

// Currency-aware formatter for per-opportunity (transaction-currency) amounts
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
  return `01 Dec ${year - 1} - 30 Nov ${year}`;
}

// Validation dimension (auto, from the opportunity's phase)
function ValidationBadge({ status }: { status?: string | null }) {
  if (status === "Validate") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 size={11} /> Validated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
      <Clock size={11} /> Forecast
    </span>
  );
}

// Budget-commitment dimension (manual, set in Create Budget): Empty / Opportunity / Budgeted
function BudgetBadge({ status }: { status?: string | null }) {
  if (status === "Budgeted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
        <CheckCircle2 size={11} /> Budgeted
      </span>
    );
  }
  if (status === "Opportunity") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        Opportunity
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
      Empty
    </span>
  );
}

export default function BudgetingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userEmail = (user as { email?: string })?.email ?? "";

  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [items, setItems] = useState<BudgetYearItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-Budget selection mode — per-opportunity 3-state decision
  const [selectMode, setSelectMode] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Sorting state (read-only mode)
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  async function load(year: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listBudgetYears(year);
      const data = (res as { data: { items: BudgetYearItem[]; summary: Summary } }).data;
      setItems(data.items);
      setSummary(data.summary);
      // seed the editable decisions from the current per-year budget status
      const seed: Record<number, string> = {};
      data.items.forEach((i) => {
        seed[i.opportunity_id] = i.budget_status || "Opportunity";
      });
      setDecisions(seed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load budget records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(fiscalYear);
    setSelectMode(false);
  }, [fiscalYear]);

  const setDecision = (oppId: number, status: string) =>
    setDecisions((prev) => ({ ...prev, [oppId]: status }));

  // Sorting helper — toggle col, flip dir on re-click
  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }
  const sortIndicator = (col: string) =>
    sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const sortedItems = [...items].sort((a, b) => {
    if (!sortCol) return 0;
    let av: string | number | null = null;
    let bv: string | number | null = null;
    if (sortCol === "name") { av = a.opportunity_name ?? ""; bv = b.opportunity_name ?? ""; }
    else if (sortCol === "plant") { av = a.plant_name ?? ""; bv = b.plant_name ?? ""; }
    else if (sortCol === "type") { av = a.opportunity_type ?? ""; bv = b.opportunity_type ?? ""; }
    else if (sortCol === "phase") { av = a.phase_status ?? ""; bv = b.phase_status ?? ""; }
    else if (sortCol === "saving") { av = a.applicable_amount_eur ?? a.applicable_amount ?? 0; bv = b.applicable_amount_eur ?? b.applicable_amount ?? 0; }
    if (av === null) av = ""; if (bv === null) bv = "";
    const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Consolidated in EUR (opportunities may be in EUR/USD/RMB/INR)
  const budgetedTotal = items
    .filter((i) => decisions[i.opportunity_id] === "Budgeted")
    .reduce((sum, i) => sum + (i.applicable_amount_eur ?? i.applicable_amount ?? 0), 0);
  const budgetedCount = items.filter(
    (i) => decisions[i.opportunity_id] === "Budgeted",
  ).length;

  async function saveBudget() {
    setShowConfirm(false);
    setSaving(true);
    setError(null);
    try {
      // H3 — deduplicate by opportunity_id (defensive: shouldn't happen, but guard it)
      const seen = new Set<number>();
      const payload = items
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Budgeting</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {selectMode
              ? `Create Budget ${fiscalYear} — tick the opportunities to commit to this budget year (forecast or validated).`
              : "Budget-year view of estimated savings. Use Create Budget to commit opportunities — including forecast ones — to a year."}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            This page follows the budget-year window, not the calendar year.
          </p>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Budget year {fiscalYear}: {budgetYearWindowLabel(fiscalYear)} · daily prorata
        </p>
        <div className="flex items-center gap-2">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value))}
            disabled={selectMode}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 disabled:opacity-50"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {!selectMode ? (
            <>
              <button
                onClick={() => load(fiscalYear)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button
                onClick={() => setSelectMode(true)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <ClipboardList size={12} /> Create Budget
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setSelectMode(false);
                  load(fiscalYear);
                }}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <X size={12} /> Cancel
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={saving || items.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Save budget
              </button>
            </>
          )}
        </div>
      </div>

      {selectMode && items.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm">
          <span className="text-blue-700">
            <strong>{budgetedCount}</strong> of {items.length} opportunit
            {items.length === 1 ? "y" : "ies"} set to <strong>Budgeted</strong> for {fiscalYear}
          </span>
          <span className="font-semibold text-blue-800">Budgeted total: {fmt(budgetedTotal)}</span>
        </div>
      )}

      {/* Confirmation modal — H1: locks are irreversible, require explicit confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-bold text-slate-800">Confirm budget commitment</h3>
            <p className="mb-1 text-sm text-slate-600">
              You are about to lock the budget decisions for <strong>FY {fiscalYear}</strong>:
            </p>
            <p className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              {budgetedCount} opportunit{budgetedCount === 1 ? "y" : "ies"} → Budgeted · Total {fmt(budgetedTotal)}
            </p>
            <p className="mb-5 text-xs text-slate-500">
              Budget decisions are <strong>locked</strong> once saved — they cannot be changed automatically. Make sure the selection is correct.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveBudget}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Confirm & save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPIs — hidden in Create Budget mode to avoid confusion with live local totals (M3) */}
      {summary && !selectMode && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Opportunities in {fiscalYear}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{summary.total}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{budgetYearWindowLabel(fiscalYear)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Estimated saving in {fiscalYear} (EUR)
            </p>
            <p className="mt-1 text-lg font-bold text-slate-800">{fmt(summary.total_applicable)}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              All statuses: Budgeted + Opportunity + Empty
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">
              Committed budget (EUR)
            </p>
            <p className="mt-1 text-lg font-bold text-blue-700">{fmt(summary.total_budgeted)}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Opportunity: {fmt(summary.total_opportunity)} · Empty: {fmt(summary.total_empty)}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
            <tr>
              {selectMode && <th className="px-3 py-2.5 font-semibold">Set status</th>}
              <th className="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-slate-600" onClick={() => !selectMode && toggleSort("name")}>Opportunity{sortIndicator("name")}</th>
              <th className="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-slate-600" onClick={() => !selectMode && toggleSort("plant")}>Plant{sortIndicator("plant")}</th>
              <th className="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-slate-600" onClick={() => !selectMode && toggleSort("type")}>Type{sortIndicator("type")}</th>
              <th className="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-slate-600" onClick={() => !selectMode && toggleSort("phase")}>Phase{sortIndicator("phase")}</th>
              <th className="px-3 py-2.5 font-semibold">Validation</th>
              <th className="px-3 py-2.5 font-semibold">Budget</th>
              <th className="px-3 py-2.5 font-semibold">Portion</th>
              <th className="cursor-pointer select-none px-3 py-2.5 text-right font-semibold hover:text-slate-600" onClick={() => !selectMode && toggleSort("saving")}>Saving (Budget {fiscalYear}){sortIndicator("saving")}</th>
            </tr>
          </thead>
          {/* L4 — derive colSpan from column count so adding a column doesn't break loading rows */}
          <tbody className="divide-y divide-slate-50">
            {loading && (
              <tr>
                <td colSpan={selectMode ? 9 : 8} className="px-3 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={selectMode ? 9 : 8} className="px-3 py-8 text-center text-slate-400">
                  No opportunities generate savings in budget year {fiscalYear}.
                </td>
              </tr>
            )}
            {!loading &&
              sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  {selectMode && (
                    <td className="px-3 py-2.5">
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400"
                        value={decisions[item.opportunity_id] || "Opportunity"}
                        onChange={(e) => setDecision(item.opportunity_id, e.target.value)}
                      >
                        <option value="Empty">Empty (rien)</option>
                        <option value="Opportunity">Opportunity</option>
                        <option value="Budgeted">Budgeted</option>
                      </select>
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() =>
                        navigate(`/purchasing-value?opp=${item.opportunity_id}`)
                      }
                      className="flex items-center gap-1 font-semibold text-slate-700 hover:text-blue-600"
                    >
                      {item.opportunity_name || `Opportunity ${item.opportunity_id}`}
                      <ExternalLink size={10} className="text-slate-300" />
                    </button>
                    {item.purchasing_owner && (
                      <div className="text-[10px] text-slate-400">{item.purchasing_owner}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{item.plant_name || "—"}</td>
                  <td className="px-3 py-2.5">
                    {item.opportunity_type && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          TYPE_COLORS[item.opportunity_type] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.opportunity_type}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{item.phase_status || "—"}</td>
                  <td className="px-3 py-2.5">
                    <ValidationBadge status={item.suggested_status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <BudgetBadge status={selectMode ? decisions[item.opportunity_id] : item.budget_status} />
                  </td>
                  <td className="px-3 py-2.5">
                    {item.portion_kind && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          PORTION_COLORS[item.portion_kind] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.portion_kind}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                    {fmtCur(item.applicable_amount, item.currency)}
                    {item.currency && item.currency !== "EUR" && item.applicable_amount_eur != null && (
                      <div className="text-[10px] font-normal text-slate-400">
                        = {fmt(item.applicable_amount_eur)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500">
        Budget year note: this screen uses the 01 Dec to 30 Nov budget window and allocates savings by actual-day prorata.
      </p>
      <p className="text-[11px] text-slate-400">
        Savings are split pro-rata by actual days across budget years from the project start date
        (real start once in Phase 3, otherwise the expected/planned start). Per-opportunity amounts
        are shown in their own currency; the <strong>KPI totals are consolidated in EUR</strong>
        (group reporting currency). Any opportunity with savings in the budget year can be committed via{" "}
        <strong>Create Budget</strong> — <strong>Validated</strong> = Phase 3 started,{" "}
        <strong>Forecast</strong> = not yet. The committed choice is locked.
      </p>
    </div>
  );
}
