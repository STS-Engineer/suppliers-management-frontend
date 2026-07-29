import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FileText,
  Layers,
  LayoutGrid,
  LayoutList,
  PlusCircle,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import supplierAPI from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";
import {
  loadPersistedFilters,
  savePersistedFilters,
} from "../utils/persistedFilters";
import type { ActionPlanRecord, Opp } from "./purchasing-value/types";
import {
  FILTER_TYPES,
  PHASES,
  PV_FILTERS_DEFAULT,
  PV_FILTERS_PAGE_KEY,
} from "./purchasing-value/constants";
import { exportOpportunitiesToExcel, fmt, toNum } from "./purchasing-value/utils";
import { FilterSelect } from "./purchasing-value/components/FilterSelect";
import { Sep } from "./purchasing-value/components/Sep";
import { CreateModal } from "./purchasing-value/modals/CreateModal";
import { DetailDrawer } from "./purchasing-value/modals/DetailDrawer";
import { PhaseColumn } from "./purchasing-value/cards/PhaseColumn";

export default function PurchasingValuePage() {
  const { user } = useAuth();
  const userEmail = (user as { email?: string })?.email ?? "";
  const [opportunities, setOpportunities] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Opp | null>(null);
  // Lazy-init reads localStorage once on mount — restores whatever this user
  // last had filtered, instead of resetting to "All" every time they
  // navigate away from this page and come back.
  const initialFilters = loadPersistedFilters(
    PV_FILTERS_PAGE_KEY,
    userEmail,
    PV_FILTERS_DEFAULT,
  );
  // Free-text search across opportunity name, type, plant, supplier and owners.
  // Kept transient (not persisted) — a stale search box on return is confusing.
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState(initialFilters.filterType);
  const [filterStatus, setFilterStatus] = useState(initialFilters.filterStatus);
  const [filterBudget, setFilterBudget] = useState(initialFilters.filterBudget);
  const [filterPriority, setFilterPriority] = useState(
    initialFilters.filterPriority,
  );
  const [filterPlant, setFilterPlant] = useState(initialFilters.filterPlant);
  const [filterPM, setFilterPM] = useState(initialFilters.filterPM);
  const [filterPurchasingOwner, setFilterPurchasingOwner] = useState(
    initialFilters.filterPurchasingOwner,
  );
  const [filterConversionOwner, setFilterConversionOwner] = useState(
    initialFilters.filterConversionOwner,
  );
  const [filterPilot, setFilterPilot] = useState(initialFilters.filterPilot);
  const [filterBudgetYear, setFilterBudgetYear] = useState(
    initialFilters.filterBudgetYear,
  );
  const [filterEscalated, setFilterEscalated] = useState(
    initialFilters.filterEscalated,
  );
  const [filterValidation, setFilterValidation] = useState(
    initialFilters.filterValidation,
  );
  const [showClosed, setShowClosed] = useState(initialFilters.showClosed);
  const [compact, setCompact] = useState(false);

  // Persist on every change so leaving and returning to this page (or a full
  // reload) restores the same filters for this user.
  useEffect(() => {
    savePersistedFilters(PV_FILTERS_PAGE_KEY, userEmail, {
      filterType,
      filterStatus,
      filterBudget,
      filterPriority,
      filterPlant,
      filterPM,
      filterPurchasingOwner,
      filterConversionOwner,
      filterPilot,
      filterBudgetYear,
      filterEscalated,
      filterValidation,
      showClosed,
    });
  }, [
    userEmail,
    filterType,
    filterStatus,
    filterBudget,
    filterPriority,
    filterPlant,
    filterPM,
    filterPurchasingOwner,
    filterConversionOwner,
    filterPilot,
    filterBudgetYear,
    filterEscalated,
    filterValidation,
    showClosed,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listOpportunities();
      setOpportunities((res.data?.items as Opp[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Deep-link: open a specific opportunity's detail when navigated from Budgeting.
  // Supports both router state (legacy) and ?opp=<id> query param (L2 — URL-safe, refresh-proof).
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkDone = useRef(false);
  useEffect(() => {
    const stateId = (location.state as { openOpportunityId?: number } | null)
      ?.openOpportunityId;
    const paramRaw = searchParams.get("opp");
    const paramId = paramRaw ? parseInt(paramRaw, 10) : undefined;
    const id = stateId ?? paramId;
    if (id && !deepLinkDone.current && opportunities.length) {
      const found = opportunities.find((o) => o.opportunity_id === id);
      if (found) {
        setSelected(found);
        deepLinkDone.current = true;
        // Clean up both state and query param so the drawer doesn't re-open on next navigation
        navigate(location.pathname, { replace: true, state: null });
      }
    }
  }, [location, searchParams, opportunities, navigate]);

  // Derive dropdown options from loaded data
  const plantOptions = [
    ...new Map(
      opportunities
        .filter((o) => o.plant_name)
        .map((o) => [o.plant_id, o.plant_name!]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const uniqueEmails = (field: keyof Opp) =>
    [
      ...new Set(opportunities.map((o) => o[field] as string).filter(Boolean)),
    ].sort();

  const pmOptions = uniqueEmails("project_owner");
  const purchasingOwnerOptions = uniqueEmails("purchasing_owner");
  const conversionOwnerOptions = uniqueEmails("conversion_owner");
  const pilotOptions = uniqueEmails("idea_owner");
  const budgetYearOptions = [
    ...new Set(opportunities.map((o) => o.budget_year).filter(Boolean)),
  ].sort() as number[];

  const STATUS_FILTER_OPTIONS = [
    "All",
    "Assigned",
    "Working on it",
    "Awaiting Validation",
    "Under Committee Review",
    "Needs Rework",
    "Stuck",
  ];

  const searchTerm = search.trim().toLowerCase();
  const filtered = opportunities.filter((o) => {
    if (searchTerm) {
      const haystack = [
        o.opportunity_name,
        o.opportunity_type,
        o.plant_name,
        o.plant_city,
        o.project_owner,
        o.purchasing_owner,
        o.conversion_owner,
        o.idea_owner,
        String(o.opportunity_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    if (filterType === "Cash") {
      if (o.cash_impact == null) return false;
    } else if (filterType !== "All" && o.opportunity_type !== filterType) {
      return false;
    }
    if (filterStatus !== "All" && o.status !== filterStatus) return false;
    if (filterBudget !== "All" && o.validation_status !== filterBudget)
      return false;
    if (filterPriority !== "All" && o.priority_category !== filterPriority)
      return false;
    if (filterPlant !== "All" && String(o.plant_id) !== filterPlant)
      return false;
    if (filterPM !== "All" && o.project_owner !== filterPM) return false;
    if (
      filterPurchasingOwner !== "All" &&
      o.purchasing_owner !== filterPurchasingOwner
    )
      return false;
    if (
      filterConversionOwner !== "All" &&
      o.conversion_owner !== filterConversionOwner
    )
      return false;
    if (filterPilot !== "All" && o.idea_owner !== filterPilot) return false;
    if (
      filterBudgetYear !== "All" &&
      String(o.budget_year) !== filterBudgetYear
    )
      return false;
    if (filterValidation !== "All") {
      // "Pending" = no gate decision recorded yet (validation_decision is null).
      if (filterValidation === "Pending") {
        if (o.validation_decision != null) return false;
      } else if (o.validation_decision !== filterValidation) {
        return false;
      }
    }
    if (filterEscalated && !o.financial_lines.some((l) => l.is_escalated))
      return false;
    if (!showClosed && o.phase_status === "Closed") return false;
    return true;
  });

  const activeFilters =
    [
      filterType,
      filterStatus,
      filterBudget,
      filterPriority,
      filterPlant,
      filterPM,
      filterPurchasingOwner,
      filterConversionOwner,
      filterPilot,
      filterBudgetYear,
      filterValidation,
    ].filter((f) => f !== "All").length + (filterEscalated ? 1 : 0);

  // Export the filtered opportunities to a multi-sheet workbook. Action plans
  // are fetched lazily per opportunity (they aren't in the bulk list), so we
  // pull them in small concurrent batches before building the file.
  async function handleExport() {
    if (exporting || filtered.length === 0) return;
    setExporting(true);
    try {
      const plansByOpp = new Map<number, ActionPlanRecord[]>();
      const BATCH = 6;
      for (let i = 0; i < filtered.length; i += BATCH) {
        const batch = filtered.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async (o) => {
            try {
              const res = await supplierAPI.listActionPlans(o.opportunity_id);
              return [o.opportunity_id, (res?.data ?? []) as ActionPlanRecord[]] as const;
            } catch {
              // A single opp's action-plan fetch failing shouldn't abort the
              // whole export — just omit its actions.
              return [o.opportunity_id, [] as ActionPlanRecord[]] as const;
            }
          }),
        );
        for (const [id, plans] of results) plansByOpp.set(id, plans);
      }
      exportOpportunitiesToExcel(filtered, plansByOpp);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to export opportunities.";
      setError(msg);
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setFilterType("All");
    setFilterStatus("All");
    setFilterBudget("All");
    setFilterPriority("All");
    setFilterPlant("All");
    setFilterPM("All");
    setFilterPurchasingOwner("All");
    setFilterConversionOwner("All");
    setFilterPilot("All");
    setFilterBudgetYear("All");
    setFilterValidation("All");
    setFilterEscalated(false);
    setShowClosed(false);
  }

  const visiblePhases = showClosed
    ? PHASES
    : PHASES.filter((p) => p !== "Closed");

  const grouped = PHASES.reduce<Record<string, Opp[]>>((acc, ph) => {
    acc[ph] = filtered.filter((o) => {
      const ps = o.phase_status ?? "Phase 0";
      // "Assigned" is a status value — the card still lives in Phase 0 column
      return ps === ph || (ph === "Phase 0" && ps === "Assigned");
    });
    return acc;
  }, {});

  // KPIs — budget source of truth is OpportunityBudgetYear (director commitment),
  // not opp.validation_status (execution-maturity flag).
  const now = new Date();
  const currentYear =
    now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const committedOppIds = new Set(
    opportunities
      .filter((o) =>
        o.budget_years?.some(
          (by) =>
            by.fiscal_year === currentYear && by.budget_status === "Budgeted",
        ),
      )
      .map((o) => o.opportunity_id),
  );
  const budgetedOpps = opportunities.filter((o) =>
    committedOppIds.has(o.opportunity_id),
  );
  // EUR is the group reporting currency — non-EUR opportunities must be
  // converted before summing into a board-wide KPI tile, same rule the KPI
  // dashboard (kpi_service.py) already applies. A missing/zero rate excludes
  // the opportunity from the total rather than distorting it with a 1:1
  // fallback.
  const fxOf = (o: Opp) => {
    const currency = o.currency || "EUR";
    if (currency === "EUR") return 1;
    return o.fx_rate_to_eur && o.fx_rate_to_eur > 0 ? o.fx_rate_to_eur : 0;
  };
  const budgetedSaving = budgetedOpps.reduce(
    (s, o) => s + toNum(o.expected_annual_saving) * fxOf(o),
    0,
  );
  const totalActual = opportunities.reduce(
    (s, o) =>
      s +
      (o.financial_lines ?? []).reduce(
        (s2, l) => s2 + toNum(l.cumulated_real_saving) * fxOf(o),
        0,
      ),
    0,
  );
  const budgeted = budgetedOpps.length;
  const overBudgetLines = opportunities
    .filter((o) => committedOppIds.has(o.opportunity_id))
    .flatMap((o) =>
      (o.financial_lines ?? []).map((l) => ({ line: l, fx: fxOf(o) })),
    )
    .filter(
      ({ line: l }) =>
        toNum(l.budget_value) > 0 &&
        toNum(l.forecast_eoy_current) > toNum(l.budget_value),
    );
  const overBudgetCount = new Set(
    overBudgetLines.map(({ line: l }) => l.financial_line_id),
  ).size;
  const overBudgetAmount = overBudgetLines.reduce(
    (s, { line: l, fx }) =>
      s + (toNum(l.forecast_eoy_current) - toNum(l.budget_value)) * fx,
    0,
  );
  const stuck = opportunities.filter((o) => o.status === "Stuck").length;

  function handleCreated(o: Opp) {
    setOpportunities((p) => [o, ...p]);
    setShowCreate(false);
  }
  function handleRefresh(u: Opp) {
    setOpportunities((p) =>
      p.map((o) => (o.opportunity_id === u.opportunity_id ? u : o)),
    );
    setSelected(u);
  }
  function handleDeleted(opportunityId: number) {
    setOpportunities((p) =>
      p.filter((o) => o.opportunity_id !== opportunityId),
    );
    setSelected(null);
  }
  function handleDuplicated(o: Opp) {
    // Prepend the new draft and open it so the buyer can re-scope it immediately.
    setOpportunities((p) => [o, ...p]);
    setSelected(o);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f0f7ff_0,#f8fafc_50%,#f0f4f8_100%)] dark:bg-[radial-gradient(circle_at_top_left,#0f1e35_0,#0b1829_50%,#0a1525_100%)]">
      {/* Header */}

      <div className="border-b border-slate-200/70 bg-white/80 px-4 py-4 backdrop-blur-sm dark:border-white/[0.07] dark:bg-[#0f1e30]/80 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[9.5px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
              Purchasing
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900 dark:text-slate-50">
              Value Management
            </h1>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              Pipeline · SB3 / SB3-Cash · Phase 0 to Phase 4
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.09]"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <button
              onClick={() => setCompact((c) => !c)}
              title={compact ? "Full cards" : "Compact cards"}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                compact
                  ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.09]"
              }`}
            >
              {compact ? <LayoutGrid size={12} /> : <LayoutList size={12} />}
              {compact ? "Full" : "Compact"}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              <PlusCircle size={14} />
              New Opportunity
            </button>
          </div>
        </div>
        {/* KPIs */}
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            {
              icon: <Layers size={12} />,
              label: "Total",
              val: String(opportunities.length),
              color: "slate",
            },
            {
              icon: <TrendingUp size={12} />,
              label: "Est. Annual Saving (Budgeted)",
              val: fmt(budgetedSaving),
              color: "emerald",
            },
            {
              icon: <FileText size={12} />,
              label: "Budgeted",
              val: String(budgeted),
              color: "violet",
            },
            {
              icon: <TrendingUp size={12} />,
              label: "Over-Delivery vs Budget",
              val:
                overBudgetCount > 0
                  ? `${overBudgetCount} · +${fmt(overBudgetAmount)}`
                  : "0",
              color: overBudgetCount > 0 ? "emerald" : "slate",
            },
            ...(stuck
              ? [
                  {
                    icon: <AlertTriangle size={12} />,
                    label: "Stuck",
                    val: String(stuck),
                    color: "orange",
                  },
                ]
              : []),
          ].map((k, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs bg-${k.color === "slate" ? "slate" : k.color}-50 text-${k.color === "slate" ? "slate-700" : k.color + "-700"} border-${k.color === "slate" ? "slate-200" : k.color + "-200"}`}
            >
              {k.icon}
              <span className="opacity-70 text-[11px]">{k.label}</span>
              <span className="font-bold">{k.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-slate-200/50 bg-white/60 backdrop-blur-sm dark:border-white/[0.07] dark:bg-[#0a1929]/60">
        {/* Row 1 — Type pills */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100/60 px-4 py-2 dark:border-white/[0.05] sm:px-8">
          <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Type
          </span>
          {["All", ...FILTER_TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${filterType === t ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.07] dark:text-slate-300 dark:hover:bg-white/[0.12]"}`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={handleExport}
            disabled={filtered.length === 0 || exporting}
            title="Export the filtered opportunities (opportunities, financial lines, monthly breakdown, action plans) to Excel"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            {exporting ? "Exporting…" : `Export Excel (${filtered.length})`}
          </button>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search opportunities…"
              className="w-56 rounded-xl border border-slate-200 bg-white/80 py-1 pl-8 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-slate-200 dark:placeholder:text-slate-500"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Row 2 — Status, Validation, Priority, Gate, Plant */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100/60 px-4 py-2 dark:border-white/[0.05] sm:px-8">
          <FilterSelect
            label="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={STATUS_FILTER_OPTIONS}
          />
          <Sep />
          <FilterSelect
            label="Validation"
            value={filterBudget}
            onChange={setFilterBudget}
            options={["All", "Budgeted", "Empty"]}
          />
          <Sep />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400">
              Priority
            </span>
            <div className="flex gap-1">
              {["All", "High", "Medium", "Low"].map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors ${
                    filterPriority === p
                      ? p === "High"
                        ? "bg-emerald-500 text-white"
                        : p === "Medium"
                          ? "bg-amber-400 text-white"
                          : p === "Low"
                            ? "bg-red-400 text-white"
                            : "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Sep />
          <FilterSelect
            label="Gate Decision"
            value={filterValidation}
            onChange={setFilterValidation}
            options={["All", "Go", "No Go", "Review", "Pending"]}
          />
          {plantOptions.length > 0 && (
            <>
              <Sep />
              <FilterSelect
                label="Plant"
                value={filterPlant}
                onChange={setFilterPlant}
                options={["All", ...plantOptions.map(([, name]) => name)]}
                values={["All", ...plantOptions.map(([id]) => String(id))]}
              />
            </>
          )}
          {budgetYearOptions.length > 1 && (
            <>
              <Sep />
              <FilterSelect
                label="Year"
                value={filterBudgetYear}
                onChange={setFilterBudgetYear}
                options={["All", ...budgetYearOptions.map(String)]}
              />
            </>
          )}
        </div>

        {/* Row 3 — People filters + escalation + clear */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 sm:px-8">
          {pmOptions.length > 0 && (
            <FilterSelect
              label="Project Manager"
              value={filterPM}
              onChange={setFilterPM}
              options={["All", ...pmOptions]}
            />
          )}
          {purchasingOwnerOptions.length > 0 && (
            <>
              <Sep />
              <FilterSelect
                label="Purchasing Owner"
                value={filterPurchasingOwner}
                onChange={setFilterPurchasingOwner}
                options={["All", ...purchasingOwnerOptions]}
              />
            </>
          )}
          {conversionOwnerOptions.length > 0 && (
            <>
              <Sep />
              <FilterSelect
                label="Conversion Owner"
                value={filterConversionOwner}
                onChange={setFilterConversionOwner}
                options={["All", ...conversionOwnerOptions]}
              />
            </>
          )}
          {pilotOptions.length > 0 && (
            <>
              <Sep />
              <FilterSelect
                label="Pilot"
                value={filterPilot}
                onChange={setFilterPilot}
                options={["All", ...pilotOptions]}
              />
            </>
          )}
          <Sep />
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700">
            <input
              type="checkbox"
              checked={filterEscalated}
              onChange={(e) => setFilterEscalated(e.target.checked)}
              className="accent-red-500"
            />
            Escalated only
          </label>

          <div className="ml-auto flex items-center gap-3">
            {activeFilters > 0 && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                <X size={10} /> Clear all
                <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {activeFilters}
                </span>
              </button>
            )}
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(e) => setShowClosed(e.target.checked)}
                className="accent-blue-600"
              />
              Show Closed
            </label>
          </div>
        </div>

        {/* Result count */}
        {activeFilters > 0 && (
          <div className="bg-blue-50/40 px-4 py-1 text-[11px] text-blue-600 dark:bg-blue-500/[0.08] dark:text-blue-300 sm:px-8">
            <strong>{filtered.length}</strong> of {opportunities.length}{" "}
            opportunities match
          </div>
        )}
      </div>

      {/* Kanban */}
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <RefreshCw size={14} className="animate-spin" />
            Loading…
          </div>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        {!loading && !error && (
          <div className="scroll-x-bar flex gap-4 pb-6">
            {visiblePhases.map((ph, i) => (
              <div key={ph} className="flex items-start gap-4">
                <PhaseColumn
                  phase={ph}
                  opps={grouped[ph] ?? []}
                  onSelect={setSelected}
                  onRefresh={handleRefresh}
                  onDeleted={handleDeleted}
                  onDuplicated={handleDuplicated}
                  userEmail={userEmail}
                  compact={compact}
                />
                {i < visiblePhases.length - 1 && (
                  <ArrowRight
                    size={16}
                    className="mt-8 shrink-0 text-slate-200 dark:text-slate-700"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          userEmail={userEmail}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {selected && (
        <DetailDrawer
          opp={selected}
          userEmail={userEmail}
          onClose={() => setSelected(null)}
          onRefresh={handleRefresh}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}




