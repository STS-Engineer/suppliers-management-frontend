import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderOpen,
  Package,
  RefreshCw,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import supplierAPI from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";
import {
  loadPersistedFilters,
  savePersistedFilters,
} from "../utils/persistedFilters";

const KPI_FILTERS_PAGE_KEY = "purchasing-kpis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Kpis {
  eoy_forecast_total: number;
  eoy_vs_budget_pct: number | null;
  eoy_vs_expected_pct: number | null;
  actual_vs_expected_ytd_pct: number | null;
  actual_vs_budget_ytd_pct: number | null;
  actual_ytd_total: number;
  expected_ytd_total: number;
  total_expected_annual: number;
  program_value_lifetime: number;
  budgeted_expected_annual: number;
  total_budget: number;
  over_budget_count: number;
  over_budget_amount: number;
  conversion_rate_pct: number | null;
  validated_opp_count: number;
  converted_opp_count: number;
  phase0_go_rate_pct: number | null;
  phase0_go_count?: number;
  phase0_decided_count?: number;
  project_on_time_rate_pct: number | null;
  monthly_update_pct: number | null;
  avg_priority_score: number | null;
  active_lines_count: number;
  escalated_count: number;
  late_projects_count: number;
  missing_update_lines: number;
  open_pipeline_count: number;
  non_eur_missing_rate: number;
  opportunity_pipeline_amount: number;
  opportunity_pipeline_count: number;
  total_saving_from_jan2026?: number;
}
interface MonthlyPoint {
  period: string;
  expected: number;
  actual: number;
  budget: number;
  eoy_forecast: number;
}
interface PlantRow {
  plant_id: number;
  plant_name: string;
  expected_annual: number;
  budget_value: number;
  actual_ytd: number;
  expected_ytd: number;
  delta_ytd: number;
  eoy_forecast: number;
  opp_count: number;
  ytd_rate_pct: number | null;
  eoy_vs_budget_pct: number | null;
  eoy_vs_expected_pct: number | null;
  type_breakdown: Record<string, number>;
  eoy_by_status: { Budgeted: number; Opportunity: number; Empty: number };
  eoy_by_type: Record<string, number>;
  delta_eoy_budget_by_type: Record<string, number>;
  // delta_eoy_budget_by_reason: Record<string, number>; // commented out — delta reason logic disabled
}
interface SupplierRow {
  supplier_name: string;
  opp_count: number;
  eoy_forecast: number;
  expected_annual: number;
  actual_ytd: number;
  eoy_by_type: Record<string, number>;
}
interface TypeRow {
  type: string;
  opp_count: number;
  validated_count: number;
  expected_annual: number;
  actual_ytd: number;
  expected_ytd: number;
  delta_ytd: number;
  eoy_forecast: number;
  ytd_rate_pct: number | null;
  eoy_vs_expected_pct: number | null;
}
interface NatureRow {
  saving_nature: string;
  opp_count: number;
  validated_count: number;
  expected_annual: number;
  actual_ytd: number;
  expected_ytd: number;
  delta_ytd: number;
  eoy_forecast: number;
  ytd_rate_pct: number | null;
  eoy_vs_expected_pct: number | null;
}
interface GateRate {
  phase: string;
  decided: number;
  go: number;
  no_go: number;
  rate: number | null;
}
interface YearSplit {
  year: number;
  expected: number;
  actual: number;
  ytd_rate_pct: number | null;
}
interface MissingUpdate {
  financial_line_id: number;
  line_name: string;
  opportunity_name: string;
  follower: string;
  missing_months: string[];
  missing_count: number;
}
interface EscalatedLine {
  financial_line_id: number;
  line_name: string;
  opportunity_name: string;
  escalation_reason: string;
  escalated_at: string;
  escalated_by: string;
  delta_ytd: number;
}
interface LateProject {
  project_id: number;
  project_name: string;
  project_owner: string;
  phase_status: string;
  planned_end_date: string | null;
}
interface BuyerRow {
  buyer_email: string;
  buyer_name: string;
  opp_count: number;
  plant_count: number;
  categories: string[];
  expected_annual: number;
  actual_ytd: number;
  expected_ytd: number;
  delta_ytd: number;
  eoy_forecast: number;
  budget_value: number;
  ytd_rate_pct: number | null;
  eoy_vs_budget_pct: number | null;
  escalated_count: number;
}
interface AvailableFilters {
  plants: { id: number; name: string }[];
  categories: string[];
  buyers: string[];
}
interface KpiFilters {
  plantIds: number[];
  categories: string[];
  buyers: string[];
}
interface PersistedKpiFilters extends KpiFilters {
  selectedYear: number | null;
}
interface KpiData {
  year: number;
  computed_at: string;
  reporting_currency?: string;
  available_filters?: AvailableFilters;
  gate_go_rates?: GateRate[];
  kpis: Kpis;
  monthly_actuals: MonthlyPoint[];
  by_plant: PlantRow[];
  by_supplier: SupplierRow[];
  by_type: TypeRow[];
  by_saving_nature: NatureRow[];
  by_buyer: BuyerRow[];
  year_split: YearSplit[];
  late_projects: LateProject[];
  missing_updates: MissingUpdate[];
  escalated: EscalatedLine[];
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  indigo: {
    bg: "bg-indigo-600",
    text: "text-indigo-600",
    light: "bg-indigo-50",
    border: "border-indigo-300",
    hex: "#4F46E5",
  },
  emerald: {
    bg: "bg-emerald-500",
    text: "text-emerald-600",
    light: "bg-emerald-50",
    border: "border-emerald-300",
    hex: "#10B981",
  },
  amber: {
    bg: "bg-amber-500",
    text: "text-amber-600",
    light: "bg-amber-50",
    border: "border-amber-300",
    hex: "#F59E0B",
  },
  rose: {
    bg: "bg-rose-500",
    text: "text-rose-600",
    light: "bg-rose-50",
    border: "border-rose-300",
    hex: "#F43F5E",
  },
  violet: {
    bg: "bg-violet-500",
    text: "text-violet-600",
    light: "bg-violet-50",
    border: "border-violet-300",
    hex: "#8B5CF6",
  },
  sky: {
    bg: "bg-sky-500",
    text: "text-sky-600",
    light: "bg-sky-50",
    border: "border-sky-300",
    hex: "#0EA5E9",
  },
};

const TYPE_PALETTE: Record<string, typeof C.indigo> = {
  Negotiation: C.violet,
  Sourcing: C.sky,
  "Technical Productivity": C.emerald,
  Cash: C.amber,
};

// Hard = real cost reduction (P&L / EBITDA impact) → emerald; Soft = cost
// avoidance → sky; Unclassified → amber (draws attention to classify).
const NATURE_PALETTE: Record<string, typeof C.indigo> = {
  Hard: C.emerald,
  Soft: C.sky,
  Unclassified: C.amber,
};

const fmt = (n?: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n);
const pctFmt = (n?: number | null) => (n == null ? "—" : `${n}%`);
const _pct = (num: number, denom: number): number | null =>
  denom === 0 ? null : Math.round((num / denom) * 100 * 10) / 10;

const pctToken = (val: number | null, target = 100) => {
  if (val == null) return C.indigo;
  if (val >= target) return C.emerald;
  if (val >= target * 0.8) return C.amber;
  return C.rose;
};

