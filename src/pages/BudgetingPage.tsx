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
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  loadPersistedFilters,
  savePersistedFilters,
} from "../utils/persistedFilters";

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
  value_of_opportunity_eur?: number | null;
  portion_kind?: string | null;
  budget_status?: string | null;
  suggested_status?: string | null;
  is_additional?: boolean;
  status_locked_at?: string | null;
  status_locked_by?: string | null;
  eoy_forecast_eur?: number | null;
  expected_annual_saving_eur?: number | null;
  actual_ytd_eur?: number | null;
  delta_ytd_eur?: number | null;
  delta_eoy_budget?: number | null;
  saving_actual_fy_eur?: number | null;
  cash_expected_eur?: number | null;
  cash_actual_eur?: number | null;
  real_start_date?: string | null;
  execution_start_date?: string | null;
  planned_start_date?: string | null;
  created_at?: string | null;
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
  baseline_cash_expected_eur: number;
  additional_cash_expected_eur: number;
  total_cash_expected_eur: number;
  baseline_cash_actual_eur: number;
  additional_cash_actual_eur: number;
  total_cash_actual_eur: number;
  additional_pending: number;
  additional_accepted: number;
  additional_rejected: number;
  total_applicable: number;
  total_budgeted: number;
  total_opportunity: number;
  total_empty: number;
  total_validated: number;
}

// ─── Excel export ────────────────────────────────────────────────────────────
// One row per budget-year item, EUR-consolidated (the page's reporting currency),
// with the native amount + FX kept for traceability. Ordered [header, accessor].
const BUDGET_EXPORT_COLUMNS: [string, (i: BudgetYearItem) => unknown][] = [
  ["Fiscal Year", (i) => i.fiscal_year],
  ["Section", (i) => (i.is_additional ? "Additional" : "Baseline")],
  ["Opp ID", (i) => i.opportunity_id],
  ["Opportunity", (i) => i.opportunity_name],
  ["Type", (i) => i.opportunity_type],
  ["Plant", (i) => i.plant_name],
  ["Purchasing Owner", (i) => i.purchasing_owner],
  ["Phase", (i) => i.phase_status],
  ["Budget Status", (i) => i.budget_status],
  ["Additional", (i) => (i.is_additional ? "Yes" : "No")],
  ["Portion", (i) => i.portion_kind],
  ["Currency", (i) => i.currency ?? "EUR"],
  ["FX to EUR", (i) => i.fx_rate_to_eur],
  ["Applicable Amount (native)", (i) => i.applicable_amount],
  ["Applicable Amount EUR", (i) => i.applicable_amount_eur],
  ["Value of Opportunity EUR", (i) => i.value_of_opportunity_eur],
  ["Expected Annual Saving EUR", (i) => i.expected_annual_saving_eur],
  ["EOY Forecast EUR", (i) => i.eoy_forecast_eur],
  ["Actual YTD EUR", (i) => i.actual_ytd_eur],
  ["Delta YTD EUR", (i) => i.delta_ytd_eur],
  ["Delta EOY-Budget EUR", (i) => i.delta_eoy_budget],
  ["Cash Expected EUR", (i) => i.cash_expected_eur],
  ["Cash Actual EUR", (i) => i.cash_actual_eur],
  ["Real Start", (i) => i.real_start_date],
  ["Planned Start", (i) => i.planned_start_date],
  ["Duration (months)", (i) => i.duration_months],
  ["Locked At", (i) => i.status_locked_at],
  ["Locked By", (i) => i.status_locked_by],
];

function exportBudgetToExcel(
  items: BudgetYearItem[],
  summary: Summary | null,
  fiscalYear: number,
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — items (baseline first, then additional), matching the page order
  const ordered = [
    ...items.filter((i) => !i.is_additional),
    ...items.filter((i) => i.is_additional),
  ];
  const rows = ordered.map((i) => {
    const row: Record<string, unknown> = {};
    for (const [header, accessor] of BUDGET_EXPORT_COLUMNS) {
      const v = accessor(i);
      row[header] = v == null ? "" : v;
    }
    return row;
  });
  const headers = BUDGET_EXPORT_COLUMNS.map(([h]) => h);
  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows, { header: headers })
      : XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(wb, ws, `Budget FY${fiscalYear}`);

  // Sheet 2 — summary totals (EUR)
  if (summary) {
    const s: [string, unknown][] = [
      ["Fiscal Year", fiscalYear],
      ["Baseline opportunities", summary.total_baseline],
      ["Additional opportunities", summary.total_additional],
      ["Baseline budgeted (EUR)", summary.baseline_budgeted_eur],
      ["Additional accepted (EUR)", summary.additional_accepted_eur],
      ["Total budget (EUR)", summary.total_budget_eur],
      ["Baseline cash expected (EUR)", summary.baseline_cash_expected_eur],
      ["Additional cash expected (EUR)", summary.additional_cash_expected_eur],
      ["Total cash expected (EUR)", summary.total_cash_expected_eur],
      ["Total cash actual (EUR)", summary.total_cash_actual_eur],
    ];
    const wsS = XLSX.utils.aoa_to_sheet([["Metric", "Value"], ...s]);
    XLSX.utils.book_append_sheet(wb, wsS, "Summary");
  }

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `budgeting-FY${fiscalYear}-${stamp}.xlsx`);
}

