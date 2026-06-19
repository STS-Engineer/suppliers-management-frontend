import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, BarChart2, BadgeCheck, Banknote, CheckCircle2,
  Clock, FolderOpen, RefreshCw, Target, TrendingDown, TrendingUp,
  Users, XCircle, Zap,
} from "lucide-react";
import supplierAPI from "../services/supplierOnboardingAPI";

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
  project_on_time_rate_pct: number | null;
  monthly_update_pct: number | null;
  avg_priority_score: number | null;
  active_lines_count: number;
  escalated_count: number;
  late_projects_count: number;
  missing_update_lines: number;
  open_pipeline_count: number;
  non_eur_missing_rate: number;
}
interface MonthlyPoint { period: string; expected: number; actual: number; budget: number; eoy_forecast: number; }
interface PlantRow {
  plant_id: number; plant_name: string;
  expected_annual: number; budget_value: number;
  actual_ytd: number; expected_ytd: number; delta_ytd: number;
  eoy_forecast: number; opp_count: number;
  ytd_rate_pct: number | null;        // actual YTD / expected YTD — correct on-track %
  eoy_vs_budget_pct: number | null;
  eoy_vs_expected_pct: number | null;
  type_breakdown: Record<string, number>;
}
interface TypeRow {
  type: string; opp_count: number; validated_count: number;
  expected_annual: number; actual_ytd: number; expected_ytd: number;
  delta_ytd: number; eoy_forecast: number;
  ytd_rate_pct: number | null;
  eoy_vs_expected_pct: number | null;
}
interface YearSplit { year: number; expected: number; actual: number; ytd_rate_pct: number | null; }
interface MissingUpdate { financial_line_id: number; line_name: string; opportunity_name: string; follower: string; missing_months: string[]; missing_count: number; }
interface EscalatedLine { financial_line_id: number; line_name: string; opportunity_name: string; escalation_reason: string; escalated_at: string; escalated_by: string; delta_ytd: number; }
interface LateProject { project_id: number; project_name: string; project_owner: string; phase_status: string; planned_end_date: string | null; }

