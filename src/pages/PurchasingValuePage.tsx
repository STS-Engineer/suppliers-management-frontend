import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Layers,
  Lock,
  Mail,
  Paperclip,
  PlusCircle,
  RefreshCw,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react";
import supplierAPI from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";
import { PageIntro } from "../components/UI";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MonthlyRow {
  monthly_financial_id: number;
  financial_line_id: number;
  period_month?: string;
  expected_saving?: number;
  actual_saving?: number;
  cumulated_expected?: number;
  cumulated_actual?: number;
  delta_vs_expected?: number;
  forecast_eoy_saving?: number;
  forecast_comment?: string;
  comment?: string;
  monthly_outcome?: string;
  cash_expected?: number;
  cash_actual?: number;
  cumulated_cash_actual?: number;
}
interface FinLine {
  financial_line_id: number;
  line_name?: string;
  budget_status?: string;
  expected_annual_saving?: number;
  budget_value?: number;
  planned_start_date?: string;
  duration_months?: number;
  cumulated_real_saving?: number;
  delta_vs_expected_ytd?: number;
  status?: string;
  follower?: string;
  forecast_eoy_current?: number;
  is_escalated?: boolean;
  escalated_at?: string;
  escalated_by?: string;
  escalation_reason?: string;
  recovery_status?: string;
  recovery_note?: string;
  recovery_target_date?: string;
  recovery_amount?: number;
  recovery_history?: string;
  component_name?: string;
  component_pn?: string;
  monthly_financials: MonthlyRow[];
}
interface ProjectRec {
  project_id: number;
  project_name?: string;
  project_type?: string;
  project_owner?: string;
  phase_status?: string;
  gate_decision?: string;
  status?: string;
  plant_validation?: string;
  planned_end_date?: string;
  actual_end_date?: string;
  comments?: string;
  phase_output_notes?: string;
  off_tool_date?: string;
  committee_review_date?: string;
  committee_members?: string;
}
interface OppDoc {
  doc_id: number;
  opportunity_id: number;
  phase_label?: string;
  file_name?: string;
  original_file_name?: string;
  file_url?: string;
  mime_type?: string;
  file_size?: number;
  uploaded_by?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}
interface SiteOption {
  id_site: number;
  site_name?: string;
  city?: string;
  country?: string;
}
interface SupplierOption {
  id_supplier_unit: number;
  supplier_code?: string;
  group_name?: string;
  city?: string;
  country?: string;
}

interface Opp {
  opportunity_id: number;
  opportunity_name?: string;
  opportunity_type?: string;
  description?: string;
  status?: string;
  phase_status?: string;
  idea_owner?: string;
  purchasing_owner?: string;
  project_owner?: string;
  plant_name?: string;
  plant_city?: string;
  conversion_owner?: string;
  plant_id?: number;
  supplier_id?: number;
  expected_annual_saving?: number;
  cash_impact?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  execution_start_date?: string;
  real_start_date?: string;
  duration_months?: number;
  budget_status?: string;
  budget_year?: number;
  budget_confirmed_at?: string;
  budget_confirmed_by?: string;
  validation_decision?: string;
  val_date?: string;
  study_start_date?: string;
  change_mode?: string;
  assumptions_summary?: string;
  payback_score?: number;
  lead_time_score?: number;
  difficulty_score?: number;
  priority_score?: number;
  priority_category?: string;
  comments?: string;
  validation_request_sent_at?: string;
  created_at?: string;
  updated_at?: string;
  // STP — scope & volumes
  scope_in?: string;
  scope_out?: string;
  customers?: string;
  annual_quantity_n1?: number;
  annual_quantity_n2?: number;
  annual_quantity_n3?: number;
  annual_quantity_n4?: number;
  // STP — supplier comparison
  proposed_supplier_name?: string;
  proposed_supplier_id?: number;
  current_price?: number;
  proposed_price?: number;
  proposed_price_n1?: number;
  proposed_price_n2?: number;
  proposed_price_n3?: number;
  country_after?: string;
  incoterms_before?: string;
  incoterms_after?: string;
  top_days_before?: number;
  top_days_after?: number;
  transit_days_before?: number;
  transit_days_after?: number;
  bonus_before?: number;
  bonus_after?: number;
  consignment_before?: string;
  consignment_after?: string;
  current_price_n1?: number;
  current_price_n2?: number;
  current_price_n3?: number;
  supplier_asked?: boolean;
  supplier_asked_result?: string;
  // STP — costs & investment
  tooling_cost?: number;
  travel_cost?: number;
  qualification_cost?: number;
  other_cost?: number;
  total_investment?: number;
  roi_percent?: number;
  // STP — risks (JSONB)
  stp_risks?: {
    material_indexation_before?: string;
    material_indexation_after?: string;
    exchange_rate_before?: string;
    exchange_rate_after?: string;
    local_content_before?: string;
    local_content_after?: string;
    quality_before?: string;
    quality_after?: string;
    other_before?: string;
    other_after?: string;
    material_same_spec?: string;
    same_tooling?: string;
    same_dimension?: string;
  };
  // STP — benefits (JSONB)
  stp_benefits?: {
    if_we_do?: string;
    if_not?: string;
  };
  // STP — planning & why
  phase1_weeks?: number;
  phase2_weeks?: number;
  phase3_weeks?: number;
  phase4_weeks?: number;
  reason_productivity?: boolean;
  reason_quality?: boolean;
  reason_capacity?: boolean;
  reason_other?: string;
  projects: ProjectRec[];
  financial_lines: FinLine[];
  opp_documents: OppDoc[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TYPES = ["Negotiation", "Sourcing", "Technical Productivity", "Cash"];
// "Assigned" is a STATUS on a Phase 0 card — not a separate phase column
const PHASES = [
  "Phase 0",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Phase 4",
  "Closed",
];
const TYPE_COLORS: Record<string, string> = {
  Negotiation: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
  Sourcing: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25",
  "Technical Productivity": "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
  Cash: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
};
const STATUS_COLORS: Record<string, string> = {
  Assigned: "bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-300",
  "Working on it": "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "Awaiting Validation": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "Under Committee Review": "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  "Needs Rework": "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  Validated: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Stuck: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  Complete: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  "Customer Refusal": "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
};
const PHASE_CONFIG: Record<string, { color: string; desc: string }> = {
  "Phase 0": {
    color: "text-amber-600",
    desc: "Opportunity study — Purchasing",
  },
  "Phase 1": {
    color: "text-blue-600",
    desc: "Feasibility study — Project Manager",
  },
  "Phase 2": { color: "text-indigo-600", desc: "Execution" },
  "Phase 3": { color: "text-purple-600", desc: "Deployment" },
  "Phase 4": { color: "text-teal-600", desc: "LLC / Closure" },
  Closed: { color: "text-slate-400", desc: "Completed or cancelled" },
};

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
        month: "short",
        year: "numeric",
        day: "numeric",
      })
    : "—";

const pldColor = (cat?: string | null) =>
  cat === "High"
    ? "text-emerald-600 bg-emerald-50"
    : cat === "Medium"
      ? "text-amber-600 bg-amber-50"
      : "text-red-500 bg-red-50";

// Module-level helper — used in both FinancialTab and PurchasingValuePage KPI strip
const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
const normalizeChangeMode = (value?: string | null) => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "standard") return "Standard";
  if (normalized === "silent") return "Silent";
  return value ?? "";
};