// ─── Filtering + client-side summary ─────────────────────────────────────────
// Deployment start = the confirmed savings/deployment anchor (real start, else
// execution start, else planned start).
const deploymentStartOf = (i: BudgetYearItem): string | null =>
  i.real_start_date ?? i.execution_start_date ?? i.planned_start_date ?? null;
// Month bucket key ("2026-07") used both as the filter value and to build options.
const monthKeyOf = (d?: string | null): string => (d ? d.slice(0, 7) : "");
const monthLabelOf = (key: string): string =>
  key
    ? new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      })
    : "";

// Recompute the summary KPIs from a (filtered) item set, mirroring the backend
// (router.list_budget_years) so the cards react to the active filters. EUR totals
// use applicable_amount_eur (non-EUR rows with no FX contribute 0, as backend).
function computeSummary(rows: BudgetYearItem[]): Summary {
  const eur = (i: BudgetYearItem) => i.applicable_amount_eur ?? 0;
  const cashExp = (i: BudgetYearItem) => i.cash_expected_eur ?? 0;
  const cashAct = (i: BudgetYearItem) => i.cash_actual_eur ?? 0;
  const sum = (arr: BudgetYearItem[], f: (i: BudgetYearItem) => number) =>
    arr.reduce((s, i) => s + f(i), 0);

  const baseline = rows.filter((i) => !i.is_additional);
  const additional = rows.filter((i) => i.is_additional);
  const bBud = baseline.filter((i) => i.budget_status === "Budgeted");
  const aBud = additional.filter((i) => i.budget_status === "Budgeted");

  const baseline_budgeted_eur = sum(bBud, eur);
  const additional_accepted_eur = sum(aBud, eur);
  const baseline_cash_expected_eur = sum(bBud, cashExp);
  const additional_cash_expected_eur = sum(aBud, cashExp);
  const baseline_cash_actual_eur = sum(bBud, cashAct);
  const additional_cash_actual_eur = sum(aBud, cashAct);

  return {
    total: rows.length,
    total_baseline: baseline.length,
    total_additional: additional.length,
    baseline_budgeted_eur,
    additional_accepted_eur,
    total_budget_eur: baseline_budgeted_eur + additional_accepted_eur,
    baseline_cash_expected_eur,
    additional_cash_expected_eur,
    total_cash_expected_eur:
      baseline_cash_expected_eur + additional_cash_expected_eur,
    baseline_cash_actual_eur,
    additional_cash_actual_eur,
    total_cash_actual_eur: baseline_cash_actual_eur + additional_cash_actual_eur,
    additional_pending: additional.filter((i) => i.budget_status === "Opportunity")
      .length,
    additional_accepted: aBud.length,
    additional_rejected: additional.filter((i) => i.budget_status === "Empty")
      .length,
    total_applicable: sum(rows, eur),
    total_budgeted: sum(
      rows.filter((i) => i.budget_status === "Budgeted"),
      eur,
    ),
    total_opportunity: sum(
      rows.filter((i) => i.budget_status === "Opportunity"),
      eur,
    ),
    total_empty: sum(
      rows.filter((i) => i.budget_status === "Empty"),
      eur,
    ),
    total_validated: sum(
      rows.filter((i) => i.suggested_status === "Validate"),
      eur,
    ),
  };
}