interface KpiData {
  year: number;
  computed_at: string;
  reporting_currency?: string;
  kpis: Kpis;
  monthly_actuals: MonthlyPoint[];
  by_plant: PlantRow[];
  by_type: TypeRow[];
  year_split: YearSplit[];
  late_projects: LateProject[];
  missing_updates: MissingUpdate[];
  escalated: EscalatedLine[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const pctFmt = (n?: number | null) => n == null ? "—" : `${n}%`;

const _pct = (num: number, denom: number): number | null =>
  denom === 0 ? null : Math.round((num / denom) * 100 * 10) / 10;

const pctColor = (val: number | null, target = 100) => {
  if (val == null) return "text-slate-400";
  if (val >= target) return "text-emerald-600";
  if (val >= target * 0.85) return "text-amber-600";
  return "text-red-500";
};

const pctBg = (val: number | null, target = 100) => {
  if (val == null) return "bg-slate-200";
  if (val >= target) return "bg-emerald-500";
  if (val >= target * 0.85) return "bg-amber-400";
  return "bg-red-500";
};

const TYPE_COLORS: Record<string, string> = {
  Negotiation: "bg-violet-500",
  Sourcing: "bg-sky-500",
  "Technical Productivity": "bg-emerald-500",
  Cash: "bg-amber-500",
};

// ---------------------------------------------------------------------------
// Mini bar chart (CSS-based, no library)
// ---------------------------------------------------------------------------
function MonthlyBarChart({ data, height = 120 }: { data: MonthlyPoint[]; height?: number }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.expected, d.actual || 0))) || 1;
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 min-w-0" style={{ height }}>
        {data.map(d => {
          const expH = Math.round((d.expected / maxVal) * (height - 20));
          const actH = d.actual > 0 ? Math.round((d.actual / maxVal) * (height - 20)) : 0;
          const label = d.period.slice(0, 7);
          const monthLabel = new Date(d.period + "-01").toLocaleDateString("en-GB", { month: "short" });
          return (
            <div key={d.period} className="group relative flex flex-col items-center gap-0.5 flex-1 min-w-[28px]">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="rounded-lg bg-slate-800 text-white text-[10px] px-2 py-1.5 whitespace-nowrap shadow-lg">
                  <p className="font-bold">{label}</p>
                  <p>Expected: {fmt(d.expected)}</p>
                  <p>Actual: {d.actual > 0 ? fmt(d.actual) : "—"}</p>
                  {d.eoy_forecast > 0 && <p>EOY Fcst: {fmt(d.eoy_forecast)}</p>}
                </div>
                <div className="border-4 border-transparent border-t-slate-800 -mt-px" />
              </div>
              {/* Bars */}
              <div className="relative flex items-end gap-0.5 w-full">
                <div className="flex-1 rounded-t bg-blue-200" style={{ height: expH }} title={`Expected: ${fmt(d.expected)}`} />
                <div
                  className={`flex-1 rounded-t transition-all ${actH > 0 ? (d.actual >= d.expected ? "bg-emerald-500" : "bg-amber-400") : "bg-slate-100"}`}
                  style={{ height: Math.max(actH, 2) }}
                  title={`Actual: ${fmt(d.actual)}`}
                />
              </div>
              <span className="text-[8px] text-slate-400 font-semibold">{monthLabel}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-blue-200 inline-block" />Expected</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-500 inline-block" />Actual (on track)</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-400 inline-block" />Actual (behind)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Score Card
// ---------------------------------------------------------------------------
function ScoreCard({
  icon, label, value, sub, pct, target = 100, trend, dim,
}: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; pct?: number | null; target?: number;
  trend?: "up" | "down" | null; dim?: string;
}) {
  const color = pct != null ? pctColor(pct, target) : "text-slate-800";
  const bgBar = pct != null ? pctBg(pct, target) : "bg-slate-300";
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-[10px] font-black uppercase tracking-widest">{label}</span></div>
        {dim && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-400">{dim}</span>}
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      {pct != null && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">Progress vs target ({target}%)</span>
            <span className={`font-bold ${color}`}>{pctFmt(pct)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100">
            <div className={`h-1.5 rounded-full transition-all ${bgBar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      )}
      {trend && (
        <div className={`flex items-center gap-1 text-[10.5px] font-semibold ${trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
          {trend === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {trend === "up" ? "On track" : "Needs attention"}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut-style progress ring
// ---------------------------------------------------------------------------
function Ring({ pct, size = 56, color = "#10b981" }: { pct: number; size?: number; color?: string }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min((pct / 100) * circ, circ);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------
export default function PurchasingKpiPage() {
  const today = new Date();
  const activeBudgetYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(activeBudgetYear);
  const [plantFilter, setPlantFilter] = useState("All");
  const [tab, setTab] = useState<"monthly" | "plant" | "type" | "alerts">("monthly");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await supplierAPI.getPurchasingKpis(selectedYear);
      setData(res.data as KpiData);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }, [selectedYear]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <RefreshCw size={24} className="animate-spin text-blue-500" />
    </div>
  );
  if (error) return <div className="px-8 py-10 text-red-600">{error}</div>;
  if (!data) return null;

  const { kpis, monthly_actuals, by_plant, by_type, late_projects, missing_updates, escalated } = data;

  // Filter monthly by plant if needed (future enhancement - currently all plants)
  const monthlyFiltered = monthly_actuals;
  const totalAlerts = kpis.escalated_count + kpis.late_projects_count + kpis.missing_update_lines;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f0f7ff_0,#f8fafc_50%,#f0f4f8_100%)]">

      {/* Header */}
      <div className="border-b border-slate-200/70 bg-white/80 px-8 py-5 backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9.5px] font-black uppercase tracking-[0.4em] text-slate-400">Purchasing · KPIs</p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900">Value Management Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">Monthly analysis · Per plant · Per type · Forecast vs Budget</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400">
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
            <button onClick={load} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <RefreshCw size={12} />Refresh
            </button>
          </div>
        </div>
        {data.computed_at && (
          <p className="mt-1 text-[10px] text-slate-400">Computed: {new Date(data.computed_at).toLocaleString("en-GB")}</p>
        )}
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* All figures are consolidated in EUR (group reporting currency). */}
        <div className="flex items-center justify-between text-[10.5px] text-slate-400">
          <span>All amounts in {data.reporting_currency ?? "EUR"} (group reporting currency)</span>
        </div>
        {kpis.non_eur_missing_rate > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong>{kpis.non_eur_missing_rate}</strong> non-EUR financial line{kpis.non_eur_missing_rate !== 1 ? "s" : ""} {kpis.non_eur_missing_rate !== 1 ? "have" : "has"} no FX rate and {kpis.non_eur_missing_rate !== 1 ? "are" : "is"} counted at 1:1 — consolidated totals may be understated until an exchange rate is set on those opportunities.
            </span>
          </div>
        )}

        {/* ── SCORE CARDS ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
          <ScoreCard icon={<Banknote size={14} />} label="EOY Forecast" dim="Forecast"
            value={fmt(kpis.eoy_forecast_total)}
            sub={`${kpis.active_lines_count} active lines`} />
          <ScoreCard icon={<Target size={14} />} label="EOY vs Budget" dim="Forecast"
            value={pctFmt(kpis.eoy_vs_budget_pct)}
            pct={kpis.eoy_vs_budget_pct}
            sub={`Committed budget ${selectedYear}: ${fmt(kpis.total_budget)}`} />
          <ScoreCard icon={<TrendingUp size={14} />} label="Est. Annual Saving — Budgeted" dim="Pipeline"
            value={fmt(kpis.budgeted_expected_annual)}
            sub={`Committed budget ${selectedYear}: ${fmt(kpis.total_budget)}`} />
          <ScoreCard icon={<Banknote size={14} />} label="Program Value — Lifetime" dim="Pipeline"
            value={fmt(kpis.program_value_lifetime)}
            sub="Cumulative multi-year saving (open pipeline)" />
          <ScoreCard icon={<TrendingUp size={14} />} label="Over-Delivery vs Budget" dim="Pipeline"
            value={kpis.over_budget_count > 0 ? `${kpis.over_budget_count} opp${kpis.over_budget_count !== 1 ? "s" : ""}` : "None"}
            sub={kpis.over_budget_count > 0 ? `+${fmt(kpis.over_budget_amount)} above committed budget (favorable)` : "None forecast above budget"} />
          <ScoreCard icon={<BadgeCheck size={14} />} label="Conversion Rate" dim="Effectiveness"
            value={pctFmt(kpis.conversion_rate_pct)}
            pct={kpis.conversion_rate_pct}
            sub={`${kpis.converted_opp_count} / ${kpis.validated_opp_count} validated`} />
          <ScoreCard icon={<Zap size={14} />} label="Phase 0 Go Rate" dim="Efficiency"
            value={pctFmt(kpis.phase0_go_rate_pct)}
            pct={kpis.phase0_go_rate_pct} />
        </div>

        {/* Secondary KPIs row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Monthly Update Coverage</p>
            <div className="flex items-center gap-3">
              <Ring pct={kpis.monthly_update_pct ?? 0} color={kpis.monthly_update_pct === 100 ? "#10b981" : kpis.monthly_update_pct && kpis.monthly_update_pct >= 80 ? "#f59e0b" : "#ef4444"} />
              <div>
                <p className={`text-xl font-black ${pctColor(kpis.monthly_update_pct)}`}>{pctFmt(kpis.monthly_update_pct)}</p>
                <p className="text-[10px] text-slate-400">Target: 100%</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Avg. Priority Score</p>
            <div className="flex items-center gap-3">
              <Ring pct={kpis.avg_priority_score ? (kpis.avg_priority_score / 125) * 100 : 0} color="#6366f1" />
              <div>
                <p className="text-xl font-black text-indigo-600">{kpis.avg_priority_score ?? "—"}</p>
                <p className="text-[10px] text-slate-400">/ 125 max · {kpis.open_pipeline_count} open</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Actual vs Budget YTD</p>
            <div className="flex items-center gap-3">
              <Ring pct={kpis.actual_vs_budget_ytd_pct ?? 0} color={kpis.actual_vs_budget_ytd_pct && kpis.actual_vs_budget_ytd_pct >= 100 ? "#10b981" : "#f59e0b"} />
              <div>
                <p className={`text-xl font-black ${pctColor(kpis.actual_vs_budget_ytd_pct)}`}>{pctFmt(kpis.actual_vs_budget_ytd_pct)}</p>
                <p className="text-[10px] text-slate-400">Committed (budgeted) opps only</p>
              </div>
            </div>
          </div>
          <div className={`rounded-2xl border p-4 ${totalAlerts > 0 ? "border-red-200 bg-red-50/40" : "border-slate-100 bg-white"}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Active Alerts</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-red-600"><AlertTriangle size={11} />Escalated</span>
                <span className="font-bold text-red-600">{kpis.escalated_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-orange-600"><Clock size={11} />Late projects</span>
                <span className="font-bold text-orange-600">{kpis.late_projects_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-amber-600"><XCircle size={11} />Missing updates</span>
                <span className="font-bold text-amber-600">{kpis.missing_update_lines}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex border-b border-slate-100 px-4 pt-3">
            {([
              ["monthly", "Monthly Savings", <BarChart2 size={12} />],
              ["plant", "By Plant", <FolderOpen size={12} />],
              ["type", "By Type", <Zap size={12} />],
              ["alerts", `Alerts${totalAlerts > 0 ? ` (${totalAlerts})` : ""}`, <AlertTriangle size={12} />],
            ] as [typeof tab, string, React.ReactNode][]).map(([id, label, icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors ${tab === id ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {icon}{label}
              </button>
            ))}
          </div>

          <div className="p-5">

            {/* MONTHLY SAVINGS TAB */}
            {tab === "monthly" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Monthly Savings — Expected vs Actual ({selectedYear})</p>
                    <p className="text-xs text-slate-400 mt-0.5">All active financial lines · Phase 2+ (in production)</p>
                  </div>
                </div>
                {monthlyFiltered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No monthly data for {selectedYear}.</p>
                ) : (
                  <MonthlyBarChart data={monthlyFiltered} height={160} />
                )}
                {/* Year-split summary — equal monthly distribution (annual ÷ duration) */}
                {data.year_split && data.year_split.length > 1 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                    <p className="text-xs font-bold text-slate-700 mb-1">Year-by-Year Attribution (annual ÷ duration, per active month)</p>
                    <p className="text-[10.5px] text-slate-400 mb-3">Expected saving is spread evenly across the active months and split across the calendar years they fall in.</p>
                    <div className="flex flex-wrap gap-3">
                      {data.year_split.map(y => (
                        <div key={y.year} className="rounded-xl border border-slate-200 bg-white px-4 py-3 min-w-[160px]">
                          <p className="text-xs font-bold text-slate-700 mb-2">{y.year}</p>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between"><span className="text-slate-400">Expected</span><span className="font-semibold">{fmt(y.expected)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Actual</span>
                              <span className={pctColor(y.ytd_rate_pct)}>{y.actual > 0 ? fmt(y.actual) : "—"}</span></div>
                            {y.ytd_rate_pct != null && (
                              <div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 mt-1">
                                  <div className={pctBg(y.ytd_rate_pct) + " h-1.5 rounded-full"} style={{ width: Math.min(y.ytd_rate_pct, 100) + "%" }} />
                                </div>
                                <p className={"text-[10px] font-bold mt-0.5 " + pctColor(y.ytd_rate_pct)}>{y.ytd_rate_pct}%</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly summary table */}
                <div className="overflow-x-auto rounded-xl border border-slate-100 mt-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left text-slate-500">
                        <th className="px-4 py-2.5 font-semibold">Month</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Expected</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Actual</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Delta</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                        <th className="px-4 py-2.5 text-right font-semibold">EOY Forecast</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyFiltered.map(d => {
                        const delta = d.actual > 0 ? d.actual - d.expected : null;
                        const rate = d.actual > 0 && d.expected > 0 ? Math.round((d.actual / d.expected) * 100) : null;
                        return (
                          <tr key={d.period} className="border-t border-slate-50 hover:bg-slate-50/60">
                            <td className="px-4 py-2 font-semibold text-slate-700">
                              {new Date(d.period + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-500">{fmt(d.expected)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-slate-800">
                              {d.actual > 0 ? fmt(d.actual) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className={`px-4 py-2 text-right font-semibold ${delta == null ? "text-slate-300" : delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {delta == null ? "—" : fmt(delta)}
                            </td>
                            <td className={`px-4 py-2 text-right font-bold ${rate == null ? "text-slate-300" : rate >= 100 ? "text-emerald-600" : rate >= 80 ? "text-amber-600" : "text-red-500"}`}>
                              {rate != null ? `${rate}%` : "—"}
                            </td>
                            <td className="px-4 py-2 text-right text-blue-600 font-semibold">
                              {d.eoy_forecast > 0 ? fmt(d.eoy_forecast) : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {monthlyFiltered.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                          <td className="px-4 py-2 text-slate-600">Total {selectedYear}</td>
                          <td className="px-4 py-2 text-right">{fmt(monthlyFiltered.reduce((s, d) => s + d.expected, 0))}</td>
                          <td className="px-4 py-2 text-right">{fmt(monthlyFiltered.reduce((s, d) => s + d.actual, 0))}</td>
                          <td className={`px-4 py-2 text-right ${monthlyFiltered.reduce((s, d) => s + d.actual, 0) >= monthlyFiltered.reduce((s, d) => s + d.expected, 0) ? "text-emerald-600" : "text-red-500"}`}>
                            {fmt(monthlyFiltered.reduce((s, d) => s + d.actual, 0) - monthlyFiltered.reduce((s, d) => s + d.expected, 0))}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {(() => {
                              const totExp = monthlyFiltered.reduce((s, d) => s + d.expected, 0);
                              const totAct = monthlyFiltered.reduce((s, d) => s + d.actual, 0);
                              return totExp > 0 ? `${Math.round((totAct / totExp) * 100)}%` : "—";
                            })()}
                          </td>
                          <td className="px-4 py-2 text-right text-blue-600">{fmt(monthlyFiltered.reduce((s, d) => s + d.eoy_forecast, 0))}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* BY PLANT TAB */}
            {tab === "plant" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">KPIs by Plant</p>
                  <p className="text-[11px] text-slate-400">All active financial lines · {data.year}</p>
                </div>
                {by_plant.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No plant data yet — opportunities need a Go decision first.</p>
                ) : (
                  <>
                    {/* One KPI block per plant */}
                    {by_plant.map(plant => (
                      <div key={plant.plant_id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {/* Plant header */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-3 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                            <p className="text-sm font-bold text-slate-800">{plant.plant_name}</p>
                            <span className="text-[10px] text-slate-400">{plant.opp_count} opportunit{plant.opp_count !== 1 ? "ies" : "y"}</span>
                          </div>
                          {/* Type breakdown pills */}
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(plant.type_breakdown).map(([t, v]) => (
                              <span key={t} className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold text-white ${TYPE_COLORS[t] ?? "bg-slate-400"}`}>
                                {t.split(" ")[0]}: {fmt(v as number)}
                              </span>
                            ))}
                          </div>
                        </div>
                        {/* KPI cards grid */}
                        <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-100">
                          {/* 1 — YTD On-Track Rate */}
                          <div className="p-4">
                            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">YTD On-Track</p>
                            <p className={`text-2xl font-black ${pctColor(plant.ytd_rate_pct)}`}>{pctFmt(plant.ytd_rate_pct)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">actual / expected YTD</p>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                              <div className={`h-1.5 rounded-full ${pctBg(plant.ytd_rate_pct)}`}
                                style={{ width: `${Math.min(plant.ytd_rate_pct ?? 0, 100)}%` }} />
                            </div>
                          </div>
                          {/* 2 — Delta YTD */}
                          <div className="p-4">
                            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">Delta YTD</p>
                            <p className={`text-2xl font-black ${plant.delta_ytd >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {plant.delta_ytd > 0 ? "+" : ""}{fmt(plant.delta_ytd)}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">actual − expected YTD</p>
                          </div>
                          {/* 3 — Actual YTD */}
                          <div className="p-4">
                            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">Actual YTD</p>
                            <p className="text-2xl font-black text-slate-800">{fmt(plant.actual_ytd)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">vs exp. {fmt(plant.expected_ytd)}</p>
                          </div>
                          {/* 4 — EOY Forecast */}
                          <div className="p-4">
                            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">EOY Forecast</p>
                            <p className="text-2xl font-black text-blue-600">{fmt(plant.eoy_forecast)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">projected full-year</p>
                          </div>
                          {/* 5 — EOY vs Budget */}
                          <div className="p-4">
                            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">EOY vs Budget</p>
                            <p className={`text-2xl font-black ${pctColor(plant.eoy_vs_budget_pct)}`}>{pctFmt(plant.eoy_vs_budget_pct)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">budget: {fmt(plant.budget_value)}</p>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                              <div className={`h-1.5 rounded-full ${pctBg(plant.eoy_vs_budget_pct)}`}
                                style={{ width: `${Math.min(plant.eoy_vs_budget_pct ?? 0, 100)}%` }} />
                            </div>
                          </div>
                          {/* 6 — Expected Annual */}
                          <div className="p-4">
                            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">Expected Annual</p>
                            <p className="text-2xl font-black text-slate-700">{fmt(plant.expected_annual)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">full-year baseline</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Compact comparison table */}
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5">
                        <span className="group-open:rotate-90 transition-transform inline-block">▶</span> Show comparison table
                      </summary>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left text-slate-500">
                              <th className="px-4 py-2.5 font-semibold">Plant</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Exp. Annual</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Exp. YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Actual YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Delta YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">YTD Rate</th>
                              <th className="px-4 py-2.5 text-right font-semibold">EOY Forecast</th>
                              <th className="px-4 py-2.5 text-right font-semibold">EOY vs Budget</th>
                            </tr>
                          </thead>
                          <tbody>
                            {by_plant.map(p => (
                              <tr key={p.plant_id} className="border-t border-slate-50 hover:bg-slate-50/60">
                                <td className="px-4 py-2 font-bold text-slate-800">{p.plant_name}</td>
                                <td className="px-4 py-2 text-right text-slate-500">{fmt(p.expected_annual)}</td>
                                <td className="px-4 py-2 text-right text-slate-500">{fmt(p.expected_ytd)}</td>
                                <td className="px-4 py-2 text-right font-semibold">{fmt(p.actual_ytd)}</td>
                                <td className={`px-4 py-2 text-right font-bold ${p.delta_ytd >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(p.delta_ytd)}</td>
                                <td className={`px-4 py-2 text-right font-bold ${pctColor(p.ytd_rate_pct)}`}>{pctFmt(p.ytd_rate_pct)}</td>
                                <td className="px-4 py-2 text-right text-blue-600 font-semibold">{fmt(p.eoy_forecast)}</td>
                                <td className={`px-4 py-2 text-right font-bold ${pctColor(p.eoy_vs_budget_pct)}`}>{pctFmt(p.eoy_vs_budget_pct)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </div>
            )}

            {/* BY TYPE TAB */}
            {tab === "type" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">KPIs by Opportunity Type</p>
                  <p className="text-[11px] text-slate-400">All types · {data.year}</p>
                </div>
                {by_type.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>
                ) : (
                  <>
                    {/* KPI block per type */}
                    {by_type.map(t => {
                      const typeColor = TYPE_COLORS[t.type] ?? "bg-slate-400";
                      const typeBorder: Record<string, string> = {
                        Negotiation: "border-violet-200",
                        Sourcing: "border-sky-200",
                        "Technical Productivity": "border-emerald-200",
                        Cash: "border-amber-200",
                      };
                      const typeHeaderBg: Record<string, string> = {
                        Negotiation: "from-violet-50",
                        Sourcing: "from-sky-50",
                        "Technical Productivity": "from-emerald-50",
                        Cash: "from-amber-50",
                      };
                      return (
                        <div key={t.type} className={`rounded-2xl border ${typeBorder[t.type] ?? "border-slate-200"} bg-white shadow-sm overflow-hidden`}>
                          {/* Type header */}
                          <div className={`flex items-center justify-between bg-gradient-to-r ${typeHeaderBg[t.type] ?? "from-slate-50"} to-white px-5 py-3 border-b border-slate-100`}>
                            <div className="flex items-center gap-2">
                              <span className={`h-3 w-3 rounded-full ${typeColor}`} />
                              <p className="text-sm font-bold text-slate-800">{t.type}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span><strong className="text-slate-700">{t.opp_count}</strong> opportunities</span>
                              <span><strong className="text-slate-700">{t.validated_count}</strong> validated</span>
                              <span className="text-slate-300">|</span>
                              <span className="text-[10.5px]">Validation rate: <strong className={pctColor(_pct(t.validated_count, t.opp_count))}>{pctFmt(_pct(t.validated_count, t.opp_count))}</strong></span>
                            </div>
                          </div>
                          {/* KPI cards grid */}
                          <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-slate-100">
                            {/* 1 — YTD On-Track Rate */}
                            <div className="p-4">
                              <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">YTD On-Track</p>
                              <p className={`text-2xl font-black ${pctColor(t.ytd_rate_pct)}`}>{pctFmt(t.ytd_rate_pct)}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">actual / expected YTD</p>
                              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                                <div className={`h-1.5 rounded-full ${pctBg(t.ytd_rate_pct)}`}
                                  style={{ width: `${Math.min(t.ytd_rate_pct ?? 0, 100)}%` }} />
                              </div>
                            </div>
                            {/* 2 — Delta YTD */}
                            <div className="p-4">
                              <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">Delta YTD</p>
                              <p className={`text-2xl font-black ${t.delta_ytd >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                {t.delta_ytd > 0 ? "+" : ""}{fmt(t.delta_ytd)}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">actual − expected YTD</p>
                            </div>
                            {/* 3 — Actual YTD */}
                            <div className="p-4">
                              <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">Actual YTD</p>
                              <p className="text-2xl font-black text-slate-800">{t.actual_ytd > 0 ? fmt(t.actual_ytd) : "—"}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">vs exp. {fmt(t.expected_ytd)}</p>
                            </div>
                            {/* 4 — EOY Forecast */}
                            <div className="p-4">
                              <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">EOY Forecast</p>
                              <p className="text-2xl font-black text-blue-600">{t.eoy_forecast > 0 ? fmt(t.eoy_forecast) : "—"}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">vs exp. annual {fmt(t.expected_annual)}</p>
                              {t.eoy_vs_expected_pct != null && (
                                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                                  <div className={`h-1.5 rounded-full ${pctBg(t.eoy_vs_expected_pct)}`}
                                    style={{ width: `${Math.min(t.eoy_vs_expected_pct, 100)}%` }} />
                                </div>
                              )}
                            </div>
                            {/* 5 — Pipeline size */}
                            <div className="p-4">
                              <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">Annual Pipeline</p>
                              <p className="text-2xl font-black text-slate-700">{fmt(t.expected_annual)}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{t.opp_count} opp{t.opp_count !== 1 ? "s" : ""} total</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Comparison table — collapsible */}
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5">
                        <span className="group-open:rotate-90 transition-transform inline-block">▶</span> Show comparison table
                      </summary>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left text-slate-500">
                              <th className="px-4 py-2.5 font-semibold">Type</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Opps</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Validated</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Exp. Annual</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Exp. YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Actual YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Delta YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">YTD Rate</th>
                              <th className="px-4 py-2.5 text-right font-semibold">EOY Forecast</th>
                            </tr>
                          </thead>
                          <tbody>
                            {by_type.map(t => (
                              <tr key={t.type} className="border-t border-slate-50 hover:bg-slate-50/60">
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full ${TYPE_COLORS[t.type] ?? "bg-slate-400"}`} />
                                    <span className="font-bold text-slate-800">{t.type}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-right text-slate-500">{t.opp_count}</td>
                                <td className="px-4 py-2 text-right text-slate-500">{t.validated_count}</td>
                                <td className="px-4 py-2 text-right">{fmt(t.expected_annual)}</td>
                                <td className="px-4 py-2 text-right text-slate-500">{fmt(t.expected_ytd)}</td>
                                <td className="px-4 py-2 text-right font-semibold">{t.actual_ytd > 0 ? fmt(t.actual_ytd) : "—"}</td>
                                <td className={`px-4 py-2 text-right font-bold ${t.delta_ytd >= 0 ? "text-emerald-600" : "text-red-500"}`}>{t.delta_ytd !== 0 ? fmt(t.delta_ytd) : "—"}</td>
                                <td className={`px-4 py-2 text-right font-bold ${pctColor(t.ytd_rate_pct)}`}>{pctFmt(t.ytd_rate_pct)}</td>
                                <td className="px-4 py-2 text-right text-blue-600 font-semibold">{t.eoy_forecast > 0 ? fmt(t.eoy_forecast) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </div>
            )}

            {/* ALERTS TAB */}
            {tab === "alerts" && (
              <div className="space-y-5">
                {totalAlerts === 0 && (
                  <div className="py-10 text-center">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-600">No active alerts — pipeline is healthy!</p>
                  </div>
                )}

                {/* Escalated */}
                {escalated.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-600">
                      <AlertTriangle size={12} /> Escalated ({escalated.length})
                    </p>
                    <div className="space-y-2">
                      {escalated.map(e => (
                        <div key={e.financial_line_id} className="rounded-xl border border-red-200 bg-red-50/50 p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{e.opportunity_name}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{e.line_name} · Escalated by {e.escalated_by || "—"}</p>
                            </div>
                            <span className={`text-xs font-bold ${e.delta_ytd < 0 ? "text-red-600" : "text-emerald-600"}`}>
                              Delta YTD: {fmt(e.delta_ytd)}
                            </span>
                          </div>
                          {e.escalation_reason && <p className="mt-1.5 text-[11px] text-red-700 bg-red-100 rounded px-2 py-1">{e.escalation_reason}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Late projects */}
                {late_projects.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-orange-600">
                      <Clock size={12} /> Late Projects ({late_projects.length})
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-orange-100">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-orange-50 text-left text-orange-600">
                          <th className="px-4 py-2 font-semibold">Project</th>
                          <th className="px-4 py-2 font-semibold">PM</th>
                          <th className="px-4 py-2 font-semibold">Phase</th>
                          <th className="px-4 py-2 font-semibold">Planned End</th>
                        </tr></thead>
                        <tbody>
                          {late_projects.map(p => (
                            <tr key={p.project_id} className="border-t border-orange-50">
                              <td className="px-4 py-2 font-semibold text-slate-800">{p.project_name}</td>
                              <td className="px-4 py-2 text-slate-500">{p.project_owner || "—"}</td>
                              <td className="px-4 py-2"><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">{p.phase_status}</span></td>
                              <td className="px-4 py-2 text-slate-500">{p.planned_end_date ? new Date(p.planned_end_date).toLocaleDateString("en-GB") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Missing updates */}
                {missing_updates.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-600">
                      <Users size={12} /> Missing Monthly Updates ({kpis.missing_update_lines} lines)
                    </p>
                    <div className="space-y-2">
                      {missing_updates.map(m => (
                        <div key={m.financial_line_id} className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-[12px] font-bold text-slate-800">{m.opportunity_name}</p>
                            <p className="text-[10.5px] text-slate-400">{m.line_name} · Owner: {m.follower || "—"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-amber-700">{m.missing_count} month{m.missing_count !== 1 ? "s" : ""} missing</p>
                            <p className="text-[10px] text-amber-500">{m.missing_months.slice(0, 3).join(", ")}{m.missing_months.length > 3 ? "…" : ""}</p>
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
      </div>
    </div>
  );
}
