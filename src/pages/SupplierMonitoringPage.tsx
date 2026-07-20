import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileWarning,
  Filter,
  Gauge,
  Link2Off,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  UserX,
  X,
} from "lucide-react";
import supplierAPI from "../services/supplierOnboardingAPI";

// ---- Types (mirror the /supplier-monitoring/overview response) ----------------

type CheckScope = "unit" | "relation";

interface MonitoringCheck {
  key: string;
  label: string;
  scope: CheckScope;
  count: number;
  // Relation-scoped checks only: distinct units behind the offending relations.
  units_affected: number | null;
}

// One row per supplier unit — carries only unit-scoped gaps.
interface UnitGapItem {
  id_group: number;
  group_code: string;
  group_name: string | null;
  id_supplier_unit: number;
  unit_code: string;
  supplier_name: string | null;
  city: string | null;
  country: string | null;
  commodity: string | null;
  supplier_owner: string | null;
  relation_count: number;
  gaps: string[];
}

// One row per offending supplier↔plant relation — carries only relation-scoped gaps.
interface RelationGapItem {
  id_relation: number;
  id_group: number;
  group_code: string;
  group_name: string | null;
  id_supplier_unit: number;
  unit_code: string;
  supplier_name: string | null;
  commodity: string | null;
  supplier_owner: string | null;
  plant_name: string | null;
  plant_city: string | null;
  plant_country: string | null;
  last_evaluation_date: string | null;
  next_evaluation_date: string | null;
  final_grade: string | null;
  class_value: number | null;
  gaps: string[];
}

interface MonitoringOverview {
  checks: MonitoringCheck[];
  total_units: number;
  units_with_gaps: number;
  groups_with_gaps: number;
  unit_items: UnitGapItem[];
  relation_items: RelationGapItem[];
  available_filters: {
    countries: string[];
    commodities: string[];
    groups: { id_group: number; nom: string | null }[];
  };
}

type Severity = "high" | "medium" | "low";

// ---- Per-check display metadata ----------------------------------------------

interface CheckMeta {
  icon: React.ReactNode;
  chip: string; // icon chip background
  badge: string; // row badge
  severity: Severity;
}

const CHECK_META: Record<string, CheckMeta> = {
  no_relation: {
    icon: <Link2Off size={16} />,
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
    severity: "high",
  },
  no_supplier_owner: {
    icon: <UserX size={16} />,
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300",
    severity: "high",
  },
  never_evaluated: {
    icon: <CalendarX size={16} />,
    chip: "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-400/15 dark:text-fuchsia-300",
    badge:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/30 dark:bg-fuchsia-400/10 dark:text-fuchsia-300",
    severity: "high",
  },
  missing_eval_date: {
    icon: <CalendarClock size={16} />,
    chip: "bg-cyan-100 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300",
    badge:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300",
    severity: "medium",
  },
  overdue_evaluation: {
    icon: <Clock3 size={16} />,
    chip: "bg-orange-100 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300",
    badge:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-300",
    severity: "high",
  },
  on_hold: {
    icon: <Ban size={16} />,
    chip: "bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-300",
    badge:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300",
    severity: "high",
  },
  poor_performer: {
    icon: <TrendingDown size={16} />,
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
    severity: "high",
  },
  no_eval_frequency: {
    icon: <CalendarClock size={16} />,
    chip: "bg-teal-100 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300",
    badge:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300",
    severity: "medium",
  },
  no_grade: {
    icon: <Gauge size={16} />,
    chip: "bg-indigo-100 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300",
    badge:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-300",
    severity: "medium",
  },
  no_quality_cert: {
    icon: <ShieldAlert size={16} />,
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
    severity: "medium",
  },
};

const fallbackMeta: CheckMeta = {
  icon: <FileWarning size={16} />,
  chip: "bg-slate-200 text-slate-600",
  badge: "border-slate-200 bg-slate-100 text-slate-600",
  severity: "low",
};

const SEV_DOT: Record<Severity, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

const metaFor = (key: string) => CHECK_META[key] ?? fallbackMeta;
const labelForCheck = (checks: MonitoringCheck[], key: string) =>
  checks.find((c) => c.key === key)?.label ?? key;
