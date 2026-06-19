import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, BarChart2, BadgeCheck, Banknote, CheckCircle2,
  ChevronDown, Clock, FolderOpen, RefreshCw, SlidersHorizontal,
  Target, TrendingUp, Users, XCircle, Zap,
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
  ytd_rate_pct: number | null;
  eoy_vs_budget_pct: number | null;
  eoy_vs_expected_pct: number | null;
  type_breakdown: Record<string, number>;
  eoy_by_status: { Budgeted: number; Opportunity: number; Empty: number };
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
interface BuyerRow {
  buyer_email: string; buyer_name: string;
  opp_count: number; plant_count: number; categories: string[];
  expected_annual: number; actual_ytd: number; expected_ytd: number;
  delta_ytd: number; eoy_forecast: number; budget_value: number;
  ytd_rate_pct: number | null; eoy_vs_budget_pct: number | null;
  escalated_count: number;
}
interface AvailableFilters {
  plants: { id: number; name: string }[];
  categories: string[];
  buyers: string[];
}
interface KpiFilters { plantIds: number[]; categories: string[]; buyers: string[]; }
interface KpiData {
  year: number; computed_at: string; reporting_currency?: string;
  available_filters?: AvailableFilters;
  kpis: Kpis; monthly_actuals: MonthlyPoint[];
  by_plant: PlantRow[]; by_type: TypeRow[]; by_buyer: BuyerRow[];
  year_split: YearSplit[]; late_projects: LateProject[];
  missing_updates: MissingUpdate[]; escalated: EscalatedLine[];
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  indigo: { bg: "bg-indigo-600", text: "text-indigo-600", light: "bg-indigo-50", border: "border-indigo-200", hex: "#4F46E5" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-50", border: "border-emerald-200", hex: "#10B981" },
  amber: { bg: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50", border: "border-amber-200", hex: "#F59E0B" },
  rose: { bg: "bg-rose-500", text: "text-rose-600", light: "bg-rose-50", border: "border-rose-200", hex: "#F43F5E" },
  violet: { bg: "bg-violet-500", text: "text-violet-600", light: "bg-violet-50", border: "border-violet-200", hex: "#8B5CF6" },
  sky: { bg: "bg-sky-500", text: "text-sky-600", light: "bg-sky-50", border: "border-sky-200", hex: "#0EA5E9" },
};

const TYPE_PALETTE: Record<string, typeof C.indigo> = {
  Negotiation: C.violet, Sourcing: C.sky,
  "Technical Productivity": C.emerald, Cash: C.amber,
};

const fmt = (n?: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pctFmt = (n?: number | null) => n == null ? "—" : `${n}%`;
const _pct = (num: number, denom: number): number | null =>
  denom === 0 ? null : Math.round((num / denom) * 100 * 10) / 10;

const pctToken = (val: number | null, target = 100) => {
  if (val == null) return C.indigo;
  if (val >= target) return C.emerald;
  if (val >= target * 0.85) return C.amber;
  return C.rose;
};

// ---------------------------------------------------------------------------
// Mini Ring
// ---------------------------------------------------------------------------
function Ring({ pct, size = 60, token = C.emerald }: { pct: number; size?: number; token?: typeof C.emerald }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min((pct / 100) * circ, circ);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={token.hex} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Monthly bar chart — overlay style with grid lines
// ---------------------------------------------------------------------------
function MonthlyBarChart({ data, height = 180 }: { data: MonthlyPoint[]; height?: number }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.expected, d.actual || 0))) || 1;
  const gridPcts = [25, 50, 75, 100];
  const barH = height - 24; // 24px for month label

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* Horizontal grid lines */}
        {gridPcts.map(p => (
          <div key={p} className="absolute left-0 right-0 border-t border-dashed border-slate-200 pointer-events-none"
            style={{ bottom: 24 + (barH * p / 100) }}>
            <span className="absolute -top-3 right-0 text-[9px] text-slate-300 pr-1">
              {fmt((maxVal * p) / 100)}
            </span>
          </div>
        ))}
        {/* Bar columns */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-1" style={{ height }}>
          {data.map(d => {
            const expH = Math.round((d.expected / maxVal) * barH);
            const actH = d.actual > 0 ? Math.round((d.actual / maxVal) * barH) : 0;
            const isOnTrack = d.actual > 0 && d.actual >= d.expected;
            const monthLabel = new Date(d.period + "-01").toLocaleDateString("en-GB", { month: "short" });
            const label = d.period.slice(0, 7);
            return (
              <div key={d.period} className="group relative flex flex-col items-center flex-1 min-w-[24px]"
                style={{ height }}>
                {/* Hover tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                  <div className="rounded-xl bg-slate-900 text-white text-[10px] px-3 py-2 whitespace-nowrap shadow-xl space-y-0.5">
                    <p className="font-bold text-[11px] text-slate-200">{label}</p>
                    <p><span className="text-slate-400">Expected </span><span className="font-semibold">{fmt(d.expected)}</span></p>
                    <p><span className="text-slate-400">Actual   </span><span className={`font-semibold ${isOnTrack ? "text-emerald-400" : "text-amber-400"}`}>{d.actual > 0 ? fmt(d.actual) : "—"}</span></p>
                    {d.actual > 0 && d.expected > 0 && (
                      <p className="border-t border-slate-700 mt-1 pt-1">
                        <span className="text-slate-400">Rate </span>
                        <span className={`font-bold ${isOnTrack ? "text-emerald-400" : "text-amber-400"}`}>
                          {Math.round((d.actual / d.expected) * 100)}%
                        </span>
                      </p>
                    )}
                    {d.eoy_forecast > 0 && <p><span className="text-slate-400">EOY Fcst </span>{fmt(d.eoy_forecast)}</p>}
                  </div>
                  <div className="border-4 border-transparent border-t-slate-900 -mt-px" />
                </div>
                {/* Bars: expected as pale background, actual as overlay */}
                <div className="absolute bottom-6 w-full flex items-end gap-0.5 px-0.5">
                  {/* Expected bar (background reference) */}
                  <div className="flex-1 rounded-t-md bg-indigo-100 border-t border-indigo-200"
                    style={{ height: Math.max(expH, 2) }} />
                  {/* Actual bar */}
                  <div
                    className={`flex-1 rounded-t-md transition-all duration-500 ${
                      d.actual > 0
                        ? isOnTrack ? "bg-emerald-500" : "bg-amber-400"
                        : "bg-slate-100"
                    }`}
                    style={{ height: Math.max(actH, d.actual > 0 ? 3 : 2) }}
                  />
                </div>
                {/* Month label */}
                <span className="absolute bottom-0 text-[9px] text-slate-400 font-semibold">{monthLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Legend */}
      <div className="mt-3 flex items-center gap-6 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-3 w-4 rounded-sm bg-indigo-100 border border-indigo-200 inline-block shrink-0" />
          Expected
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-4 rounded-sm bg-emerald-500 inline-block shrink-0" />
          Actual (on track ≥ 100%)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-4 rounded-sm bg-amber-400 inline-block shrink-0" />
          Actual (behind &lt; 100%)
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Card — left colored border, icon bubble, progress bar
// ---------------------------------------------------------------------------
function ScoreCard({
  icon, label, value, sub, pct, target = 100, token = C.indigo, dim,
}: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; pct?: number | null; target?: number;
  token?: typeof C.indigo; dim?: string;
}) {
  const t = pct != null ? pctToken(pct, target) : token;
  return (
    <div className={`rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_8px_rgba(0,0,0,0.05)] border-l-4 ${t.border} overflow-hidden flex flex-col gap-0`}>
      <div className="p-4 flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className={`rounded-xl ${t.light} p-2 ${t.text}`}>{icon}</div>
          {dim && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{dim}</span>}
        </div>
        <div>
          <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
          <p className={`text-2xl font-black ${t.text}`}>{value}</p>
          {sub && <p className="text-[10.5px] text-slate-400 mt-0.5 leading-tight">{sub}</p>}
        </div>
        {pct != null && (
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-400">vs target ({target}%)</span>
              <span className={`font-bold ${t.text}`}>{pctFmt(pct)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div className={`h-1.5 rounded-full transition-all duration-700 ${t.bg}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric cell — used inside collapsible plant/buyer/type cards
// ---------------------------------------------------------------------------
function Metric({ label, value, sub, token, bar }: {
  label: string; value: string; sub?: string;
  token?: typeof C.indigo; bar?: number | null;
}) {
  const t = token ?? C.indigo;
  return (
    <div className="p-4 flex flex-col gap-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-xl font-black ${t.text}`}>{value}</p>
      {sub && <p className="text-[9.5px] text-slate-400 leading-tight">{sub}</p>}
      {bar != null && (
        <div className="mt-1 h-1 w-full rounded-full bg-slate-100">
          <div className={`h-1 rounded-full ${t.bg}`} style={{ width: `${Math.min(bar, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EOY stacked bar chart by budget status
// ---------------------------------------------------------------------------
const STATUS_COLORS = {
  Budgeted:    { hex: "#4F46E5", label: "Budgeted"    },
  Opportunity: { hex: "#F59E0B", label: "Opportunity" },
  Empty:       { hex: "#C7D2FE", label: "No budget"   },
} as const;
const STATUS_ORDER = ["Empty", "Opportunity", "Budgeted"] as const;
const STATUS_LEGEND = ["Budgeted", "Opportunity", "Empty"] as const;
const CHART_H = 160; const LABEL_H = 16; const NAME_H = 36;

function EoyByPlantChart({ plants }: { plants: PlantRow[] }) {
  const visible = plants.filter(p => p.eoy_forecast > 0);
  if (!visible.length) return <p className="py-8 text-center text-sm text-slate-400">No EOY data.</p>;
  const maxVal = Math.max(...visible.map(p => p.eoy_forecast), 1);
  const colH = CHART_H + LABEL_H + NAME_H;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500">
        {STATUS_LEGEND.map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm inline-block shrink-0" style={{ backgroundColor: STATUS_COLORS[s].hex }} />
            {STATUS_COLORS[s].label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-2 min-w-0" style={{ height: colH }}>
          {visible.map(plant => {
            const eoy = plant.eoy_by_status ?? { Budgeted: 0, Opportunity: 0, Empty: 0 };
            const total = plant.eoy_forecast;
            const totalH = Math.max(Math.round((total / maxVal) * CHART_H), 2);
            const segs = STATUS_ORDER.map(s => ({ s, val: eoy[s as keyof typeof eoy] ?? 0 })).filter(x => x.val > 0);
            let rem = totalH;
            const segHeights = segs.map((x, i) => {
              if (i === segs.length - 1) return { ...x, h: rem };
              const h = Math.round((x.val / total) * totalH);
              rem -= h;
              return { ...x, h };
            });
            return (
              <div key={plant.plant_id} className="group relative flex flex-col items-center flex-1 min-w-[44px]" style={{ height: colH }}>
                {/* Tooltip */}
                <div className="absolute hidden group-hover:flex flex-col items-center z-20 pointer-events-none"
                  style={{ bottom: NAME_H + totalH + LABEL_H + 8 }}>
                  <div className="rounded-xl bg-slate-900 text-white text-[10px] px-3 py-2 whitespace-nowrap shadow-xl space-y-0.5">
                    <p className="font-bold text-[11px] mb-1 text-slate-200">{plant.plant_name}</p>
                    {STATUS_LEGEND.map(s => {
                      const v = eoy[s as keyof typeof eoy] ?? 0;
                      return v > 0 ? (
                        <p key={s} style={{ color: STATUS_COLORS[s].hex }}>{STATUS_COLORS[s].label}: {fmt(v)}</p>
                      ) : null;
                    })}
                    <p className="border-t border-slate-700 mt-1 pt-1 font-semibold">Total: {fmt(total)}</p>
                  </div>
                  <div className="border-4 border-transparent border-t-slate-900" />
                </div>
                {/* Value label */}
                <div className="absolute w-full text-center text-[8.5px] font-bold text-slate-500 leading-none"
                  style={{ bottom: NAME_H + totalH + 2 }}>
                  {fmt(total)}
                </div>
                {/* Stacked bar */}
                <div className="absolute w-full overflow-hidden rounded-t-lg flex flex-col"
                  style={{ bottom: NAME_H, height: totalH }}>
                  {segHeights.map(({ s, h }) => (
                    <div key={s} style={{ height: h, backgroundColor: STATUS_COLORS[s].hex }} />
                  ))}
                </div>
                {/* Plant name */}
                <div className="absolute bottom-0 w-full text-center px-0.5" style={{ height: NAME_H }}>
                  <span className="text-[8.5px] text-slate-500 font-semibold leading-tight block truncate" title={plant.plant_name}>
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
// Collapsible entity card (plant / buyer / type)
// ---------------------------------------------------------------------------
function CollapsibleCard({
  colorBar, header, badge, children, defaultOpen = false,
}: {
  colorBar: string; header: React.ReactNode; badge?: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`h-4 w-1 rounded-full ${colorBar} shrink-0`} />
          <div className="text-left">{header}</div>
        </div>
        <div className="flex items-center gap-3">
          {badge}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
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
  const [filters, setFilters] = useState<KpiFilters>({ plantIds: [], categories: [], buyers: [] });
  const [tab, setTab] = useState<"monthly" | "plant" | "type" | "buyer" | "alerts">("monthly");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await supplierAPI.getPurchasingKpis(selectedYear, {
        plantIds: filters.plantIds, categories: filters.categories, buyers: filters.buyers,
      });
      setData(res.data as KpiData);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }, [selectedYear, filters]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw size={28} className="animate-spin text-indigo-500" />
        <p className="text-sm text-slate-400">Computing KPIs…</p>
      </div>
    </div>
  );
  if (error) return <div className="px-8 py-10 text-rose-600">{error}</div>;
  if (!data) return null;

  const { kpis, monthly_actuals, by_plant, by_type, by_buyer, late_projects, missing_updates, escalated } = data;
  const avail = data.available_filters;
  const hasFilters = filters.plantIds.length > 0 || filters.categories.length > 0 || filters.buyers.length > 0;
  const totalAlerts = kpis.escalated_count + kpis.late_projects_count + kpis.missing_update_lines;

  const togglePlant = (id: number) => setFilters(f => ({
    ...f, plantIds: f.plantIds.includes(id) ? f.plantIds.filter(x => x !== id) : [...f.plantIds, id],
  }));
  const toggleCategory = (c: string) => setFilters(f => ({
    ...f, categories: f.categories.includes(c) ? f.categories.filter(x => x !== c) : [...f.categories, c],
  }));
  const toggleBuyer = (b: string) => setFilters(f => ({
    ...f, buyers: f.buyers.includes(b) ? f.buyers.filter(x => x !== b) : [...f.buyers, b],
  }));

  const tabs = [
    { id: "monthly" as const, label: "Monthly Savings", icon: <BarChart2 size={13} /> },
    { id: "plant"   as const, label: "By Plant",        icon: <FolderOpen size={13} /> },
    { id: "type"    as const, label: "By Type",         icon: <Zap size={13} /> },
    { id: "buyer"   as const, label: `By Buyer${by_buyer?.length > 0 ? ` (${by_buyer.length})` : ""}`, icon: <Users size={13} /> },
    { id: "alerts"  as const, label: `Alerts${totalAlerts > 0 ? ` (${totalAlerts})` : ""}`, icon: <AlertTriangle size={13} /> },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6FB]">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200/70 px-8 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9.5px] font-black uppercase tracking-[0.45em] text-indigo-400">Purchasing · KPIs</p>
            <h1 className="mt-1 text-xl font-black text-slate-900">Value Management Dashboard</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Monthly analysis · Per plant · Per type · Forecast vs Budget
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>
        {data.computed_at && (
          <p className="mt-1.5 text-[10px] text-slate-400">
            Computed: {new Date(data.computed_at).toLocaleString("en-GB")}
            {hasFilters && <span className="ml-2 text-indigo-500 font-semibold">· Filtered view active</span>}
          </p>
        )}
      </div>

      {/* ── FILTER BAR ── */}
      {avail && (avail.plants.length > 0 || avail.categories.length > 0 || avail.buyers.length > 0) && (
        <div className="bg-white border-b border-slate-100 px-8 py-2.5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <SlidersHorizontal size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest">Filter</span>
          </div>

          {avail.plants.map(p => (
            <button key={p.id} onClick={() => togglePlant(p.id)}
              className={`rounded-full px-3 py-1 text-[10.5px] font-semibold border transition-all ${
                filters.plantIds.includes(p.id)
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
              }`}>
              {p.name}
            </button>
          ))}
          {avail.categories.map(c => (
            <button key={c} onClick={() => toggleCategory(c)}
              className={`rounded-full px-3 py-1 text-[10.5px] font-semibold border transition-all ${
                filters.categories.includes(c)
                  ? `${TYPE_PALETTE[c]?.bg ?? "bg-violet-600"} border-transparent text-white shadow-sm`
                  : "bg-white border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600"
              }`}>
              {c}
            </button>
          ))}
          {avail.buyers.map(b => {
            const name = b.includes("@") ? b.split("@")[0].split(".").map((s: string) => s[0].toUpperCase() + s.slice(1)).join(" ") : b;
            return (
              <button key={b} onClick={() => toggleBuyer(b)}
                className={`rounded-full px-3 py-1 text-[10.5px] font-semibold border transition-all ${
                  filters.buyers.includes(b)
                    ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
                }`}>
                {name}
              </button>
            );
          })}
          {hasFilters && (
            <button onClick={() => setFilters({ plantIds: [], categories: [], buyers: [] })}
              className="ml-auto flex items-center gap-1 text-[10.5px] font-semibold text-slate-400 hover:text-rose-500 transition-colors">
              <XCircle size={12} /> Reset
            </button>
          )}
        </div>
      )}

      <div className="px-8 py-6 space-y-5">

        {/* FX warning */}
        {kpis.non_eur_missing_rate > 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
            <span>
              <strong>{kpis.non_eur_missing_rate}</strong> non-EUR line{kpis.non_eur_missing_rate !== 1 ? "s" : ""} {kpis.non_eur_missing_rate !== 1 ? "have" : "has"} no FX rate and {kpis.non_eur_missing_rate !== 1 ? "are" : "is"} counted at 1:1 — consolidated totals may be understated.
            </span>
          </div>
        )}

        {/* ── P1 EXECUTION KPIs ── */}
        <div>
          <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-2.5">P1 · Execution</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ScoreCard icon={<Banknote size={15} />} label="EOY Forecast" token={C.indigo} dim="Forecast"
              value={fmt(kpis.eoy_forecast_total)}
              sub={`${kpis.active_lines_count} active financial lines`} />
            <ScoreCard icon={<Target size={15} />} label="EOY vs Budget"
              value={pctFmt(kpis.eoy_vs_budget_pct)} pct={kpis.eoy_vs_budget_pct}
              sub={`Committed budget ${selectedYear}: ${fmt(kpis.total_budget)}`} />
            <ScoreCard icon={<TrendingUp size={15} />} label="Actual YTD" token={C.sky} dim="YTD"
              value={fmt(kpis.actual_ytd_total)}
              sub={`vs expected ${fmt(kpis.expected_ytd_total)}`}
              pct={kpis.actual_vs_expected_ytd_pct} />
            <ScoreCard icon={<BadgeCheck size={15} />} label="Actual vs Budget YTD"
              value={pctFmt(kpis.actual_vs_budget_ytd_pct)} pct={kpis.actual_vs_budget_ytd_pct}
              sub="Committed (budgeted) opps only" />
          </div>
        </div>

        {/* ── P2 PIPELINE KPIs ── */}
        <div>
          <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-2.5">P2 · Pipeline</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ScoreCard icon={<TrendingUp size={15} />} label="Est. Annual — Budgeted" token={C.emerald} dim="Pipeline"
              value={fmt(kpis.budgeted_expected_annual)}
              sub={`Budget ${selectedYear}: ${fmt(kpis.total_budget)}`} />
            <ScoreCard icon={<Banknote size={15} />} label="Program Value — Lifetime" token={C.violet} dim="Pipeline"
              value={fmt(kpis.program_value_lifetime)}
              sub="Cumulative multi-year saving (open)" />
            <ScoreCard icon={<BadgeCheck size={15} />} label="Conversion Rate" token={C.sky} dim="Effectiveness"
              value={pctFmt(kpis.conversion_rate_pct)} pct={kpis.conversion_rate_pct}
              sub={`${kpis.converted_opp_count} / ${kpis.validated_opp_count} validated`} />
            <ScoreCard icon={<Zap size={15} />} label="Phase 0 Go Rate" token={C.amber} dim="Efficiency"
              value={pctFmt(kpis.phase0_go_rate_pct)} pct={kpis.phase0_go_rate_pct} />
          </div>
        </div>

        {/* ── SECONDARY KPI ROW ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Monthly update coverage */}
          <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.05)] p-4">
            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-3">Monthly Update Coverage</p>
            <div className="flex items-center gap-3">
              <Ring pct={kpis.monthly_update_pct ?? 0}
                token={kpis.monthly_update_pct === 100 ? C.emerald : kpis.monthly_update_pct && kpis.monthly_update_pct >= 80 ? C.amber : C.rose} />
              <div>
                <p className={`text-2xl font-black ${pctToken(kpis.monthly_update_pct).text}`}>{pctFmt(kpis.monthly_update_pct)}</p>
                <p className="text-[10px] text-slate-400">Target: 100%</p>
                {kpis.missing_update_lines > 0 && (
                  <p className="text-[10px] text-amber-600 font-semibold">{kpis.missing_update_lines} line{kpis.missing_update_lines !== 1 ? "s" : ""} missing</p>
                )}
              </div>
            </div>
          </div>
          {/* Priority score */}
          <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.05)] p-4">
            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-3">Avg. Priority Score</p>
            <div className="flex items-center gap-3">
              <Ring pct={kpis.avg_priority_score ? (kpis.avg_priority_score / 125) * 100 : 0} token={C.violet} />
              <div>
                <p className="text-2xl font-black text-violet-600">{kpis.avg_priority_score ?? "—"}</p>
                <p className="text-[10px] text-slate-400">/ 125 max</p>
                <p className="text-[10px] text-slate-400">{kpis.open_pipeline_count} open opps</p>
              </div>
            </div>
          </div>
          {/* Over-budget outperformance */}
          <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.05)] p-4">
            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-3">Forecast Outperformance</p>
            <p className={`text-2xl font-black ${kpis.over_budget_count > 0 ? "text-emerald-600" : "text-slate-400"}`}>
              {kpis.over_budget_count > 0 ? `${kpis.over_budget_count} opp${kpis.over_budget_count !== 1 ? "s" : ""}` : "None"}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
              {kpis.over_budget_count > 0 ? `+${fmt(kpis.over_budget_amount)} forecasting above commitment` : "All forecasts within commitment"}
            </p>
          </div>
          {/* Alerts */}
          <div className={`rounded-2xl border shadow-[0_1px_8px_rgba(0,0,0,0.05)] p-4 ${totalAlerts > 0 ? "border-rose-200 bg-rose-50/30" : "border-slate-200/60 bg-white"}`}>
            <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-3">Active Alerts</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-rose-600 font-medium"><AlertTriangle size={11} />Escalated</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${kpis.escalated_count > 0 ? "bg-rose-100 text-rose-700" : "text-slate-300"}`}>{kpis.escalated_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-orange-600 font-medium"><Clock size={11} />Late projects</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${kpis.late_projects_count > 0 ? "bg-orange-100 text-orange-700" : "text-slate-300"}`}>{kpis.late_projects_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-amber-600 font-medium"><XCircle size={11} />Missing updates</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${kpis.missing_update_lines > 0 ? "bg-amber-100 text-amber-700" : "text-slate-300"}`}>{kpis.missing_update_lines}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── TAB AREA ── */}
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.05)] overflow-hidden">
          {/* Pill tabs */}
          <div className="border-b border-slate-100 px-4 pt-3 pb-0">
            <div className="flex gap-0.5">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-[11.5px] font-bold rounded-t-xl border-b-2 -mb-px transition-all ${
                    tab === t.id
                      ? "border-indigo-500 text-indigo-600 bg-indigo-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
                  }`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">

            {/* ── MONTHLY SAVINGS ── */}
            {tab === "monthly" && (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-bold text-slate-800">Monthly Savings — Expected vs Actual ({selectedYear})</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">All active financial lines · Phase 2+ in production</p>
                </div>
                {monthly_actuals.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No monthly data for {selectedYear}.</p>
                ) : (
                  <MonthlyBarChart data={monthly_actuals} height={200} />
                )}

                {/* Year attribution */}
                {data.year_split && data.year_split.length > 1 && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5">
                      <ChevronDown size={13} className="group-open:rotate-180 transition-transform" /> Year-by-Year Attribution
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {data.year_split.map(y => (
                        <div key={y.year} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 min-w-[160px]">
                          <p className="text-xs font-bold text-slate-700 mb-2">{y.year}</p>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between"><span className="text-slate-400">Expected</span><span className="font-semibold">{fmt(y.expected)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400">Actual</span>
                              <span className={pctToken(y.ytd_rate_pct).text}>{y.actual > 0 ? fmt(y.actual) : "—"}</span></div>
                            {y.ytd_rate_pct != null && (
                              <div>
                                <div className="h-1.5 w-full rounded-full bg-slate-200 mt-1">
                                  <div className={`h-1.5 rounded-full ${pctToken(y.ytd_rate_pct).bg}`} style={{ width: Math.min(y.ytd_rate_pct, 100) + "%" }} />
                                </div>
                                <p className={`text-[10px] font-bold mt-0.5 ${pctToken(y.ytd_rate_pct).text}`}>{y.ytd_rate_pct}%</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Monthly table */}
                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5">
                    <ChevronDown size={13} className="group-open:rotate-180 transition-transform" /> Monthly detail table
                  </summary>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
                          <th className="px-4 py-2.5 font-semibold">Month</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Expected</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Actual</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Delta</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                          <th className="px-4 py-2.5 text-right font-semibold">EOY Fcst</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthly_actuals.map(d => {
                          const delta = d.actual > 0 ? d.actual - d.expected : null;
                          const rate = d.actual > 0 && d.expected > 0 ? Math.round((d.actual / d.expected) * 100) : null;
                          const tok = pctToken(rate);
                          return (
                            <tr key={d.period} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-2 font-semibold text-slate-700">
                                {new Date(d.period + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                              </td>
                              <td className="px-4 py-2 text-right text-slate-500">{fmt(d.expected)}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-800">
                                {d.actual > 0 ? fmt(d.actual) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className={`px-4 py-2 text-right font-semibold ${delta == null ? "text-slate-300" : delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                {delta == null ? "—" : (delta > 0 ? "+" : "") + fmt(delta)}
                              </td>
                              <td className={`px-4 py-2 text-right font-bold ${rate == null ? "text-slate-300" : tok.text}`}>
                                {rate != null ? `${rate}%` : "—"}
                              </td>
                              <td className="px-4 py-2 text-right text-indigo-500 font-semibold">
                                {d.eoy_forecast > 0 ? fmt(d.eoy_forecast) : <span className="text-slate-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {monthly_actuals.length > 0 && (() => {
                        const totExp = monthly_actuals.reduce((s, d) => s + d.expected, 0);
                        const totAct = monthly_actuals.reduce((s, d) => s + d.actual, 0);
                        const totDelta = totAct - totExp;
                        const totRate = totExp > 0 ? Math.round((totAct / totExp) * 100) : null;
                        const tok = pctToken(totRate);
                        return (
                          <tfoot>
                            <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                              <td className="px-4 py-2.5 text-slate-700">Total {selectedYear}</td>
                              <td className="px-4 py-2.5 text-right text-slate-600">{fmt(totExp)}</td>
                              <td className="px-4 py-2.5 text-right text-slate-800">{fmt(totAct)}</td>
                              <td className={`px-4 py-2.5 text-right ${totDelta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{(totDelta > 0 ? "+" : "") + fmt(totDelta)}</td>
                              <td className={`px-4 py-2.5 text-right ${tok.text}`}>{totRate != null ? `${totRate}%` : "—"}</td>
                              <td className="px-4 py-2.5 text-right text-indigo-500">{fmt(monthly_actuals.reduce((s, d) => s + d.eoy_forecast, 0))}</td>
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">KPIs by Plant</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">All active financial lines · FY {data.year} · Click a row to expand</p>
                  </div>
                  <p className="text-[11px] text-indigo-500 font-semibold">{by_plant.length} plant{by_plant.length !== 1 ? "s" : ""}</p>
                </div>
                {by_plant.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No plant data yet.</p>
                ) : (
                  <>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                      <p className="text-xs font-bold text-slate-700 mb-1">EOY Forecast by Plant — Budget Status</p>
                      <p className="text-[10.5px] text-slate-400 mb-4">Each bar = total EOY forecast, coloured by opportunity budget commitment.</p>
                      <EoyByPlantChart plants={by_plant} />
                    </div>

                    <div className="space-y-2">
                      {by_plant.map((plant, idx) => {
                        const tok = pctToken(plant.ytd_rate_pct);
                        return (
                          <CollapsibleCard key={plant.plant_id} defaultOpen={idx === 0}
                            colorBar={tok.bg}
                            header={
                              <div>
                                <p className="text-sm font-bold text-slate-800">{plant.plant_name}</p>
                                <p className="text-[10px] text-slate-400">{plant.opp_count} opp{plant.opp_count !== 1 ? "s" : ""} · EOY {fmt(plant.eoy_forecast)}</p>
                              </div>
                            }
                            badge={
                              <div className="flex items-center gap-2">
                                {Object.entries(plant.type_breakdown).map(([t, v]) => (
                                  <span key={t} className={`rounded-full px-2 py-0.5 text-[9px] font-bold text-white ${TYPE_PALETTE[t]?.bg ?? "bg-slate-400"}`}>
                                    {t.split(" ")[0]}: {fmt(v as number)}
                                  </span>
                                ))}
                                <span className={`text-base font-black ${tok.text}`}>{pctFmt(plant.ytd_rate_pct)}</span>
                              </div>
                            }
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-100 border-b border-slate-100">
                              <Metric label="YTD On-Track" value={pctFmt(plant.ytd_rate_pct)} sub="actual / expected" token={tok} bar={plant.ytd_rate_pct} />
                              <Metric label="Delta YTD" value={(plant.delta_ytd > 0 ? "+" : "") + fmt(plant.delta_ytd)} sub="actual − expected" token={plant.delta_ytd >= 0 ? C.emerald : C.rose} />
                              <Metric label="Actual YTD" value={fmt(plant.actual_ytd)} sub={`exp. ${fmt(plant.expected_ytd)}`} token={C.sky} />
                              <Metric label="EOY Forecast" value={fmt(plant.eoy_forecast)} sub="projected full-year" token={C.indigo} />
                              <Metric label="EOY vs Budget" value={pctFmt(plant.eoy_vs_budget_pct)} sub={`budget: ${fmt(plant.budget_value)}`} token={pctToken(plant.eoy_vs_budget_pct)} bar={plant.eoy_vs_budget_pct} />
                              <Metric label="Expected Annual" value={fmt(plant.expected_annual)} sub="full-year baseline" token={C.violet} />
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5">
                        <ChevronDown size={13} className="group-open:rotate-180 transition-transform" /> Comparison table
                      </summary>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
                              <th className="px-4 py-2.5 font-semibold">Plant</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Exp. Annual</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Exp. YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Actual YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Delta</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                              <th className="px-4 py-2.5 text-right font-semibold">EOY Fcst</th>
                              <th className="px-4 py-2.5 text-right font-semibold">EOY vs Budget</th>
                            </tr>
                          </thead>
                          <tbody>
                            {by_plant.map(p => {
                              const tok = pctToken(p.ytd_rate_pct);
                              return (
                                <tr key={p.plant_id} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                                  <td className="px-4 py-2 font-bold text-slate-800">{p.plant_name}</td>
                                  <td className="px-4 py-2 text-right text-slate-500">{fmt(p.expected_annual)}</td>
                                  <td className="px-4 py-2 text-right text-slate-500">{fmt(p.expected_ytd)}</td>
                                  <td className="px-4 py-2 text-right font-semibold">{fmt(p.actual_ytd)}</td>
                                  <td className={`px-4 py-2 text-right font-bold ${p.delta_ytd >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{(p.delta_ytd > 0 ? "+" : "") + fmt(p.delta_ytd)}</td>
                                  <td className={`px-4 py-2 text-right font-bold ${tok.text}`}>{pctFmt(p.ytd_rate_pct)}</td>
                                  <td className="px-4 py-2 text-right text-indigo-600 font-semibold">{fmt(p.eoy_forecast)}</td>
                                  <td className={`px-4 py-2 text-right font-bold ${pctToken(p.eoy_vs_budget_pct).text}`}>{pctFmt(p.eoy_vs_budget_pct)}</td>
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

            {/* ── BY TYPE ── */}
            {tab === "type" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">KPIs by Opportunity Type</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">All types · FY {data.year} · Click a row to expand</p>
                  </div>
                </div>
                {by_type.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {by_type.map((t, idx) => {
                        const pal = TYPE_PALETTE[t.type] ?? C.indigo;
                        const tok = pctToken(t.ytd_rate_pct);
                        return (
                          <CollapsibleCard key={t.type} defaultOpen={idx === 0}
                            colorBar={pal.bg}
                            header={
                              <div className="flex items-center gap-2.5">
                                <span className={`h-2.5 w-2.5 rounded-full ${pal.bg} shrink-0`} />
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{t.type}</p>
                                  <p className="text-[10px] text-slate-400">{t.opp_count} opps · {t.validated_count} validated · EOY {fmt(t.eoy_forecast)}</p>
                                </div>
                              </div>
                            }
                            badge={
                              <div className="flex items-center gap-3">
                                <span className="text-[10.5px] text-slate-400">
                                  Validation: <strong className={pctToken(_pct(t.validated_count, t.opp_count)).text}>{pctFmt(_pct(t.validated_count, t.opp_count))}</strong>
                                </span>
                                <span className={`text-base font-black ${tok.text}`}>{pctFmt(t.ytd_rate_pct)}</span>
                              </div>
                            }
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-slate-100 border-b border-slate-100">
                              <Metric label="YTD On-Track" value={pctFmt(t.ytd_rate_pct)} sub="actual / expected" token={tok} bar={t.ytd_rate_pct} />
                              <Metric label="Delta YTD" value={(t.delta_ytd > 0 ? "+" : "") + fmt(t.delta_ytd)} sub="actual − expected" token={t.delta_ytd >= 0 ? C.emerald : C.rose} />
                              <Metric label="Actual YTD" value={t.actual_ytd > 0 ? fmt(t.actual_ytd) : "—"} sub={`exp. ${fmt(t.expected_ytd)}`} token={C.sky} />
                              <Metric label="EOY Forecast" value={t.eoy_forecast > 0 ? fmt(t.eoy_forecast) : "—"} sub={`vs annual ${fmt(t.expected_annual)}`} token={C.indigo} bar={t.eoy_vs_expected_pct} />
                              <Metric label="Annual Pipeline" value={fmt(t.expected_annual)} sub={`${t.opp_count} opp${t.opp_count !== 1 ? "s" : ""} total`} token={pal} />
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5">
                        <ChevronDown size={13} className="group-open:rotate-180 transition-transform" /> Comparison table
                      </summary>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
                              <th className="px-4 py-2.5 font-semibold">Type</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Opps</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Validated</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Exp. Annual</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Actual YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                              <th className="px-4 py-2.5 text-right font-semibold">EOY Fcst</th>
                            </tr>
                          </thead>
                          <tbody>
                            {by_type.map(t => {
                              const pal = TYPE_PALETTE[t.type] ?? C.indigo;
                              const tok = pctToken(t.ytd_rate_pct);
                              return (
                                <tr key={t.type} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`h-2 w-2 rounded-full ${pal.bg}`} />
                                      <span className="font-bold text-slate-800">{t.type}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-500">{t.opp_count}</td>
                                  <td className="px-4 py-2 text-right text-slate-500">{t.validated_count}</td>
                                  <td className="px-4 py-2 text-right">{fmt(t.expected_annual)}</td>
                                  <td className="px-4 py-2 text-right font-semibold">{t.actual_ytd > 0 ? fmt(t.actual_ytd) : "—"}</td>
                                  <td className={`px-4 py-2 text-right font-bold ${tok.text}`}>{pctFmt(t.ytd_rate_pct)}</td>
                                  <td className="px-4 py-2 text-right text-indigo-600 font-semibold">{t.eoy_forecast > 0 ? fmt(t.eoy_forecast) : "—"}</td>
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

            {/* ── BY BUYER ── */}
            {tab === "buyer" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Performance par Acheteur</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Savings attendus · Réalisation YTD · Forecast EOY · {selectedYear} · Click to expand</p>
                  </div>
                  <p className="text-[11px] text-emerald-600 font-semibold">{by_buyer?.length ?? 0} acheteur{(by_buyer?.length ?? 0) !== 1 ? "s" : ""} actifs</p>
                </div>

                {(!by_buyer || by_buyer.length === 0) ? (
                  <p className="py-8 text-center text-sm text-slate-400">Aucun acheteur avec des lignes actives sur cet exercice.</p>
                ) : (
                  <>
                    {/* Summary row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                        <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">Acheteurs actifs</p>
                        <p className="text-2xl font-black text-slate-800">{by_buyer.length}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                        <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">Expected Annual total</p>
                        <p className="text-2xl font-black text-indigo-600">{fmt(by_buyer.reduce((s, b) => s + b.expected_annual, 0))}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                        <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">EOY Forecast total</p>
                        <p className="text-2xl font-black text-emerald-600">{fmt(by_buyer.reduce((s, b) => s + b.eoy_forecast, 0))}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.05)]">
                        <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 mb-1">Escalades totales</p>
                        <p className={`text-2xl font-black ${by_buyer.reduce((s, b) => s + b.escalated_count, 0) > 0 ? "text-rose-500" : "text-emerald-600"}`}>
                          {by_buyer.reduce((s, b) => s + b.escalated_count, 0)}
                        </p>
                      </div>
                    </div>

                    {/* Per-buyer collapsible cards */}
                    <div className="space-y-2">
                      {by_buyer.map((buyer, idx) => {
                        const initials = buyer.buyer_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                        const tok = pctToken(buyer.ytd_rate_pct);
                        return (
                          <CollapsibleCard key={buyer.buyer_email} defaultOpen={idx === 0}
                            colorBar={tok.bg}
                            header={
                              <div className="flex items-center gap-3">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${C.emerald.light} ${C.emerald.text} text-[10px] font-black shrink-0`}>
                                  {initials}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">{buyer.buyer_name}</p>
                                  <p className="text-[10px] text-slate-400">{buyer.buyer_email} · {buyer.opp_count} opp · {buyer.plant_count} site{buyer.plant_count !== 1 ? "s" : ""}</p>
                                </div>
                              </div>
                            }
                            badge={
                              <div className="flex items-center gap-2">
                                {buyer.categories.map((c: string) => (
                                  <span key={c} className={`rounded-full px-2 py-0.5 text-[9px] font-bold text-white ${TYPE_PALETTE[c]?.bg ?? "bg-slate-400"}`}>{c.split(" ")[0]}</span>
                                ))}
                                {buyer.escalated_count > 0 && (
                                  <span className="rounded-full bg-rose-100 text-rose-600 px-2 py-0.5 text-[9px] font-bold">{buyer.escalated_count} esc.</span>
                                )}
                                <span className={`text-base font-black ${tok.text}`}>{pctFmt(buyer.ytd_rate_pct)}</span>
                              </div>
                            }
                          >
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-100 border-b border-slate-100">
                              <Metric label="YTD On-Track" value={pctFmt(buyer.ytd_rate_pct)} sub="actual / expected" token={tok} bar={buyer.ytd_rate_pct} />
                              <Metric label="Delta YTD" value={(buyer.delta_ytd > 0 ? "+" : "") + fmt(buyer.delta_ytd)} sub="actual − expected" token={buyer.delta_ytd >= 0 ? C.emerald : C.rose} />
                              <Metric label="Actual YTD" value={fmt(buyer.actual_ytd)} sub={`exp. ${fmt(buyer.expected_ytd)}`} token={C.sky} />
                              <Metric label="EOY Forecast" value={fmt(buyer.eoy_forecast)} sub="projected full-year" token={C.indigo} />
                              <Metric label="EOY vs Budget" value={pctFmt(buyer.eoy_vs_budget_pct)} sub={`budget: ${fmt(buyer.budget_value)}`} token={pctToken(buyer.eoy_vs_budget_pct)} bar={buyer.eoy_vs_budget_pct} />
                              <Metric label="Expected Annual" value={fmt(buyer.expected_annual)} sub="full-year baseline" token={C.violet} />
                            </div>
                          </CollapsibleCard>
                        );
                      })}
                    </div>

                    {/* Comparison table */}
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none flex items-center gap-1.5">
                        <ChevronDown size={13} className="group-open:rotate-180 transition-transform" /> Tableau comparatif
                      </summary>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
                              <th className="px-4 py-2.5 font-semibold">Acheteur</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Opps</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Expected Annual</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Actual YTD</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                              <th className="px-4 py-2.5 text-right font-semibold">EOY Fcst</th>
                              <th className="px-4 py-2.5 text-right font-semibold">EOY vs Budget</th>
                            </tr>
                          </thead>
                          <tbody>
                            {by_buyer.map(b => {
                              const tok = pctToken(b.ytd_rate_pct);
                              return (
                                <tr key={b.buyer_email} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                                  <td className="px-4 py-2 font-semibold text-slate-700">{b.buyer_name}</td>
                                  <td className="px-4 py-2 text-right text-slate-500">{b.opp_count}</td>
                                  <td className="px-4 py-2 text-right text-slate-600">{fmt(b.expected_annual)}</td>
                                  <td className="px-4 py-2 text-right font-semibold">{fmt(b.actual_ytd)}</td>
                                  <td className={`px-4 py-2 text-right font-bold ${tok.text}`}>{pctFmt(b.ytd_rate_pct)}</td>
                                  <td className="px-4 py-2 text-right text-indigo-600 font-semibold">{fmt(b.eoy_forecast)}</td>
                                  <td className={`px-4 py-2 text-right font-bold ${pctToken(b.eoy_vs_budget_pct).text}`}>{pctFmt(b.eoy_vs_budget_pct)}</td>
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
              <div className="space-y-5">
                {totalAlerts === 0 && (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                      <CheckCircle2 size={28} className="text-emerald-500" />
                    </div>
                    <p className="text-sm font-bold text-emerald-700">No active alerts</p>
                    <p className="text-xs text-slate-400 mt-1">Pipeline is healthy — all lines up to date</p>
                  </div>
                )}

                {escalated.length > 0 && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-rose-600">
                      <AlertTriangle size={12} /> Escalated ({escalated.length})
                    </p>
                    <div className="space-y-2">
                      {escalated.map(e => (
                        <div key={e.financial_line_id} className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{e.opportunity_name}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{e.line_name} · Escalated by {e.escalated_by || "—"}</p>
                            </div>
                            <span className={`text-xs font-bold shrink-0 ${e.delta_ytd < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              Delta: {fmt(e.delta_ytd)}
                            </span>
                          </div>
                          {e.escalation_reason && (
                            <p className="mt-2 text-[11px] text-rose-800 bg-rose-100 rounded-lg px-3 py-1.5">{e.escalation_reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {late_projects.length > 0 && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-orange-600">
                      <Clock size={12} /> Late Projects ({late_projects.length})
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-orange-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-orange-50 text-left text-orange-600 border-b border-orange-100">
                            <th className="px-4 py-2.5 font-semibold">Project</th>
                            <th className="px-4 py-2.5 font-semibold">PM</th>
                            <th className="px-4 py-2.5 font-semibold">Phase</th>
                            <th className="px-4 py-2.5 font-semibold">Planned End</th>
                          </tr>
                        </thead>
                        <tbody>
                          {late_projects.map(p => (
                            <tr key={p.project_id} className="border-t border-orange-50 hover:bg-orange-50/40 transition-colors">
                              <td className="px-4 py-2 font-semibold text-slate-800">{p.project_name}</td>
                              <td className="px-4 py-2 text-slate-500">{p.project_owner || "—"}</td>
                              <td className="px-4 py-2">
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[9.5px] font-semibold text-orange-700">{p.phase_status}</span>
                              </td>
                              <td className="px-4 py-2 text-slate-500">{p.planned_end_date ? new Date(p.planned_end_date).toLocaleDateString("en-GB") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {missing_updates.length > 0 && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-amber-600">
                      <XCircle size={12} /> Missing Monthly Updates ({kpis.missing_update_lines} lines)
                    </p>
                    <div className="space-y-2">
                      {missing_updates.map(m => (
                        <div key={m.financial_line_id} className="rounded-xl border border-amber-100 bg-amber-50/30 px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-[12px] font-bold text-slate-800">{m.opportunity_name}</p>
                            <p className="text-[10.5px] text-slate-400">{m.line_name} · Owner: {m.follower || "—"}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-amber-700">{m.missing_count} month{m.missing_count !== 1 ? "s" : ""} missing</p>
                            <p className="text-[10px] text-amber-500 mt-0.5">{m.missing_months.slice(0, 3).join(", ")}{m.missing_months.length > 3 ? " …" : ""}</p>
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

        <p className="text-center text-[10px] text-slate-300">
          All amounts consolidated in {data.reporting_currency ?? "EUR"} (group reporting currency)
        </p>
      </div>
    </div>
  );
}