// ---------------------------------------------------------------------------
// TrendChip
// ---------------------------------------------------------------------------
function TrendChip({
  val,
  target = 100,
}: {
  val: number | null;
  target?: number;
}) {
  if (val == null) return null;
  if (val >= target)
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
        <ArrowUpRight size={8} />
        On track
      </span>
    );
  if (val >= target * 0.8)
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
        Watch
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
      <ArrowDownRight size={8} />
      Below target
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mini Ring
// ---------------------------------------------------------------------------
function Ring({
  pct,
  size = 60,
  token = C.emerald,
}: {
  pct: number;
  size?: number;
  token?: typeof C.emerald;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min((pct / 100) * circ, circ);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={token.hex}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Executive Summary Bar
// ---------------------------------------------------------------------------
function ExecSummaryBar({
  kpis,
  year,
  totalAlerts,
}: {
  kpis: Kpis;
  year: number;
  totalAlerts: number;
}) {
  const coverageToken =
    kpis.monthly_update_pct === 100
      ? C.emerald
      : (kpis.monthly_update_pct ?? 0) >= 80
        ? C.amber
        : C.rose;
  const alertToken =
    totalAlerts === 0 ? C.emerald : kpis.escalated_count > 0 ? C.rose : C.amber;

  const stats = [
    {
      icon: <TrendingUp size={13} />,
      token: C.indigo,
      label: "EOY Forecast",
      value: fmt(kpis.eoy_forecast_total),
      sub: `${kpis.active_lines_count} active lines`,
      trend: null as number | null,
    },
    {
      icon: <Banknote size={13} />,
      token: pctToken(kpis.actual_vs_expected_ytd_pct),
      label: "Actual YTD",
      value: fmt(kpis.actual_ytd_total),
      sub:
        kpis.actual_vs_expected_ytd_pct != null
          ? `${kpis.actual_vs_expected_ytd_pct}% of target`
          : `exp. ${fmt(kpis.expected_ytd_total)}`,
      trend: kpis.actual_vs_expected_ytd_pct,
    },
    {
      icon: <Target size={13} />,
      token: pctToken(kpis.eoy_vs_budget_pct),
      label: "EOY vs Budget",
      value: pctFmt(kpis.eoy_vs_budget_pct),
      sub: `budget: ${fmt(kpis.total_budget)}`,
      trend: kpis.eoy_vs_budget_pct,
    },
    {
      icon: <AlertTriangle size={13} />,
      token: alertToken,
      label: "Active Alerts",
      value: String(totalAlerts),
      sub: `${kpis.escalated_count} esc · ${kpis.late_projects_count} late · ${kpis.missing_update_lines} miss`,
      trend: null as number | null,
    },
    {
      icon: <Activity size={13} />,
      token: coverageToken,
      label: "Monthly Coverage",
      value: pctFmt(kpis.monthly_update_pct),
      sub:
        kpis.missing_update_lines > 0
          ? `${kpis.missing_update_lines} lines missing`
          : "Fully up to date",
      trend: kpis.monthly_update_pct,
    },
  ];

  return (
    <div className="rounded-2xl bg-white border border-slate-200/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Premium top accent */}
      <div className="h-[3px] bg-gradient-to-r from-indigo-500 via-violet-400 to-sky-400" />

      <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-indigo-500" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            Executive Summary
          </span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">
          FY {year}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-slate-100">
        {stats.map((s, i) => {
          const valueIsAmount =
            s.value.startsWith("€") || s.value.startsWith("-€");
          const valueColor = valueIsAmount ? "text-slate-900" : s.token.text;
          const isAlertsCell = s.label === "Active Alerts";
          const alertsClear = isAlertsCell && totalAlerts === 0;
          return (
            <div key={i} className="px-5 py-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className={alertsClear ? C.emerald.text : s.token.text}>
                  {s.icon}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  {s.label}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <p
                  className={`text-[21px] font-black leading-none ${alertsClear ? "text-emerald-600" : valueColor}`}
                >
                  {s.value}
                </p>
                {s.trend != null && <TrendChip val={s.trend} />}
              </div>
              <p className="text-[11px] leading-snug mt-0.5 text-slate-400">
                {alertsClear ? "Pipeline clear" : s.sub}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Chart palette — separate from card tokens
const CHART = {
  expected: { bar: "#DDE3F0", border: "#B0BCDB" }, // cool slate-blue, clearly a reference
  onTrack: { bar: "#4F46E5", glow: "#C7D2FE" }, // indigo-600 — solid achievement
  behind: { bar: "#F97316", glow: "#FED7AA" }, // orange-500 — caution, not alarm
  future: { bar: "#F1F5F9" }, // slate-100 — neutral placeholder
};

// ---------------------------------------------------------------------------
// Monthly bar chart
// ---------------------------------------------------------------------------
function MonthlyBarChart({
  data,
  height = 220,
}: {
  data: MonthlyPoint[];
  height?: number;
}) {
  const maxVal =
    Math.max(...data.map((d) => Math.max(d.expected, d.actual || 0))) || 1;
  const gridLines = [0.25, 0.5, 0.75, 1];
  const barAreaH = height - 32; // 32px reserved for month labels

  return (
    <div>
      {/* Chart area */}
      <div
        className="relative rounded-xl bg-slate-50/60 border border-slate-100 px-3 pt-3 pb-0"
        style={{ height }}
      >
        {/* Horizontal grid lines */}
        {gridLines.map((p) => {
          const y = 12 + barAreaH * (1 - p); // 12px top padding
          return (
            <div
              key={p}
              className="absolute left-3 right-3 pointer-events-none"
              style={{ top: y }}
            >
              <div className="border-t border-dashed border-slate-200 w-full" />
              <span className="absolute -top-3.5 right-0 text-[10px] text-slate-400 font-medium tabular-nums">
                {fmt((maxVal * p) / 100)}
              </span>
            </div>
          );
        })}

        {/* Bar columns */}
        <div
          className="absolute inset-x-3 bottom-0 flex items-end gap-1.5"
          style={{ height }}
        >
          {data.map((d) => {
            const expH = Math.max(
              Math.round((d.expected / maxVal) * barAreaH),
              2,
            );
            const actH =
              d.actual > 0
                ? Math.max(Math.round((d.actual / maxVal) * barAreaH), 3)
                : 2;
            const hasAct = d.actual > 0;
            const isOnTrack = hasAct && d.actual >= d.expected;
            const monthLabel = new Date(d.period + "-01").toLocaleDateString(
              "en-GB",
              { month: "short" },
            );
            const rate =
              hasAct && d.expected > 0
                ? Math.round((d.actual / d.expected) * 100)
                : null;

            return (
              <div
                key={d.period}
                className="group relative flex flex-col items-center flex-1 min-w-[28px]"
                style={{ height }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                  <div className="rounded-xl bg-[#1E2235] text-white text-[11px] px-3.5 py-3 whitespace-nowrap shadow-2xl space-y-1.5 min-w-[160px]">
                    <p className="text-[12px] font-bold text-white border-b border-white/10 pb-2 mb-0.5">
                      {new Date(d.period + "-01").toLocaleDateString("en-GB", {
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-400">Expected</span>
                      <span className="font-semibold tabular-nums text-slate-200">
                        {fmt(d.expected)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-slate-400">Actual</span>
                      <span
                        className="font-semibold tabular-nums"
                        style={{
                          color: !hasAct
                            ? "#64748B"
                            : isOnTrack
                              ? "#818CF8"
                              : "#FB923C",
                        }}
                      >
                        {hasAct ? fmt(d.actual) : "—"}
                      </span>
                    </div>
                    {rate != null && (
                      <div className="flex justify-between gap-6 border-t border-white/10 pt-1.5 mt-0.5">
                        <span className="text-slate-400">Achievement</span>
                        <span
                          className="font-bold tabular-nums"
                          style={{ color: isOnTrack ? "#818CF8" : "#FB923C" }}
                        >
                          {rate}%
                        </span>
                      </div>
                    )}
                    {d.eoy_forecast > 0 && (
                      <div className="flex justify-between gap-6">
                        <span className="text-slate-400">EOY Fcst</span>
                        <span className="font-semibold tabular-nums text-indigo-300">
                          {fmt(d.eoy_forecast)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="border-[5px] border-transparent border-t-[#1E2235] -mt-px" />
                </div>

                {/* Bar pair */}
                <div
                  className="absolute flex items-end gap-0.5 w-full px-0.5"
                  style={{ bottom: 32 }}
                >
                  {/* Expected — reference */}
                  <div
                    className="flex-1 rounded-t-[4px] transition-all duration-300"
                    style={{
                      height: expH,
                      backgroundColor: CHART.expected.bar,
                      borderTop: `2px solid ${CHART.expected.border}`,
                    }}
                  />
                  {/* Actual */}
                  <div
                    className="flex-1 rounded-t-[4px] transition-all duration-500"
                    style={{
                      height: actH,
                      backgroundColor: !hasAct
                        ? CHART.future.bar
                        : isOnTrack
                          ? CHART.onTrack.bar
                          : CHART.behind.bar,
                      opacity: !hasAct ? 0.5 : 1,
                    }}
                  />
                </div>

                {/* Month label */}
                <span className="absolute bottom-2 text-[10px] text-slate-500 font-semibold select-none">
                  {monthLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-6 px-1">
        {[
          {
            color: CHART.expected.bar,
            border: CHART.expected.border,
            label: "Expected (reference)",
          },
          { color: CHART.onTrack.bar, label: "Actual ≥ 100% — on track" },
          { color: CHART.behind.bar, label: "Actual < 100% — below target" },
        ].map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-2 text-[11px] text-slate-500"
          >
            <span
              className="inline-block h-2.5 w-5 rounded-sm shrink-0 flex-none"
              style={{
                backgroundColor: item.color,
                border: item.border ? `1.5px solid ${item.border}` : undefined,
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Card
// ---------------------------------------------------------------------------
function ScoreCard({
  icon,
  label,
  value,
  sub,
  pct,
  target = 100,
  token = C.indigo,
  dim: _dim,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  pct?: number | null;
  target?: number;
  token?: typeof C.indigo;
  dim?: string;
}) {
  const t = pct != null ? pctToken(pct, target) : token;
  const valueIsAmount = value.startsWith("€") || value.startsWith("-€");
  const valueColor = valueIsAmount ? "text-slate-900" : t.text;
  return (
    <div
      className={`rounded-2xl bg-white border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.04)] border-l-4 ${t.border} overflow-hidden flex flex-col`}
    >
      <div className="px-4 pt-4 pb-3.5 flex flex-col gap-3 flex-1">
        {/* Icon */}
        <div className={`rounded-xl ${t.light} p-2 ${t.text} w-fit`}>
          {icon}
        </div>

        {/* Label + value */}
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            {label}
          </p>
          <p className={`text-[23px] leading-none font-black ${valueColor}`}>
            {value}
          </p>
          {sub && (
            <p className="text-[11px] text-slate-400 leading-tight pt-0.5">
              {sub}
            </p>
          )}
        </div>

        {/* Progress bar — simplified: bar then value+status below */}
        {pct != null && (
          <div className="mt-auto space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${t.bg}`}
                style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <TrendChip val={pct} target={target} />
              <span className={`text-[11px] font-bold tabular-nums ${t.text}`}>
                {pctFmt(pct)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric cell
// ---------------------------------------------------------------------------
function Metric({
  label,
  value,
  sub,
  token,
  bar,
}: {
  label: string;
  value: string;
  sub?: string;
  token?: typeof C.indigo;
  bar?: number | null;
}) {
  const t = token ?? C.indigo;
  return (
    <div className="p-4 flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p className={`text-lg font-black ${t.text}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 leading-tight">{sub}</p>}
      {bar != null && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-slate-100">
          <div
            className={`h-1 rounded-full ${t.bg}`}
            style={{ width: `${Math.min(Math.max(bar, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EOY stacked bar chart by budget status
// ---------------------------------------------------------------------------
const STATUS_COLORS = {
  Budgeted: { hex: "#4F46E5", label: "Budgeted" },
  Opportunity: { hex: "#F59E0B", label: "Opportunity" },
  Empty: { hex: "#C7D2FE", label: "No budget" },
} as const;
const STATUS_ORDER = ["Empty", "Opportunity", "Budgeted"] as const;
const STATUS_LEGEND = ["Budgeted", "Opportunity", "Empty"] as const;
const CHART_H = 160;
const LABEL_H = 16;
const NAME_H = 36;

function EoyByPlantChart({ plants }: { plants: PlantRow[] }) {
  const visible = plants.filter((p) => p.eoy_forecast > 0);
  if (!visible.length)
    return (
      <p className="py-8 text-center text-sm text-slate-400">No EOY data.</p>
    );
  const maxVal = Math.max(...visible.map((p) => p.eoy_forecast), 1);
  const colH = CHART_H + LABEL_H + NAME_H;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-5 text-[11px] text-slate-500">
        {STATUS_LEGEND.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm inline-block shrink-0"
              style={{ backgroundColor: STATUS_COLORS[s].hex }}
            />
            {STATUS_COLORS[s].label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-2 min-w-0" style={{ height: colH }}>
          {visible.map((plant) => {
            const eoy = plant.eoy_by_status ?? {
              Budgeted: 0,
              Opportunity: 0,
              Empty: 0,
            };
            const total = plant.eoy_forecast;
            const totalH = Math.max(Math.round((total / maxVal) * CHART_H), 2);
            const segs = STATUS_ORDER.map((s) => ({
              s,
              val: eoy[s as keyof typeof eoy] ?? 0,
            })).filter((x) => x.val > 0);
            let rem = totalH;
            const segHeights = segs.map((x, i) => {
              if (i === segs.length - 1) return { ...x, h: rem };
              const h = Math.round((x.val / total) * totalH);
              rem -= h;
              return { ...x, h };
            });
            return (
              <div
                key={plant.plant_id}
                className="group relative flex flex-col items-center flex-1 min-w-[44px]"
                style={{ height: colH }}
              >
                <div
                  className="absolute hidden group-hover:flex flex-col items-center z-20 pointer-events-none"
                  style={{ bottom: NAME_H + totalH + LABEL_H + 8 }}
                >
                  <div className="rounded-xl bg-slate-900 text-white text-[10px] px-3 py-2.5 whitespace-nowrap shadow-2xl space-y-1">
                    <p className="font-bold text-[11px] mb-1 text-slate-100 border-b border-slate-700 pb-1.5">
                      {plant.plant_name}
                    </p>
                    {STATUS_LEGEND.map((s) => {
                      const v = eoy[s as keyof typeof eoy] ?? 0;
                      return v > 0 ? (
                        <p
                          key={s}
                          className="flex justify-between gap-4"
                          style={{ color: STATUS_COLORS[s].hex }}
                        >
                          <span>{STATUS_COLORS[s].label}</span>
                          <span className="font-semibold tabular-nums">
                            {fmt(v)}
                          </span>
                        </p>
                      ) : null;
                    })}
                    <p className="border-t border-slate-700 mt-1 pt-1 font-semibold flex justify-between gap-4">
                      <span className="text-slate-300">Total</span>
                      <span className="tabular-nums">{fmt(total)}</span>
                    </p>
                  </div>
                  <div className="border-4 border-transparent border-t-slate-900" />
                </div>
                <div
                  className="absolute w-full text-center text-[8.5px] font-bold text-slate-500 leading-none tabular-nums"
                  style={{ bottom: NAME_H + totalH + 2 }}
                >
                  {fmt(total)}
                </div>
                <div
                  className="absolute w-full overflow-hidden rounded-t-lg flex flex-col"
                  style={{ bottom: NAME_H, height: totalH }}
                >
                  {segHeights.map(({ s, h }) => (
                    <div
                      key={s}
                      style={{
                        height: h,
                        backgroundColor: STATUS_COLORS[s].hex,
                      }}
                    />
                  ))}
                </div>
                <div
                  className="absolute bottom-0 w-full text-center px-0.5"
                  style={{ height: NAME_H }}
                >
                  <span
                    className="text-[8.5px] text-slate-500 font-semibold leading-tight block truncate"
                    title={plant.plant_name}
                  >
                    {plant.plant_name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delta-reason color map (matches Monday.com taxonomy) — DISABLED
// ---------------------------------------------------------------------------
// const REASON_HEX: Record<string, string> = {
//   "As planned":                  "#22C55E",
//   "NTS":                         "#9CA3AF",
//   "Inventory issue":             "#A78BFA",
//   "Higher productivity / Volume":"#16A34A",
//   "Inventory reduction":         "#EC4899",
//   "Check Data":                  "#38BDF8",
//   "Lower volume / Late start":   "#D97706",
//   "Cancel & Replace":            "#92400E",
//   "Stuck":                       "#7C3AED",
//   "Budget Mist":                 "#EA580C",
//   "Price increase":              "#F472B6",
//   "Strategy change":             "#C084FC",
//   "Supplier Issue":              "#F97316",
//   "Recovery":                    "#0369A1",
//   "Late action":                 "#EF4444",
//   "RM Not Available":            "#1E293B",
// };
// function getReasonHex(r: string) { return REASON_HEX[r] ?? "#94A3B8"; }

// ---------------------------------------------------------------------------
// EOY by plant — grouped by opportunity type (stacked horizontal bars)
// ---------------------------------------------------------------------------
const TYPE_HEX: Record<string, string> = {
  Negotiation: "#8B5CF6",
  Sourcing: "#0EA5E9",
  "Technical Productivity": "#10B981",
  Cash: "#F59E0B",
};
function getTypeHex(t: string) {
  return TYPE_HEX[t] ?? "#94A3B8";
}

function EoyByPlantByTypeChart({ plants }: { plants: PlantRow[] }) {
  const visible = plants.filter((p) => p.eoy_forecast > 0);
  if (!visible.length)
    return (
      <p className="py-8 text-center text-sm text-slate-400">No EOY data.</p>
    );
  const allTypes = [
    ...new Set(visible.flatMap((p) => Object.keys(p.eoy_by_type ?? {}))),
  ];
  if (!allTypes.length)
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No type breakdown available.
      </p>
    );
  const maxVal = Math.max(...visible.map((p) => p.eoy_forecast), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
        {allTypes.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm inline-block shrink-0"
              style={{ backgroundColor: getTypeHex(t) }}
            />
            {t}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {visible.map((plant) => {
          const barPct = Math.round((plant.eoy_forecast / maxVal) * 100);
          const segs = allTypes
            .map((t) => ({ type: t, val: (plant.eoy_by_type ?? {})[t] ?? 0 }))
            .filter((s) => s.val > 0);
          return (
            <div key={plant.plant_id} className="flex items-center gap-3">
              <div className="w-32 shrink-0 text-[11px] font-semibold text-slate-600 truncate text-right">
                {plant.plant_name}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-slate-100 rounded-md h-6 overflow-hidden">
                  <div className="flex h-full" style={{ width: `${barPct}%` }}>
                    {segs.map((s) => (
                      <div
                        key={s.type}
                        className="h-full transition-all"
                        style={{
                          width: `${Math.round((s.val / plant.eoy_forecast) * 100)}%`,
                          backgroundColor: getTypeHex(s.type),
                        }}
                        title={`${s.type}: ${fmt(s.val)}`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-[12px] font-black text-slate-800 tabular-nums shrink-0 w-28 text-right">
                  {fmt(plant.eoy_forecast)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delta EOY vs Budget by plant — diverging horizontal bars grouped by type
// ---------------------------------------------------------------------------
function DeltaEoyByPlantChart({ plants }: { plants: PlantRow[] }) {
  const withDelta = plants
    .map((p) => ({
      ...p,
      total_delta: Object.values(p.delta_eoy_budget_by_type ?? {}).reduce(
        (s, v) => s + v,
        0,
      ),
    }))
    .filter((p) => Object.keys(p.delta_eoy_budget_by_type ?? {}).length > 0)
    .sort((a, b) => b.total_delta - a.total_delta);

  if (!withDelta.length)
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No committed opportunities to compare.
      </p>
    );

  const maxAbs = Math.max(...withDelta.map((p) => Math.abs(p.total_delta)), 1);
  const allTypes = [
    ...new Set(
      withDelta.flatMap((p) => Object.keys(p.delta_eoy_budget_by_type ?? {})),
    ),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6 text-[11px] text-slate-500">
        {allTypes.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm inline-block shrink-0"
              style={{ backgroundColor: getTypeHex(t) }}
            />
            {t}
          </span>
        ))}
        <span className="ml-2 text-[10px] text-slate-400 italic">
          + above baseline · − below baseline
        </span>
      </div>
      <div className="space-y-2">
        {withDelta.map((plant) => {
          const isPos = plant.total_delta >= 0;
          const barPct = Math.round(
            (Math.abs(plant.total_delta) / maxAbs) * 100,
          );
          const segs = allTypes
            .map((t) => ({
              type: t,
              val: (plant.delta_eoy_budget_by_type ?? {})[t] ?? 0,
            }))
            .filter((s) => (isPos ? s.val > 0 : s.val < 0));
          const totalAbs = segs.reduce((s, v) => s + Math.abs(v.val), 0) || 1;

          return (
            <div key={plant.plant_id} className="flex items-center gap-3">
              <div className="w-32 shrink-0 text-[11px] font-semibold text-slate-600 truncate text-right">
                {plant.plant_name}
              </div>
              <div className="flex-1 flex items-center">
                {/* left (negative) */}
                <div className="w-1/2 flex justify-end pr-px">
                  {!isPos && (
                    <div
                      className="flex h-5 rounded-l-sm overflow-hidden"
                      style={{ width: `${barPct}%` }}
                    >
                      {segs.map((s) => (
                        <div
                          key={s.type}
                          className="h-full"
                          style={{
                            width: `${Math.round((Math.abs(s.val) / totalAbs) * 100)}%`,
                            backgroundColor: getTypeHex(s.type),
                            opacity: 0.75,
                          }}
                          title={`${s.type}: ${fmt(s.val)}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {/* centre */}
                <div className="w-px h-7 bg-slate-300 shrink-0" />
                {/* right (positive) */}
                <div className="w-1/2 pl-px">
                  {isPos && plant.total_delta > 0 && (
                    <div
                      className="flex h-5 rounded-r-sm overflow-hidden"
                      style={{ width: `${barPct}%` }}
                    >
                      {segs.map((s) => (
                        <div
                          key={s.type}
                          className="h-full"
                          style={{
                            width: `${Math.round((Math.abs(s.val) / totalAbs) * 100)}%`,
                            backgroundColor: getTypeHex(s.type),
                          }}
                          title={`${s.type}: ${fmt(s.val)}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <span
                className={`text-[11px] font-bold tabular-nums shrink-0 w-28 ${isPos ? "text-emerald-600" : "text-rose-500"}`}
              >
                {isPos && plant.total_delta > 0 ? "+" : ""}
                {fmt(plant.total_delta)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delta EOY vs Budget by plant — stacked by delta_reason (chart 5) — DISABLED
// ---------------------------------------------------------------------------
// function DeltaEoyByReasonChart({ plants }: { plants: PlantRow[] }) {
//   const withDelta = plants
//     .map(p => ({
//       ...p,
//       total_delta: Object.values(p.delta_eoy_budget_by_reason ?? {}).reduce((s, v) => s + v, 0),
//     }))
//     .filter(p => Object.keys(p.delta_eoy_budget_by_reason ?? {}).length > 0)
//     .sort((a, b) => b.total_delta - a.total_delta);
//   if (!withDelta.length)
//     return (
//       <p className="py-8 text-center text-sm text-slate-400">
//         No delta reason data yet. Set <em>delta_reason</em> on budget assignments to populate this chart.
//       </p>
//     );
//   const allReasons = [...new Set(withDelta.flatMap(p => Object.keys(p.delta_eoy_budget_by_reason ?? {})))];
//   const maxAbs = Math.max(...withDelta.map(p => Math.abs(p.total_delta)), 1);
//   return (
//     <div className="space-y-4">
//       <div className="flex flex-wrap gap-3">
//         {allReasons.map(r => (
//           <span key={r} className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
//             <span className="h-2.5 w-2.5 rounded-sm inline-block shrink-0" style={{ backgroundColor: getReasonHex(r) }} />
//             {r}
//           </span>
//         ))}
//         <span className="ml-2 text-[10px] text-slate-400 italic">+ above baseline · − below baseline</span>
//       </div>
//       <div className="space-y-2">
//         {withDelta.map(plant => {
//           const isPos = plant.total_delta >= 0;
//           const barPct = Math.round((Math.abs(plant.total_delta) / maxAbs) * 100);
//           const segs = allReasons
//             .map(r => ({ reason: r, val: (plant.delta_eoy_budget_by_reason ?? {})[r] ?? 0 }))
//             .filter(s => (isPos ? s.val > 0 : s.val < 0));
//           const totalAbs = segs.reduce((s, v) => s + Math.abs(v.val), 0) || 1;
//           return (
//             <div key={plant.plant_id} className="flex items-center gap-3">
//               <div className="w-32 shrink-0 text-[11px] font-semibold text-slate-600 truncate text-right">{plant.plant_name}</div>
//               <div className="flex-1 flex items-center">
//                 <div className="w-1/2 flex justify-end pr-px">
//                   {!isPos && (
//                     <div className="flex h-5 rounded-l-sm overflow-hidden" style={{ width: `${barPct}%` }}>
//                       {segs.map(s => (
//                         <div key={s.reason} className="h-full" title={`${s.reason}: ${fmt(s.val)}`}
//                           style={{ width: `${Math.round((Math.abs(s.val) / totalAbs) * 100)}%`, backgroundColor: getReasonHex(s.reason), opacity: 0.8 }} />
//                       ))}
//                     </div>
//                   )}
//                 </div>
//                 <div className="w-px h-7 bg-slate-300 shrink-0" />
//                 <div className="w-1/2 pl-px">
//                   {isPos && plant.total_delta > 0 && (
//                     <div className="flex h-5 rounded-r-sm overflow-hidden" style={{ width: `${barPct}%` }}>
//                       {segs.map(s => (
//                         <div key={s.reason} className="h-full" title={`${s.reason}: ${fmt(s.val)}`}
//                           style={{ width: `${Math.round((Math.abs(s.val) / totalAbs) * 100)}%`, backgroundColor: getReasonHex(s.reason) }} />
//                       ))}
//                     </div>
//                   )}
//                 </div>
//               </div>
//               <span className={`text-[11px] font-bold tabular-nums shrink-0 w-28 ${isPos ? "text-emerald-600" : "text-rose-500"}`}>
//                 {isPos && plant.total_delta > 0 ? "+" : ""}{fmt(plant.total_delta)}
//               </span>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

// ---------------------------------------------------------------------------
// Top 10 suppliers — horizontal stacked bars by type
// ---------------------------------------------------------------------------
function TopSuppliersChart({ suppliers }: { suppliers: SupplierRow[] }) {
  const visible = suppliers.filter((s) => s.eoy_forecast > 0);
  if (!visible.length)
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No supplier data. Populate <em>proposed_supplier_name</em> on
        opportunities to see this chart.
      </p>
    );
  const allTypes = [
    ...new Set(visible.flatMap((s) => Object.keys(s.eoy_by_type))),
  ];
  const maxVal = Math.max(...visible.map((s) => s.eoy_forecast), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
        {allTypes.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm inline-block shrink-0"
              style={{ backgroundColor: getTypeHex(t) }}
            />
            {t}
          </span>
        ))}
      </div>
      <div className="space-y-2.5">
        {visible.map((sup, i) => {
          const barPct = Math.round((sup.eoy_forecast / maxVal) * 100);
          const segs = allTypes
            .map((t) => ({ type: t, val: sup.eoy_by_type[t] ?? 0 }))
            .filter((s) => s.val > 0);
          return (
            <div key={sup.supplier_name} className="flex items-center gap-3">
              <span className="w-5 text-[10px] font-black text-slate-300 text-right shrink-0">
                {i + 1}
              </span>
              <div className="w-36 shrink-0">
                <p
                  className="text-[11px] font-semibold text-slate-700 leading-tight truncate"
                  title={sup.supplier_name}
                >
                  {sup.supplier_name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {sup.opp_count} opp{sup.opp_count !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-slate-100 rounded-md h-5 overflow-hidden">
                  <div className="flex h-full" style={{ width: `${barPct}%` }}>
                    {segs.map((s) => (
                      <div
                        key={s.type}
                        className="h-full"
                        style={{
                          width: `${Math.round((s.val / sup.eoy_forecast) * 100)}%`,
                          backgroundColor: getTypeHex(s.type),
                        }}
                        title={`${s.type}: ${fmt(s.val)}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right w-28">
                  <p className="text-[12px] font-black text-slate-800 tabular-nums">
                    {fmt(sup.eoy_forecast)}
                  </p>
                  {sup.actual_ytd > 0 && (
                    <p className="text-[10px] text-slate-400 tabular-nums">
                      YTD {fmt(sup.actual_ytd)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible entity card
// ---------------------------------------------------------------------------
function CollapsibleCard({
  colorBar,
  header,
  badge,
  children,
  defaultOpen = false,
}: {
  colorBar: string;
  header: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`h-4 w-1 rounded-full ${colorBar} shrink-0`} />
          <div className="text-left">{header}</div>
        </div>
        <div className="flex items-center gap-3">
          {badge}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionLabel({ label, dim }: { label: string; dim?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="h-3.5 w-[3px] rounded-full bg-indigo-400 shrink-0" />
      <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">
        {label}
      </span>
      {dim && (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400">
          {dim}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------
export default function PurchasingKpiPage() {
  const { user } = useAuth();
  const userEmail = (user as { email?: string })?.email ?? "";
  const today = new Date();
  const activeBudgetYear =
    today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
  // Restores whatever this user last had filtered — otherwise leaving this
  // page and coming back (or a reload) silently resets every filter.
  const initialFilters = loadPersistedFilters<PersistedKpiFilters>(
    KPI_FILTERS_PAGE_KEY,
    userEmail,
    { selectedYear: null, plantIds: [], categories: [], buyers: [] },
  );
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(
    initialFilters.selectedYear ?? activeBudgetYear,
  );
  const [filters, setFilters] = useState<KpiFilters>({
    plantIds: initialFilters.plantIds,
    categories: initialFilters.categories,
    buyers: initialFilters.buyers,
  });
  const [tab, setTab] = useState<
    "monthly" | "plant" | "supplier" | "type" | "nature" | "buyer" | "alerts"
  >("monthly");

  useEffect(() => {
    savePersistedFilters<PersistedKpiFilters>(KPI_FILTERS_PAGE_KEY, userEmail, {
      selectedYear,
      plantIds: filters.plantIds,
      categories: filters.categories,
      buyers: filters.buyers,
    });
  }, [userEmail, selectedYear, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.getPurchasingKpis(selectedYear, {
        plantIds: filters.plantIds,
        categories: filters.categories,
        buyers: filters.buyers,
      });
      setData(res.data as KpiData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, filters]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-indigo-100" />
            <RefreshCw
              size={18}
              className="animate-spin text-indigo-500 absolute inset-0 m-auto"
            />
          </div>
          <p className="text-sm font-medium text-slate-400">Computing KPIs…</p>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5 text-rose-700 text-sm max-w-sm text-center">
          <AlertTriangle size={20} className="mx-auto mb-2 text-rose-400" />
          {error}
        </div>
      </div>
    );
  if (!data) return null;

  const {
    kpis,
    monthly_actuals,
    by_plant,
    by_supplier,
    by_type,
    by_saving_nature,
    by_buyer,
    late_projects,
    missing_updates,
    escalated,
  } = data;
  const avail = data.available_filters;
  const hasFilters =
    filters.plantIds.length > 0 ||
    filters.categories.length > 0 ||
    filters.buyers.length > 0;
  const totalAlerts =
    kpis.escalated_count + kpis.late_projects_count + kpis.missing_update_lines;

  const togglePlant = (id: number) =>
    setFilters((f) => ({
      ...f,
      plantIds: f.plantIds.includes(id)
        ? f.plantIds.filter((x) => x !== id)
        : [...f.plantIds, id],
    }));
  const toggleCategory = (c: string) =>
    setFilters((f) => ({
      ...f,
      categories: f.categories.includes(c)
        ? f.categories.filter((x) => x !== c)
        : [...f.categories, c],
    }));
  const toggleBuyer = (b: string) =>
    setFilters((f) => ({
      ...f,
      buyers: f.buyers.includes(b)
        ? f.buyers.filter((x) => x !== b)
        : [...f.buyers, b],
    }));

  const tabs = [
    {
      id: "monthly" as const,
      label: "Monthly Savings",
      icon: <BarChart2 size={13} />,
    },
    { id: "plant" as const, label: "By Plant", icon: <FolderOpen size={13} /> },
    {
      id: "supplier" as const,
      label: `Top 10 Suppliers${by_supplier?.length > 0 ? ` (${by_supplier.length})` : ""}`,
      icon: <Package size={13} />,
    },
    { id: "type" as const, label: "By Type", icon: <Zap size={13} /> },
    { id: "nature" as const, label: "By Nature", icon: <Banknote size={13} /> },
    {
      id: "buyer" as const,
      label: `By Buyer${by_buyer?.length > 0 ? ` (${by_buyer.length})` : ""}`,
      icon: <Users size={13} />,
    },
    {
      id: "alerts" as const,
      label: `Alerts${totalAlerts > 0 ? ` · ${totalAlerts}` : ""}`,
      icon: <AlertTriangle size={13} />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F1F4FA]">
      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200/70 px-8 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-200">
              <BarChart2 size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">
                Purchasing · KPIs
              </p>
              <h1 className="text-xl font-black text-slate-900 leading-tight">
                Value Management Dashboard
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Monthly savings · Per plant · Per type · Forecast vs Budget
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                FY
              </span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="border-0 bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition-colors"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {data.computed_at && (
          <p className="mt-2 text-[10px] text-slate-400 flex items-center gap-2">
            <span>
              Computed: {new Date(data.computed_at).toLocaleString("en-GB")}
            </span>
            {data.reporting_currency && data.reporting_currency !== "EUR" && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                {data.reporting_currency}
              </span>
            )}
            {hasFilters && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-600 font-semibold">
                <SlidersHorizontal size={9} /> Filtered view
              </span>
            )}
          </p>
        )}
      </div>

      {/* ── FILTER BAR ── */}
      {avail &&
        (avail.plants.length > 0 ||
          avail.categories.length > 0 ||
          avail.buyers.length > 0) && (
          <div className="bg-white border-b border-slate-100 px-8 py-2.5 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-400 mr-1">
              <SlidersHorizontal size={11} />
              <span className="text-[9.5px] font-black uppercase tracking-widest">
                Filter
              </span>
            </div>

            {avail.plants.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePlant(p.id)}
                className={`rounded-full px-3 py-1 text-[10.5px] font-semibold border transition-all ${
                  filters.plantIds.includes(p.id)
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {p.name}
              </button>
            ))}
            {avail.categories.map((c) => (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className={`rounded-full px-3 py-1 text-[10.5px] font-semibold border transition-all ${
                  filters.categories.includes(c)
                    ? `${TYPE_PALETTE[c]?.bg ?? "bg-violet-600"} border-transparent text-white shadow-sm`
                    : "bg-white border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600"
                }`}
              >
                {c}
              </button>
            ))}
            {avail.buyers.map((b) => {
              const name = b.includes("@")
                ? b
                    .split("@")[0]
                    .split(".")
                    .map((s: string) => s[0].toUpperCase() + s.slice(1))
                    .join(" ")
                : b;
              return (
                <button
                  key={b}
                  onClick={() => toggleBuyer(b)}
                  className={`rounded-full px-3 py-1 text-[10.5px] font-semibold border transition-all ${
                    filters.buyers.includes(b)
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
                  }`}
                >
                  {name}
                </button>
              );
            })}
            {hasFilters && (
              <button
                onClick={() =>
                  setFilters({ plantIds: [], categories: [], buyers: [] })
                }
                className="ml-auto flex items-center gap-1 text-[10.5px] font-semibold text-slate-400 hover:text-rose-500 transition-colors"
              >
                <XCircle size={11} /> Reset
              </button>
            )}
          </div>
        )}

      <div className="px-8 py-7 space-y-6 max-w-[1600px] mx-auto">
        {/* FX warning */}
        {kpis.non_eur_missing_rate > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <AlertTriangle
              size={14}
              className="mt-0.5 shrink-0 text-amber-500"
            />
            <span>
              <strong>{kpis.non_eur_missing_rate}</strong> non-EUR line
              {kpis.non_eur_missing_rate !== 1 ? "s have" : " has"} no FX rate
              and {kpis.non_eur_missing_rate !== 1 ? "are" : "is"} counted at
              1:1 — consolidated totals may be understated.
            </span>
          </div>
        )}

        {/* ── EXECUTIVE SUMMARY ── */}
        <ExecSummaryBar
          kpis={kpis}
          year={selectedYear}
          totalAlerts={totalAlerts}
        />

        {/* ── P1 EXECUTION KPIs ── */}
        <div>
          <SectionLabel label="P1 · Execution" dim="Year-to-date performance" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <ScoreCard
              icon={<TrendingUp size={15} />}
              label="EOY Forecast"
              token={C.indigo}
              dim="Forecast"
              value={fmt(kpis.eoy_forecast_total)}
              sub={`${kpis.active_lines_count} active financial lines`}
            />
            <ScoreCard
              icon={<Target size={15} />}
              label="EOY vs Budget"
              value={pctFmt(kpis.eoy_vs_budget_pct)}
              pct={kpis.eoy_vs_budget_pct}
              sub={`vs budgeted annual baseline: ${fmt(kpis.budgeted_expected_annual)}`}
            />
            <ScoreCard
              icon={<Banknote size={15} />}
              label="Actual YTD"
              token={C.sky}
              dim="YTD"
              value={fmt(kpis.actual_ytd_total)}
              sub={`vs expected ${fmt(kpis.expected_ytd_total)}`}
              pct={kpis.actual_vs_expected_ytd_pct}
            />
            <ScoreCard
              icon={<BadgeCheck size={15} />}
              label="Actual vs Budget YTD"
              value={pctFmt(kpis.actual_vs_budget_ytd_pct)}
              pct={kpis.actual_vs_budget_ytd_pct}
              sub="Committed (budgeted) opps only"
            />
            <ScoreCard
              icon={<FolderOpen size={15} />}
              label="Validated — Not Committed"
              token={C.violet}
              value={fmt(kpis.opportunity_pipeline_amount)}
              sub={`${kpis.opportunity_pipeline_count} opp${kpis.opportunity_pipeline_count !== 1 ? "s" : ""} · FY applicable amount`}
            />
          </div>
        </div>

        {/* ── P2 PIPELINE KPIs ── */}
        <div>
          <SectionLabel
            label="P2 · Pipeline"
            dim="Opportunities &amp; effectiveness"
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
            <ScoreCard
              icon={<TrendingUp size={15} />}
              label="Est. Annual — Budgeted"
              token={C.emerald}
              dim="Pipeline"
              value={fmt(kpis.budgeted_expected_annual)}
              sub={`Budget ${selectedYear}: ${fmt(kpis.total_budget)}`}
            />
            <ScoreCard
              icon={<Banknote size={15} />}
              label="Program Value — Lifetime"
              token={C.violet}
              dim="Pipeline"
              value={fmt(kpis.program_value_lifetime)}
              sub="Cumulative multi-year saving (open)"
            />
            <ScoreCard
              icon={<BadgeCheck size={15} />}
              label="Conversion Rate"
              token={C.sky}
              dim="Effectiveness"
              value={pctFmt(kpis.conversion_rate_pct)}
              pct={kpis.conversion_rate_pct}
              sub={`${kpis.converted_opp_count} / ${kpis.validated_opp_count} validated`}
            />
            <ScoreCard
              icon={<Zap size={15} />}
              label="Phase 0 Go Rate"
              token={C.amber}
              dim="Efficiency"
              value={pctFmt(kpis.phase0_go_rate_pct)}
              pct={kpis.phase0_go_rate_pct}
              sub={`${kpis.phase0_go_count ?? 0} / ${kpis.phase0_decided_count ?? 0} decided`}
            />
            <ScoreCard
              icon={<CheckCircle2 size={15} />}
              label="Projects On Time"
              token={C.emerald}
              dim="Delivery"
              value={pctFmt(kpis.project_on_time_rate_pct)}
              pct={kpis.project_on_time_rate_pct}
              sub="Schedule adherence"
            />
          </div>
        </div>

        {/* ── SECONDARY KPI ROW ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Monthly update coverage */}
          <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] px-4 py-3.5 border-l-4 border-l-indigo-300">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">
              Monthly Coverage
            </p>
            <div className="flex items-center gap-3">
              <Ring
                pct={kpis.monthly_update_pct ?? 0}
                token={
                  kpis.monthly_update_pct === 100
                    ? C.emerald
                    : (kpis.monthly_update_pct ?? 0) >= 75
                      ? C.amber
                      : C.rose
                }
              />
              <div className="min-w-0">
                <p
                  className={`text-[22px] font-black leading-none ${pctToken(kpis.monthly_update_pct).text}`}
                >
                  {pctFmt(kpis.monthly_update_pct)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {kpis.missing_update_lines > 0 ? (
                    <span className="text-orange-600 font-semibold">
                      {kpis.missing_update_lines} line
                      {kpis.missing_update_lines !== 1 ? "s" : ""} missing
                    </span>
                  ) : (
                    "All lines up to date"
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Forecast outperformance */}
          <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] px-4 py-3.5 border-l-4 border-l-emerald-300">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">
              Forecast Outperformance
            </p>
            <p
              className={`text-[22px] font-black leading-none ${kpis.over_budget_count > 0 ? "text-emerald-600" : "text-slate-300"}`}
            >
              {kpis.over_budget_count > 0
                ? `${kpis.over_budget_count} opp${kpis.over_budget_count !== 1 ? "s" : ""}`
                : "None"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              {kpis.over_budget_count > 0 ? (
                <>
                  <span className="font-semibold text-emerald-600 tabular-nums">
                    +{fmt(kpis.over_budget_amount)}
                  </span>{" "}
                  above budget
                </>
              ) : (
                "All within commitment"
              )}
            </p>
          </div>

          {/* Since Jan 2026 */}
          <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] px-4 py-3.5 border-l-4 border-l-sky-300">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">
              Since Jan 2026
            </p>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-sky-500 shrink-0" />
              <p className="text-[22px] font-black leading-none text-slate-900 tabular-nums">
                {fmt(kpis.total_saving_from_jan2026 ?? 0)}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
              Calendar-year actuals · all lines
            </p>
          </div>

          {/* Active alerts — status card */}
          <div
            className={`rounded-2xl border shadow-[0_2px_10px_rgba(0,0,0,0.04)] px-4 py-3.5 border-l-4 ${
              totalAlerts === 0
                ? "border-slate-200/60 border-l-emerald-400 bg-white"
                : kpis.escalated_count > 0
                  ? "border-rose-100 border-l-rose-500 bg-rose-50/20"
                  : "border-orange-100 border-l-orange-400 bg-orange-50/10"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 mb-3">
              Active Alerts
            </p>
            {totalAlerts === 0 ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                <p className="text-[13px] font-semibold text-emerald-700">
                  All clear
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {[
                  {
                    icon: <AlertTriangle size={10} />,
                    label: "Escalated",
                    count: kpis.escalated_count,
                    on: "text-rose-600",
                    bg: "bg-rose-100 text-rose-700",
                  },
                  {
                    icon: <Clock size={10} />,
                    label: "Late projects",
                    count: kpis.late_projects_count,
                    on: "text-orange-600",
                    bg: "bg-orange-100 text-orange-700",
                  },
                  {
                    icon: <XCircle size={10} />,
                    label: "Missing updates",
                    count: kpis.missing_update_lines,
                    on: "text-amber-600",
                    bg: "bg-amber-100 text-amber-700",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between"
                  >
                    <span
                      className={`flex items-center gap-1.5 text-[11px] font-medium ${row.count > 0 ? row.on : "text-slate-300"}`}
                    >
                      {row.icon}
                      {row.label}
                    </span>
                    <span
                      className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${row.count > 0 ? row.bg : "text-slate-300"}`}
                    >
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── TAB AREA ── */}
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="border-b border-slate-100 px-4 pt-3 pb-0">
            <div className="flex gap-0.5 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-[11.5px] font-bold rounded-t-xl border-b-2 -mb-px transition-all whitespace-nowrap ${
                    tab === t.id
                      ? "border-indigo-500 text-indigo-600 bg-indigo-50/60"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/60"
                  }`}
                >
                  {t.icon}
                  {t.label}
                  {t.id === "alerts" && totalAlerts > 0 && (
                    <span className="ml-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 leading-none">
                      {totalAlerts}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {/* ── MONTHLY SAVINGS ── */}
            {tab === "monthly" && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Monthly Savings — Expected vs Actual ({selectedYear})
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      All active financial lines · Phase 2+ in production
                    </p>
                  </div>
                  {monthly_actuals.length > 0 &&
                    (() => {
                      const totExp = monthly_actuals.reduce(
                        (s, d) => s + d.expected,
                        0,
                      );
                      const totAct = monthly_actuals
                        .filter((d) => d.actual > 0)
                        .reduce((s, d) => s + d.actual, 0);
                      const hasAny = monthly_actuals.some((d) => d.actual > 0);
                      const rate =
                        hasAny && totExp > 0
                          ? Math.round((totAct / totExp) * 100)
                          : null;
                      const tok = pctToken(rate);
                      return (
                        <div className="flex items-center gap-5 text-right shrink-0">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                              YTD Actual
                            </p>
                            <p className="text-[15px] font-black text-slate-900 tabular-nums">
                              {hasAny ? fmt(totAct) : "—"}
                            </p>
                          </div>
                          <div className="border-l border-slate-200 pl-5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                              Achievement
                            </p>
                            <p
                              className={`text-[15px] font-black tabular-nums ${tok.text}`}
                            >
                              {rate != null ? `${rate}%` : "—"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                </div>

                {monthly_actuals.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">
                    No monthly data for {selectedYear}.
                  </p>
                ) : (
                  <MonthlyBarChart data={monthly_actuals} height={210} />
                )}

                {data.year_split && data.year_split.length > 1 && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5 select-none">
                      <ChevronDown
                        size={13}
                        className="group-open:rotate-180 transition-transform"
                      />{" "}
                      Year-by-Year Attribution
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {data.year_split.map((y) => (
                        <div
                          key={y.year}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 min-w-[160px]"
                        >
                          <p className="text-xs font-bold text-slate-700 mb-2">
                            {y.year}
                          </p>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Expected</span>
                              <span className="font-semibold tabular-nums">
                                {fmt(y.expected)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Actual</span>
                              <span
                                className={`${pctToken(y.ytd_rate_pct).text} tabular-nums`}
                              >
                                {y.actual > 0 ? fmt(y.actual) : "—"}
                              </span>
                            </div>
                            {y.ytd_rate_pct != null && (
                              <div className="pt-0.5">
                                <div className="h-1.5 w-full rounded-full bg-slate-200">
                                  <div
                                    className={`h-1.5 rounded-full ${pctToken(y.ytd_rate_pct).bg}`}
                                    style={{
                                      width:
                                        Math.min(y.ytd_rate_pct, 100) + "%",
                                    }}
                                  />
                                </div>
                                <p
                                  className={`text-[10px] font-bold mt-0.5 tabular-nums ${pctToken(y.ytd_rate_pct).text}`}
                                >
                                  {y.ytd_rate_pct}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5 select-none">
                    <ChevronDown
                      size={13}
                      className="group-open:rotate-180 transition-transform"
                    />{" "}
                    Monthly detail table
                  </summary>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
                          <th className="px-4 py-2.5 font-semibold">Month</th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            Expected
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            Actual
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            Delta
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            Rate
                          </th>
                          <th className="px-4 py-2.5 text-right font-semibold">
                            EOY Fcst
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthly_actuals.map((d) => {
                          const delta =
                            d.actual > 0 ? d.actual - d.expected : null;
                          const rate =
                            d.actual > 0 && d.expected > 0
                              ? Math.round((d.actual / d.expected) * 100)
                              : null;
                          const tok = pctToken(rate);
                          return (
                            <tr
                              key={d.period}
                              className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                            >
                              <td className="px-4 py-2 font-semibold text-slate-700">
                                {new Date(d.period + "-01").toLocaleDateString(
                                  "en-GB",
                                  { month: "short", year: "numeric" },
                                )}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-500 tabular-nums">
                                {fmt(d.expected)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-800 tabular-nums">
                                {d.actual > 0 ? (
                                  fmt(d.actual)
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-semibold tabular-nums ${delta == null ? "text-slate-300" : delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}
                              >
                                {delta == null
                                  ? "—"
                                  : (delta > 0 ? "+" : "") + fmt(delta)}
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-bold tabular-nums ${rate == null ? "text-slate-300" : tok.text}`}
                              >
                                {rate != null ? `${rate}%` : "—"}
                              </td>
                              <td className="px-4 py-2 text-right text-indigo-500 font-semibold tabular-nums">
                                {d.eoy_forecast > 0 ? (
                                  fmt(d.eoy_forecast)
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {monthly_actuals.length > 0 &&
                        (() => {
                          const totExp = monthly_actuals.reduce(
                            (s, d) => s + d.expected,
                            0,
                          );
                          const totAct = monthly_actuals.reduce(
                            (s, d) => s + d.actual,
                            0,
                          );
                          const hasAnyActual = monthly_actuals.some(
                            (d) => d.actual > 0,
                          );
                          const totDelta = hasAnyActual
                            ? totAct - totExp
                            : null;
                          const totRate =
                            hasAnyActual && totExp > 0
                              ? Math.round((totAct / totExp) * 100)
                              : null;
                          const tok = pctToken(totRate);
                          return (
                            <tfoot>
                              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                                <td className="px-4 py-2.5 text-slate-700">
                                  Total {selectedYear}
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">
                                  {fmt(totExp)}
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-800 tabular-nums">
                                  {hasAnyActual ? (
                                    fmt(totAct)
                                  ) : (
                                    <span className="font-normal text-slate-300">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right tabular-nums ${totDelta == null ? "text-slate-300 font-normal" : totDelta >= 0 ? "text-emerald-600" : "text-rose-500"}`}
                                >
                                  {totDelta == null
                                    ? "—"
                                    : (totDelta > 0 ? "+" : "") + fmt(totDelta)}
                                </td>
                                <td
                                  className={`px-4 py-2.5 text-right tabular-nums ${tok.text}`}
                                >
                                  {totRate != null ? `${totRate}%` : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right text-indigo-500 tabular-nums">
                                  {fmt(
                                    monthly_actuals.reduce(
                                      (s, d) => s + d.eoy_forecast,
                                      0,
                                    ),
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          );
                        })()}
                    </table>
                  </div>
                </details>
              </div>
            )}

            {/* ── BY PLANT ── */}
            {tab === "plant" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      KPIs by Plant
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      All active financial lines · FY {data.year} · Click to
                      expand
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10.5px] font-bold text-indigo-600">
                    {by_plant.length} plant{by_plant.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {by_plant.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">
                    No plant data yet.
                  </p>
                ) : (
                  <>
                    {/* Chart 2 — EOY by plant by type */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                      <p className="text-xs font-bold text-slate-700 mb-0.5">
                        EOY Forecast by Plant — By Opportunity Type
                      </p>
                      <p className="text-[10.5px] text-slate-400 mb-4">
                        Each bar shows projected EOY savings, segmented by
                        saving type.
                      </p>
                      <EoyByPlantByTypeChart plants={by_plant} />
                    </div>

                    {/* Chart 4 — Delta EOY vs Budget by plant, segmented by type */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                      <p className="text-xs font-bold text-slate-700 mb-0.5">
                        Delta EOY vs Budget by Plant — By Type
                      </p>
                      <p className="text-[10.5px] text-slate-400 mb-4">
                        Gap between projected EOY savings and annual baseline
                        for committed opportunities. Positive = outperforming ·
                        Negative = below plan · Segments = saving type.
                      </p>
                      <DeltaEoyByPlantChart plants={by_plant} />
                    </div>

                    {/* Chart 5 — Delta EOY vs Budget by plant, stacked by main reason — DISABLED */}
                    {/* <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                      <p className="text-xs font-bold text-slate-700 mb-0.5">Delta EOY vs Budget by Plant — By Main Reason</p>
                      <p className="text-[10.5px] text-slate-400 mb-4">
                        Same delta, explained by root cause. Set the <strong>delta reason</strong> on each budget assignment to populate.
                        Each colour segment corresponds to a Monday.com reason category.
                      </p>
                      <DeltaEoyByReasonChart plants={by_plant} />
                    </div> */}

                    {/* Chart — EOY by plant by budget status (existing) */}
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5 select-none">
                        <ChevronDown
                          size={13}
                          className="group-open:rotate-180 transition-transform"
                        />{" "}
                        EOY by Budget Status (commitment view)
                      </summary>
                      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                        <EoyByPlantChart plants={by_plant} />
                      </div>
                    </details>

                    <div className="space-y-2">
                      {by_plant.map((plant, idx) => {
                        const tok = pctToken(plant.ytd_rate_pct);
                        return (
                          <CollapsibleCard
                            key={plant.plant_id}
                            defaultOpen={idx === 0}
                            colorBar={tok.bg}
                            header={
                              <div>
                                <p className="text-sm font-bold text-slate-800">
                                  {plant.plant_name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {plant.opp_count} opp
                                  {plant.opp_count !== 1 ? "s" : ""} · EOY{" "}
                                  {fmt(plant.eoy_forecast)}
                                </p>
                              </div>
                            }
                            badge={
                              <span
                                className={`text-sm font-black ${tok.text}`}
                              >
                                {pctFmt(plant.ytd_rate_pct)}
                              </span>
                            }
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-100 border-b border-slate-100">
                              <Metric
                                label="YTD On-Track"
                                value={pctFmt(plant.ytd_rate_pct)}
                                sub="actual / expected"
                                token={tok}
                                bar={plant.ytd_rate_pct}
                              />
                              <Metric
                                label="Delta YTD"
                                value={
                                  (plant.delta_ytd > 0 ? "+" : "") +
                                  fmt(plant.delta_ytd)
                                }
                                sub="actual − expected"
                                token={
                                  plant.delta_ytd >= 0 ? C.emerald : C.rose
                                }
                              />
                              <Metric
                                label="Actual YTD"
                                value={fmt(plant.actual_ytd)}
                                sub={`exp. ${fmt(plant.expected_ytd)}`}
                                token={C.sky}
                              />
                              <Metric
                                label="EOY Forecast"
                                value={fmt(plant.eoy_forecast)}
                                sub="projected full-year"
                                token={C.indigo}
                              />
                              <Metric
                                label="EOY vs Budget"
                                value={pctFmt(plant.eoy_vs_budget_pct)}
                                sub={`budget: ${fmt(plant.budget_value)}`}
                                token={pctToken(plant.eoy_vs_budget_pct)}
                                bar={plant.eoy_vs_budget_pct}
                              />
                              <Metric
                                label="Expected Annual"
                                value={fmt(plant.expected_annual)}
                                sub="full-year baseline"
                                token={C.violet}
                              />
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5 select-none">
                        <ChevronDown
                          size={13}
                          className="group-open:rotate-180 transition-transform"
                        />{" "}
                        Comparison table
                      </summary>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
                              <th className="px-4 py-2.5 font-semibold">
                                Plant
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Exp. Annual
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Exp. YTD
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Actual YTD
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Delta
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Rate
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                EOY Fcst
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                EOY vs Budget
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {by_plant.map((p) => {
                              const tok = pctToken(p.ytd_rate_pct);
                              return (
                                <tr
                                  key={p.plant_id}
                                  className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                                >
                                  <td className="px-4 py-2 font-bold text-slate-800">
                                    {p.plant_name}
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-500 tabular-nums">
                                    {fmt(p.expected_annual)}
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-500 tabular-nums">
                                    {fmt(p.expected_ytd)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                                    {fmt(p.actual_ytd)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right font-bold tabular-nums ${p.delta_ytd >= 0 ? "text-emerald-600" : "text-rose-500"}`}
                                  >
                                    {(p.delta_ytd > 0 ? "+" : "") +
                                      fmt(p.delta_ytd)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right font-bold tabular-nums ${tok.text}`}
                                  >
                                    {pctFmt(p.ytd_rate_pct)}
                                  </td>
                                  <td className="px-4 py-2 text-right text-indigo-600 font-semibold tabular-nums">
                                    {fmt(p.eoy_forecast)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right font-bold tabular-nums ${pctToken(p.eoy_vs_budget_pct).text}`}
                                  >
                                    {pctFmt(p.eoy_vs_budget_pct)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </div>
            )}

            {/* ── TOP 10 SUPPLIERS ── */}
            {tab === "supplier" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Top 10 Suppliers — Projected EOY Savings
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Ranked by EOY forecast · Segments by opportunity type ·
                      Source: <em>proposed_supplier_name</em>
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10.5px] font-bold text-indigo-600">
                    {by_supplier?.length ?? 0} supplier
                    {(by_supplier?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                  <TopSuppliersChart suppliers={by_supplier ?? []} />
                </div>

                {(by_supplier?.length ?? 0) > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5 select-none">
                      <ChevronDown
                        size={13}
                        className="group-open:rotate-180 transition-transform"
                      />{" "}
                      Detail table
                    </summary>
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
                            <th className="px-4 py-2.5 font-semibold">#</th>
                            <th className="px-4 py-2.5 font-semibold">
                              Supplier
                            </th>
                            <th className="px-4 py-2.5 text-right font-semibold">
                              Opps
                            </th>
                            <th className="px-4 py-2.5 text-right font-semibold">
                              Exp. Annual
                            </th>
                            <th className="px-4 py-2.5 text-right font-semibold">
                              Actual YTD
                            </th>
                            <th className="px-4 py-2.5 text-right font-semibold">
                              EOY Forecast
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(by_supplier ?? []).map((s, i) => (
                            <tr
                              key={s.supplier_name}
                              className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                            >
                              <td className="px-4 py-2 text-slate-400 font-bold">
                                {i + 1}
                              </td>
                              <td
                                className="px-4 py-2 font-bold text-slate-800 max-w-[200px] truncate"
                                title={s.supplier_name}
                              >
                                {s.supplier_name}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-500">
                                {s.opp_count}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-500 tabular-nums">
                                {fmt(s.expected_annual)}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-700 tabular-nums">
                                {s.actual_ytd > 0 ? fmt(s.actual_ytd) : "—"}
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-indigo-600 tabular-nums">
                                {fmt(s.eoy_forecast)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* ── BY TYPE ── */}
            {tab === "type" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      KPIs by Opportunity Type
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      All types · FY {data.year} · Click to expand
                    </p>
                  </div>
                </div>

                {by_type.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">
                    No data yet.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {by_type.map((t, idx) => {
                        const pal = TYPE_PALETTE[t.type] ?? C.indigo;
                        const tok = pctToken(t.ytd_rate_pct);
                        return (
                          <CollapsibleCard
                            key={t.type}
                            defaultOpen={idx === 0}
                            colorBar={pal.bg}
                            header={
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${pal.bg} shrink-0`}
                                />
                                <div>
                                  <p className="text-sm font-bold text-slate-800">
                                    {t.type}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {t.opp_count} opps · {t.validated_count}{" "}
                                    validated · EOY {fmt(t.eoy_forecast)}
                                  </p>
                                </div>
                              </div>
                            }
                            badge={
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-[10.5px] text-slate-400">
                                  Validation:{" "}
                                  <strong
                                    className={
                                      pctToken(
                                        _pct(t.validated_count, t.opp_count),
                                      ).text
                                    }
                                  >
                                    {pctFmt(
                                      _pct(t.validated_count, t.opp_count),
                                    )}
                                  </strong>
                                </span>
                                <span
                                  className={`text-sm font-black ${tok.text}`}
                                >
                                  {pctFmt(t.ytd_rate_pct)}
                                </span>
                              </div>
                            }
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-slate-100 border-b border-slate-100">
                              <Metric
                                label="YTD On-Track"
                                value={pctFmt(t.ytd_rate_pct)}
                                sub="actual / expected"
                                token={tok}
                                bar={t.ytd_rate_pct}
                              />
                              <Metric
                                label="Delta YTD"
                                value={
                                  (t.delta_ytd > 0 ? "+" : "") +
                                  fmt(t.delta_ytd)
                                }
                                sub="actual − expected"
                                token={t.delta_ytd >= 0 ? C.emerald : C.rose}
                              />
                              <Metric
                                label="Actual YTD"
                                value={
                                  t.actual_ytd > 0 ? fmt(t.actual_ytd) : "—"
                                }
                                sub={`exp. ${fmt(t.expected_ytd)}`}
                                token={C.sky}
                              />
                              <Metric
                                label="EOY Forecast"
                                value={
                                  t.eoy_forecast > 0 ? fmt(t.eoy_forecast) : "—"
                                }
                                sub={`vs annual ${fmt(t.expected_annual)}`}
                                token={C.indigo}
                                bar={t.eoy_vs_expected_pct}
                              />
                              <Metric
                                label="Annual Pipeline"
                                value={fmt(t.expected_annual)}
                                sub={`${t.opp_count} opp${t.opp_count !== 1 ? "s" : ""} total`}
                                token={pal}
                              />
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5 select-none">
                        <ChevronDown
                          size={13}
                          className="group-open:rotate-180 transition-transform"
                        />{" "}
                        Comparison table
                      </summary>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
                              <th className="px-4 py-2.5 font-semibold">
                                Type
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Opps
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Validated
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Exp. Annual
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Actual YTD
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Rate
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                EOY Fcst
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {by_type.map((t) => {
                              const pal = TYPE_PALETTE[t.type] ?? C.indigo;
                              const tok = pctToken(t.ytd_rate_pct);
                              return (
                                <tr
                                  key={t.type}
                                  className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                                >
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`h-2 w-2 rounded-full ${pal.bg} shrink-0`}
                                      />
                                      <span className="font-bold text-slate-800">
                                        {t.type}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-500 tabular-nums">
                                    {t.opp_count}
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-500 tabular-nums">
                                    {t.validated_count}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums">
                                    {fmt(t.expected_annual)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                                    {t.actual_ytd > 0 ? fmt(t.actual_ytd) : "—"}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right font-bold tabular-nums ${tok.text}`}
                                  >
                                    {pctFmt(t.ytd_rate_pct)}
                                  </td>
                                  <td className="px-4 py-2 text-right text-indigo-600 font-semibold tabular-nums">
                                    {t.eoy_forecast > 0
                                      ? fmt(t.eoy_forecast)
                                      : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </div>
            )}

            {/* ── BY SAVING NATURE (Hard / Soft) ── */}
            {tab === "nature" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Savings by Nature
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Hard = real cost reduction · Soft = cost avoidance · FY{" "}
                      {data.year}
                    </p>
                  </div>
                </div>

                {by_saving_nature.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">
                    No data yet.
                  </p>
                ) : (
                  <>
                    {/* Headline split: Hard (P&L impact) vs Soft (cost avoidance) */}
                    {(() => {
                      const hard = by_saving_nature.find(
                        (n) => n.saving_nature === "Hard",
                      );
                      const soft = by_saving_nature.find(
                        (n) => n.saving_nature === "Soft",
                      );
                      const uncl = by_saving_nature.find(
                        (n) => n.saving_nature === "Unclassified",
                      );
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <p className="text-[10.5px] font-bold uppercase tracking-wide text-emerald-700">
                              Hard · P&amp;L impact
                            </p>
                            <p className="text-2xl font-black text-emerald-700 tabular-nums mt-1">
                              {fmt(hard?.expected_annual ?? 0)}
                            </p>
                            <p className="text-[10.5px] text-emerald-600/80 mt-0.5">
                              {hard?.opp_count ?? 0} opps · EOY{" "}
                              {fmt(hard?.eoy_forecast ?? 0)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                            <p className="text-[10.5px] font-bold uppercase tracking-wide text-sky-700">
                              Soft · cost avoidance
                            </p>
                            <p className="text-2xl font-black text-sky-700 tabular-nums mt-1">
                              {fmt(soft?.expected_annual ?? 0)}
                            </p>
                            <p className="text-[10.5px] text-sky-600/80 mt-0.5">
                              {soft?.opp_count ?? 0} opps · EOY{" "}
                              {fmt(soft?.eoy_forecast ?? 0)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
                              Unclassified
                            </p>
                            <p className="text-2xl font-black text-amber-700 tabular-nums mt-1">
                              {fmt(uncl?.expected_annual ?? 0)}
                            </p>
                            <p className="text-[10.5px] text-amber-600/80 mt-0.5">
                              {uncl?.opp_count ?? 0} opps · needs classification
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-2">
                      {by_saving_nature.map((n, idx) => {
                        const pal = NATURE_PALETTE[n.saving_nature] ?? C.indigo;
                        const tok = pctToken(n.ytd_rate_pct);
                        return (
                          <CollapsibleCard
                            key={n.saving_nature}
                            defaultOpen={idx === 0}
                            colorBar={pal.bg}
                            header={
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${pal.bg} shrink-0`}
                                />
                                <div>
                                  <p className="text-sm font-bold text-slate-800">
                                    {n.saving_nature}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {n.opp_count} opps · {n.validated_count}{" "}
                                    validated · EOY {fmt(n.eoy_forecast)}
                                  </p>
                                </div>
                              </div>
                            }
                            badge={
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-[10.5px] text-slate-400">
                                  Validation:{" "}
                                  <strong
                                    className={
                                      pctToken(
                                        _pct(n.validated_count, n.opp_count),
                                      ).text
                                    }
                                  >
                                    {pctFmt(
                                      _pct(n.validated_count, n.opp_count),
                                    )}
                                  </strong>
                                </span>
                                <span
                                  className={`text-sm font-black ${tok.text}`}
                                >
                                  {pctFmt(n.ytd_rate_pct)}
                                </span>
                              </div>
                            }
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-slate-100 border-b border-slate-100">
                              <Metric
                                label="YTD On-Track"
                                value={pctFmt(n.ytd_rate_pct)}
                                sub="actual / expected"
                                token={tok}
                                bar={n.ytd_rate_pct}
                              />
                              <Metric
                                label="Delta YTD"
                                value={
                                  (n.delta_ytd > 0 ? "+" : "") +
                                  fmt(n.delta_ytd)
                                }
                                sub="actual − expected"
                                token={n.delta_ytd >= 0 ? C.emerald : C.rose}
                              />
                              <Metric
                                label="Actual YTD"
                                value={
                                  n.actual_ytd > 0 ? fmt(n.actual_ytd) : "—"
                                }
                                sub={`exp. ${fmt(n.expected_ytd)}`}
                                token={C.sky}
                              />
                              <Metric
                                label="EOY Forecast"
                                value={
                                  n.eoy_forecast > 0 ? fmt(n.eoy_forecast) : "—"
                                }
                                sub={`vs annual ${fmt(n.expected_annual)}`}
                                token={C.indigo}
                                bar={n.eoy_vs_expected_pct}
                              />
                              <Metric
                                label="Annual Pipeline"
                                value={fmt(n.expected_annual)}
                                sub={`${n.opp_count} opp${n.opp_count !== 1 ? "s" : ""} total`}
                                token={pal}
                              />
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── BY BUYER ── */}
            {tab === "buyer" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Performance by Buyer
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Expected Savings · YTD Realization · EOY Forecast · FY{" "}
                      {selectedYear}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10.5px] font-bold text-emerald-700">
                    {by_buyer?.length ?? 0} active buyer
                    {(by_buyer?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                </div>

                {!by_buyer || by_buyer.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">
                    No buyer with active lines this fiscal year.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)] border-l-4 border-l-slate-300">
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">
                          Active Buyers
                        </p>
                        <p className="text-2xl font-black text-slate-800">
                          {by_buyer.length}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)] border-l-4 border-l-indigo-300">
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">
                          Expected Annual total
                        </p>
                        <p className="text-2xl font-black text-indigo-600 tabular-nums">
                          {fmt(
                            by_buyer.reduce((s, b) => s + b.expected_annual, 0),
                          )}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)] border-l-4 border-l-emerald-300">
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">
                          EOY Forecast total
                        </p>
                        <p className="text-2xl font-black text-emerald-600 tabular-nums">
                          {fmt(
                            by_buyer.reduce((s, b) => s + b.eoy_forecast, 0),
                          )}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)] border-l-4 border-l-rose-300">
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">
                          Total Escalations
                        </p>
                        <p
                          className={`text-2xl font-black tabular-nums ${by_buyer.reduce((s, b) => s + b.escalated_count, 0) > 0 ? "text-rose-500" : "text-emerald-600"}`}
                        >
                          {by_buyer.reduce((s, b) => s + b.escalated_count, 0)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {by_buyer.map((buyer, idx) => {
                        const initials = buyer.buyer_name
                          .split(" ")
                          .map((w: string) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();
                        const tok = pctToken(buyer.ytd_rate_pct);
                        return (
                          <CollapsibleCard
                            key={buyer.buyer_email}
                            defaultOpen={idx === 0}
                            colorBar={tok.bg}
                            header={
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-8 w-8 items-center justify-center rounded-full ${C.emerald.light} ${C.emerald.text} text-[10px] font-black shrink-0`}
                                >
                                  {initials}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">
                                    {buyer.buyer_name}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {buyer.buyer_email} · {buyer.opp_count} opp
                                    · {buyer.plant_count} site
                                    {buyer.plant_count !== 1 ? "s" : ""}
                                  </p>
                                </div>
                              </div>
                            }
                            badge={
                              <div className="flex items-center gap-2 flex-wrap">
                                {buyer.categories.map((c: string) => (
                                  <span
                                    key={c}
                                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold text-white ${TYPE_PALETTE[c]?.bg ?? "bg-slate-400"}`}
                                  >
                                    {c.split(" ")[0]}
                                  </span>
                                ))}
                                {buyer.escalated_count > 0 && (
                                  <span className="rounded-full bg-rose-100 text-rose-600 px-2 py-0.5 text-[9px] font-bold">
                                    {buyer.escalated_count} esc.
                                  </span>
                                )}
                                <span
                                  className={`text-sm font-black ${tok.text}`}
                                >
                                  {pctFmt(buyer.ytd_rate_pct)}
                                </span>
                              </div>
                            }
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-100 border-b border-slate-100">
                              <Metric
                                label="YTD On-Track"
                                value={pctFmt(buyer.ytd_rate_pct)}
                                sub="actual / expected"
                                token={tok}
                                bar={buyer.ytd_rate_pct}
                              />
                              <Metric
                                label="Delta YTD"
                                value={
                                  (buyer.delta_ytd > 0 ? "+" : "") +
                                  fmt(buyer.delta_ytd)
                                }
                                sub="actual − expected"
                                token={
                                  buyer.delta_ytd >= 0 ? C.emerald : C.rose
                                }
                              />
                              <Metric
                                label="Actual YTD"
                                value={fmt(buyer.actual_ytd)}
                                sub={`exp. ${fmt(buyer.expected_ytd)}`}
                                token={C.sky}
                              />
                              <Metric
                                label="EOY Forecast"
                                value={fmt(buyer.eoy_forecast)}
                                sub="projected full-year"
                                token={C.indigo}
                              />
                              <Metric
                                label="EOY vs Budget"
                                value={pctFmt(buyer.eoy_vs_budget_pct)}
                                sub={`budget: ${fmt(buyer.budget_value)}`}
                                token={pctToken(buyer.eoy_vs_budget_pct)}
                                bar={buyer.eoy_vs_budget_pct}
                              />
                              <Metric
                                label="Expected Annual"
                                value={fmt(buyer.expected_annual)}
                                sub="full-year baseline"
                                token={C.violet}
                              />
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5 select-none">
                        <ChevronDown
                          size={13}
                          className="group-open:rotate-180 transition-transform"
                        />{" "}
                        Comparison table
                      </summary>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
                              <th className="px-4 py-2.5 font-semibold">
                                Buyer
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Opps
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Expected Annual
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Actual YTD
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                Rate
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                EOY Fcst
                              </th>
                              <th className="px-4 py-2.5 text-right font-semibold">
                                EOY vs Budget
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {by_buyer.map((b) => {
                              const tok = pctToken(b.ytd_rate_pct);
                              return (
                                <tr
                                  key={b.buyer_email}
                                  className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors"
                                >
                                  <td className="px-4 py-2 font-semibold text-slate-700">
                                    {b.buyer_name}
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-500 tabular-nums">
                                    {b.opp_count}
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-600 tabular-nums">
                                    {fmt(b.expected_annual)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                                    {fmt(b.actual_ytd)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right font-bold tabular-nums ${tok.text}`}
                                  >
                                    {pctFmt(b.ytd_rate_pct)}
                                  </td>
                                  <td className="px-4 py-2 text-right text-indigo-600 font-semibold tabular-nums">
                                    {fmt(b.eoy_forecast)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right font-bold tabular-nums ${pctToken(b.eoy_vs_budget_pct).text}`}
                                  >
                                    {pctFmt(b.eoy_vs_budget_pct)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </div>
            )}

            {/* ── ALERTS ── */}
            {tab === "alerts" && (
              <div className="space-y-6">
                {totalAlerts === 0 ? (
                  <div className="py-16 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                      <CheckCircle2 size={28} className="text-emerald-500" />
                    </div>
                    <p className="text-sm font-bold text-emerald-700">
                      No active alerts
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Pipeline is healthy — all lines up to date
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    {kpis.escalated_count > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-[11px] font-bold text-rose-700">
                        <AlertTriangle size={11} /> {kpis.escalated_count}{" "}
                        Escalated
                      </span>
                    )}
                    {kpis.late_projects_count > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-[11px] font-bold text-orange-700">
                        <Clock size={11} /> {kpis.late_projects_count} Late
                        projects
                      </span>
                    )}
                    {kpis.missing_update_lines > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold text-amber-700">
                        <XCircle size={11} /> {kpis.missing_update_lines}{" "}
                        Missing updates
                      </span>
                    )}
                  </div>
                )}

                {escalated.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <AlertTriangle size={13} className="text-rose-500" />
                      <span className="text-[11px] font-bold text-slate-700">
                        Escalated Lines
                      </span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        {escalated.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {escalated.map((e) => (
                        <div
                          key={e.financial_line_id}
                          className="rounded-xl border border-rose-100 bg-white border-l-4 border-l-rose-500 overflow-hidden"
                        >
                          <div className="px-4 py-3.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-slate-800 truncate">
                                  {e.opportunity_name}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {e.line_name}
                                  {e.escalated_by && (
                                    <>
                                      {" "}
                                      · by{" "}
                                      <span className="font-semibold text-slate-600">
                                        {e.escalated_by}
                                      </span>
                                    </>
                                  )}
                                  {e.escalated_at && (
                                    <>
                                      {" "}
                                      ·{" "}
                                      {new Date(
                                        e.escalated_at,
                                      ).toLocaleDateString("en-GB")}
                                    </>
                                  )}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p
                                  className={`text-[12px] font-bold tabular-nums ${e.delta_ytd < 0 ? "text-rose-600" : "text-emerald-600"}`}
                                >
                                  {e.delta_ytd >= 0 ? "+" : ""}
                                  {fmt(e.delta_ytd)}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  delta YTD
                                </p>
                              </div>
                            </div>
                            {e.escalation_reason && (
                              <p className="mt-2.5 text-[11px] text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
                                {e.escalation_reason}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {late_projects.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-orange-600">
                        <Clock size={12} /> Late Projects
                      </span>
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                        {late_projects.length}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-orange-100 bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-orange-50 text-left text-orange-700 border-b border-orange-100">
                            <th className="px-4 py-2.5 font-semibold">
                              Project
                            </th>
                            <th className="px-4 py-2.5 font-semibold">
                              Project Manager
                            </th>
                            <th className="px-4 py-2.5 font-semibold">Phase</th>
                            <th className="px-4 py-2.5 font-semibold">
                              Planned End
                            </th>
                            <th className="px-4 py-2.5 font-semibold">
                              Overdue by
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {late_projects.map((p) => {
                            const overdueDays = p.planned_end_date
                              ? Math.floor(
                                  (Date.now() -
                                    new Date(p.planned_end_date).getTime()) /
                                    86400000,
                                )
                              : null;
                            return (
                              <tr
                                key={p.project_id}
                                className="border-t border-orange-50 hover:bg-orange-50/40 transition-colors"
                              >
                                <td className="px-4 py-2.5 font-semibold text-slate-800">
                                  {p.project_name}
                                </td>
                                <td className="px-4 py-2.5 text-slate-500">
                                  {p.project_owner || "—"}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[9.5px] font-bold text-orange-700">
                                    {p.phase_status}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-500">
                                  {p.planned_end_date
                                    ? new Date(
                                        p.planned_end_date,
                                      ).toLocaleDateString("en-GB")
                                    : "—"}
                                </td>
                                <td className="px-4 py-2.5">
                                  {overdueDays != null && overdueDays > 0 ? (
                                    <span className="font-bold text-rose-600">
                                      {overdueDays}d
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {missing_updates.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <XCircle size={13} className="text-amber-500" />
                      <span className="text-[11px] font-bold text-slate-700">
                        Missing Monthly Updates
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {kpis.missing_update_lines}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {missing_updates.map((m) => (
                        <div
                          key={m.financial_line_id}
                          className="rounded-xl border border-amber-100 bg-white border-l-4 border-l-amber-400"
                        >
                          <div className="px-4 py-3 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-slate-800 truncate">
                                {m.opportunity_name}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {m.line_name}
                                {m.follower && (
                                  <>
                                    {" "}
                                    ·{" "}
                                    <span className="font-semibold text-slate-600">
                                      {m.follower}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[12px] font-bold text-amber-600 tabular-nums">
                                {m.missing_count} month
                                {m.missing_count !== 1 ? "s" : ""}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {m.missing_months.slice(0, 3).join(", ")}
                                {m.missing_months.length > 3
                                  ? ` +${m.missing_months.length - 3}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-300 pb-2">
          All amounts consolidated in {data.reporting_currency ?? "EUR"} · Group
          reporting currency
        </p>
      </div>
    </div>
  );
}