const worstSeverity = (gaps: string[]): Severity => {
  let worst: Severity = "low";
  for (const g of gaps) {
    const s = metaFor(g).severity;
    if (SEV_RANK[s] < SEV_RANK[worst]) worst = s;
  }
  return worst;
};

export default function SupplierMonitoringPage() {
  const [data, setData] = useState<MonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Server-side filters
  const [country, setCountry] = useState("");
  const [commodity, setCommodity] = useState("");
  const [groupId, setGroupId] = useState<number | "">("");

  // Client-side controls
  const [tab, setTab] = useState<CheckScope>("relation");
  const [search, setSearch] = useState("");
  const [activeChecks, setActiveChecks] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.getSupplierMonitoringOverview({
        country: country || undefined,
        commodity: commodity || undefined,
        groupId: groupId === "" ? undefined : groupId,
      });
      setData(res.data as MonitoringOverview);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load supplier monitoring.",
      );
    } finally {
      setLoading(false);
    }
  }, [country, commodity, groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCheck = (key: string) =>
    setActiveChecks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Split the checks by what they measure so the two families of KPI never get
  // silently compared: unit-level gaps count supplier units, relation-level gaps
  // count supplier↔plant relations (and match the Batch Evaluation dashboard).
  const unitChecks = useMemo(
    () => (data ? data.checks.filter((c) => c.scope === "unit") : []),
    [data],
  );
  const relationChecks = useMemo(
    () => (data ? data.checks.filter((c) => c.scope === "relation") : []),
    [data],
  );

  // Only checks belonging to the current tab drive filtering — a relation tile
  // must never filter the unit table (and vice-versa).
  const tabChecks = tab === "unit" ? unitChecks : relationChecks;
  const tabCheckKeys = useMemo(
    () => new Set(tabChecks.map((c) => c.key)),
    [tabChecks],
  );
  const activeInTab = useMemo(
    () => [...activeChecks].filter((k) => tabCheckKeys.has(k)),
    [activeChecks, tabCheckKeys],
  );

  // Client-side filtering: active check tiles (OR, within the tab) + free text.
  const filteredUnitItems = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    const active = new Set(activeInTab);
    return data.unit_items.filter((it) => {
      if (active.size > 0 && !it.gaps.some((g) => active.has(g))) return false;
      if (term) {
        const hay = [
          it.supplier_name,
          it.group_name,
          it.unit_code,
          it.group_code,
          it.city,
          it.country,
          it.commodity,
          it.supplier_owner,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [data, activeInTab, search]);

  const filteredRelationItems = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    const active = new Set(activeInTab);
    return data.relation_items.filter((it) => {
      if (active.size > 0 && !it.gaps.some((g) => active.has(g))) return false;
      if (term) {
        const hay = [
          it.supplier_name,
          it.group_name,
          it.unit_code,
          it.group_code,
          it.plant_name,
          it.plant_city,
          it.plant_country,
          it.commodity,
          it.supplier_owner,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [data, activeInTab, search]);

  const resetFilters = () => {
    setCountry("");
    setCommodity("");
    setGroupId("");
    setSearch("");
    // Clear only the current tab's check filters.
    setActiveChecks((prev) => new Set([...prev].filter((k) => !tabCheckKeys.has(k))));
  };

  const serverFiltersActive = !!country || !!commodity || groupId !== "";
  const hasActiveFilters =
    serverFiltersActive || !!search || activeInTab.length > 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f5f8] dark:bg-[#0b1829]">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-300">
          <RefreshCw size={18} className="animate-spin text-sky-500" />
          <p className="text-sm font-medium">Loading supplier monitoring...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f5f8] dark:bg-[#0b1829]">
        <div className="max-w-md rounded-3xl border border-rose-200 bg-rose-50 px-6 py-5 text-center text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          <AlertTriangle size={20} className="mx-auto mb-2" />
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const unitGapTotal = unitChecks.reduce((s, c) => s + c.count, 0);
  const relationGapTotal = relationChecks.reduce((s, c) => s + c.count, 0);
  const cleanUnits = data.total_units - data.units_with_gaps;
  const healthPct =
    data.total_units > 0
      ? Math.round((cleanUnits / data.total_units) * 100)
      : 100;

  return (
    <div className="min-h-screen bg-[#eef3f8] dark:bg-[#0b1829]">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-[linear-gradient(135deg,#0e2238_0%,#183552_58%,#1f5f7e_100%)] p-6 text-white shadow-[0_24px_56px_rgba(15,23,42,.16)] dark:border-white/10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-sky-100/70">
                Supplier Monitoring
              </p>
              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                Suppliers with missing data
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-100/80">
                Data-completeness &amp; risk gaps across the active panel. Click a
                tile to focus, then drill into the supplier or its evaluation.
              </p>
            </div>

            {/* Health snapshot */}
            <div className="flex items-center gap-4 rounded-3xl border border-white/15 bg-white/[0.06] px-5 py-4 backdrop-blur-sm">
              <div className="relative grid h-16 w-16 place-items-center">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke={healthPct >= 80 ? "#34d399" : healthPct >= 50 ? "#fbbf24" : "#fb7185"}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${(healthPct / 100) * 97.4} 97.4`}
                  />
                </svg>
                <span className="absolute text-sm font-black">{healthPct}%</span>
              </div>
              <div className="text-[11px] leading-5 text-white/75">
                <p className="text-base font-black text-white">
                  {data.units_with_gaps}
                  <span className="ml-1 text-xs font-medium text-white/60">
                    / {data.total_units} units
                  </span>
                </p>
                <p>need attention</p>
                <p>{data.groups_with_gaps} groups · {unitGapTotal} unit · {relationGapTotal} relation gaps</p>
              </div>
              <button
                onClick={load}
                className="ml-1 inline-flex items-center gap-2 self-stretch rounded-2xl bg-white/90 px-3 text-sm font-bold text-[#112033] hover:bg-white"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* Scope tabs */}
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
              {([
                {
                  id: "relation" as CheckScope,
                  label: "By relation",
                  sub: `${relationGapTotal} gaps`,
                },
                {
                  id: "unit" as CheckScope,
                  label: "By unit",
                  sub: `${unitGapTotal} gaps`,
                },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    tab === t.id
                      ? "bg-[#10233f] text-white shadow-sm dark:bg-sky-500/90"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                  }`}
                >
                  {t.label}
                  <span
                    className={`ml-1.5 text-[11px] font-semibold ${
                      tab === t.id ? "text-white/70" : "text-slate-400"
                    }`}
                  >
                    {t.sub}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              {activeInTab.length > 0 && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">
                  {activeInTab.length} active
                </span>
              )}
              <button
                onClick={() =>
                  setActiveChecks(
                    (prev) => new Set([...prev, ...tabChecks.map((c) => c.key)]),
                  )
                }
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              >
                Select all
              </button>
              <button
                onClick={() =>
                  setActiveChecks(
                    (prev) => new Set([...prev].filter((k) => !tabCheckKeys.has(k))),
                  )
                }
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
            <Filter size={13} />
            {tab === "relation"
              ? "Each tile counts supplier · plant relations — aligned with the Evaluations dashboard."
              : "Each tile counts supplier units."}
          </div>

          <CheckGroup
            checks={tabChecks}
            activeChecks={activeChecks}
            onToggle={toggleCheck}
            className="mt-3"
          />
        </section>

        {/* Filters bar */}
        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_26px_rgba(15,23,42,.05)] backdrop-blur dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search supplier, group, unit code..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <FilterSelect label="Country" value={country} onChange={setCountry} options={data.available_filters.countries} />
            <FilterSelect label="Commodity" value={commodity} onChange={setCommodity} options={data.available_filters.commodities} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Group</span>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value === "" ? "" : Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                <option value="">All groups</option>
                {data.available_filters.groups.map((g) => (
                  <option key={g.id_group} value={g.id_group}>
                    {g.nom || `Group ${g.id_group}`}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <X size={14} /> Reset
              </button>
            )}
          </div>

          {/* Active check chips */}
          {activeInTab.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Filtering by</span>
              {activeInTab.map((k) => {
                const meta = metaFor(k);
                return (
                  <button
                    key={k}
                    onClick={() => toggleCheck(k)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${meta.badge}`}
                  >
                    {labelForCheck(data.checks, k)}
                    <X size={12} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Results table */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_16px_36px_rgba(15,23,42,.06)] dark:border-white/10 dark:bg-slate-950/40">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <div>
              <h3 className="text-lg font-bold text-[#10233f] dark:text-white">
                {tab === "relation" ? "Relations to review" : "Units to review"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {tab === "relation" ? (
                  <>
                    {filteredRelationItems.length} relation
                    {filteredRelationItems.length === 1 ? "" : "s"} shown
                  </>
                ) : (
                  <>
                    {filteredUnitItems.length} unit
                    {filteredUnitItems.length === 1 ? "" : "s"} shown
                  </>
                )}
                {hasActiveFilters ? " (filtered)" : ""}
              </p>
            </div>
          </div>

          {tab === "relation" ? (
            <RelationTable
              items={filteredRelationItems}
              checks={data.checks}
              activeChecks={activeChecks}
              onToggleCheck={toggleCheck}
            />
          ) : (
            <UnitTable
              items={filteredUnitItems}
              checks={data.checks}
              activeChecks={activeChecks}
              onToggleCheck={toggleCheck}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ---- Shared table bits -------------------------------------------------------

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

function EmptyResults() {
  return (
    <div className="px-6 py-14 text-center">
      <CheckCircle2 size={28} className="mx-auto mb-3 text-emerald-400" />
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
        Nothing matches the current filters
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Everything here is complete — adjust filters to see more.
      </p>
    </div>
  );
}

function GapBadges({
  gaps,
  checks,
  activeChecks,
  onToggleCheck,
}: {
  gaps: string[];
  checks: MonitoringCheck[];
  activeChecks: Set<string>;
  onToggleCheck: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {gaps.map((g) => {
        const meta = metaFor(g);
        const active = activeChecks.has(g);
        return (
          <button
            key={g}
            onClick={() => onToggleCheck(g)}
            title="Filter by this gap"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-transform hover:scale-[1.03] ${meta.badge} ${
              active ? "ring-1 ring-sky-400" : ""
            }`}
          >
            {meta.icon && <span className="[&_svg]:h-3 [&_svg]:w-3">{meta.icon}</span>}
            {labelForCheck(checks, g)}
          </button>
        );
      })}
    </div>
  );
}

function UnitTable({
  items,
  checks,
  activeChecks,
  onToggleCheck,
}: {
  items: UnitGapItem[];
  checks: MonitoringCheck[];
  activeChecks: Set<string>;
  onToggleCheck: (key: string) => void;
}) {
  if (items.length === 0) return <EmptyResults />;
  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
          <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
            <th className="px-5 py-3">Supplier / Unit</th>
            <th className="px-5 py-3">Group / Owner</th>
            <th className="px-5 py-3">Location</th>
            <th className="px-5 py-3">Missing data</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const sev = worstSeverity(it.gaps);
            return (
              <tr
                key={it.id_supplier_unit}
                className={`border-b border-slate-50 last:border-b-0 hover:bg-sky-50/40 dark:border-white/5 dark:hover:bg-white/5 ${
                  idx % 2 ? "bg-slate-50/40 dark:bg-white/[0.015]" : ""
                }`}
              >
                <td className="px-5 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEV_DOT[sev]}`} title={`${sev} priority`} />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-white">
                        {it.supplier_name || "Unnamed unit"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {it.unit_code}
                        {it.commodity ? ` · ${it.commodity}` : ""}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <p className="text-slate-700 dark:text-slate-200">{it.group_name || "-"}</p>
                  <p className="text-[11px] text-slate-400">{it.supplier_owner || "No owner"}</p>
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                  {[it.city, it.country].filter(Boolean).join(", ") || "-"}
                </td>
                <td className="px-5 py-3">
                  <GapBadges
                    gaps={it.gaps}
                    checks={checks}
                    activeChecks={activeChecks}
                    onToggleCheck={onToggleCheck}
                  />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`/suppliers/${it.id_group}/manage`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                      title="Open supplier group & units in a new tab"
                    >
                      <Building2 size={13} /> Unit
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RelationTable({
  items,
  checks,
  activeChecks,
  onToggleCheck,
}: {
  items: RelationGapItem[];
  checks: MonitoringCheck[];
  activeChecks: Set<string>;
  onToggleCheck: (key: string) => void;
}) {
  if (items.length === 0) return <EmptyResults />;
  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-full min-w-[1040px] text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
          <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
            <th className="px-5 py-3">Supplier / Unit</th>
            <th className="px-5 py-3">Plant</th>
            <th className="px-5 py-3">Owner</th>
            <th className="px-5 py-3">Last / Next eval</th>
            <th className="px-5 py-3">Missing data</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const sev = worstSeverity(it.gaps);
            return (
              <tr
                key={it.id_relation}
                className={`border-b border-slate-50 last:border-b-0 hover:bg-sky-50/40 dark:border-white/5 dark:hover:bg-white/5 ${
                  idx % 2 ? "bg-slate-50/40 dark:bg-white/[0.015]" : ""
                }`}
              >
                <td className="px-5 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEV_DOT[sev]}`} title={`${sev} priority`} />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-white">
                        {it.supplier_name || "Unnamed unit"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {it.unit_code}
                        {it.commodity ? ` · ${it.commodity}` : ""}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <p className="text-slate-700 dark:text-slate-200">{it.plant_name || "-"}</p>
                  <p className="text-[11px] text-slate-400">
                    {[it.plant_city, it.plant_country].filter(Boolean).join(", ")}
                  </p>
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                  {it.supplier_owner || <span className="text-slate-400">No owner</span>}
                </td>
                <td className="px-5 py-3 text-[12px] text-slate-600 dark:text-slate-300">
                  <p>{fmtDate(it.last_evaluation_date)}</p>
                  <p className="text-slate-400">→ {fmtDate(it.next_evaluation_date)}</p>
                </td>
                <td className="px-5 py-3">
                  <GapBadges
                    gaps={it.gaps}
                    checks={checks}
                    activeChecks={activeChecks}
                    onToggleCheck={onToggleCheck}
                  />
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`/suppliers/${it.id_group}/manage`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                      title="Open supplier group & units in a new tab"
                    >
                      <Building2 size={13} /> Unit
                    </a>
                    <a
                      href={`/supplier-relations/${it.id_relation}/evaluation`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[12px] font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300"
                      title="Open relation evaluation in a new tab"
                    >
                      <ExternalLink size={13} /> Eval
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CheckGroup({
  title,
  hint,
  checks,
  activeChecks,
  onToggle,
  className = "",
}: {
  title?: string;
  hint?: string;
  checks: MonitoringCheck[];
  activeChecks: Set<string>;
  onToggle: (key: string) => void;
  className?: string;
}) {
  if (checks.length === 0) return null;
  return (
    <div className={className}>
      {(title || hint) && (
        <div className="mb-2 flex items-baseline gap-2">
          {title && (
            <h3 className="text-[12px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {title}
            </h3>
          )}
          {hint && <span className="text-[11px] font-medium text-slate-400">{hint}</span>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {checks.map((c) => (
          <CheckTile
            key={c.key}
            check={c}
            active={activeChecks.has(c.key)}
            onToggle={() => onToggle(c.key)}
          />
        ))}
      </div>
    </div>
  );
}

function CheckTile({
  check,
  active,
  onToggle,
}: {
  check: MonitoringCheck;
  active: boolean;
  onToggle: () => void;
}) {
  const meta = metaFor(check.key);
  // Unit-scoped: "N units". Relation-scoped: "N relations · M units" so the two
  // granularities are never mistaken for one another.
  const noun = check.scope === "relation" ? "relations" : "units";
  const subLabel =
    check.scope === "relation" && check.units_affected != null
      ? `${noun} · ${check.units_affected} unit${check.units_affected === 1 ? "" : "s"}`
      : noun;
  return (
    <button
      onClick={onToggle}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_10px_26px_rgba(15,23,42,0.05)] transition-all dark:bg-slate-950/40 ${
        active
          ? "border-sky-400 ring-2 ring-sky-300/60 dark:border-sky-400/60"
          : "border-slate-200/80 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] dark:border-white/10"
      }`}
    >
      <span
        className={`absolute right-3 top-3 grid h-4 w-4 place-items-center rounded-full transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      >
        <CheckCircle2 size={16} className="text-sky-500" />
      </span>
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${meta.chip}`}>
        {meta.icon}
      </div>
      <p className="mt-3 text-[1.7rem] font-black leading-none tracking-[-0.05em] text-slate-900 dark:text-white">
        {check.count}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[meta.severity]}`} />
        <span className="truncate text-[12px] font-semibold text-slate-600 dark:text-slate-300">
          {check.label}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {subLabel}
      </p>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