// ---------------------------------------------------------------------------
// Small shared components
// ---------------------------------------------------------------------------
function InfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value?: string | null;
  valueClassName?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-3 border-b border-slate-50 px-4 py-2 last:border-0 dark:border-white/[0.05]">
      <span className="w-36 shrink-0 pt-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className={`break-all text-sm ${valueClassName ?? "text-slate-700 dark:text-slate-200"}`}>
        {value}
      </span>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  subClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  subClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/[0.07] dark:bg-white/[0.04]">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {icon}
        {label}
      </div>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{value}</p>
      {sub && (
        <p className={`mt-0.5 text-[10px] ${subClassName ?? "text-slate-400 dark:text-slate-500"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ScoreSlider({
  label,
  letter,
  value,
  onChange,
}: {
  label: string;
  letter: string;
  value: number | "";
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-slate-600">
          {label} <span className="text-slate-400">({letter})</span>
        </label>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
          {value || "—"} / 5
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value || 1}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-blue-600 h-1.5"
      />
      <div className="flex justify-between text-[9px] text-slate-300 mt-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create modal
// ---------------------------------------------------------------------------
function CreateModal({
  onClose,
  onCreated,
  userEmail,
}: {
  onClose: () => void;
  onCreated: (o: Opp) => void;
  userEmail: string;
}) {
  const [form, setForm] = useState({
    opportunity_name: "",
    opportunity_type: "Sourcing",
    idea_owner: userEmail,
    description: "",
    plant_id: "",
    // budget_status removed — only settable after Phase 0 Go (Olivier: "tant que c'est working on it, on n'a pas le droit de le budgeter")
  });
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const needsPlant = ["Sourcing", "Technical Productivity"].includes(
    form.opportunity_type,
  );

  useEffect(() => {
    supplierAPI
      .listSiteOptions()
      .then((r: { data?: SiteOption[] }) => setSites(r.data ?? []))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (needsPlant && !form.plant_id) {
      setError("Plant is required for this opportunity type.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.createOpportunity({
        ...form,
        plant_id: form.plant_id ? parseInt(form.plant_id) : undefined,
      });
      onCreated(res.data as Opp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">
            New Opportunity
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Name *
            </label>
            <input
              required
              className={inp}
              value={form.opportunity_name}
              onChange={(e) => set("opportunity_name", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Type *
            </label>
            <select
              required
              className={inp}
              value={form.opportunity_type}
              onChange={(e) => set("opportunity_type", e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          {needsPlant && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Avocarbon Plant *{" "}
                <span className="text-orange-500">(required)</span>
              </label>
              <select
                required
                className={inp}
                value={form.plant_id}
                onChange={(e) => set("plant_id", e.target.value)}
              >
                <option value="">— Select plant —</option>
                {sites.map((s) => (
                  <option key={s.id_site} value={s.id_site}>
                    {s.site_name}
                    {s.city ? ` · ${s.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Initial Pilot (email) *
            </label>
            <input
              required
              type="email"
              className={inp}
              value={form.idea_owner}
              onChange={(e) => set("idea_owner", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Description
            </label>
            <textarea
              rows={2}
              className={`${inp} resize-none`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <PlusCircle size={14} />
              )}{" "}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer tabs
// ---------------------------------------------------------------------------
type Tab = "overview" | "edit" | "stp" | "gate" | "financial" | "project" | "files";

function OverviewTab({ opp }: { opp: Opp }) {
  const pldReady =
    opp.payback_score && opp.lead_time_score && opp.difficulty_score;
  return (
    <div className="space-y-5">
      {opp.description && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 leading-relaxed">
          {opp.description}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<TrendingUp size={12} />}
          label="Est. Annual Saving"
          value={fmt(opp.expected_annual_saving)}
        />
        <MetricCard
          icon={<Banknote size={12} />}
          label="Cash Impact"
          value={fmt(opp.cash_impact)}
        />
        <MetricCard
          icon={<Clock size={12} />}
          label="Duration"
          value={opp.duration_months ? `${opp.duration_months} months` : "—"}
        />
        <MetricCard
          icon={<FileText size={12} />}
          label="Budget Year"
          value={opp.budget_year ? String(opp.budget_year) : "—"}
          sub={opp.budget_status ?? undefined}
          subClassName={
            opp.budget_status === "Budgeted"
              ? "font-semibold text-emerald-600"
              : undefined
          }
        />
      </div>
      {pldReady && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
            PLD Priority
          </p>
          <div className="flex items-center gap-3">
            <div className="flex gap-2 text-xs text-slate-600">
              <span>P={opp.payback_score}</span>
              <span>L={opp.lead_time_score}</span>
              <span>D={opp.difficulty_score}</span>
            </div>
            <span className="font-bold text-sm">= {opp.priority_score}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${pldColor(opp.priority_category)}`}
            >
              {opp.priority_category}
            </span>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
        <InfoRow label="Idea Owner (Pilot)" value={opp.idea_owner} />
        <InfoRow label="Purchasing Owner" value={opp.purchasing_owner} />
        <InfoRow label="Project Manager" value={opp.project_owner} />
        <InfoRow label="Conversion Owner" value={opp.conversion_owner} />
        <InfoRow
          label="Plant"
          value={
            opp.plant_name
              ? `${opp.plant_name}${opp.plant_city ? ` · ${opp.plant_city}` : ""}`
              : opp.plant_id
                ? `#${opp.plant_id}`
                : null
          }
        />
        <InfoRow label="Change Mode" value={opp.change_mode} />
        <InfoRow label="Scope IN" value={opp.scope_in} />
        <InfoRow label="Customers" value={opp.customers} />
        {opp.proposed_supplier_name && (
          <InfoRow
            label="Proposed Supplier"
            value={opp.proposed_supplier_name}
          />
        )}
        {opp.current_price != null && opp.proposed_price != null && (
          <InfoRow
            label="Price Before→After"
            value={`€${opp.current_price} → €${opp.proposed_price}`}
          />
        )}
        {opp.total_investment != null && (
          <InfoRow
            label="Total Investment"
            value={`€${opp.total_investment.toLocaleString()} (ROI: ${opp.roi_percent ?? "?"}%)`}
          />
        )}
        <InfoRow
          label="Planned Start"
          value={fmtDate(opp.planned_start_date)}
        />
        <InfoRow
          label="Planned End"
          value={fmtDate(opp.planned_end_date)}
        />
        <InfoRow
          label="Execution Start (Phase 2)"
          value={fmtDate(opp.execution_start_date)}
        />
        <InfoRow
          label="Deployment Start (Phase 3)"
          value={fmtDate(opp.real_start_date)}
        />
        <InfoRow label="Validation Date (Phase 0 Go)" value={fmtDate(opp.val_date)} />
        <InfoRow
          label="Budget Status"
          value={
            opp.budget_status
              ? `${opp.budget_status}${opp.budget_confirmed_at ? ` — confirmed ${fmtDate(opp.budget_confirmed_at)}${opp.budget_confirmed_by ? ` by ${opp.budget_confirmed_by}` : ""}` : ""}`
              : undefined
          }
          valueClassName={
            opp.budget_status === "Budgeted"
              ? "font-semibold text-emerald-600"
              : undefined
          }
        />
        {opp.assumptions_summary && (
          <InfoRow label="Assumptions" value={opp.assumptions_summary} />
        )}
        {opp.comments && <InfoRow label="Comments" value={opp.comments} />}
      </div>
    </div>
  );
}

function EditTab({
  opp,
  userEmail,
  onRefresh,
  mode = "general",
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
  mode?: "general" | "stp";
}) {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [suppliersForPlant, setSuppliersForPlant] = useState<SupplierOption[]>(
    [],
  );
  const isSourced = ["Sourcing", "Technical Productivity"].includes(
    opp.opportunity_type ?? "",
  );

  useEffect(() => {
    supplierAPI
      .listSiteOptions()
      .then((r: { data?: SiteOption[] }) => setSites(r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const pid = opp.plant_id;
    if (pid) {
      supplierAPI
        .getSuppliersByPlant(pid)
        .then((r: { data?: SupplierOption[] }) =>
          setSuppliersForPlant(r.data ?? []),
        )
        .catch(() => {});
    }
  }, [opp.plant_id]);

  const [currentSupplierEval, setCurrentSupplierEval] = useState<Record<
    string,
    unknown
  > | null>(null);
  useEffect(() => {
    if (opp.supplier_id && opp.plant_id) {
      supplierAPI
        .getCurrentSupplierEvaluation(opp.opportunity_id)
        .then((r: { data?: Record<string, unknown> }) =>
          setCurrentSupplierEval(r.data ?? null),
        )
        .catch(() => {});
    }
  }, [opp.supplier_id, opp.plant_id, opp.opportunity_id]);

  const isPhase0 = opp.phase_status === "Phase 0";
  const goApplied = opp.validation_decision === "Go";
  const stpEditablePhases = ["Assigned", "Phase 0", "Phase 1"];
  const showStpSection = isSourced;
  const stpReadOnly =
    mode === "stp" && !stpEditablePhases.includes(opp.phase_status ?? "");
  // Saving locked only once budgeted — modifiable in Phase 1/2/3 until budget is confirmed
  const isBudgeted = opp.budget_status === "Budgeted";
  const locked = isBudgeted;
  const budgetYearLocked = isBudgeted && opp.budget_year != null;
  // Olivier: budget only settable after validation. "tant que c est working on it, on n a pas le droit de le budgeter"
  const budgetEditable = goApplied;

  const phaseNote: Record<string, string> = {
    "Phase 1":
      "Phase 0 Go applied. Annual saving and dates remain editable until the opportunity is Budgeted. Update owners, assumptions and comments freely.",
    "Phase 2":
      "Execution phase — enter real start date once production begins, update assumptions if saving estimate changed.",
    "Phase 3":
      "Deployment phase — confirm real start date and PPAP status in the Project tab.",
    "Phase 4":
      "Closure phase — add final comments and lessons learned before closing.",
  };

  const [form, setForm] = useState({
    opportunity_name: opp.opportunity_name ?? "",
    description: opp.description ?? "",
    // Strip Python Decimal trailing zeros ("12.00"→"12", "2700.00"→"2700")
    // Prevents French locale browser rendering "12,00" in number inputs
    expected_annual_saving: opp.expected_annual_saving
      ? String(parseFloat(String(opp.expected_annual_saving)))
      : "",
    cash_impact: opp.cash_impact
      ? String(parseFloat(String(opp.cash_impact)))
      : "",
    duration_months: opp.duration_months
      ? String(parseInt(String(opp.duration_months)))
      : "",
    planned_start_date: opp.planned_start_date ?? "",
    execution_start_date: opp.execution_start_date ?? "",
    real_start_date: opp.real_start_date ?? "",
    budget_status: opp.budget_status ?? "Outside Budget",
    budget_year: opp.budget_year
      ? String(parseInt(String(opp.budget_year)))
      : "",
    change_mode: normalizeChangeMode(opp.change_mode),
    assumptions_summary: opp.assumptions_summary ?? "",
    comments: opp.comments ?? "",
    purchasing_owner: opp.purchasing_owner ?? "",
    // Default conversion_owner to purchasing_owner if not set
    conversion_owner: opp.conversion_owner ?? opp.purchasing_owner ?? "",
    payback_score: opp.payback_score ?? ("" as number | ""),
    lead_time_score: opp.lead_time_score ?? ("" as number | ""),
    difficulty_score: opp.difficulty_score ?? ("" as number | ""),
    // STP
    scope_in: opp.scope_in ?? "",
    scope_out: opp.scope_out ?? "",
    customers: opp.customers ?? "",
    annual_quantity_n1: opp.annual_quantity_n1
      ? String(parseInt(String(opp.annual_quantity_n1)))
      : "",
    annual_quantity_n2: opp.annual_quantity_n2
      ? String(parseInt(String(opp.annual_quantity_n2)))
      : "",
    annual_quantity_n3: opp.annual_quantity_n3
      ? String(parseInt(String(opp.annual_quantity_n3)))
      : "",
    annual_quantity_n4: opp.annual_quantity_n4
      ? String(parseInt(String(opp.annual_quantity_n4)))
      : "",
    supplier_id: opp.supplier_id
      ? String(opp.supplier_id)
      : "",
    proposed_supplier_name: opp.proposed_supplier_name ?? "",
    proposed_supplier_id: opp.proposed_supplier_id
      ? String(parseInt(String(opp.proposed_supplier_id)))
      : "",
    current_price: opp.current_price
      ? String(parseFloat(String(opp.current_price)))
      : "",
    proposed_price: opp.proposed_price
      ? String(parseFloat(String(opp.proposed_price)))
      : "",
    proposed_price_n1: opp.proposed_price_n1
      ? String(parseFloat(String(opp.proposed_price_n1)))
      : "",
    proposed_price_n2: opp.proposed_price_n2
      ? String(parseFloat(String(opp.proposed_price_n2)))
      : "",
    proposed_price_n3: opp.proposed_price_n3
      ? String(parseFloat(String(opp.proposed_price_n3)))
      : "",
    country_after: opp.country_after ?? "",
    incoterms_before: opp.incoterms_before ?? "",
    incoterms_after: opp.incoterms_after ?? "",
    top_days_before: opp.top_days_before
      ? String(parseInt(String(opp.top_days_before)))
      : "",
    top_days_after: opp.top_days_after
      ? String(parseInt(String(opp.top_days_after)))
      : "",
    transit_days_before: opp.transit_days_before
      ? String(parseInt(String(opp.transit_days_before)))
      : "",
    transit_days_after: opp.transit_days_after
      ? String(parseInt(String(opp.transit_days_after)))
      : "",
    bonus_before: opp.bonus_before
      ? String(parseFloat(String(opp.bonus_before)))
      : "",
    bonus_after: opp.bonus_after
      ? String(parseFloat(String(opp.bonus_after)))
      : "",
    consignment_before: opp.consignment_before ?? "",
    consignment_after: opp.consignment_after ?? "",
    current_price_n1: opp.current_price_n1
      ? String(parseFloat(String(opp.current_price_n1)))
      : "",
    current_price_n2: opp.current_price_n2
      ? String(parseFloat(String(opp.current_price_n2)))
      : "",
    current_price_n3: opp.current_price_n3
      ? String(parseFloat(String(opp.current_price_n3)))
      : "",
    supplier_asked: opp.supplier_asked?.toString() ?? "",
    supplier_asked_result: opp.supplier_asked_result ?? "",
    tooling_cost: opp.tooling_cost
      ? String(parseFloat(String(opp.tooling_cost)))
      : "",
    travel_cost: opp.travel_cost
      ? String(parseFloat(String(opp.travel_cost)))
      : "",
    qualification_cost: opp.qualification_cost
      ? String(parseFloat(String(opp.qualification_cost)))
      : "",
    other_cost: opp.other_cost
      ? String(parseFloat(String(opp.other_cost)))
      : "",
    // stp_risks — flattened for form inputs, packed back to JSON on submit
    risk_material_indexation_before: opp.stp_risks?.material_indexation_before ?? "",
    risk_material_indexation_after: opp.stp_risks?.material_indexation_after ?? "",
    risk_exchange_rate_before: opp.stp_risks?.exchange_rate_before ?? "",
    risk_exchange_rate_after: opp.stp_risks?.exchange_rate_after ?? "",
    risk_local_content_before: opp.stp_risks?.local_content_before ?? "",
    risk_local_content_after: opp.stp_risks?.local_content_after ?? "",
    risk_quality_before: opp.stp_risks?.quality_before ?? "",
    risk_quality_after: opp.stp_risks?.quality_after ?? "",
    risk_other_before: opp.stp_risks?.other_before ?? "",
    risk_other_after: opp.stp_risks?.other_after ?? "",
    material_same_spec: opp.stp_risks?.material_same_spec ?? "",
    same_tooling: opp.stp_risks?.same_tooling ?? "",
    same_dimension: opp.stp_risks?.same_dimension ?? "",
    // stp_benefits — flattened for form inputs
    benefit_if_we_do: opp.stp_benefits?.if_we_do ?? "",
    benefit_if_not: opp.stp_benefits?.if_not ?? "",
    phase1_weeks: opp.phase1_weeks
      ? String(parseInt(String(opp.phase1_weeks)))
      : "",
    phase2_weeks: opp.phase2_weeks
      ? String(parseInt(String(opp.phase2_weeks)))
      : "",
    phase3_weeks: opp.phase3_weeks
      ? String(parseInt(String(opp.phase3_weeks)))
      : "",
    phase4_weeks: opp.phase4_weeks
      ? String(parseInt(String(opp.phase4_weeks)))
      : "",
    reason_productivity: opp.reason_productivity ?? false,
    reason_quality: opp.reason_quality ?? false,
    reason_capacity: opp.reason_capacity ?? false,
    reason_other: opp.reason_other ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const budgetStatusChanged = form.budget_status !== opp.budget_status;
  const budgetYearRequired =
    budgetEditable &&
    form.budget_status === "Budgeted" &&
    !form.budget_year.trim();

  // Live-computed end date: last day of the final month in the period
  // duration=1, start=Oct → 31 Oct | duration=12, start=Oct → 30 Sep next year
  const computedEndDate = (() => {
    const start = form.planned_start_date || opp.planned_start_date;
    const dur = form.duration_months ? parseInt(form.duration_months) : opp.duration_months ? Number(opp.duration_months) : null;
    if (!start || !dur || dur <= 0) return null;
    const d = new Date(start);
    d.setMonth(d.getMonth() + dur - 1);
    d.setMonth(d.getMonth() + 1, 0);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  })();

  // Live PLD computation (component-level so submit handler can use them too)
  const _pldTotalInv =
    (parseFloat(form.tooling_cost || "0") || 0) +
    (parseFloat(form.travel_cost || "0") || 0) +
    (parseFloat(form.qualification_cost || "0") || 0) +
    (parseFloat(form.other_cost || "0") || 0);
  const _pldAnnSaving = parseFloat(form.expected_annual_saving || "0") || 0;
  const _pldHasInvData = _pldAnnSaving > 0 || _pldTotalInv > 0;
  const _pldPaybackMonths = _pldAnnSaving > 0 ? _pldTotalInv / (_pldAnnSaving / 12) : _pldTotalInv > 0 ? 999 : 0;
  const livePScore = !_pldHasInvData ? null
    : _pldPaybackMonths === 0 ? 1
    : _pldPaybackMonths <= 2 ? 2
    : _pldPaybackMonths <= 4 ? 3
    : _pldPaybackMonths <= 12 ? 4
    : 5;
  const _pldTotalWeeks =
    (parseInt(form.phase1_weeks || "0") || 0) +
    (parseInt(form.phase2_weeks || "0") || 0) +
    (parseInt(form.phase3_weeks || "0") || 0);
  const _pldLeadMonths = _pldTotalWeeks / 4.33;
  const liveLScore = _pldTotalWeeks === 0 ? null
    : _pldLeadMonths < 1 ? 1
    : _pldLeadMonths < 2 ? 2
    : _pldLeadMonths < 4 ? 3
    : _pldLeadMonths < 6 ? 4
    : 5;
  const liveDScore = form.difficulty_score ? Number(form.difficulty_score) : null;

  const pScore =
    livePScore && liveLScore && liveDScore
      ? livePScore * liveLScore * liveDScore
      : null;
  const pCat =
    pScore == null
      ? null
      : pScore >= 75
        ? "High"
        : pScore >= 25
          ? "Medium"
          : "Low";

  // Auto-calculate expected_annual_saving from prices × qty (when all three are filled)
  const autoSaving =
    form.current_price && form.proposed_price && form.annual_quantity_n1
      ? Math.round(
          (parseFloat(form.current_price) - parseFloat(form.proposed_price)) *
            parseInt(form.annual_quantity_n1),
        )
      : null;

  useEffect(() => {
    if (autoSaving != null && autoSaving > 0 && !locked) {
      setForm((f) =>
        f.expected_annual_saving
          ? f  // never overwrite a value the user already entered or that was loaded
          : { ...f, expected_annual_saving: autoSaving.toString() },
      );
    }
  }, [form.current_price, form.proposed_price, form.annual_quantity_n1]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate: budget confirmation requires an @avocarbon.com email
    if (
      form.budget_status === "Budgeted" &&
      form.budget_status !== opp.budget_status &&
      !userEmail.toLowerCase().endsWith("@avocarbon.com")
    ) {
      setError("Budget confirmation requires an @avocarbon.com email address.");
      setLoading(false);
      return;
    }
    if (budgetYearRequired) {
      setError("Enter the Budget Year before saving an opportunity with Budget Status set to Budgeted.");
      setLoading(false);
      return;
    }

    try {
      const res = await supplierAPI.updateOpportunity(opp.opportunity_id, {
        opportunity_name: form.opportunity_name || undefined,
        description: form.description || undefined,
        expected_annual_saving: form.expected_annual_saving
          ? parseFloat(form.expected_annual_saving)
          : undefined,
        cash_impact: form.cash_impact
          ? parseFloat(form.cash_impact)
          : undefined,
        duration_months: form.duration_months
          ? parseInt(form.duration_months)
          : undefined,
        planned_start_date: form.planned_start_date || undefined,
        execution_start_date: form.execution_start_date || undefined,
        real_start_date: form.real_start_date || undefined,
        budget_status: form.budget_status || undefined,
        budget_year: form.budget_year ? parseInt(form.budget_year) : undefined,
        change_mode: form.change_mode || undefined,
        assumptions_summary: form.assumptions_summary || undefined,
        comments: form.comments || undefined,
        purchasing_owner: form.purchasing_owner || undefined,
        conversion_owner: form.conversion_owner || undefined,
        payback_score: livePScore ?? undefined,
        lead_time_score: liveLScore ?? undefined,
        difficulty_score: liveDScore ?? undefined,
        scope_in: form.scope_in || undefined,
        scope_out: form.scope_out || undefined,
        customers: form.customers || undefined,
        annual_quantity_n1: form.annual_quantity_n1
          ? parseInt(form.annual_quantity_n1)
          : undefined,
        annual_quantity_n2: form.annual_quantity_n2
          ? parseInt(form.annual_quantity_n2)
          : undefined,
        annual_quantity_n3: form.annual_quantity_n3
          ? parseInt(form.annual_quantity_n3)
          : undefined,
        annual_quantity_n4: form.annual_quantity_n4
          ? parseInt(form.annual_quantity_n4)
          : undefined,
        supplier_id: form.supplier_id ? parseInt(form.supplier_id) : undefined,
        proposed_supplier_name: form.proposed_supplier_name || undefined,
        proposed_supplier_id: form.proposed_supplier_id
          ? parseInt(form.proposed_supplier_id)
          : undefined,
        current_price: form.current_price
          ? parseFloat(form.current_price)
          : undefined,
        proposed_price: form.proposed_price
          ? parseFloat(form.proposed_price)
          : undefined,
        proposed_price_n1: form.proposed_price_n1
          ? parseFloat(form.proposed_price_n1)
          : undefined,
        proposed_price_n2: form.proposed_price_n2
          ? parseFloat(form.proposed_price_n2)
          : undefined,
        proposed_price_n3: form.proposed_price_n3
          ? parseFloat(form.proposed_price_n3)
          : undefined,
        country_after: form.country_after || undefined,
        incoterms_before: form.incoterms_before || undefined,
        incoterms_after: form.incoterms_after || undefined,
        top_days_before: form.top_days_before
          ? parseInt(form.top_days_before)
          : undefined,
        top_days_after: form.top_days_after
          ? parseInt(form.top_days_after)
          : undefined,
        transit_days_before: form.transit_days_before
          ? parseInt(form.transit_days_before)
          : undefined,
        transit_days_after: form.transit_days_after
          ? parseInt(form.transit_days_after)
          : undefined,
        bonus_before: form.bonus_before
          ? parseFloat(form.bonus_before)
          : undefined,
        bonus_after: form.bonus_after
          ? parseFloat(form.bonus_after)
          : undefined,
        consignment_before: form.consignment_before || undefined,
        consignment_after: form.consignment_after || undefined,
        current_price_n1: form.current_price_n1
          ? parseFloat(form.current_price_n1)
          : undefined,
        current_price_n2: form.current_price_n2
          ? parseFloat(form.current_price_n2)
          : undefined,
        current_price_n3: form.current_price_n3
          ? parseFloat(form.current_price_n3)
          : undefined,
        supplier_asked: form.supplier_asked
          ? form.supplier_asked === "true"
          : undefined,
        supplier_asked_result: form.supplier_asked_result || undefined,
        tooling_cost: form.tooling_cost
          ? parseFloat(form.tooling_cost)
          : undefined,
        travel_cost: form.travel_cost
          ? parseFloat(form.travel_cost)
          : undefined,
        qualification_cost: form.qualification_cost
          ? parseFloat(form.qualification_cost)
          : undefined,
        other_cost: form.other_cost
          ? parseFloat(form.other_cost)
          : undefined,
        stp_risks: {
          material_indexation_before: form.risk_material_indexation_before || undefined,
          material_indexation_after: form.risk_material_indexation_after || undefined,
          exchange_rate_before: form.risk_exchange_rate_before || undefined,
          exchange_rate_after: form.risk_exchange_rate_after || undefined,
          local_content_before: form.risk_local_content_before || undefined,
          local_content_after: form.risk_local_content_after || undefined,
          quality_before: form.risk_quality_before || undefined,
          quality_after: form.risk_quality_after || undefined,
          other_before: form.risk_other_before || undefined,
          other_after: form.risk_other_after || undefined,
          material_same_spec: form.material_same_spec || undefined,
          same_tooling: form.same_tooling || undefined,
          same_dimension: form.same_dimension || undefined,
        },
        stp_benefits: {
          if_we_do: form.benefit_if_we_do || undefined,
          if_not: form.benefit_if_not || undefined,
        },
        phase1_weeks: form.phase1_weeks
          ? parseInt(form.phase1_weeks)
          : undefined,
        phase2_weeks: form.phase2_weeks
          ? parseInt(form.phase2_weeks)
          : undefined,
        phase3_weeks: form.phase3_weeks
          ? parseInt(form.phase3_weeks)
          : undefined,
        phase4_weeks: form.phase4_weeks
          ? parseInt(form.phase4_weeks)
          : undefined,
        reason_productivity: form.reason_productivity,
        reason_quality: form.reason_quality,
        reason_capacity: form.reason_capacity,
        reason_other: form.reason_other || undefined,
        changed_by: userEmail,
      });
      // Backend now returns fresh data after commit (R9 rebuild etc.)
      // Extra GET as safety net for any residual session cache issues
      const realStartChanged = form.real_start_date && form.real_start_date !== opp.real_start_date;
      if (realStartChanged) {
        const fresh = await supplierAPI.getOpportunity(opp.opportunity_id);
        onRefresh(fresh.data as Opp);
      } else {
        onRefresh(res.data as Opp);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const label = "mb-1 block text-xs font-semibold text-slate-600";

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {phaseNote[opp.phase_status ?? ""] && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
          {phaseNote[opp.phase_status ?? ""]}
        </div>
      )}
      {mode === "general" && (
        <>
      <div>
        <label className={label}>Opportunity Name</label>
        <input
          className={inp}
          value={form.opportunity_name}
          onChange={(e) => set("opportunity_name", e.target.value)}
        />
      </div>
      <div>
        <label className={label}>Description</label>
        <textarea
          rows={2}
          className={`${inp} resize-none`}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      {/* ---- FINANCIAL BASELINE (locked once Budgeted) ---- */}
      <div
        className={`rounded-xl p-4 space-y-3 ${locked ? "bg-slate-50 border border-slate-200" : ""}`}
      >
        {locked && (
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-400">
            <Lock size={10} /> Financial baseline — locked after Phase 0 Go
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>
              Est. Annual Saving (€)
              {autoSaving != null && !locked && (
                <span className="ml-2 text-emerald-600 font-bold">
                  → auto: €{autoSaving.toLocaleString()}
                </span>
              )}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={locked}
              className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
              value={form.expected_annual_saving}
              onChange={(e) => set("expected_annual_saving", e.target.value)}
            />
            {autoSaving != null && !locked && (
              <p className="text-[10px] text-emerald-600 mt-0.5">
                Auto-calculated from price difference × quantity
              </p>
            )}
          </div>
          <div>
            <label className={label}>
              Cash Impact (€){" "}
              <span className="font-normal text-slate-400">
                — total cash estimate, locked when Budgeted
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              disabled={locked}
              className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
              value={form.cash_impact}
              onChange={(e) => set("cash_impact", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>
              Duration (months){" "}
              <span className="font-normal text-slate-400">
                — saving period length
              </span>
            </label>
            <input
              type="number"
              min="1"
              max="120"
              step="1"
              disabled={locked}
              className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
              value={form.duration_months}
              onChange={(e) => set("duration_months", e.target.value)}
            />
            {computedEndDate && (
              <p className="mt-1 text-[10.5px] text-slate-500">
                → Planned end: <span className="font-semibold text-slate-700">{computedEndDate}</span>
              </p>
            )}
          </div>
          <div>
            <label className={label}>
              Budget Year{" "}
              <span className="font-normal text-slate-400">
                — locked when Budgeted unless missing
              </span>
            </label>
            <input
              type="number"
              min="2020"
              max="2040"
              disabled={budgetYearLocked}
              className={`${inp} ${budgetYearLocked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
              value={form.budget_year}
              onChange={(e) => set("budget_year", e.target.value)}
            />
            {isBudgeted && !opp.budget_year && (
              <p className="mt-1 text-[10.5px] font-medium text-amber-600">
                Budgeted is already set, but Budget Year is still missing. Enter it here and save.
              </p>
            )}
          </div>
          <div>
            <label className={label}>
              Planned Start{" "}
              <span className="font-normal text-slate-400">
                — editable until budgeted; will rebuild profile if changed in Phase 0/1
              </span>
            </label>
            <input
              type="date"
              className={inp}
              value={form.planned_start_date}
              onChange={(e) => set("planned_start_date", e.target.value)}
            />
            {computedEndDate && (
              <p className="mt-1 text-[10.5px] text-slate-500">
                → Planned end: <span className="font-semibold text-slate-700">{computedEndDate}</span>
              </p>
            )}
            {form.planned_start_date
              && form.planned_start_date !== opp.planned_start_date
              && ["Phase 0", "Phase 1", "Assigned"].includes(opp.phase_status ?? "") && (
              <p className="mt-1 text-[10.5px] text-amber-600 font-medium">
                ⚠ Date changed — monthly savings profile will be rebuilt from {form.planned_start_date}
              </p>
            )}
            {form.planned_start_date
              && form.planned_start_date !== opp.planned_start_date
              && ["Phase 2", "Phase 3", "Phase 4"].includes(opp.phase_status ?? "") && (
              <p className="mt-1 text-[10.5px] text-blue-600 font-medium">
                ℹ Planned date updated — use Deployment Start Date to rebuild the savings profile.
              </p>
            )}
          </div>
          {/* Phase 2 date — when execution work began */}
          {["Phase 2", "Phase 3", "Phase 4"].includes(
            opp.phase_status ?? "",
          ) && (
            <div>
              <label className={label}>
                Execution Start Date
                <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
                  Phase 2
                </span>
                <span className="ml-1 font-normal text-slate-400">
                  — when work began (tooling, qualification, supplier contacted)
                </span>
              </label>
              <input
                type="date"
                className={inp}
                value={form.execution_start_date}
                onChange={(e) => set("execution_start_date", e.target.value)}
              />
            </div>
          )}
          {/* Phase 3 date — when savings actually started flowing */}
          {["Phase 3", "Phase 4"].includes(opp.phase_status ?? "") && (
            <div>
              <label className={label}>
                Deployment Start Date (Real Savings Start)
                <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">
                  Phase 3
                </span>
                <span className="ml-1 font-normal text-slate-400">
                  — when PPAP validated and Longrun/new parts entered production
                </span>
              </label>
              <input
                type="date"
                className={inp}
                value={form.real_start_date}
                onChange={(e) => set("real_start_date", e.target.value)}
              />
              {form.real_start_date &&
                opp.planned_start_date &&
                form.real_start_date !== opp.planned_start_date && (
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    ⚠ Differs from planned start (
                    {fmtDate(opp.planned_start_date)}) — saving will
                    automatically rebuild the monthly profile.
                  </p>
                )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>
              Budget Status
              {!budgetEditable && (
                <span className="ml-1.5 text-[9px] text-amber-600 font-semibold">
                  (settable after Phase 0 Go)
                </span>
              )}
            </label>
            {budgetEditable ? (
              <>
                <select
                  className={inp}
                  value={form.budget_status}
                  onChange={(e) => set("budget_status", e.target.value)}
                >
                  <option>Outside Budget</option>
                  <option>Budgeted</option>
                </select>
                {opp.budget_confirmed_at && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Last confirmed {fmtDate(opp.budget_confirmed_at)}
                    {opp.budget_confirmed_by ? ` by ${opp.budget_confirmed_by}` : ""}
                  </p>
                )}
                {form.budget_status === "Budgeted" && (
                  <p
                    className={`mt-1 text-[10.5px] font-medium ${
                      budgetYearRequired ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {budgetYearRequired
                      ? "Enter Budget Year before saving this opportunity as Budgeted."
                      : `Budgeted for ${form.budget_year}.`}
                  </p>
                )}
                {form.budget_status !== opp.budget_status && (
                  <p className="mt-1 text-[10.5px] text-blue-600 font-medium">
                    ℹ Change will be timestamped automatically on save.
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Budget status can only be set after Phase 0 Go validation.
              </div>
            )}
          </div>
          <div>
            <label className={label}>
              Change Mode{" "}
              <span className="font-normal text-slate-400">
                — confirmed in Phase 1 by PM
              </span>
            </label>
            <select
              className={inp}
              value={normalizeChangeMode(form.change_mode)}
              onChange={(e) => set("change_mode", e.target.value)}
            >
              <option value="">— To be confirmed in Phase 1 —</option>
              <option>Standard</option>
              <option>Silent</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <label className={label}>Assumptions Summary</label>
        <textarea
          rows={3}
          className={`${inp} resize-none`}
          placeholder="Volumes, prices, timing, etc."
          value={form.assumptions_summary}
          onChange={(e) => set("assumptions_summary", e.target.value)}
        />
      </div>
      {/* Alert recipients — required for delay alerts and escalations */}
      {(!form.purchasing_owner || !form.conversion_owner) && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>
            <strong>Purchasing Owner and Conversion Owner are required</strong>{" "}
            to receive missing data alerts and escalation emails.
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>
            Purchasing Owner
            <span className="ml-1 text-red-400">*</span>
            <span className="ml-1.5 font-normal text-slate-400">
              — receives tracking alerts
            </span>
          </label>
          <input
            type="email"
            className={`${inp} ${!form.purchasing_owner ? "border-amber-300 focus:border-amber-400" : ""}`}
            placeholder="purchasing.manager@avocarbon.com"
            value={form.purchasing_owner}
            onChange={(e) => set("purchasing_owner", e.target.value)}
          />
        </div>
        <div>
          <label className={label}>
            Conversion Owner
            <span className="ml-1 text-red-400">*</span>
            <span className="ml-1.5 font-normal text-slate-400">
              — enters monthly actuals
            </span>
          </label>
          <input
            type="email"
            className={`${inp} ${!form.conversion_owner ? "border-amber-300 focus:border-amber-400" : ""}`}
            placeholder="buyer@avocarbon.com"
            value={form.conversion_owner}
            onChange={(e) => set("conversion_owner", e.target.value)}
          />
        </div>
      </div>
      {/* PLD scoring — compact */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">PLD</span>
          <div className="flex items-center gap-1.5 text-[11px]">
            {livePScore != null && <span className="text-slate-500">P=<b className="text-slate-700">{livePScore}</b></span>}
            {liveLScore != null && <span className="text-slate-400">× L=<b className="text-slate-700">{liveLScore}</b></span>}
            {liveDScore != null && <span className="text-slate-400">× D=<b className="text-slate-700">{liveDScore}</b></span>}
            {pScore != null ? (
              <>
                <span className="text-slate-400">=</span>
                <span className="font-black text-blue-700 text-sm">{pScore}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pldColor(pCat)}`}>{pCat}</span>
              </>
            ) : (
              <span className="text-slate-300 text-[10px]">incomplete</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px]">
          {/* P */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-black text-blue-700">P</span>
              <span className="text-slate-500 font-medium">Pay-back</span>
            </div>
            <div className="rounded bg-white border border-slate-100 px-2 py-1 text-[10px]">
              {_pldHasInvData ? (
                <span className={`font-semibold ${livePScore! <= 2 ? "text-emerald-600" : livePScore! >= 4 ? "text-red-500" : "text-amber-500"}`}>
                  {_pldPaybackMonths === 0 ? "0 mo." : _pldPaybackMonths >= 999 ? "∞" : `${_pldPaybackMonths.toFixed(1)} mo.`}
                  {livePScore != null && <span className="ml-1 text-slate-400">→ {livePScore}</span>}
                </span>
              ) : (
                <span className="text-slate-300">fill costs + saving</span>
              )}
            </div>
            <div className="text-[9px] text-slate-400 space-y-0.5">
              {([["0 mo.", "1 ★"], ["≤2 mo.", "2"], ["≤4 mo.", "3"], ["≤12 mo.", "4"], [">12 mo.", "5"]] as [string, string][]).map(([v, s]) => (
                <div key={s} className={`flex justify-between px-1 rounded ${String(livePScore) === s.replace(" ★","") ? "bg-blue-50 text-blue-600 font-semibold" : ""}`}>
                  <span>{v}</span><span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* L */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-black text-blue-700">L</span>
              <span className="text-slate-500 font-medium">Lead-time</span>
            </div>
            <div className="rounded bg-white border border-slate-100 px-2 py-1 text-[10px]">
              {_pldTotalWeeks > 0 ? (
                <span className={`font-semibold ${liveLScore! <= 2 ? "text-emerald-600" : liveLScore! >= 4 ? "text-red-500" : "text-amber-500"}`}>
                  {_pldTotalWeeks} wks = {_pldLeadMonths.toFixed(1)} mo.
                  {liveLScore != null && <span className="ml-1 text-slate-400">→ {liveLScore}</span>}
                </span>
              ) : (
                <span className="text-slate-300">fill phase weeks</span>
              )}
            </div>
            <div className="text-[9px] text-slate-400 space-y-0.5">
              {([["<1m", "1 ★"], ["<2m", "2"], ["<4m", "3"], ["<6m", "4"], ["≥6m", "5"]] as [string, string][]).map(([v, s]) => (
                <div key={s} className={`flex justify-between px-1 rounded ${String(liveLScore) === s.replace(" ★","") ? "bg-blue-50 text-blue-600 font-semibold" : ""}`}>
                  <span>{v}</span><span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* D */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-black text-blue-700">D</span>
              <span className="text-slate-500 font-medium">Difficulty</span>
            </div>
            <select
              className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] outline-none focus:border-blue-300"
              value={liveDScore ?? ""}
              onChange={e => set("difficulty_score", e.target.value as unknown as number)}
            >
              <option value="">— select —</option>
              <option value="1">1 — Easy</option>
              <option value="2">2 — Relatively easy</option>
              <option value="3">3 — Moderately difficult</option>
              <option value="4">4 — Difficult</option>
              <option value="5">5 — Very Difficult</option>
            </select>
            <div className="text-[9px] text-slate-400 space-y-0.5">
              {([["Easy", "1 ★"], ["Rel. easy", "2"], ["Moderate", "3"], ["Difficult", "4"], ["Very diff.", "5"]] as [string, string][]).map(([v, s]) => (
                <div key={s} className={`flex justify-between px-1 rounded ${String(liveDScore) === s.replace(" ★","") ? "bg-blue-50 text-blue-600 font-semibold" : ""}`}>
                  <span>{v}</span><span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div>
        <label className={label}>Comments</label>
        <textarea
          rows={2}
          className={`${inp} resize-none`}
          value={form.comments}
          onChange={(e) => set("comments", e.target.value)}
        />
      </div>
        </>
      )}

      {/* STP section — only Phase 0 / Phase 1, based on STP workbook structure */}
      {mode === "stp" && showStpSection && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <FileText size={11} /> STP — Sourcing and Technical Productivity
          </p>
          <p className="text-[11px] text-slate-500">
            Workbook-aligned STP inputs for Phase 0 and Phase 1 only.
          </p>
          {stpReadOnly && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              STP stays visible in this phase, but it is read-only after Phase 1.
            </div>
          )}
          <fieldset
            disabled={stpReadOnly}
            className={stpReadOnly ? "space-y-4 opacity-80" : "space-y-4"}
          >

          {/* Why checkboxes */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Why
            </label>
            <div className="flex flex-wrap gap-3">
              {[
                ["reason_productivity", "Productivity"],
                ["reason_quality", "Quality"],
                ["reason_capacity", "Capacity"],
              ].map(([k, lbl]) => (
                <label
                  key={k}
                  className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={form[k as keyof typeof form] as boolean}
                    onChange={(e) =>
                      set(k, e.target.checked as unknown as string)
                    }
                  />
                  {lbl}
                </label>
              ))}
              <input
                className={`${inp} flex-1 min-w-[120px]`}
                placeholder="Other..."
                value={form.reason_other}
                onChange={(e) => set("reason_other", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Scope IN (part numbers)</label>
              <input
                disabled={locked}
                className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                placeholder="27102500010"
                value={form.scope_in}
                onChange={(e) => set("scope_in", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Scope OUT</label>
              <input
                disabled={locked}
                className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                placeholder="NA"
                value={form.scope_out}
                onChange={(e) => set("scope_out", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Customers</label>
              <input
                className={inp}
                placeholder="Valeo, Multipe..."
                value={form.customers}
                onChange={(e) => set("customers", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>
                Annual Qty N1{" "}
                <span className="font-normal text-slate-400">
                  — used to auto-calc saving
                </span>
              </label>
              <input
                type="number"
                disabled={locked}
                className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                value={form.annual_quantity_n1}
                onChange={(e) => set("annual_quantity_n1", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Annual Qty N2</label>
              <input
                type="number"
                disabled={locked}
                className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                value={form.annual_quantity_n2}
                onChange={(e) => set("annual_quantity_n2", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Annual Qty N3</label>
              <input
                type="number"
                disabled={locked}
                className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                value={form.annual_quantity_n3}
                onChange={(e) => set("annual_quantity_n3", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Annual Qty N4</label>
              <input
                type="number"
                disabled={locked}
                className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                value={form.annual_quantity_n4}
                onChange={(e) => set("annual_quantity_n4", e.target.value)}
              />
            </div>
          </div>

          {/* Initial Step */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Initial Step
            </p>
            <p className="text-[11px] text-slate-500">
              Has the current supplier been formally given a chance to decrease
              the price?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Answer</label>
                <select
                  className={inp}
                  value={form.supplier_asked}
                  onChange={(e) => set("supplier_asked", e.target.value)}
                >
                  <option value="">— Select —</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label className={label}>Result / explanation</label>
                <input
                  className={inp}
                  placeholder="e.g. Declined to match price"
                  value={form.supplier_asked_result}
                  onChange={(e) => set("supplier_asked_result", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Current supplier class evaluation — read from existing DB (PldClassEvaluationInput) */}
          {currentSupplierEval && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                Current Supplier — Latest Class Evaluation (from panel)
              </p>
              <p className="text-[10px] text-emerald-500">
                This data is read from the existing supplier evaluation — no
                need to re-enter it.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                {[
                  ["Supplier status", "supplier_status"],
                  ["Class", "class_value_relation"],
                  ["Operational grade", "operational_grade"],
                  ["Final grade", "final_grade"],
                  ["Panel decision", "panel_decision"],
                  ["TOP (payment terms)", "top"],
                  ["LTA", "lta"],
                  ["Competitiveness", "competitiveness"],
                  ["SQMA", "sqma"],
                  ["Financial health", "financial_health"],
                  ["Geo coverage", "geo_coverage"],
                  ["Family coverage", "family_coverage"],
                ].map(([lbl, key]) =>
                  currentSupplierEval[key] != null ? (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-slate-400 w-36 shrink-0">
                        {lbl}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {String(currentSupplierEval[key])}
                      </span>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          )}

          {/* Supplier before/after — full STP comparison */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Supplier Comparison (Before → After)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Current Supplier — Before</label>
                {isPhase0 ? (
                  <>
                    <select
                      className={inp}
                      value={form.supplier_id}
                      onChange={(e) => set("supplier_id", e.target.value)}
                    >
                      <option value="">— Select current supplier —</option>
                      {suppliersForPlant.map((s) => (
                        <option key={s.id_supplier_unit} value={s.id_supplier_unit}>
                          {[s.group_name, s.supplier_code, s.city].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                    </select>
                    {suppliersForPlant.length === 0 && opp.plant_id && (
                      <p className="text-[10px] text-amber-500 mt-1">No suppliers linked to this plant yet.</p>
                    )}
                  </>
                ) : (
                  (() => {
                    const before = suppliersForPlant.find(
                      (s) => s.id_supplier_unit === (opp.supplier_id ?? parseInt(form.supplier_id || "0")),
                    );
                    return (
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 min-h-[28px]">
                        {before
                          ? [before.group_name, before.supplier_code, before.city].filter(Boolean).join(" · ")
                          : opp.supplier_id ? `ID ${opp.supplier_id}` : "—"}
                      </div>
                    );
                  })()
                )}
              </div>
              <div>
                <label className={label}>Proposed New Supplier — After</label>
                {isPhase0 ? (
                  <>
                    <input
                      className={inp}
                      placeholder="Longrun, Haihe... (free text in Phase 0)"
                      value={form.proposed_supplier_name}
                      onChange={(e) =>
                        set("proposed_supplier_name", e.target.value)
                      }
                    />
                    <p className="text-[9.5px] text-slate-400 mt-0.5">
                      Free text in Phase 0 — link to panel from Phase 1
                    </p>
                  </>
                ) : (
                  <>
                    <select
                      className={inp}
                      value={form.proposed_supplier_id}
                      onChange={(e) =>
                        set("proposed_supplier_id", e.target.value)
                      }
                    >
                      <option value="">— Select from panel —</option>
                      {suppliersForPlant.map((s) => (
                        <option key={s.id_supplier_unit} value={s.id_supplier_unit}>
                          {[s.group_name, s.supplier_code, s.city]
                            .filter(Boolean)
                            .join(" · ")}
                        </option>
                      ))}
                    </select>
                    {opp.proposed_supplier_name && (
                      <p className="text-[9.5px] text-slate-400 mt-0.5">
                        Phase 0 candidate:{" "}
                        <span className="font-medium text-slate-600">
                          {opp.proposed_supplier_name}
                        </span>
                      </p>
                    )}
                    {suppliersForPlant.length === 0 && opp.plant_id && (
                      <p className="text-[10px] text-amber-500 mt-1">
                        No suppliers linked to this plant yet.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            {/* Logistics: Before / After table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 w-1/3">
                      Field
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">
                      Before
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">
                      After
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Country — Before is derived from the selected supplier (form.supplier_id) */}
                  {(() => {
                    const currentSupplierCountry =
                      suppliersForPlant.find(
                        (s) => s.id_supplier_unit === (parseInt(form.supplier_id || "0") || opp.supplier_id),
                      )?.city ?? null;
                    return (
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-semibold text-slate-500">
                          Country
                        </td>
                        <td className="px-3 py-1.5">
                          {currentSupplierCountry ? (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                              {currentSupplierCountry}{" "}
                              <span className="font-normal text-emerald-500">
                                (from panel)
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">
                              Select supplier above
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300"
                            placeholder="China"
                            value={form.country_after}
                            onChange={(e) =>
                              set("country_after", e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    );
                  })()}
                  {(
                    [
                      [
                        "incoterms_before",
                        "incoterms_after",
                        "Incoterms",
                        "DDP",
                        "EXW",
                      ],
                      [
                        "top_days_before",
                        "top_days_after",
                        "TOP (days)",
                        "45",
                        "105",
                      ],
                      [
                        "transit_days_before",
                        "transit_days_after",
                        "Transit time (days)",
                        "3",
                        "6",
                      ],
                      [
                        "bonus_before",
                        "bonus_after",
                        "Bonus / business link",
                        "0",
                        "0",
                      ],
                    ] as [string, string, string, string, string][]
                  ).map(([kb, ka, lbl, ph1, ph2]) => (
                    <tr key={kb} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-slate-500">
                        {lbl}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300"
                          placeholder={ph1}
                          value={form[kb as keyof typeof form] as string}
                          onChange={(e) => set(kb, e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300"
                          placeholder={ph2}
                          value={form[ka as keyof typeof form] as string}
                          onChange={(e) => set(ka, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  {/* Consignment — Yes/No selects (needed for inventory gap formula) */}
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-semibold text-slate-500">
                      Consignment
                    </td>
                    {(["consignment_before", "consignment_after"] as const).map((k) => (
                      <td key={k} className="px-3 py-1.5">
                        <select
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                          value={form[k as keyof typeof form] as string}
                          onChange={(e) => set(k, e.target.value)}
                        >
                          <option value="">—</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>
                    ))}
                  </tr>
                  {(
                    [
                      [
                        "current_price",
                        "proposed_price",
                        "Price (€/unit)",
                        "0.4000",
                        "0.1300",
                      ],
                      ["current_price_n1", "proposed_price_n1", "Price N+1", "0.3880", "0.1261"],
                      ["current_price_n2", "proposed_price_n2", "Price N+2", "0.3762", "0.1223"],
                      ["current_price_n3", "proposed_price_n3", "Price N+3", "0.3650", "0.1186"],
                    ] as [string, string, string, string, string][]
                  ).map(([kb, ka, lbl, ph1, ph2]) => (
                    <tr key={ka} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-slate-500">
                        {lbl}
                      </td>
                      <td className="px-3 py-1.5">
                        {kb ? (
                          <input
                            type="number"
                            step="0.000001"
                            disabled={locked}
                            className={`w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 ${locked ? "bg-slate-100" : ""}`}
                            placeholder={ph1}
                            value={form[kb as keyof typeof form] as string}
                            onChange={(e) => set(kb, e.target.value)}
                          />
                        ) : (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          step="0.000001"
                          disabled={locked && kb === "current_price"}
                          className={`w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 ${locked && kb === "current_price" ? "bg-slate-100" : ""}`}
                          placeholder={ph2}
                          value={form[ka as keyof typeof form] as string}
                          onChange={(e) => set(ka, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!locked &&
                form.current_price &&
                form.proposed_price &&
                form.annual_quantity_n1 && (
                  <p className="mt-1 text-[10px] text-emerald-600 font-semibold px-3">
                    Auto-calculated saving: (€
                    {parseFloat(form.current_price).toFixed(4)} − €
                    {parseFloat(form.proposed_price).toFixed(4)}) ×{" "}
                    {parseInt(form.annual_quantity_n1).toLocaleString()} ={" "}
                    <strong>€{autoSaving?.toLocaleString()}/year</strong>
                  </p>
                )}
            </div>
          </div>

          {/* Risks */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Risks
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 w-1/3">Risk</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Before</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">After</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["risk_material_indexation_before", "risk_material_indexation_after", "Material indexation"],
                    ["risk_exchange_rate_before", "risk_exchange_rate_after", "Exchange rate"],
                    ["risk_local_content_before", "risk_local_content_after", "Local content"],
                    ["risk_quality_before", "risk_quality_after", "Quality"],
                    ["risk_other_before", "risk_other_after", "Other"],
                  ] as [string, string, string][]).map(([kb, ka, lbl]) => (
                    <tr key={kb} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-slate-500">{lbl}</td>
                      <td className="px-3 py-1.5">
                        <input
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300"
                          placeholder="e.g. 5%"
                          value={form[kb as keyof typeof form] as string}
                          onChange={(e) => set(kb, e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300"
                          placeholder="e.g. hedged"
                          value={form[ka as keyof typeof form] as string}
                          onChange={(e) => set(ka, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  {([
                    ["material_same_spec", "Will material spec & appearance be the same?"],
                    ["same_tooling", "Same tooling?"],
                    ["same_dimension", "Same dimensions & appearance?"],
                  ] as [string, string][]).map(([k, lbl]) => (
                    <tr key={k} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-slate-500 col-span-2">{lbl}</td>
                      <td className="px-3 py-1.5" colSpan={2}>
                        <select
                          className="w-40 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                          value={form[k as keyof typeof form] as string}
                          onChange={(e) => set(k, e.target.value)}
                        >
                          <option value="">—</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Benefits */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Benefits
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>If we do</label>
                <textarea
                  rows={2}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 resize-none"
                  placeholder="Expected benefits if we proceed..."
                  value={form.benefit_if_we_do}
                  onChange={(e) => set("benefit_if_we_do", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>If we don't</label>
                <textarea
                  rows={2}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 resize-none"
                  placeholder="Risk of not proceeding..."
                  value={form.benefit_if_not}
                  onChange={(e) => set("benefit_if_not", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Investment costs */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Investment Costs
            </p>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className={label}>Tooling (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inp}
                  value={form.tooling_cost}
                  onChange={(e) => set("tooling_cost", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Travel (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inp}
                  value={form.travel_cost}
                  onChange={(e) => set("travel_cost", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Qualification (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inp}
                  value={form.qualification_cost}
                  onChange={(e) => set("qualification_cost", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Other (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inp}
                  value={form.other_cost}
                  onChange={(e) => set("other_cost", e.target.value)}
                />
              </div>
            </div>
            {opp.total_investment != null && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                <span className="text-slate-500">
                  Total investment:{" "}
                  <strong>€{opp.total_investment.toLocaleString()}</strong>
                </span>
                {opp.roi_percent != null && (
                  <span className="text-emerald-600 font-bold">
                    ROI: {opp.roi_percent}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Planning */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Estimated Planning (weeks)
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[
                ["phase1_weeks", "Phase 1"],
                ["phase2_weeks", "Phase 2"],
                ["phase3_weeks", "Phase 3"],
                ["phase4_weeks", "Phase 4"],
              ].map(([k, lbl]) => (
                <div key={k}>
                  <label className={label}>{lbl}</label>
                  <input
                    type="number"
                    min="1"
                    className={inp}
                    value={form[k as keyof typeof form] as string}
                    onChange={(e) => set(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
          </fieldset>
        </div>
      )}

      {mode === "stp" && !showStpSection && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          STP is available only for Sourcing or Technical Productivity opportunities.
        </div>
      )}

      <div className="pt-2">
        {error && (
          <div className="mb-3 flex justify-end">
            <p className="max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 shadow-sm">
              {error}
            </p>
          </div>
        )}
        <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={loading || (mode === "stp" && stpReadOnly)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading && <RefreshCw size={13} className="animate-spin" />} Save
          Changes
        </button>
        </div>
      </div>
    </form>
  );
}

function GateTab({
  opp,
  userEmail,
  onRefresh,
  onNavigate,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
  onNavigate: (tab: Tab) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Start study
  const [showStart, setShowStart] = useState(false);
  // Submit for validation (Phase 0)
  const [showSubmitP0, setShowSubmitP0] = useState(false);
  const [submitP0Form, setSubmitP0Form] = useState({
    to_emails: "",
    message: "",
  });
  // Submit to committee (Phase 1)
  const [showSubmitP1, setShowSubmitP1] = useState(false);
  const [submitP1Form, setSubmitP1Form] = useState({
    to_emails: "",
    committee_type: "Full Committee",
    message: "",
  });
  // Gate decision
  const [decision, setDecision] = useState<"Go" | "No Go" | "Review">("Go");
  const [pm, setPm] = useState(opp.project_owner ?? "");
  const [comments, setComments] = useState("");
  const [showGate, setShowGate] = useState(false);

  const isAssigned = opp.status === "Assigned";
  const isWorkingOn =
    opp.status === "Working on it" || opp.status === "Needs Rework";
  const isAwaitingP0 =
    opp.status === "Awaiting Validation" && opp.phase_status === "Phase 0";
  const isPhase1Working =
    opp.phase_status === "Phase 1" &&
    (opp.status === "Working on it" || opp.status === "Needs Rework");
  const isUnderCommittee = opp.status === "Under Committee Review";
  const canApplyGate =
    isAwaitingP0 ||
    isUnderCommittee ||
    ["Phase 2", "Phase 3", "Phase 4"].includes(opp.phase_status ?? "");
  const isClosed = opp.phase_status === "Closed";
  const needsPm =
    decision === "Go" &&
    opp.opportunity_type &&
    !["Negotiation", "Cash"].includes(opp.opportunity_type) &&
    opp.phase_status === "Phase 0";
  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  // ── Pre-submission validation checks ──────────────────────────────
  // Phase 0 → PM validation: what must be filled
  const phase0Checks = [
    {
      ok: !!opp.expected_annual_saving && opp.expected_annual_saving > 0,
      label: "Est. Annual Saving is required",
    },
    {
      ok: !!opp.duration_months && opp.duration_months > 0,
      label: "Duration (months) is required",
    },
    { ok: !!opp.planned_start_date, label: "Planned Start Date is required" },
    { ok: !!opp.assumptions_summary, label: "Assumptions Summary is required" },
    {
      ok: !!opp.purchasing_owner,
      label: "Purchasing Owner required (needed for alerts)",
    },
    {
      ok: !!opp.conversion_owner,
      label: "Conversion Owner required (needed for alerts)",
    },
    ...(!["Negotiation", "Cash"].includes(opp.opportunity_type ?? "")
      ? [
          {
            ok: !!opp.plant_id,
            label: "Plant selected (Sourcing / Technical)",
          },
          { ok: !!opp.scope_in, label: "Scope IN required (part number)" },
          {
            ok: !!opp.proposed_supplier_name,
            label: "Proposed supplier name required",
          },
          {
            ok: !!opp.current_price && !!opp.proposed_price,
            label: "Before/After unit prices required",
          },
        ]
      : []),
  ];
  const phase0Missing = phase0Checks.filter((c) => !c.ok);

  // Phase 1 → Committee: what must be filled
  const proj0 = opp.projects[0];
  const phase1Checks = [
    {
      ok: !!proj0?.phase_output_notes,
      label: "Phase 1 output notes filled (Project tab)",
    },
    {
      ok: !!proj0?.committee_review_date,
      label: "Committee review date filled (Project tab)",
    },
    {
      ok: !!proj0?.committee_members,
      label: "Committee members filled (Project tab)",
    },
    {
      ok: opp.opp_documents.some(
        (d) =>
          d.phase_label?.includes("STP") || d.phase_label?.includes("Phase 1"),
      ),
      label: "STP or Phase 1 document uploaded (Files tab)",
    },
    {
      ok: !!opp.change_mode,
      label: "Change Mode confirmed (Standard or Silent)",
    },
  ];
  const phase1Missing = phase1Checks.filter((c) => !c.ok);

  const act = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (isClosed)
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        This opportunity is closed.
      </div>
    );

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Status context bar */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p>
              <span className="font-semibold text-slate-500">Phase:</span>{" "}
              <span className="font-bold text-slate-800">
                {opp.phase_status}
              </span>
            </p>
            <p>
              <span className="font-semibold text-slate-500">Status:</span>{" "}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[opp.status ?? ""] ?? "bg-slate-100 text-slate-600"}`}
              >
                {opp.status}
              </span>
            </p>
            {opp.validation_decision && (
              <p>
                <span className="font-semibold text-slate-500">Last gate:</span>{" "}
                <span className="font-bold">{opp.validation_decision}</span>{" "}
                {opp.val_date ? `on ${fmtDate(opp.val_date)}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* STEP 1 — Phase 0: Start Study (Assigned → Working on it) */}
      {isAssigned && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-bold text-blue-700 mb-1">
            Step 1 — Start Phase 0 Study
          </p>
          <p className="text-[11px] text-blue-600 mb-3">
            Click to change status from <strong>Assigned</strong> to{" "}
            <strong>Working on it</strong> and begin the Opportunity Study.
          </p>
          <button
            disabled={loading}
            onClick={() =>
              act(async () => {
                const res = await supplierAPI.startStudy(
                  opp.opportunity_id,
                  userEmail,
                );
                onRefresh(res.data as Opp);
                const updatedOpp = res.data as Opp;
                onNavigate(["Sourcing", "Technical Productivity"].includes(updatedOpp.opportunity_type ?? "") ? "stp" : "edit");
              })
            }
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <CircleDot size={13} />
            )}{" "}
            Start Phase 0 Study
          </button>
        </div>
      )}

      {/* STEP 2 — Phase 0: Submit to PM for gate review */}
      {isWorkingOn && opp.phase_status === "Phase 0" && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-3">
          {/* Pre-submission checklist — Phase 0 */}
          {phase0Missing.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-white p-3 space-y-1.5">
              <p className="text-[10.5px] font-bold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle size={11} /> {phase0Missing.length} item
                {phase0Missing.length > 1 ? "s" : ""} missing before submission:
              </p>
              {phase0Missing.map((c, i) => (
                <p
                  key={i}
                  className="flex items-start gap-1.5 text-[11px] text-amber-600"
                >
                  <span className="shrink-0 text-amber-400">✗</span> {c.label}
                </p>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={11} /> All checks passed — ready to submit to
              PM
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-700">
              Step 2 — Submit Phase 0 for PM Validation
            </p>
            <button
              onClick={() => setShowSubmitP0((s) => !s)}
              className="text-[11px] font-semibold text-amber-600 hover:underline"
            >
              {showSubmitP0 ? "Hide" : "Open →"}
            </button>
          </div>
          <p className="text-[11px] text-amber-600">
            Sends the Opportunity Study to the Purchasing Manager for Go / No Go
            / Review gate decision.
          </p>
          {opp.validation_request_sent_at && (
            <p className="text-[10px] text-amber-500">
              Last sent: {fmtDate(opp.validation_request_sent_at)}
            </p>
          )}
          {showSubmitP0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const emails = submitP0Form.to_emails
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (!emails.length)
                    throw new Error("At least one PM email required.");
                  const res = await supplierAPI.submitForValidation(
                    opp.opportunity_id,
                    {
                      to_emails: emails,
                      message: submitP0Form.message || undefined,
                      submitted_by: userEmail,
                    },
                  );
                  onRefresh(res.data as Opp);
                  setShowSubmitP0(false);
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                  Purchasing Manager email(s) *
                </label>
                <input
                  required
                  className={inp}
                  placeholder="pm@avocarbon.com"
                  value={submitP0Form.to_emails}
                  onChange={(e) =>
                    setSubmitP0Form((f) => ({
                      ...f,
                      to_emails: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                  Message (optional)
                </label>
                <textarea
                  rows={2}
                  className={`${inp} resize-none`}
                  value={submitP0Form.message}
                  onChange={(e) =>
                    setSubmitP0Form((f) => ({ ...f, message: e.target.value }))
                  }
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {loading ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Mail size={13} />
                )}{" "}
                Submit for Validation
              </button>
            </form>
          )}
        </div>
      )}

      {/* STEP 3 — Phase 1: Submit to Sourcing Committee */}
      {isPhase1Working && (
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 space-y-3">
          {/* Pre-submission checklist — Phase 1 */}
          {phase1Missing.length > 0 ? (
            <div className="rounded-xl border border-purple-200 bg-white p-3 space-y-1.5">
              <p className="text-[10.5px] font-bold text-purple-700 flex items-center gap-1.5">
                <AlertTriangle size={11} /> {phase1Missing.length} item
                {phase1Missing.length > 1 ? "s" : ""} missing before committee
                submission:
              </p>
              {phase1Missing.map((c, i) => (
                <p
                  key={i}
                  className="flex items-start gap-1.5 text-[11px] text-purple-600"
                >
                  <span className="shrink-0 text-purple-400">✗</span> {c.label}
                </p>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={11} /> All checks passed — ready to submit to
              committee
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-purple-700">
              Submit Phase 1 to Sourcing Committee
            </p>
            <button
              onClick={() => setShowSubmitP1((s) => !s)}
              className="text-[11px] font-semibold text-purple-600 hover:underline"
            >
              {showSubmitP1 ? "Hide" : "Open →"}
            </button>
          </div>
          <p className="text-[11px] text-purple-600">
            Sends the Feasibility Dossier to the committee (CEO · COO · Plant
            Manager · CDP · Purchasing).
          </p>
          {showSubmitP1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const emails = submitP1Form.to_emails
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  // Email optional — Olivier: PM organises meeting manually
                  const res = await supplierAPI.submitToCommittee(
                    opp.opportunity_id,
                    {
                      to_emails: emails.length ? emails : undefined,
                      committee_type: submitP1Form.committee_type,
                      message: submitP1Form.message || undefined,
                      submitted_by: userEmail,
                    },
                  );
                  onRefresh(res.data as Opp);
                  setShowSubmitP1(false);
                });
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Committee emails <span className="font-normal text-slate-400">(optional — PM organises meeting)</span>
                  </label>
                  <input
                    className={inp}
                    placeholder="ceo@..., coo@..., pm@..."
                    value={submitP1Form.to_emails}
                    onChange={(e) =>
                      setSubmitP1Form((f) => ({
                        ...f,
                        to_emails: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Committee type
                  </label>
                  <select
                    className={inp}
                    value={submitP1Form.committee_type}
                    onChange={(e) =>
                      setSubmitP1Form((f) => ({
                        ...f,
                        committee_type: e.target.value,
                      }))
                    }
                  >
                    <option>Full Committee</option>
                    <option>Restricted Committee</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                  Message (optional)
                </label>
                <textarea
                  rows={2}
                  className={`${inp} resize-none`}
                  value={submitP1Form.message}
                  onChange={(e) =>
                    setSubmitP1Form((f) => ({ ...f, message: e.target.value }))
                  }
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {loading ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Mail size={13} />
                )}{" "}
                Submit to Committee
              </button>
            </form>
          )}
        </div>
      )}

      {/* Awaiting review banners */}
      {isAwaitingP0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <p className="font-bold flex items-center gap-1.5">
            <Clock size={12} /> Awaiting PM Validation
          </p>
          <p className="mt-0.5">
            Submitted{" "}
            {opp.validation_request_sent_at
              ? fmtDate(opp.validation_request_sent_at)
              : ""}
            . The Purchasing Manager must apply their gate decision below.
          </p>
        </div>
      )}
      {isUnderCommittee && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-xs text-purple-700">
          <p className="font-bold flex items-center gap-1.5">
            <Users size={12} /> Under Committee Review
          </p>
          <p className="mt-0.5">
            Feasibility dossier submitted to committee. Apply the committee's
            gate decision below once received.
          </p>
        </div>
      )}
      {opp.status === "Needs Rework" && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-700">
          <p className="font-bold">
            Needs Rework — review comments in the history below, then resubmit.
          </p>
        </div>
      )}

      {/* GATE DECISION — visible to reviewer/PM after submission */}
      {(canApplyGate ||
        ["Phase 2", "Phase 3", "Phase 4"].includes(opp.phase_status ?? "")) && (
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-700">
              Gate Decision ({opp.phase_status})
            </p>
            <button
              onClick={() => setShowGate((s) => !s)}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              {showGate ? "Hide" : "Apply decision →"}
            </button>
          </div>
          {!showGate && (
            <p className="text-[11px] text-slate-400">
              Click "Apply decision" to record Go / No Go / Review.
            </p>
          )}
          {showGate && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const res = await supplierAPI.applyGateDecision(
                    opp.opportunity_id,
                    {
                      decision,
                      decided_by: userEmail,
                      comments: comments || undefined,
                      project_manager: pm || undefined,
                    },
                  );
                  onRefresh(res.data as Opp);
                  setComments("");
                  setPm("");
                  const updated = res.data as Opp;
                  if (decision === "Go") {
                    if (updated.phase_status === "Phase 1") onNavigate("project");
                    else if (["Phase 2", "Phase 3", "Phase 4"].includes(updated.phase_status ?? "")) onNavigate("financial");
                  } else if (decision === "No Go") {
                    onNavigate("overview");
                  }
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-2">
                {(["Go", "No Go", "Review"] as const).map((d) => (
                  <label
                    key={d}
                    className={`flex items-center justify-center gap-1.5 cursor-pointer rounded-xl border-2 py-3 text-sm font-bold transition-all ${
                      decision === d
                        ? d === "Go"
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : d === "No Go"
                            ? "border-red-400 bg-red-50 text-red-700"
                            : "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="gate"
                      value={d}
                      checked={decision === d}
                      onChange={() => setDecision(d)}
                      className="sr-only"
                    />
                    {d === "Go" ? (
                      <CheckCircle2 size={14} />
                    ) : d === "No Go" ? (
                      <XCircle size={14} />
                    ) : (
                      <AlertTriangle size={14} />
                    )}{" "}
                    {d}
                  </label>
                ))}
              </div>
              {needsPm && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Project Manager email *
                  </label>
                  <input
                    required
                    type="email"
                    className={inp}
                    value={pm}
                    onChange={(e) => setPm(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  {decision === "No Go"
                    ? "Rejection reason (required for audit)"
                    : decision === "Review"
                      ? "What needs to be reworked?"
                      : "Decision comments"}
                </label>
                <textarea
                  rows={3}
                  className={`${inp} resize-none`}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-[10.5px] text-slate-500">
                {decision === "Go" && opp.phase_status === "Phase 0" && (
                  <>
                    ✓ Will validate opportunity · Create Financial Line
                    {!["Negotiation", "Cash"].includes(
                      opp.opportunity_type ?? "",
                    )
                      ? " · Create Project"
                      : ""}{" "}
                    · Advance to Phase 1
                  </>
                )}
                {decision === "Go" && opp.phase_status === "Phase 1" && (
                  <>✓ Advance to Phase 2 — Enable execution tracking</>
                )}
                {decision === "No Go" && (
                  <>✗ Opportunity will be closed and cancelled — irreversible</>
                )}
                {decision === "Review" && (
                  <>
                    ↩ Send back for rework — submitter must correct and resubmit
                  </>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${decision === "Go" ? "bg-emerald-600 hover:bg-emerald-700" : decision === "No Go" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}
              >
                {loading && <RefreshCw size={13} className="animate-spin" />}{" "}
                Apply {decision}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Audit trail from comments */}
      {opp.comments && opp.comments.includes("[") && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Decision History
          </p>
          <div className="space-y-1">
            {opp.comments
              .split("\n")
              .filter((l) => l.trim().startsWith("["))
              .map((line, i) => (
                <p
                  key={i}
                  className="text-[11px] text-slate-600 bg-slate-50 rounded px-3 py-1.5"
                >
                  {line.trim()}
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

const OUTCOME_CONFIG: Record<string, { label: string; color: string }> = {
  Continue: { label: "Continue", color: "bg-emerald-100 text-emerald-700" },
  Recover: { label: "Recover", color: "bg-amber-100 text-amber-700" },
  Escalate: { label: "Escalate", color: "bg-red-100 text-red-700" },
};

// Phase-aware context for the financial tab
const FINANCIAL_PHASE_CONTEXT: Record<
  string,
  {
    color: string;
    title: string;
    guidance: string;
    canRevise: boolean;
    showActuals: boolean;
  }
> = {
  "Phase 0": {
    color: "blue",
    title: "Baseline Created",
    guidance:
      "Financial line just created. No actuals expected yet — implementation has not started.",
    canRevise: false,
    showActuals: false,
  },
  "Phase 1": {
    color: "blue",
    title: "Feasibility Phase",
    guidance:
      "No actuals expected yet. If the committee validates a revised saving figure, update the baseline below — monthly expected profile will rebuild.",
    canRevise: true,
    showActuals: false,
  },
  "Phase 2": {
    color: "indigo",
    title: "Execution Phase",
    guidance:
      "Execution is in progress. Prepare the deployment timing here, but monthly actuals stay read-only until Phase 3 starts.",
    canRevise: false,
    showActuals: true,
  },
  "Phase 3": {
    color: "purple",
    title: "Deployment Phase",
    guidance:
      "Main savings period. Monthly actuals should reflect deployment progress. Enter actuals every month and update EOY Forecast after each review.",
    canRevise: false,
    showActuals: true,
  },
  "Phase 4": {
    color: "teal",
    title: "Closure Phase",
    guidance:
      "Closure phase. Review the final Phase 3 actuals, confirm the outcome, then mark the financial line complete.",
    canRevise: false,
    showActuals: true,
  },
};

function FinancialTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const [editRow, setEditRow] = useState<number | null>(null);
  const [rowForm, setRowForm] = useState({
    actual_saving: "",
    cash_actual: "",
    forecast_eoy_saving: "",
    forecast_comment: "",
    comment: "",
    monthly_outcome: "Continue",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEscalate, setShowEscalate] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [pendingRecoveryPrompt, setPendingRecoveryPrompt] = useState(false);
  const [escalateForm, setEscalateForm] = useState({
    escalation_reason: "",
    extra_recipients: "",
  });
  const [recoveryForm, setRecoveryForm] = useState({
    recovery_status: "Planned",
    recovery_note: "",
    recovery_target_date: "",
    recovery_amount: "",
  });
  // Phase 1: revise baseline saving
  const [showRevise, setShowRevise] = useState(false);
  const [revisedSaving, setRevisedSaving] = useState("");
  const [reviseNote, setReviseNote] = useState("");

  const phaseCtx =
    FINANCIAL_PHASE_CONTEXT[opp.phase_status ?? ""] ??
    FINANCIAL_PHASE_CONTEXT["Phase 3"];
  const canEditFinancialRows = opp.phase_status === "Phase 3";
  const todayFirstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );
  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  if (!opp.financial_lines.length) {
    return (
      <div className="py-12 text-center">
        <BarChart2 size={28} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-500 font-semibold">
          No financial line yet
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Created automatically when Phase 0 Go is applied.
        </p>
      </div>
    );
  }

  const isBudgeted = opp.budget_status === "Budgeted";

  // One financial line per opportunity (Olivier: one STP = one opportunity = one financial line)
  const line = opp.financial_lines[0];
  const rows = [...(line?.monthly_financials ?? [])].sort((a, b) =>
    (a.period_month ?? "").localeCompare(b.period_month ?? ""),
  );
  const isCompleted = line?.status === "Completed";
  const convRate =
    line?.expected_annual_saving && toNum(line.cumulated_real_saving) > 0
      ? Math.round(
          (toNum(line.cumulated_real_saving) /
            toNum(line.expected_annual_saving)) *
            100,
        )
      : null;

  // Gap 1 — Year split: aggregate monthly rows by calendar year
  const yearBreakdown = rows.reduce<
    Record<number, { expected: number; actual: number; budget: number }>
  >((acc, row) => {
    if (!row.period_month) return acc;
    const yr = new Date(row.period_month).getFullYear();
    if (!acc[yr])
      acc[yr] = {
        expected: 0,
        actual: 0,
        budget:
          (toNum(line.budget_value) / toNum(line.duration_months || 12)) * 12,
      };
    acc[yr].expected += toNum(row.expected_saving);
    if (row.actual_saving != null) acc[yr].actual += toNum(row.actual_saving);
    return acc;
  }, {});
  const yearEntries = Object.entries(yearBreakdown).sort(
    ([a], [b]) => Number(a) - Number(b),
  );

  // Gap 3 — cash tracking visible for Cash/Negotiation type
  const showCash =
    ["Cash", "Negotiation"].includes(opp.opportunity_type ?? "") &&
    rows.some((r) => r.cash_expected != null);

  async function saveRow(monthId: number) {
    if (!canEditFinancialRows) {
      setError("Monthly financial rows can only be edited in Phase 3.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.updateMonthlyActual(monthId, {
        actual_saving: rowForm.actual_saving
          ? parseFloat(rowForm.actual_saving)
          : undefined,
        cash_actual: rowForm.cash_actual
          ? parseFloat(rowForm.cash_actual)
          : undefined,
        forecast_eoy_saving: rowForm.forecast_eoy_saving
          ? parseFloat(rowForm.forecast_eoy_saving)
          : undefined,
        forecast_comment: rowForm.forecast_comment || undefined,
        comment: rowForm.comment || undefined,
        monthly_outcome: rowForm.monthly_outcome || undefined,
        updated_by: userEmail,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setEditRow(null);
      // Auto-prompt recovery form when outcome = Recover and no plan yet
      if (rowForm.monthly_outcome === "Recover") {
        const updatedLine = (res.data as Opp).financial_lines[0];
        if (!updatedLine?.recovery_status || updatedLine.recovery_status === "Done") {
          setPendingRecoveryPrompt(true);
          setShowRecovery(true);
          setShowEscalate(false);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleEscalate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const extra = escalateForm.extra_recipients
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await supplierAPI.escalateFinancialLine(line.financial_line_id, {
        escalation_reason: escalateForm.escalation_reason,
        escalated_by: userEmail,
        extra_recipients: extra.length ? extra : undefined,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setShowEscalate(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Escalation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeescalate() {
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.deescalateFinancialLine(line.financial_line_id);
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.setRecovery(line.financial_line_id, {
        recovery_status: recoveryForm.recovery_status,
        recovery_note: recoveryForm.recovery_note || undefined,
        recovery_target_date: recoveryForm.recovery_target_date || undefined,
        recovery_amount: recoveryForm.recovery_amount
          ? parseFloat(recoveryForm.recovery_amount)
          : undefined,
        updated_by: userEmail,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setShowRecovery(false);
      setPendingRecoveryPrompt(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.completeFinancialLine(line.financial_line_id, {
        completed_by: userEmail,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveRevision(e: React.FormEvent) {
    e.preventDefault();
    if (!revisedSaving || parseFloat(revisedSaving) <= 0) {
      setError("Enter a valid revised saving.");
      return;
    }
    if (!reviseNote.trim()) {
      setError("Reason for revision is required for audit trail.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.reviseFinancialLineBaseline(line.financial_line_id, {
        revised_saving: parseFloat(revisedSaving),
        note: reviseNote,
        revised_by: userEmail,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setShowRevise(false);
      setRevisedSaving("");
      setReviseNote("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Phase context banner */}
      <div
        className={`rounded-xl border px-4 py-3 text-xs border-${phaseCtx.color}-100 bg-${phaseCtx.color}-50`}
      >
        <p
          className={`font-bold text-${phaseCtx.color}-700 flex items-center gap-1.5`}
        >
          <span
            className={`rounded-full bg-${phaseCtx.color}-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-${phaseCtx.color}-800`}
          >
            {opp.phase_status}
          </span>
          {phaseCtx.title}
        </p>
        <p className={`mt-1 text-${phaseCtx.color}-600`}>{phaseCtx.guidance}</p>
        {!canEditFinancialRows && (
          <p className={`mt-2 font-semibold text-${phaseCtx.color}-700`}>
            Monthly financial rows are read-only outside Phase 3.
          </p>
        )}
      </div>

      {/* Phase 1 or Phase 3 (after deployment start confirmed): revise baseline saving */}
      {(phaseCtx.canRevise || (opp.phase_status === "Phase 3" && opp.real_start_date)) && !isCompleted && !isBudgeted && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-700">
                Revise Baseline Saving
              </p>
              <p className="text-[11px] text-blue-500 mt-0.5">
                Current baseline:{" "}
                <strong>{fmt(line.expected_annual_saving)}/year</strong> ·
                Budget: <strong>{fmt(line.budget_value)}/year</strong> (locked)
              </p>
              <p className="text-[10px] text-blue-400 mt-0.5">
                {opp.phase_status === "Phase 3"
                  ? "Deployment started — revise the expected saving if the actual trajectory differs. Monthly profile will rebuild from the deployment start date."
                  : "If the committee validated a revised figure, enter it here. Monthly expected profile will rebuild. Budget value stays unchanged."}
              </p>
            </div>
            <button
              onClick={() => setShowRevise((s) => !s)}
              className="ml-3 shrink-0 text-[11px] font-semibold text-blue-600 hover:underline"
            >
              {showRevise ? "Cancel" : "Revise →"}
            </button>
          </div>
          {showRevise && (
            <form onSubmit={saveRevision} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Revised Annual Saving (€) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className={inp}
                    placeholder={line.expected_annual_saving?.toString()}
                    value={revisedSaving}
                    onChange={(e) => setRevisedSaving(e.target.value)}
                  />
                  {revisedSaving && line.expected_annual_saving && (
                    <p
                      className={`text-[10px] mt-0.5 ${parseFloat(revisedSaving) < Number(line.expected_annual_saving) ? "text-amber-600" : "text-emerald-600"}`}
                    >
                      {parseFloat(revisedSaving) <
                      Number(line.expected_annual_saving)
                        ? "▼"
                        : "▲"}{" "}
                      Change: €
                      {Math.abs(
                        parseFloat(revisedSaving) -
                          Number(line.expected_annual_saving),
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Reason for revision *
                  </label>
                  <input
                    required
                    className={inp}
                    placeholder="e.g. Tooling higher than estimated"
                    value={reviseNote}
                    onChange={(e) => setReviseNote(e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[10.5px] text-amber-700">
                ⚠ This will delete and rebuild all monthly expected rows. Rows
                that already have actuals entered will be preserved.
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading && <RefreshCw size={12} className="animate-spin" />}{" "}
                Confirm Revision
              </button>
            </form>
          )}
        </div>
      )}

      {/* Escalation banner */}
      {line.is_escalated && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-red-700">
              <AlertTriangle size={13} /> Escalated
              {line.escalated_at && (
                <span className="text-xs font-normal text-red-400">
                  — {fmtDate(line.escalated_at)}
                </span>
              )}
            </p>
            {line.escalation_reason && (
              <p className="mt-0.5 text-xs text-red-600">
                {line.escalation_reason}
              </p>
            )}
          </div>
          <button
            onClick={handleDeescalate}
            disabled={loading}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            De-escalate
          </button>
        </div>
      )}

      {/* Recovery banner */}
      {line.recovery_status && line.recovery_status !== "Done" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold text-amber-700">
              <RefreshCw size={13} /> Recovery: {line.recovery_status}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-amber-600">
              {line.recovery_amount != null && (
                <span>Target: <strong>{fmt(line.recovery_amount)}</strong></span>
              )}
              {line.recovery_target_date && (
                <span>By: <strong>{fmtDate(line.recovery_target_date)}</strong></span>
              )}
            </div>
          </div>
          {line.recovery_note && (
            <p className="text-xs text-amber-600">{line.recovery_note}</p>
          )}
        </div>
      )}

      {/* One financial line per opportunity — as per Olivier's process */}

      {/* Gap 1 — Year split KPI */}
      {yearEntries.length > 1 && (
        <div className="rounded-xl border border-slate-100 bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Year-by-Year Breakdown
          </p>
          <div className="flex gap-4 flex-wrap">
            {yearEntries.map(([yr, d]) => {
              const rate =
                d.expected > 0
                  ? Math.round((d.actual / d.expected) * 100)
                  : null;
              return (
                <div
                  key={yr}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 min-w-[120px]"
                >
                  <p className="text-[10px] font-bold text-slate-500 mb-1">
                    {yr}
                  </p>
                  <div className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">Expected</span>
                      <span className="font-semibold">{fmt(d.expected)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">Actual</span>
                      <span
                        className={`font-bold ${d.actual >= d.expected ? "text-emerald-600" : d.actual > 0 ? "text-amber-600" : "text-slate-300"}`}
                      >
                        {d.actual > 0 ? fmt(d.actual) : "—"}
                      </span>
                    </div>
                    {rate != null && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400">Rate</span>
                        <span
                          className={`font-bold ${rate >= 100 ? "text-emerald-600" : rate >= 75 ? "text-amber-600" : "text-red-500"}`}
                        >
                          {rate}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI header */}
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs">
        <div>
          <span className="block font-semibold text-slate-400">
            Expected Annual
          </span>
          <p className="font-bold text-slate-800">
            {fmt(line.expected_annual_saving)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">Actual YTD</span>
          <p
            className={`font-bold ${(line.cumulated_real_saving ?? 0) >= (line.expected_annual_saving ?? Infinity) ? "text-emerald-700" : "text-slate-800"}`}
          >
            {fmt(line.cumulated_real_saving)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">
            EOY Forecast
          </span>
          <p className="font-bold text-blue-700">
            {fmt(line.forecast_eoy_current)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">Delta YTD</span>
          <p
            className={`font-bold ${(line.delta_vs_expected_ytd ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {fmt(line.delta_vs_expected_ytd)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">
            Conversion Rate
          </span>
          <p
            className={`font-bold ${convRate == null ? "text-slate-400" : convRate >= 100 ? "text-emerald-600" : convRate >= 75 ? "text-amber-600" : "text-red-600"}`}
          >
            {convRate != null ? `${convRate}%` : "—"}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">Status</span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${line.status === "Active" ? "bg-emerald-100 text-emerald-700" : line.status === "Completed" ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-600"}`}
          >
            {line.status ?? "—"}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {!isCompleted && (
        <div className="flex flex-wrap gap-2">
          {!line.is_escalated && (
            <button
              onClick={() => {
                setShowEscalate(true);
                setShowRecovery(false);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <AlertTriangle size={11} /> Escalate
            </button>
          )}
          <button
            onClick={() => {
              setRecoveryForm({
                recovery_status: line.recovery_status ?? "Planned",
                recovery_note: line.recovery_note ?? "",
                recovery_target_date: line.recovery_target_date ?? "",
                recovery_amount: line.recovery_amount?.toString() ?? "",
              });
              setShowRecovery(true);
              setShowEscalate(false);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
          >
            <RefreshCw size={11} />{" "}
            {line.recovery_status ? "Update Recovery" : "Set Recovery Plan"}
          </button>
          {opp.phase_status === "Phase 3" && (
            <button
              onClick={handleComplete}
              disabled={loading}
              className="ml-auto flex items-center gap-1.5 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
            >
              <CheckCircle2 size={11} /> Mark Complete
            </button>
          )}
        </div>
      )}

      {/* Escalation form */}
      {showEscalate && (
        <form
          onSubmit={handleEscalate}
          className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4"
        >
          <p className="flex items-center gap-1.5 text-xs font-bold text-red-700">
            <AlertTriangle size={11} /> Escalation — will alert Purchasing owner
            by email
          </p>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Reason *
            </label>
            <textarea
              required
              rows={3}
              className="w-full resize-none rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none"
              value={escalateForm.escalation_reason}
              onChange={(e) =>
                setEscalateForm((f) => ({
                  ...f,
                  escalation_reason: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Extra recipients (comma-separated, optional)
            </label>
            <input
              className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="ceo@avocarbon.com, plant.manager@..."
              value={escalateForm.extra_recipients}
              onChange={(e) =>
                setEscalateForm((f) => ({
                  ...f,
                  extra_recipients: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {loading && <RefreshCw size={11} className="animate-spin" />}{" "}
              Confirm Escalation
            </button>
            <button
              type="button"
              onClick={() => setShowEscalate(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Recovery form */}
      {showRecovery && (
        <form
          onSubmit={handleRecovery}
          className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
        >
          <div className="flex items-start justify-between">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
              <RefreshCw size={11} /> Recovery Plan
            </p>
            {pendingRecoveryPrompt && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                You selected Recover — fill in your plan below
              </span>
            )}
          </div>

          {/* Delta YTD context — show current gap so user knows what to recover */}
          {line.delta_vs_expected_ytd != null && (
            <div className="flex items-center gap-4 rounded-lg bg-white border border-amber-100 px-3 py-2 text-xs">
              <div>
                <span className="text-slate-400">Current gap (Delta YTD) </span>
                <span className={`font-bold ${(line.delta_vs_expected_ytd ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {fmt(line.delta_vs_expected_ytd)}
                </span>
              </div>
              {(line.delta_vs_expected_ytd ?? 0) < 0 && (
                <button
                  type="button"
                  className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
                  onClick={() => setRecoveryForm((f) => ({
                    ...f,
                    recovery_amount: Math.abs(line.delta_vs_expected_ytd ?? 0).toString(),
                  }))}
                >
                  Use as amount ↗
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                Status *
              </label>
              <select
                required
                className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
                value={recoveryForm.recovery_status}
                onChange={(e) =>
                  setRecoveryForm((f) => ({ ...f, recovery_status: e.target.value }))
                }
              >
                <option>Planned</option>
                <option>In Progress</option>
                <option>Done</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                Target recovery date
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
                value={recoveryForm.recovery_target_date}
                onChange={(e) =>
                  setRecoveryForm((f) => ({ ...f, recovery_target_date: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Amount to recover (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="e.g. 5000"
              value={recoveryForm.recovery_amount}
              onChange={(e) =>
                setRecoveryForm((f) => ({ ...f, recovery_amount: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Recovery note — what will you do to catch up?
            </label>
            <textarea
              rows={3}
              className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="e.g. Renegotiate volume commitment to recover Q3 gap by November…"
              value={recoveryForm.recovery_note}
              onChange={(e) =>
                setRecoveryForm((f) => ({ ...f, recovery_note: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {loading && <RefreshCw size={11} className="animate-spin" />} Save Recovery Plan
            </button>
            <button
              type="button"
              onClick={() => { setShowRecovery(false); setPendingRecoveryPrompt(false); }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            >
              {pendingRecoveryPrompt ? "Skip for now" : "Cancel"}
            </button>
          </div>

          {/* History timeline */}
          {line.recovery_history && (
            <div className="border-t border-amber-100 pt-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">History</p>
              {line.recovery_history.split("\n").filter(Boolean).reverse().map((entry, i) => (
                <p key={i} className="text-[10.5px] text-slate-500 font-mono leading-relaxed">
                  {entry}
                </p>
              ))}
            </div>
          )}
        </form>
      )}

      {/* Phase 0/1: show expected profile as read-only preview, no actuals entry */}
      {!phaseCtx.showActuals && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-xs font-semibold text-slate-500">
            Expected Monthly Profile (read-only)
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Actuals entry starts in Phase 2 once implementation begins.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {rows.map((row) => {
              const rowDate = row.period_month
                ? new Date(row.period_month)
                : null;
              return (
                <div
                  key={row.monthly_financial_id}
                  className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-center min-w-[60px]"
                >
                  <p className="text-[9.5px] font-semibold text-slate-400">
                    {rowDate
                      ? rowDate.toLocaleDateString("en-GB", {
                          month: "short",
                          year: "2-digit",
                        })
                      : "?"}
                  </p>
                  <p className="text-[11px] font-bold text-slate-600">
                    {fmt(row.expected_saving)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly table — Phase 2+ only */}
      {phaseCtx.showActuals && (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-2 font-semibold">Month</th>
                <th className="px-3 py-2 text-right font-semibold">Expected</th>
                <th className="px-3 py-2 text-right font-semibold">Actual</th>
                <th className="px-3 py-2 text-right font-semibold">Delta</th>
                <th className="px-3 py-2 text-right font-semibold">Cum.</th>
                <th className="px-3 py-2 text-right font-semibold">EOY Fcst</th>
                {showCash && (
                  <th className="px-3 py-2 text-right font-semibold text-amber-600">
                    Cash Exp.
                  </th>
                )}
                {showCash && (
                  <th className="px-3 py-2 text-right font-semibold text-amber-600">
                    Cash Act.
                  </th>
                )}
                <th className="px-3 py-2 font-semibold">Outcome</th>
                <th className="px-3 py-2 font-semibold text-blue-600" title="Why did the EOY forecast change?">Forecast note</th>
                <th className="px-3 py-2 font-semibold" title="What happened this month?">Monthly note</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEdit = editRow === row.monthly_financial_id;
                const rowDate = row.period_month
                  ? new Date(row.period_month)
                  : null;
                const isPast = rowDate != null && rowDate < todayFirstOfMonth;
                const isMissing = isPast && row.actual_saving == null;
                const delta = row.delta_vs_expected;
                const monthLabel = rowDate
                  ? rowDate.toLocaleDateString("en-GB", {
                      month: "short",
                      year: "2-digit",
                    })
                  : "—";
                const outcomeCfg = row.monthly_outcome
                  ? OUTCOME_CONFIG[row.monthly_outcome]
                  : null;
                const rowBg = isEdit
                  ? "bg-blue-50"
                  : isMissing
                  ? "bg-red-50/40"
                  : row.monthly_outcome === "Recover"
                  ? "bg-amber-50/50"
                  : row.monthly_outcome === "Escalate"
                  ? "bg-red-50/30"
                  : "hover:bg-slate-50/60";
                return (
                  <tr
                    key={row.monthly_financial_id}
                    className={`border-t border-slate-50 ${rowBg}`}
                  >
                    <td className="px-3 py-2">
                      <span className="font-semibold text-slate-700">
                        {monthLabel}
                      </span>
                      {isMissing && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-600">
                          <AlertTriangle size={8} />
                          Missing
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {fmt(row.expected_saving)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">
                      {isEdit ? (
                        <input
                          type="number"
                          step="0.01"
                          className="w-24 rounded border border-blue-300 px-1.5 py-1 text-xs"
                          value={rowForm.actual_saving}
                          onChange={(e) =>
                            setRowForm((f) => ({
                              ...f,
                              actual_saving: e.target.value,
                            }))
                          }
                          placeholder="0"
                        />
                      ) : row.actual_saving != null ? (
                        fmt(row.actual_saving)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${delta == null ? "text-slate-300" : delta >= 0 ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {delta == null ? "—" : fmt(delta)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {row.cumulated_actual != null
                        ? fmt(row.cumulated_actual)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-700">
                      {isEdit ? (
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            min={row.cumulated_actual ?? 0}
                            className={`w-24 rounded border px-1.5 py-1 text-xs ${
                              rowForm.forecast_eoy_saving &&
                              row.cumulated_actual != null &&
                              parseFloat(rowForm.forecast_eoy_saving) < row.cumulated_actual
                                ? "border-red-400 bg-red-50"
                                : "border-blue-300"
                            }`}
                            value={rowForm.forecast_eoy_saving}
                            onChange={(e) => setRowForm((f) => ({ ...f, forecast_eoy_saving: e.target.value }))}
                            placeholder="0"
                          />
                          {rowForm.forecast_eoy_saving &&
                            row.cumulated_actual != null &&
                            parseFloat(rowForm.forecast_eoy_saving) < row.cumulated_actual && (
                              <p className="text-[9px] text-red-500 mt-0.5 w-24">
                                Must be ≥ {fmt(row.cumulated_actual)}
                              </p>
                          )}
                        </div>
                      ) : row.forecast_eoy_saving != null ? (
                        fmt(row.forecast_eoy_saving)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Gap 3 — cash columns */}
                    {showCash && (
                      <td className="px-3 py-2 text-right text-amber-600 text-[11px]">
                        {row.cash_expected != null
                          ? fmt(row.cash_expected)
                          : "—"}
                      </td>
                    )}
                    {showCash && (
                      <td className="px-3 py-2 text-right text-amber-700 font-semibold text-[11px]">
                        {isEdit ? (
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 rounded border border-amber-300 px-1.5 py-1 text-xs"
                            value={rowForm.cash_actual ?? ""}
                            onChange={(e) =>
                              setRowForm((f) => ({
                                ...f,
                                cash_actual: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                        ) : row.cash_actual != null ? (
                          fmt(row.cash_actual)
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <select
                          className="rounded border border-blue-300 px-1.5 py-1 text-xs"
                          value={rowForm.monthly_outcome}
                          onChange={(e) =>
                            setRowForm((f) => ({
                              ...f,
                              monthly_outcome: e.target.value,
                            }))
                          }
                        >
                          <option>Continue</option>
                          <option>Recover</option>
                          <option>Escalate</option>
                        </select>
                      ) : outcomeCfg ? (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${outcomeCfg.color}`}
                          >
                            {outcomeCfg.label}
                          </span>
                          {row.monthly_outcome === "Recover" && line.recovery_status && (
                            <span className={`rounded px-1.5 py-0.5 text-[8.5px] font-semibold ${
                              line.recovery_status === "Done"
                                ? "bg-emerald-100 text-emerald-700"
                                : line.recovery_status === "In Progress"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              Plan: {line.recovery_status}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Forecast note — why did EOY forecast change? */}
                    <td className="max-w-[120px] truncate px-3 py-2 text-blue-500 text-[11px]"
                        title={row.forecast_comment || ""}>
                      {isEdit ? (
                        <input
                          className="w-28 rounded border border-blue-300 px-1.5 py-1 text-xs"
                          value={rowForm.forecast_comment}
                          onChange={(e) => setRowForm((f) => ({ ...f, forecast_comment: e.target.value }))}
                          placeholder="Why forecast changed…"
                        />
                      ) : (
                        row.forecast_comment
                          ? <span className="text-blue-500">{row.forecast_comment}</span>
                          : <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Monthly note — what happened this month? */}
                    <td className="max-w-[120px] truncate px-3 py-2 text-slate-400 text-[11px]"
                        title={row.comment || ""}>
                      {isEdit ? (
                        <input
                          className="w-28 rounded border border-slate-300 px-1.5 py-1 text-xs"
                          value={rowForm.comment}
                          onChange={(e) => setRowForm((f) => ({ ...f, comment: e.target.value }))}
                          placeholder="What happened…"
                        />
                      ) : (
                        row.comment
                          ? <span>{row.comment}</span>
                          : <span className="text-slate-200">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveRow(row.monthly_financial_id)}
                            disabled={loading}
                            className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-60"
                          >
                            {loading ? "…" : "Save"}
                          </button>
                          <button
                            onClick={() => setEditRow(null)}
                            className="rounded bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600"
                          >
                            ✕
                          </button>
                        </div>
                      ) : canEditFinancialRows ? (
                        <button
                          onClick={() => {
                            setEditRow(row.monthly_financial_id);
                            setRowForm({
                              actual_saving:
                                row.actual_saving?.toString() ?? "",
                              cash_actual: row.cash_actual?.toString() ?? "",
                              forecast_eoy_saving:
                                row.forecast_eoy_saving?.toString() ?? "",
                              forecast_comment: row.forecast_comment ?? "",
                              comment: row.comment ?? "",
                              monthly_outcome:
                                row.monthly_outcome ?? "Continue",
                            });
                          }}
                          className="rounded px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      ) : (
                        <span className="rounded px-2 py-1 text-[10px] font-semibold text-slate-400">
                          Locked
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const PHASE_OPTIONS = [
  "General",
  "Phase 0",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Phase 4",
  "STP Document",
  "Other",
];

function FilesTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phaseLabel, setPhaseLabel] = useState("General");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docs = opp.opp_documents ?? [];

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await supplierAPI.uploadOpportunityDocument(
        opp.opportunity_id,
        file,
        phaseLabel,
        notes || undefined,
        userEmail,
      );
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: number) {
    setDeleting(docId);
    setError(null);
    try {
      await supplierAPI.deleteOpportunityDocument(docId);
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  const fmtSize = (b?: number | null) =>
    !b
      ? ""
      : b < 1024
        ? `${b} B`
        : b < 1024 * 1024
          ? `${(b / 1024).toFixed(1)} KB`
          : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Upload zone */}
      <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4">
        <p className="text-xs font-bold text-blue-700 mb-3 flex items-center gap-1.5">
          <Upload size={12} /> Upload a file
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Phase / Category
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400"
              value={phaseLabel}
              onChange={(e) => setPhaseLabel(e.target.value)}
            >
              {PHASE_OPTIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
              Notes (optional)
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400"
              placeholder="e.g. Rev 1.1 – signed"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {uploading ? (
            <>
              <RefreshCw size={14} className="animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Paperclip size={14} /> Choose file (PDF, Word, Excel, Image)
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            disabled={uploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleUpload}
          />
        </label>
      </div>

      {/* File list */}
      {docs.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          No files uploaded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.doc_id}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 hover:border-slate-200"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <FileText size={14} className="text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {doc.original_file_name || doc.file_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-500">
                    {doc.phase_label}
                  </span>
                  {doc.file_size && (
                    <span className="text-[10px] text-slate-400">
                      {fmtSize(doc.file_size)}
                    </span>
                  )}
                  {doc.notes && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {doc.notes}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    Open
                  </a>
                )}
                <button
                  onClick={() => handleDelete(doc.doc_id)}
                  disabled={deleting === doc.doc_id}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  {deleting === doc.doc_id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PHASE_OUTPUT_DEF: Record<
  string,
  {
    title: string;
    owner: string;
    deliverable: string;
    fields: {
      key: string;
      label: string;
      type: string;
      options?: string[];
      hint?: string;
    }[];
  }
> = {
  "Phase 1": {
    title: "Feasibility Study",
    owner: "Project Manager (Purchasing support)",
    deliverable: "Feasibility dossier (STP document)",
    fields: [
      {
        key: "phase_output_notes",
        label: "Output summary (gain · planning · risks · investment)",
        type: "textarea",
        hint: "Gain confirmed €, timeline weeks, key risks, total investment €",
      },
      {
        key: "committee_review_date",
        label: "Committee review date",
        type: "date",
      },
      {
        key: "committee_members",
        label: "Committee members",
        type: "text",
        hint: "CEO, COO, Plant Manager, CDP, Achats",
      },
      {
        key: "status",
        label: "Project status",
        type: "select",
        options: ["On time", "Late", "On hold"],
      },
      { key: "planned_end_date", label: "Planned end date", type: "date" },
    ],
  },
  "Phase 2": {
    title: "Completion / Execution",
    owner: "Project Manager (Purchasing support)",
    deliverable: "Execution package + off-tool first validation",
    fields: [
      {
        key: "phase_output_notes",
        label: "Output notes (objectives achieved, change mode confirmed)",
        type: "textarea",
        hint: "What was achieved vs Phase 1 plan. Silent or Standard confirmed.",
      },
      {
        key: "off_tool_date",
        label: "Off-tool date (first validation)",
        type: "date",
        hint: "Date of first off-tool part presentation",
      },
      {
        key: "status",
        label: "Project status",
        type: "select",
        options: ["On time", "Late", "On hold"],
      },
      { key: "planned_end_date", label: "Planned end date", type: "date" },
    ],
  },
  "Phase 3": {
    title: "Deployment",
    owner: "Project Manager (Purchasing support)",
    deliverable: "PPAP validated + plant start",
    fields: [
      {
        key: "plant_validation",
        label: "PPAP / Plant validation",
        type: "select",
        options: ["Pending", "Approved", "Rejected"],
        hint: "Industrial validation by the plant (required for Standard change)",
      },
      {
        key: "phase_output_notes",
        label: "Deployment notes",
        type: "textarea",
        hint: "Deployment status, plant start confirmed, statuses confirmed",
      },
      {
        key: "status",
        label: "Project status",
        type: "select",
        options: ["On time", "Late", "On hold"],
      },
      { key: "actual_end_date", label: "Actual deployment date", type: "date" },
    ],
  },
  "Phase 4": {
    title: "Lessons Learned & Closure (LLC)",
    owner: "Project Manager (Purchasing support)",
    deliverable: "LLC document + savings follow-up closed",
    fields: [
      {
        key: "phase_output_notes",
        label: "Lessons learned",
        type: "textarea",
        hint: "What worked well, what to improve, knowledge to retain",
      },
      {
        key: "status",
        label: "Final project status",
        type: "select",
        options: ["Completed", "On hold"],
      },
      { key: "actual_end_date", label: "Actual closure date", type: "date" },
      { key: "comments", label: "Final comments", type: "textarea" },
    ],
  },
};

const PHASE_GUIDE: Record<
  string,
  { title: string; checklist: string[]; deliverable: string }
> = {
  "Phase 1": {
    title: "Feasibilit  y Study",
    deliverable: "Feasibility dossier (STP document)",
    checklist: [
      "Confirm gain estimate, timeline and investment cost",
      "Confirm Standard or Silent change mode",
      "Assess risks (exchange rate, quality, tooling)",
      "Present to Sourcing Committee (CEO, COO, Plant Manager, Purchasing)",
      "Upload STP document in Files tab",
      "Apply Go / No Go / Review gate decision",
    ],
  },
  "Phase 2": {
    title: "Completion / Execution",
    deliverable: "Execution package (tooling, qualification, drawings)",
    checklist: [
      "Launch tooling orders",
      "Start supplier qualification process",
      "Update change drawings if Standard change",
      "Fill Real Start Date once production begins",
      "Enter monthly actuals in Financial tab",
      "Upload execution evidence in Files tab",
      "Apply Go / No Go / Review gate decision",
    ],
  },
  "Phase 3": {
    title: "Deployment",
    deliverable: "PPAP validation + industrial evidence",
    checklist: [
      "Complete PPAP (for Standard change) — customer approval",
      "Phase-in new supplier / process, phase-out old",
      "Confirm Real Start Date in Edit tab",
      "Monthly actuals should reflect deployment progress",
      "Upload PPAP documents and implementation evidence in Files tab",
      "Apply Go gate decision to close Phase 3",
    ],
  },
  "Phase 4": {
    title: "LLC — Lessons Learned & Closure",
    deliverable: "Closure and lessons learned document",
    checklist: [
      "Write lessons learned (what worked, what to improve)",
      "Confirm final actual savings in Financial tab",
      "Upload LLC document in Files tab",
      "Click Mark Complete on Financial tab to close saving tracking",
      "Apply Close gate decision",
    ],
  },
};

function ProjectTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const phaseDef = PHASE_OUTPUT_DEF[opp.phase_status ?? ""];
  const guide = PHASE_GUIDE[opp.phase_status ?? ""];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const proj = opp.projects[0];
  // Phase 1 output remains editable even during/after committee review
  // The committee received the email — DB updates don't change what was sent
  const isUnderReview = opp.status === "Under Committee Review";

  const initForm = () =>
    Object.fromEntries(
      (phaseDef?.fields ?? []).map((f) => {
        const val = proj
          ? (proj as unknown as Record<string, unknown>)[f.key]
          : undefined;
        return [f.key, val != null ? String(val) : ""];
      }),
    );
  const [form, setForm] = useState<Record<string, string>>(initForm);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!proj) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      // Strip empty strings → undefined so Pydantic accepts Optional[date] fields
      const payload = Object.fromEntries(
        Object.entries({ ...form, updated_by: userEmail }).map(([k, v]) => [
          k,
          v === "" ? undefined : v,
        ]),
      );
      await supplierAPI.updateProject(proj.project_id, payload);
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (!opp.projects.length) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        {["Negotiation", "Cash"].includes(opp.opportunity_type ?? "")
          ? "Negotiation and Cash opportunities do not require a project."
          : "Project created automatically on Phase 0 Go."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Project header card */}
      {proj && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-bold text-slate-800">
                {proj.project_name}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {proj.project_type} · PM: {proj.project_owner || "—"}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${
                proj.status === "On time"
                  ? "bg-emerald-100 text-emerald-700"
                  : proj.status === "Late"
                    ? "bg-red-100 text-red-700"
                    : proj.status === "Completed"
                      ? "bg-teal-100 text-teal-700"
                      : "bg-orange-100 text-orange-700"
              }`}
            >
              {proj.status || "—"}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600">
              {proj.phase_status}
            </span>
            {proj.gate_decision && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                  proj.gate_decision === "Go"
                    ? "bg-emerald-50 text-emerald-600"
                    : proj.gate_decision === "No Go"
                      ? "bg-red-50 text-red-600"
                      : "bg-amber-50 text-amber-600"
                }`}
              >
                {proj.gate_decision}
              </span>
            )}
            {proj.plant_validation && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                  proj.plant_validation === "Approved"
                    ? "bg-emerald-50 text-emerald-600"
                    : proj.plant_validation === "Rejected"
                      ? "bg-red-50 text-red-600"
                      : "bg-amber-50 text-amber-600"
                }`}
              >
                PPAP: {proj.plant_validation}
              </span>
            )}
          </div>
          {proj.phase_output_notes && (
            <p className="mt-2 text-xs text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-100">
              {proj.phase_output_notes}
            </p>
          )}
        </div>
      )}

      {/* Phase output form — always editable, even during committee review */}
      {isUnderReview && (
        <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-2.5 text-xs text-purple-700 flex items-start gap-2">
          <span className="shrink-0 mt-0.5">ℹ</span>
          <span>
            The dossier has been submitted to the committee. You can still
            complete the fields below — database updates do not change the email
            already sent. If you change significant items, re-submit the dossier
            via the Gate tab.
          </span>
        </div>
      )}
      {phaseDef && proj && (
        <form
          onSubmit={save}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              {opp.phase_status} Output — {phaseDef.title}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Owner: <span className="font-semibold">{phaseDef.owner}</span> ·
              Deliverable:{" "}
              <span className="font-semibold">{phaseDef.deliverable}</span>
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              ✓ Saved
            </p>
          )}

          {phaseDef.fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                {f.label}
                {f.hint && (
                  <span className="ml-1.5 font-normal text-slate-400">
                    ({f.hint})
                  </span>
                )}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  <option value="">— Select —</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <RefreshCw size={13} className="animate-spin" />} Save
              Output
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STP Download Button — fetch with auth token then trigger browser download
// ---------------------------------------------------------------------------
function StpDownloadButton({
  opportunityId,
  oppName,
  phase,
}: {
  opportunityId: number;
  oppName?: string;
  phase: 0 | 1;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(false);
    try {
      await supplierAPI.downloadStpPdf(opportunityId, phase, oppName ?? undefined);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={`Download STP Phase ${phase} PDF`}
      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-semibold transition-colors disabled:opacity-60 ${
        error
          ? "border-red-300 bg-red-50 text-red-600"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
      }`}
    >
      {loading ? (
        <RefreshCw size={11} className="animate-spin" />
      ) : (
        <Download size={11} />
      )}
      STP P{phase}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer
// ---------------------------------------------------------------------------
const PRESET_WIDTHS = [520, 720, 960, 1200];
const PRESET_LABELS = ["S", "M", "L", "XL"];

function DetailDrawer({
  opp,
  onClose,
  onRefresh,
  userEmail,
}: {
  opp: Opp;
  onClose: () => void;
  onRefresh: (o: Opp) => void;
  userEmail: string;
}) {
  const defaultTab = (o: Opp): Tab => {
    const ps = o.phase_status ?? "";
    const st = o.status ?? "";
    if (st === "Assigned") return "edit";
    if (ps === "Phase 0" && ["Working on it", "Needs Rework"].includes(st))
      return ["Sourcing", "Technical Productivity"].includes(o.opportunity_type ?? "") ? "stp" : "edit";
    if (st === "Awaiting Validation" || st === "Under Committee Review") return "gate";
    if (ps === "Phase 1") return "project";
    if (["Phase 2", "Phase 3", "Phase 4"].includes(ps)) return "financial";
    if (ps === "Closed") return "overview";
    return "overview";
  };
  const [tab, setTab] = useState<Tab>(() => defaultTab(opp));
  const [drawerWidth, setDrawerWidth] = useState(720);
  const typeClass =
    TYPE_COLORS[opp.opportunity_type ?? ""] ??
    "bg-slate-100 text-slate-600 border-slate-200";
  const showStpTab = ["Sourcing", "Technical Productivity"].includes(
    opp.opportunity_type ?? "",
  );
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = drawerWidth;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      setDrawerWidth(
        Math.min(Math.max(startW.current + delta, 380), window.innerWidth - 60),
      );
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const docCount = opp.opp_documents?.length ?? 0;
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <Layers size={11} /> },
    { id: "edit", label: "Edit", icon: <FileText size={11} /> },
    ...(showStpTab
      ? [{ id: "stp" as Tab, label: "STP Study", icon: <FileText size={11} /> }]
      : []),
    { id: "project", label: "Project", icon: <FolderOpen size={11} /> },
    { id: "financial", label: "Financial", icon: <BarChart2 size={11} /> },
    { id: "gate", label: "Gate", icon: <CheckCircle2 size={11} /> },
    {
      id: "files",
      label: `Files${docCount ? ` (${docCount})` : ""}`,
      icon: <Paperclip size={11} />,
    },
  ];

  const editDisabled = false; // always editable — phase note shown inside the form
  const gateDisabled = opp.phase_status === "Closed";
  const tabDisabled = (id: Tab) => id === "gate" && gateDisabled;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex flex-col bg-white shadow-2xl dark:bg-[#0f1e30]"
        style={{ width: drawerWidth }}
      >
        {/* Drag handle — left edge */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-transparent hover:bg-blue-400/30 transition-colors z-20"
          title="Drag to resize"
        />
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 dark:border-white/[0.07] dark:from-[#0f1e30] dark:to-[#101f35]">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              #{opp.opportunity_id}
            </p>
            <h2 className="mt-0.5 max-w-md truncate text-base font-bold text-slate-800 dark:text-slate-100">
              {opp.opportunity_name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${typeClass}`}
              >
                {opp.opportunity_type}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[opp.status ?? ""] ?? "bg-slate-100 text-slate-600"}`}
              >
                {opp.status}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600">
                {opp.phase_status}
              </span>
              {opp.budget_status === "Budgeted" && (
                <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold text-violet-600">
                  Budgeted
                </span>
              )}
              {opp.priority_category && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pldColor(opp.priority_category)}`}
                >
                  {opp.priority_category} priority
                </span>
              )}
            </div>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-1">
            {/* Download STP — only for Sourcing / Technical Productivity */}
            {["Sourcing", "Technical Productivity"].includes(opp.opportunity_type ?? "") && (
              <div className="flex gap-1 mr-2">
                {([0, 1] as const).map((ph) => (
                  <StpDownloadButton
                    key={ph}
                    opportunityId={opp.opportunity_id}
                    oppName={opp.opportunity_name}
                    phase={ph}
                  />
                ))}
              </div>
            )}
            {/* Width presets */}
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 mr-1">
              {PRESET_WIDTHS.map((w, i) => (
                <button
                  key={w}
                  onClick={() => setDrawerWidth(w)}
                  title={`${w}px`}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${drawerWidth === w ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-700"}`}
                >
                  {PRESET_LABELS[i]}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-slate-100 bg-white px-4 pt-2">
          {TABS.map((t) => {
            const disabled = tabDisabled(t.id);
            return (
              <button
                key={t.id}
                disabled={disabled}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11.5px] font-semibold border-b-2 -mb-px transition-colors ${tab === t.id ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"} disabled:opacity-35 disabled:cursor-not-allowed`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "overview" && <OverviewTab opp={opp} />}
          {tab === "edit" && (
            <EditTab
              key={`edit-${opp.opportunity_id}-${opp.updated_at ?? ""}-${opp.budget_year ?? ""}-${opp.change_mode ?? ""}`}
              opp={opp}
              userEmail={userEmail}
              onRefresh={onRefresh}
            />
          )}
          {tab === "stp" && (
            <EditTab
              key={`stp-${opp.opportunity_id}-${opp.updated_at ?? ""}-${opp.phase_status ?? ""}`}
              opp={opp}
              userEmail={userEmail}
              onRefresh={onRefresh}
              mode="stp"
            />
          )}
          {tab === "gate" && (
            <GateTab opp={opp} userEmail={userEmail} onRefresh={onRefresh} onNavigate={setTab} />
          )}
          {tab === "financial" && (
            <FinancialTab
              key={`financial-${opp.opportunity_id}-${opp.updated_at ?? ""}-${opp.real_start_date ?? ""}`}
              opp={opp}
              userEmail={userEmail}
              onRefresh={onRefresh}
            />
          )}
          {tab === "project" && (
            <ProjectTab opp={opp} userEmail={userEmail} onRefresh={onRefresh} />
          )}
          {tab === "files" && (
            <FilesTab opp={opp} userEmail={userEmail} onRefresh={onRefresh} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Opportunity Card
// ---------------------------------------------------------------------------
function OppCard({
  opp,
  onClick,
  onRefresh,
  userEmail,
}: {
  opp: Opp;
  onClick: () => void;
  onRefresh?: (o: Opp) => void;
  userEmail?: string;
}) {
  const typeClass =
    TYPE_COLORS[opp.opportunity_type ?? ""] ??
    "bg-slate-100 text-slate-600 border-slate-200";
  const hasFinancial = opp.financial_lines.length > 0;
  const line = opp.financial_lines[0];
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-white/[0.08] dark:bg-[#111e30] dark:hover:border-blue-500/30 dark:hover:bg-[#152035]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-slate-800 dark:text-slate-100">
          {opp.opportunity_name}
        </p>
        <ChevronRight
          size={13}
          className="mt-0.5 shrink-0 text-slate-300 group-hover:text-blue-400 dark:text-slate-600 dark:group-hover:text-blue-400"
        />
      </div>
      <p className="mb-2 text-[10.5px] text-slate-400 dark:text-slate-500">{opp.idea_owner}</p>
      <div className="flex flex-wrap gap-1 mb-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${typeClass}`}
        >
          {opp.opportunity_type}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${STATUS_COLORS[opp.status ?? ""] ?? "bg-slate-100 text-slate-500"}`}
        >
          {opp.status}
        </span>
        {opp.budget_status === "Budgeted" && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9.5px] font-semibold text-violet-600 border border-violet-100">
            Budgeted
          </span>
        )}
      </div>
      {(opp.expected_annual_saving || opp.priority_category) && (
        <div className="flex items-center gap-3 border-t border-slate-50 pt-2 dark:border-white/[0.06]">
          {opp.expected_annual_saving && (
            <div className="flex items-center gap-1">
              <TrendingUp size={10} className="text-emerald-500" />
              <span className="text-[10.5px] font-semibold text-emerald-700">
                {fmt(opp.expected_annual_saving)}
              </span>
            </div>
          )}
          {opp.priority_category && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${pldColor(opp.priority_category)}`}
            >
              {opp.priority_category}
            </span>
          )}
          {hasFinancial && line?.cumulated_real_saving != null && (
            <div className="flex items-center gap-1 ml-auto">
              <BadgeCheck size={10} className="text-blue-400" />
              <span className="text-[10.5px] text-blue-600 font-semibold">
                {fmt(line.cumulated_real_saving)}
              </span>
            </div>
          )}
        </div>
      )}
      {/* Quick action for Assigned cards */}
      {opp.status === "Assigned" && onRefresh && userEmail && (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const res = await supplierAPI.startStudy(
                opp.opportunity_id,
                userEmail,
              );
              onRefresh(res.data as Opp);
            } catch {
              /* open drawer instead */ onClick();
            }
          }}
          className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
        >
          Start Phase 0 Study →
        </button>
      )}
      {(opp.status === "Awaiting Validation" ||
        opp.status === "Under Committee Review") && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold">
          <Clock size={10} /> {opp.status}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase Column
// ---------------------------------------------------------------------------
function PhaseColumn({
  phase,
  opps,
  onSelect,
  onRefresh,
  userEmail,
}: {
  phase: string;
  opps: Opp[];
  onSelect: (o: Opp) => void;
  onRefresh?: (o: Opp) => void;
  userEmail?: string;
}) {
  const cfg = PHASE_CONFIG[phase] ?? { color: "text-slate-500", desc: "" };
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <CircleDot size={13} className={cfg.color} />
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">{phase}</p>
          <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">{cfg.desc}</p>
        </div>
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
          {opps.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {opps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-[11px] text-slate-400 dark:border-white/[0.1] dark:text-slate-600">
            Empty
          </div>
        ) : (
          opps.map((o) => (
            <OppCard
              key={o.opportunity_id}
              opp={o}
              onClick={() => onSelect(o)}
              onRefresh={onRefresh}
              userEmail={userEmail}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------
function Sep() {
  return <div className="h-4 w-px shrink-0 bg-slate-200 dark:bg-white/[0.1]" />;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  values,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  values?: string[];
}) {
  const isActive = value !== "All";
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`text-[10px] font-semibold ${isActive ? "text-blue-600" : "text-slate-400"}`}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`max-w-[160px] cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none focus:border-blue-400 ${isActive ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 bg-white text-slate-700 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-slate-300"}`}
      >
        {options.map((opt, i) => (
          <option key={opt} value={values ? values[i] : opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function PurchasingValuePage() {
  const { user } = useAuth();
  const userEmail = (user as { email?: string })?.email ?? "";
  const [opportunities, setOpportunities] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Opp | null>(null);
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterBudget, setFilterBudget] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterPlant, setFilterPlant] = useState("All");
  const [filterPM, setFilterPM] = useState("All");
  const [filterPurchasingOwner, setFilterPurchasingOwner] = useState("All");
  const [filterConversionOwner, setFilterConversionOwner] = useState("All");
  const [filterPilot, setFilterPilot] = useState("All");
  const [filterBudgetYear, setFilterBudgetYear] = useState("All");
  const [filterEscalated, setFilterEscalated] = useState(false);
  const [filterValidation, setFilterValidation] = useState("All");
  const [showClosed, setShowClosed] = useState(false);

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

  const filtered = opportunities.filter((o) => {
    if (filterType !== "All" && o.opportunity_type !== filterType) return false;
    if (filterStatus !== "All" && o.status !== filterStatus) return false;
    if (filterBudget !== "All" && o.budget_status !== filterBudget)
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
    if (
      filterValidation !== "All" &&
      o.validation_decision !== filterValidation
    )
      return false;
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

  function resetFilters() {
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

  // KPIs
  const budgetedOpps = opportunities.filter((o) => o.budget_status === "Budgeted");
  const budgetedSaving = budgetedOpps.reduce(
    (s, o) => s + toNum(o.expected_annual_saving),
    0,
  );
  const totalActual = opportunities
    .flatMap((o) => o.financial_lines)
    .reduce((s, l) => s + toNum(l.cumulated_real_saving), 0);
  const budgeted = budgetedOpps.length;
  const overBudgetLines = opportunities
    .flatMap((o) => o.financial_lines)
    .filter(
      (l) =>
        l.budget_status === "Budgeted" &&
        toNum(l.budget_value) > 0 &&
        toNum(l.forecast_eoy_current) > toNum(l.budget_value),
    );
  const overBudgetCount = new Set(overBudgetLines.map((l) => l.financial_line_id)).size;
  const overBudgetAmount = overBudgetLines.reduce(
    (s, l) => s + (toNum(l.forecast_eoy_current) - toNum(l.budget_value)),
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
              icon: <AlertTriangle size={12} />,
              label: "Over Budget",
              val: overBudgetCount > 0
                ? `${overBudgetCount} · +${fmt(overBudgetAmount)}`
                : "0",
              color: overBudgetCount > 0 ? "red" : "slate",
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
          {["All", ...TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition-colors ${filterType === t ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.07] dark:text-slate-300 dark:hover:bg-white/[0.12]"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Row 2 — Status, Budget, Priority, Validation, Plant */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100/60 px-4 py-2 dark:border-white/[0.05] sm:px-8">
          <FilterSelect
            label="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={STATUS_FILTER_OPTIONS}
          />
          <Sep />
          <FilterSelect
            label="Budget"
            value={filterBudget}
            onChange={setFilterBudget}
            options={["All", "Budgeted", "Outside Budget"]}
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
          <div className="flex gap-4 overflow-x-auto pb-6">
            {visiblePhases.map((ph, i) => (
              <div key={ph} className="flex items-start gap-4">
                <PhaseColumn
                  phase={ph}
                  opps={grouped[ph] ?? []}
                  onSelect={setSelected}
                  onRefresh={handleRefresh}
                  userEmail={userEmail}
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
        />
      )}
    </div>
  );
}