// Small labelled dropdown used in the filter toolbar.
function FilterSelect({
  label,
  value,
  onChange,
  options,
  format,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  format?: (v: string) => string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-slate-200"
      >
        <option value="All">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {format ? format(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
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
    ? new Date(s).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtDuration = (months?: number | null) => {
  if (months == null) return "—";
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
};

const CUR_SYMBOL: Record<string, string> = {
  EUR: "€",
  USD: "$",
  RMB: "¥",
  INR: "₹",
};
const fmtCur = (n?: number | null, currency?: string | null) => {
  if (n == null) return "—";
  const sym = CUR_SYMBOL[currency ?? "EUR"] ?? `${currency} `;
  const body = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
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

// Persisted per-user filter preset (search stays transient — see PurchasingValuePage).
const BUDGET_FILTERS_PAGE_KEY = "budgeting";
const BUDGET_FILTERS_DEFAULT = {
  filterType: "All",
  filterPlant: "All",
  filterPortion: "All",
  filterStart: "All",
};

function budgetYearWindowLabel(year: number) {
  return `01 Jan ${year} – 31 Dec ${year}`;
}

// "Empty" (explicitly excluded) and "Opportunity" (never decided) are both
// merged into "Not considered" — the UI only ever writes "Opportunity"/"Budgeted"
// going forward, but existing rows may still carry the legacy "Empty" value.
function normalizeBudgetStatus(
  status?: string | null,
): "Opportunity" | "Budgeted" {
  return status === "Budgeted" ? "Budgeted" : "Opportunity";
}

function BudgetStatusBadge({
  status,
  isAdditional,
}: {
  status?: string | null;
  isAdditional?: boolean;
}) {
  if (status === "Budgeted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
        {/* "Budgeted" means part of the year's official budget — an Additional
            row never is, even before closure, so it's labelled "Accepted" instead. */}
        <CheckCircle2 size={11} /> {isAdditional ? "Accepted" : "Budgeted"}
      </span>
    );
  }
  // "Empty" (explicitly excluded) and "Opportunity" (never decided) are both
  // shown as one status to the user — Not considered — whether the row is
  // baseline or additional.
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      Not considered
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

  const [fiscalYear, setFiscalYear] = useState<number>(
    new Date().getFullYear(),
  );
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
  const [additionalDecisions, setAdditionalDecisions] = useState<
    Record<number, string>
  >({});
  const [savingAdditional, setSavingAdditional] = useState(false);

  // ── Search + filters (normal mode only) ──────────────────────────────────
  // Dropdown filters persist per user (localStorage); search stays transient so
  // a stale search box never surprises you on return.
  const initialFilters = loadPersistedFilters(
    BUDGET_FILTERS_PAGE_KEY,
    userEmail,
    BUDGET_FILTERS_DEFAULT,
  );
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState(initialFilters.filterType);
  const [filterPlant, setFilterPlant] = useState(initialFilters.filterPlant);
  const [filterPortion, setFilterPortion] = useState(
    initialFilters.filterPortion,
  );
  const [filterStart, setFilterStart] = useState(initialFilters.filterStart); // deployment-start month key

  const loadRequestRef = useRef(0);

  async function load(year: number) {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listBudgetYears(year);
      if (requestId !== loadRequestRef.current) return;
      const data = (
        res as {
          data: {
            items: BudgetYearItem[];
            summary: Summary;
            closure: BudgetClosure | null;
          };
        }
      ).data;
      setItems(data.items);
      setSummary(data.summary);
      setClosure(data.closure ?? null);
      const baselineSeed: Record<number, string> = {};
      const additionalSeed: Record<number, string> = {};
      data.items.forEach((i) => {
        if (i.is_additional)
          additionalSeed[i.opportunity_id] = normalizeBudgetStatus(
            i.budget_status,
          );
        else
          baselineSeed[i.opportunity_id] = normalizeBudgetStatus(
            i.budget_status,
          );
      });
      setDecisions(baselineSeed);
      setAdditionalDecisions(additionalSeed);
    } catch (err: unknown) {
      if (requestId !== loadRequestRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to load budget records",
      );
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
      setError(
        err instanceof Error ? err.message : "Failed to close budget year.",
      );
    } finally {
      setClosing(false);
    }
  }

  useEffect(() => {
    load(fiscalYear);
    setSelectMode(false);
  }, [fiscalYear]);

  // Persist the dropdown filters per user on every change.
  useEffect(() => {
    savePersistedFilters(BUDGET_FILTERS_PAGE_KEY, userEmail, {
      filterType,
      filterPlant,
      filterPortion,
      filterStart,
    });
  }, [userEmail, filterType, filterPlant, filterPortion, filterStart]);

  // ── Create Budget (baseline only) ─────────────────────────────────────────

  // Unfiltered — used for Create Budget mode, saving, and the live counters so a
  // filter never changes what gets committed.
  const baselineItems = items.filter((i) => !i.is_additional);
  const additionalItems = items.filter((i) => i.is_additional);

  // ── Filter options (from the full item set) ──────────────────────────────
  const typeOptions = [
    ...new Set(items.map((i) => i.opportunity_type).filter(Boolean) as string[]),
  ].sort();
  const plantOptions = [
    ...new Set(items.map((i) => i.plant_name).filter(Boolean) as string[]),
  ].sort();
  const portionOptions = [
    ...new Set(items.map((i) => i.portion_kind).filter(Boolean) as string[]),
  ].sort();
  const startOptions = [
    ...new Set(
      items.map((i) => monthKeyOf(deploymentStartOf(i))).filter(Boolean),
    ),
  ].sort();

  const matchesFilters = (i: BudgetYearItem): boolean => {
    if (search.trim()) {
      const hay = [
        i.opportunity_name,
        i.opportunity_type,
        i.plant_name,
        i.purchasing_owner,
        String(i.opportunity_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    if (filterType !== "All" && i.opportunity_type !== filterType) return false;
    if (filterPlant !== "All" && (i.plant_name ?? "") !== filterPlant)
      return false;
    if (filterPortion !== "All" && (i.portion_kind ?? "") !== filterPortion)
      return false;
    if (
      filterStart !== "All" &&
      monthKeyOf(deploymentStartOf(i)) !== filterStart
    )
      return false;
    return true;
  };

  const activeFilterCount =
    [filterType, filterPlant, filterPortion, filterStart].filter(
      (f) => f !== "All",
    ).length + (search.trim() ? 1 : 0);

  // Filtered sets drive the DISPLAY tables and the KPI cards (normal mode).
  const filteredItems = items.filter(matchesFilters);
  const displayBaseline = filteredItems.filter((i) => !i.is_additional);
  const displayAdditional = filteredItems.filter((i) => i.is_additional);
  // KPIs recomputed from the filtered set so the cards react to filters.
  const viewSummary = computeSummary(filteredItems);

  function resetFilters() {
    setSearch("");
    setFilterType("All");
    setFilterPlant("All");
    setFilterPortion("All");
    setFilterStart("All");
  }

  // Total "Value of Opportunity" = sum of each opportunity's full multi-year gain
  // (dedup by opportunity_id — an opp can have several budget-year rows on this page).
  const valueOfOpportunityTotal = (() => {
    const seen = new Set<number>();
    return filteredItems.reduce((s, i) => {
      if (seen.has(i.opportunity_id)) return s;
      seen.add(i.opportunity_id);
      return s + (i.value_of_opportunity_eur ?? 0);
    }, 0);
  })();

  const baselineBudgetedCount = baselineItems.filter(
    (i) => decisions[i.opportunity_id] === "Budgeted",
  ).length;
  const baselineBudgetedTotal = baselineItems
    .filter((i) => decisions[i.opportunity_id] === "Budgeted")
    .reduce(
      (s, i) => s + (i.applicable_amount_eur ?? i.applicable_amount ?? 0),
      0,
    );
  const baselineAdditionalCount = baselineItems.filter(
    (i) => decisions[i.opportunity_id] === "Additional",
  ).length;

  async function saveBudget() {
    setShowConfirm(false);
    setSaving(true);
    setError(null);
    try {
      const seen = new Set<number>();
      const payload = baselineItems
        .filter((i) => {
          if (seen.has(i.opportunity_id)) return false;
          seen.add(i.opportunity_id);
          return true;
        })
        .map((i) => {
          const decision = decisions[i.opportunity_id] || "Opportunity";
          // "Additional" is a manual override, independent of budget_status —
          // it moves the row into the Additional bucket even though the
          // fiscal year isn't closed yet.
          return decision === "Additional"
            ? {
                opportunity_id: i.opportunity_id,
                budget_status: "Budgeted",
                is_additional: true,
              }
            : { opportunity_id: i.opportunity_id, budget_status: decision };
        });
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
    (i) =>
      additionalDecisions[i.opportunity_id] !==
      normalizeBudgetStatus(i.budget_status),
  );

  async function saveAdditionalDecisions() {
    setSavingAdditional(true);
    setError(null);
    try {
      const seen = new Set<number>();
      const payload = additionalItems
        .filter((i) => {
          if (seen.has(i.opportunity_id)) return false;
          seen.add(i.opportunity_id);
          return true;
        })
        .map((i) => {
          const decision =
            additionalDecisions[i.opportunity_id] || "Opportunity";
          // "Baseline" reverts a manually-flagged Additional row back to the
          // normal baseline bucket — only offered while the year isn't closed.
          return decision === "Baseline"
            ? {
                opportunity_id: i.opportunity_id,
                budget_status: "Opportunity",
                is_additional: false,
              }
            : { opportunity_id: i.opportunity_id, budget_status: decision };
        });
      await supplierAPI.assignBudget(fiscalYear, payload, userEmail);
      await load(fiscalYear);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save additional decisions",
      );
    } finally {
      setSavingAdditional(false);
    }
  }

  // ── Table helpers ─────────────────────────────────────────────────────────

  function OppNameCell({ item }: { item: BudgetYearItem }) {
    return (
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
          <div className="text-[10px] text-slate-400">
            {item.purchasing_owner}
          </div>
        )}
      </td>
    );
  }

  function CommonCells({ item }: { item: BudgetYearItem }) {
    return (
      <>
        <td className="px-3 py-2.5 text-slate-600">{item.plant_name || "—"}</td>
        <td className="px-3 py-2.5">
          {item.opportunity_type && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[item.opportunity_type] || "bg-slate-100 text-slate-600"}`}
            >
              {item.opportunity_type}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-slate-600">
          {item.phase_status || "—"}
        </td>
        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
          {fmtDate(item.created_at)}
        </td>
        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
          {fmtDate(item.planned_start_date)}
        </td>
        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
          {fmtDate(item.execution_start_date)}
        </td>
        <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
          {fmtDate(item.real_start_date)}
        </td>
        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
          {fmtDuration(item.duration_months)}
        </td>
        <td className="px-3 py-2.5">
          {item.portion_kind && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PORTION_COLORS[item.portion_kind] || "bg-slate-100 text-slate-600"}`}
            >
              {item.portion_kind}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-right text-slate-500">
          {fmt(item.value_of_opportunity_eur)}
        </td>
        <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
          <div>
            {fmtCur(item.applicable_amount, item.currency)}
            {item.currency &&
              item.currency !== "EUR" &&
              item.applicable_amount_eur != null && (
                <span className="ml-1 font-normal text-slate-400">
                  (= {fmt(item.applicable_amount_eur)})
                </span>
              )}
          </div>
          <div className="text-[10px] font-normal text-slate-400">
            actual {fmt(item.saving_actual_fy_eur)}
          </div>
        </td>
        <td className="px-3 py-2.5 text-right text-slate-700">
          {item.cash_expected_eur == null && item.cash_actual_eur == null ? (
            <span className="text-slate-300">—</span>
          ) : (
            <>
              <div>{fmt(item.cash_expected_eur)}</div>
              <div className="text-[10px] font-normal text-slate-400">
                actual {fmt(item.cash_actual_eur)}
              </div>
            </>
          )}
        </td>
        <td className="px-3 py-2.5 text-right text-slate-700">
          {fmt(item.eoy_forecast_eur)}
        </td>
        <td className="px-3 py-2.5 text-right">
          {item.delta_eoy_budget == null ? (
            <span className="text-slate-400">—</span>
          ) : item.delta_eoy_budget >= 0 ? (
            <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
              <TrendingUp size={11} />
              {fmt(item.delta_eoy_budget)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 font-semibold text-red-500">
              <TrendingDown size={11} />
              {fmt(item.delta_eoy_budget)}
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
          <th
            className={COL_HEADER}
            title="Study start date (Phase 0 kickoff) — the opportunity has no separate creation timestamp"
          >
            Created
          </th>
          <th
            className={COL_HEADER}
            title="Anticipated savings start date, entered on the opportunity"
          >
            Planned Start
          </th>
          <th
            className={COL_HEADER}
            title="Phase 2 — when execution work began (tooling ordered, supplier contacted)"
          >
            Execution Start (phase 2)
          </th>
          <th
            className={COL_HEADER}
            title="Confirmed real start date — when savings actually started flowing"
          >
            Deployment Start (phase 3)
          </th>
          <th className={COL_HEADER}>Savings Duration</th>
          <th className={COL_HEADER}>Portion</th>
          <th
            className={`${COL_HEADER} text-right`}
            title="Total multi-year gain of the opportunity (value of opportunity = sum of the per-year savings). Shown for context — it is NOT what gets budgeted this year."
          >
            Value of Opp.
          </th>
          <th
            className={`${COL_HEADER} text-right`}
            title="À budgéter — the incremental year-over-year price drop allocated to this fiscal year (not the full annual saving reconducted). A flat price budgets the whole gain in the first year, then 0 the following years. Actual — real saving recorded so far within this fiscal year."
          >
            À budgéter FY {fiscalYear}
          </th>
          <th
            className={`${COL_HEADER} text-right`}
            title="Cash-type opportunities only — planned (expected) cash, with actual recorded so far below"
          >
            Cash FY {fiscalYear}
          </th>
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
              ? `Create Budget ${fiscalYear} — set Budgeted / Not considered for each baseline opportunity.`
              : `FY ${fiscalYear} · ${budgetYearWindowLabel(fiscalYear)} · Phase 3+ confirmed opps, or Phase 2 with execution started`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
                onClick={() =>
                  exportBudgetToExcel(filteredItems, viewSummary, fiscalYear)
                }
                disabled={loading || filteredItems.length === 0}
                title="Export the current fiscal year's budget (items + summary) to Excel"
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-40"
              >
                <Download size={12} /> Export Excel
              </button>
              <button
                onClick={() => load(fiscalYear)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={12}
                  className={loading ? "animate-spin" : ""}
                />{" "}
                Refresh
              </button>
              {!closure && (
                <span
                  title={
                    !isPrivileged
                      ? "Purchasing Director or VP Conversion only"
                      : undefined
                  }
                  className={!isPrivileged ? "cursor-not-allowed" : undefined}
                >
                  <button
                    onClick={() => setSelectMode(true)}
                    disabled={
                      loading || !isPrivileged || baselineItems.length === 0
                    }
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ClipboardList size={12} /> Create Budget
                  </button>
                </span>
              )}
              {!closure && (
                <span
                  title={
                    !isPrivileged
                      ? "Purchasing Director or VP Conversion only"
                      : undefined
                  }
                  className={!isPrivileged ? "cursor-not-allowed" : undefined}
                >
                  <button
                    onClick={() => setShowCloseConfirm(true)}
                    disabled={
                      loading || !isPrivileged || baselineItems.length === 0
                    }
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Lock size={12} /> Close Budget {fiscalYear}
                  </button>
                </span>
              )}
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
                disabled={saving || baselineItems.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-40"
              >
                {saving ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}{" "}
                Save Budget
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-bold text-slate-800">
              Confirm budget commitment
            </h3>
            <p className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              {baselineBudgetedCount} opportunit
              {baselineBudgetedCount === 1 ? "y" : "ies"} → Budgeted ·{" "}
              {fmt(baselineBudgetedTotal)}
            </p>
            <p className="mb-5 text-xs text-slate-500">
              Decisions are saved but{" "}
              <strong>the budget is not closed yet</strong>. Use{" "}
              <em>Close Budget</em> to lock the baseline permanently.
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

      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-bold text-slate-800">
              Close Budget {fiscalYear}?
            </h3>
            <ul className="mb-4 space-y-1.5 text-xs text-slate-600 list-disc list-inside">
              <li>
                All <strong>Budgeted</strong> baseline rows are{" "}
                <strong>locked</strong> — the baseline cannot change.
              </li>
              <li>
                Any new Phase 3+ opp with real_start_date in {fiscalYear} (or
                Phase 2 opp with execution started) will appear as{" "}
                <strong className="text-violet-700">Additional</strong>.
              </li>
              <li>
                This action is <strong>irreversible</strong>.
              </li>
            </ul>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={closeYear}
                disabled={closing}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {closing ? (
                  <RefreshCw size={11} className="animate-spin" />
                ) : (
                  <Lock size={11} />
                )}{" "}
                Close Budget {fiscalYear}
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
            <strong>
              {new Date(closure.closed_at).toLocaleDateString("en-GB")}
            </strong>{" "}
            by <strong>{closure.closed_by}</strong>. Baseline is locked. New
            qualifying opportunities are automatically marked{" "}
            <span className="font-semibold text-violet-700">Additional</span>.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Search + Filters (normal mode) ── */}
      {!selectMode && !loading && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search opportunity, plant, owner…"
              className="w-64 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400"
            />
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35m1.35-5.4a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z"
              />
            </svg>
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <FilterSelect
            label="Type"
            value={filterType}
            onChange={setFilterType}
            options={typeOptions}
          />
          <FilterSelect
            label="Plant"
            value={filterPlant}
            onChange={setFilterPlant}
            options={plantOptions}
          />
          <FilterSelect
            label="Deployment start"
            value={filterStart}
            onChange={setFilterStart}
            options={startOptions}
            format={monthLabelOf}
          />
          <FilterSelect
            label="Portion"
            value={filterPortion}
            onChange={setFilterPortion}
            options={portionOptions}
          />
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
            <span>
              <strong className="text-slate-600">{filteredItems.length}</strong>{" "}
              / {items.length}
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X size={12} /> Reset ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 3 KPI Cards ── */}
      {summary && !selectMode && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {/* Card 1 — Initial Baseline */}
          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Initial Baseline Budget
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-700">
              {fmt(viewSummary.baseline_budgeted_eur)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {viewSummary.total_baseline} opportunit
              {viewSummary.total_baseline !== 1 ? "ies" : "y"} · Budgeted &amp;
              locked at closure
            </p>
          </div>

          {/* Card 2 — Additional */}
          <div
            className={`rounded-xl border p-4 shadow-sm ${viewSummary.total_additional > 0 ? "border-violet-100 bg-violet-50/40" : "border-slate-100 bg-white"}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Additional (post-closure)
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${viewSummary.total_additional > 0 ? "text-violet-700" : "text-slate-300"}`}
            >
              {fmt(viewSummary.additional_accepted_eur)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {viewSummary.additional_accepted} Accepted ·{" "}
              {viewSummary.additional_pending + viewSummary.additional_rejected}{" "}
              Not considered
            </p>
          </div>

          {/* Card 3 — Total Budget by Saving */}
          <div className="rounded-xl border border-slate-100 bg-slate-800 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Total Budget (Saving) {fiscalYear}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {fmt(viewSummary.total_budget_eur)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Baseline {fmt(viewSummary.baseline_budgeted_eur)} + Additional{" "}
              {fmt(viewSummary.additional_accepted_eur)}
            </p>
          </div>

          {/* Card 4 — Total Budget by Cash */}
          <div className="rounded-xl border border-slate-100 bg-slate-800 p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Total Budget (Cash) {fiscalYear}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {fmt(viewSummary.total_cash_expected_eur)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Baseline {fmt(viewSummary.baseline_cash_expected_eur)} + Additional{" "}
              {fmt(viewSummary.additional_cash_expected_eur)} · Actual{" "}
              {fmt(viewSummary.total_cash_actual_eur)}
            </p>
          </div>

          {/* Card 5 — Value of Opportunity (total multi-year gain) */}
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Value of Opportunity {fiscalYear}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-700">
              {fmt(valueOfOpportunityTotal)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Total multi-year gain of opps active this year — context, not the
              budgeted amount
            </p>
          </div>
        </div>
      )}

      {/* ── Create Budget live counter ── */}
      {selectMode && baselineItems.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm">
          <span className="text-blue-700">
            <strong>{baselineBudgetedCount}</strong> of {baselineItems.length}{" "}
            set to <strong>Budgeted</strong>
            {baselineAdditionalCount > 0 && (
              <>
                {" · "}
                <strong>{baselineAdditionalCount}</strong> set to{" "}
                <strong className="text-violet-700">Additional</strong>
              </>
            )}
          </span>
          <span className="font-semibold text-blue-800">
            Total: {fmt(baselineBudgetedTotal)}
          </span>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <RefreshCw size={20} className="animate-spin text-slate-300" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No Phase 3+ opportunities with confirmed real start date (or Phase 2
          with execution started) in FY {fiscalYear}.
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
            <span className="text-[11px] text-slate-400">
              — {(selectMode ? baselineItems : displayBaseline).length}{" "}
              opportunit
              {(selectMode ? baselineItems : displayBaseline).length !== 1
                ? "ies"
                : "y"}
            </span>
          </div>
          <div className="scroll-x-visible rounded-xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <TableHead showDecisionCol={selectMode} />
              <tbody className="divide-y divide-slate-50">
                {(selectMode ? baselineItems : displayBaseline).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    {selectMode && (
                      <td className="px-3 py-2.5">
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:border-blue-400"
                          value={
                            decisions[item.opportunity_id] === "Additional"
                              ? "Additional"
                              : normalizeBudgetStatus(
                                  decisions[item.opportunity_id],
                                )
                          }
                          onChange={(e) =>
                            setDecisions((p) => ({
                              ...p,
                              [item.opportunity_id]: e.target.value,
                            }))
                          }
                        >
                          <option value="Opportunity">Not considered</option>
                          <option value="Budgeted">Budgeted</option>
                          <option value="Additional">Additional</option>
                        </select>
                      </td>
                    )}
                    <OppNameCell item={item} />
                    <CommonCells item={item} />
                    {!selectMode && (
                      <td className="px-3 py-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <BudgetStatusBadge status={item.budget_status} />
                            {item.status_locked_at && (
                              <span title="Locked" className="inline-flex">
                                <Lock
                                  size={10}
                                  className="text-slate-300"
                                  aria-hidden="true"
                                />
                              </span>
                            )}
                          </div>
                          {item.status_locked_at && (
                            <div className="text-[10px] text-slate-400">
                              Locked {fmtDate(item.status_locked_at)}
                              {item.status_locked_by ? ` by ${item.status_locked_by}` : ""}
                            </div>
                          )}
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
      {!loading && (closure || additionalItems.length > 0) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-violet-500">
                Additional Opportunities
              </span>
              {additionalItems.length > 0 ? (
                <span className="text-[11px] text-slate-400">
                  — {(selectMode ? additionalItems : displayAdditional).length}{" "}
                  opportunit
                  {(selectMode ? additionalItems : displayAdditional).length !==
                  1
                    ? "ies"
                    : "y"}{" "}
                  added after budget closure or manually marked Additional
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">— none yet</span>
              )}
              {viewSummary.additional_pending + viewSummary.additional_rejected >
                0 && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  {viewSummary.additional_pending +
                    viewSummary.additional_rejected}{" "}
                  not considered
                </span>
              )}
            </div>
            {additionalChanged && isPrivileged && (
              <button
                onClick={saveAdditionalDecisions}
                disabled={savingAdditional}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {savingAdditional ? (
                  <RefreshCw size={11} className="animate-spin" />
                ) : (
                  <Save size={11} />
                )}
                Save decisions
              </button>
            )}
          </div>
          {additionalItems.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-violet-100 py-8 text-center">
              <p className="text-sm font-semibold text-violet-400">
                No additional opportunities yet
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                When a Phase 3+ opportunity with a {fiscalYear} real start date
                (or a Phase 2 opportunity with execution started) becomes
                eligible after budget closure, it will appear here
                automatically. You can also mark any baseline opportunity as
                Additional manually from the Create Budget screen.
              </p>
            </div>
          ) : (
            <div className="scroll-x-visible rounded-xl border border-violet-100 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <TableHead showDecisionCol={false} />
                <tbody className="divide-y divide-slate-50">
                  {(selectMode ? additionalItems : displayAdditional).map(
                    (item) => (
                    <tr key={item.id} className="hover:bg-violet-50/30">
                      <OppNameCell item={item} />
                      <CommonCells item={item} />
                      <td className="px-3 py-2.5">
                        {isPrivileged ? (
                          <select
                            className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:border-violet-400"
                            value={
                              additionalDecisions[item.opportunity_id] ===
                              "Baseline"
                                ? "Baseline"
                                : normalizeBudgetStatus(
                                    additionalDecisions[item.opportunity_id],
                                  )
                            }
                            onChange={(e) =>
                              setAdditionalDecisions((p) => ({
                                ...p,
                                [item.opportunity_id]: e.target.value,
                              }))
                            }
                          >
                            <option value="Opportunity">Not considered</option>
                            <option value="Budgeted">Accepted</option>
                            {/* Only reversible while this fiscal year isn't closed — once
                                closed, an Additional row is a permanent post-closure record. */}
                            {!closure && (
                              <option value="Baseline">Back to Baseline</option>
                            )}
                          </select>
                        ) : (
                          <BudgetStatusBadge
                            status={item.budget_status}
                            isAdditional
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-1 text-[10px] text-slate-400">
            Opportunities that reached Phase 3 after budget {fiscalYear} was
            closed, or were manually marked Additional. Set to Accepted to
            include their savings in the Additional total, or leave as Not
            considered to exclude.
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Only <strong>Phase 3 / Phase 4 / Completed</strong> opportunities with a
        confirmed real start date, or <strong>Phase 2</strong> opportunities
        with execution already started, appear here. The budgeted amount is the{" "}
        <strong>« à budgéter »</strong> — only the incremental year-over-year
        price drop, not the full annual saving reconducted each year. So a flat
        price budgets the whole gain in the first year and <strong>0</strong> the
        following years, while the <em>Value of Opp.</em> column keeps showing the
        total multi-year gain. Amounts are split pro-rata by actual days across
        calendar years (01 Jan – 31 Dec), in transaction currency; KPI totals
        consolidated in <strong>EUR</strong>.
      </p>
    </div>
  );
}
