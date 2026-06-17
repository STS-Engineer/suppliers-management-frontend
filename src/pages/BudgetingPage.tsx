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

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

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

  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [items, setItems] = useState<BudgetYearItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-Budget selection mode — per-opportunity 3-state decision
  const [selectMode, setSelectMode] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

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

  // Consolidated in EUR (opportunities may be in EUR/USD/RMB/INR)
  const budgetedTotal = items
    .filter((i) => decisions[i.opportunity_id] === "Budgeted")
    .reduce((sum, i) => sum + (i.applicable_amount_eur ?? i.applicable_amount ?? 0), 0);
  const budgetedCount = items.filter(
    (i) => decisions[i.opportunity_id] === "Budgeted",
  ).length;

  async function saveBudget() {
    setSaving(true);
    setError(null);
    try {
      const payload = items.map((i) => ({
        opportunity_id: i.opportunity_id,
        budget_status: decisions[i.opportunity_id] || "Opportunity",
      }));
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
              ? `Create Budget ${fiscalYear} — tick the opportunities to commit to this year's budget (forecast or validated).`
              : "Calendar-year view of estimated savings. Use Create Budget to commit opportunities — including forecast ones — to a year."}
          </p>
        </div>
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
                onClick={saveBudget}
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

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Opportunities in {fiscalYear}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Total estimated saving (EUR)
            </p>
            <p className="mt-1 text-lg font-bold text-slate-800">{fmt(summary.total_applicable)}</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">
              Budgeted (EUR)
            </p>
            <p className="mt-1 text-lg font-bold text-blue-700">{fmt(summary.total_budgeted)}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              opportunity (not yet budgeted): {fmt(summary.total_opportunity)}
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
              <th className="px-3 py-2.5 font-semibold">Opportunity</th>
              <th className="px-3 py-2.5 font-semibold">Plant</th>
              <th className="px-3 py-2.5 font-semibold">Type</th>
              <th className="px-3 py-2.5 font-semibold">Phase</th>
              <th className="px-3 py-2.5 font-semibold">Validation</th>
              <th className="px-3 py-2.5 font-semibold">Budget</th>
              <th className="px-3 py-2.5 font-semibold">Portion</th>
              <th className="px-3 py-2.5 text-right font-semibold">Saving ({fiscalYear})</th>
            </tr>
          </thead>
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
                  No opportunities generate savings in {fiscalYear}.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((item) => (
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
                        navigate("/purchasing-value", {
                          state: { openOpportunityId: item.opportunity_id },
                        })
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

      <p className="text-[11px] text-slate-400">
        Savings are split pro-rata across fiscal years from the project start date (real start once
        in Phase 3, otherwise the expected/planned start). Per-opportunity amounts are shown in their
        own currency; the <strong>KPI totals are consolidated in EUR</strong> (group reporting
        currency). Any opportunity with savings in the year can be committed via{" "}
        <strong>Create Budget</strong> — <strong>Validated</strong> = Phase 3 started,{" "}
        <strong>Forecast</strong> = not yet. The committed choice is locked.
      </p>
    </div>
  );
}
