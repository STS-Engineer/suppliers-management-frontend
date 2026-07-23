import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart2,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Copy,
  Download,
  FileText,
  FolderOpen,
  LayoutGrid,
  LayoutList,
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
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import supplierAPI, {
  SupplierApiError,
} from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";
import { PageIntro } from "../components/UI";
import {
  loadPersistedFilters,
  savePersistedFilters,
} from "../utils/persistedFilters";
import {
  ALL_ROLES,
  COMMITTEE_LEVELS,
  mandatoryRolesForPhase,
  NEGOTIATION_APPROVER_ROLES,
  type CommitteeLevel,
} from "../data/gateApprovalConstants";

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
  updated_at?: string;
  updated_by?: string;
}
interface FinLine {
  financial_line_id: number;
  line_name?: string;
  validation_status?: string;
  expected_annual_saving?: number;
  budget_value?: number;
  planned_start_date?: string;
  duration_months?: number;
  cumulated_real_saving?: number;
  delta_vs_expected_ytd?: number;
  pacing_status?: string;
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
  change_mode?: string;
  change_mode_comment?: string;
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
  updated_by?: string;
}

interface PhaseHistoryEntry {
  snapshot_id: number;
  opportunity_id: number;
  phase_from?: string;
  phase_to?: string;
  gate_decision?: string;
  decided_by?: string;
  decided_at?: string;
  gate_comments?: string;
  opportunity_snapshot?: Record<string, unknown> | null;
}
interface SiteOption {
  id_site: number;
  site_name?: string;
  city?: string;
  country?: string;
}
interface SupplierOption {
  id_supplier_unit: number;
  supplier_name?: string;
  group_name?: string;
  city?: string;
  country?: string;
}

const INCOTERMS_OPTIONS: { value: string; label: string }[] = [
  { value: "EXW", label: "Ex Works" },
  { value: "FCA", label: "Free Carrier" },
  { value: "FAS", label: "Free Alongside Ship" },
  { value: "FOB", label: "Free On Board" },
  { value: "CFR", label: "Cost and Freight" },
  { value: "CIF", label: "Cost, Insurance and Freight" },
  { value: "CPT", label: "Carriage Paid To" },
  { value: "CIP", label: "Carriage and Insurance Paid To" },
  { value: "DAP", label: "Delivered At Place" },
  { value: "DPU", label: "Delivered at Place Unloaded" },
  { value: "DDP", label: "Delivered Duty Paid" },
];

interface Opp {
  opportunity_id: number;
  opportunity_name?: string;
  opportunity_type?: string;
  saving_nature?: string;
  entry_mode?: string;
  description?: string;
  status?: string;
  phase_status?: string;
  idea_owner?: string;
  purchasing_owner?: string;
  project_owner?: string;
  plant_name?: string;
  plant_city?: string;
  conversion_owner?: string;
  committee_level?: string;
  plant_id?: number;
  supplier_id?: number;
  expected_annual_saving?: number;
  cash_impact?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  execution_start_date?: string;
  real_start_date?: string;
  duration_months?: number;
  validation_status?: string;
  budget_year?: number;
  budget_confirmed_at?: string;
  budget_confirmed_by?: string;
  validation_decision?: string;
  val_date?: string;
  study_start_date?: string;
  change_mode?: string;
  currency?: string;
  fx_rate_to_eur?: number;
  assumptions_summary?: string;
  payback_score?: number;
  lead_time_score?: number;
  difficulty_score?: number;
  priority_score?: number;
  priority_category?: string;
  priority_locked?: boolean;
  comments?: string;
  validation_request_sent_at?: string;
  // Reminder aggregate for the open gate request (computed on the backend)
  reminders_sent?: number;
  pending_approvers?: number;
  created_at?: string;
  created_by?: string;
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
  place_of_incoterms_before?: string;
  place_of_incoterms_after?: string;
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
  roi_period_percent?: number;
  // STP — computed savings (Excel formulas)
  period_saving?: number;
  // Estimated saving per year (year N == expected_annual_saving incl. bonus; sum == period_saving)
  saving_year_n?: number;
  saving_year_n1?: number;
  saving_year_n2?: number;
  saving_year_n3?: number;
  // Calendar-year prorated estimate {"2026": 1234.56, ...} (start-date aware)
  saving_by_year?: Record<string, number>;
  // Total multi-year gain (== period_saving) — the "value of opportunity"
  value_of_opportunity?: number;
  // Incremental year-over-year price drop per calendar year — what actually gets budgeted
  saving_to_budget_by_year?: Record<string, number>;
  // Per-fiscal-year budget records (budgeting module)
  budget_years?: {
    id: number;
    fiscal_year: number;
    applicable_amount?: number;
    portion_kind?: string;
    suggested_status?: string;
    budget_status?: string;
    is_additional?: boolean;
    status_locked_at?: string | null;
    status_locked_by?: string | null;
  }[];
  cash_inventory_gap?: number;
  cash_ap_gap?: number;
  // STP — risks (JSONB)
  stp_risks?: {
    material_indexation_before?: string; // Yes / No
    material_indexation_after?: string; // Yes / No
    material_indexation_desc?: string;
    exchange_rate_before?: string; // Yes / No
    exchange_rate_after?: string; // Yes / No
    exchange_rate_desc?: string;
    local_content_before?: string; // Yes / No
    local_content_after?: string; // Yes / No
    local_content_desc?: string;
    quality_before?: string; // Yes / No
    quality_after?: string; // Yes / No
    quality_desc?: string;
    other_before?: string; // Yes / No
    other_after?: string; // Yes / No
    other_desc?: string;
    material_same_spec?: string;
    same_tooling?: string;
    same_dimension?: string;
    same_process?: string;
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
  secondary_plants?: string;
  pending_stp_revision?: Record<string, unknown> | null;
  revision_history?: Record<string, unknown>[] | null;
  projects: ProjectRec[];
  financial_lines: FinLine[];
  opp_documents: OppDoc[];
}

// ---------------------------------------------------------------------------
// Excel export — flatten opportunities into a spreadsheet with all key columns
// ---------------------------------------------------------------------------
// "Price increase" is stored as an opportunity_type but it is a cost increase
// (negative saving), not one of the three real opportunity types. We surface it
// in a dedicated "Price Increase" column and keep the Type column to the three
// canonical types — normalizing away import casing variants ("Technical
// productivity" → "Technical Productivity") so the column has clean values.
const CANONICAL_TYPES: Record<string, string> = {
  negotiation: "Negotiation",
  sourcing: "Sourcing",
  "technical productivity": "Technical Productivity",
};
function isPriceIncrease(o: Opp): boolean {
  return (o.opportunity_type ?? "").trim().toLowerCase() === "price increase";
}
function canonicalType(o: Opp): string {
  const raw = (o.opportunity_type ?? "").trim();
  if (!raw || isPriceIncrease(o)) return "";
  return CANONICAL_TYPES[raw.toLowerCase()] ?? raw;
}

// Budget commitment lives per fiscal-year in opp.budget_years (not the single
// opp.budget_year planning field). Summarize it: is it budgeted, in which FY(s),
// and is any of it an "Additional" (post-closure) commitment.
function budgetedFiscalYears(o: Opp): number[] {
  return (o.budget_years ?? [])
    .filter((by) => by.budget_status === "Budgeted")
    .map((by) => by.fiscal_year)
    .sort((a, b) => a - b);
}
function isAdditional(o: Opp): boolean {
  return (o.budget_years ?? []).some(
    (by) => by.is_additional && by.budget_status === "Budgeted",
  );
}

// Ordered [header, accessor] pairs. Keeping this explicit (rather than dumping
// every Opp key) gives readable headers, a sensible column order, and lets us
// derive/format values (dates, "Validated" flag, joined year maps, etc.).
const EXPORT_COLUMNS: [string, (o: Opp) => unknown][] = [
  ["ID", (o) => o.opportunity_id],
  ["Name", (o) => o.opportunity_name],
  ["Type", (o) => canonicalType(o)],
  ["Price Increase", (o) => (isPriceIncrease(o) ? "Yes" : "No")],
  ["Saving Nature", (o) => o.saving_nature],
  ["Entry Mode", (o) => o.entry_mode],
  ["Phase", (o) => o.phase_status],
  ["Status", (o) => o.status],
  // Yes when validated/budgeted. The app's canonical value is "Budgeted", but
  // imported (SB12/Monday) rows carry "Validate"; treat anything non-empty
  // other than "Empty" as validated so the flag is meaningful across sources.
  [
    "Validated",
    (o) => {
      const s = (o.validation_status ?? "").trim().toLowerCase();
      return s && s !== "empty" ? "Yes" : "No";
    },
  ],
  ["Validation Status", (o) => o.validation_status],
  ["Gate Decision", (o) => o.validation_decision ?? "Pending"],
  ["Validation Date", (o) => o.val_date],
  ["Priority Category", (o) => o.priority_category],
  ["Priority Score", (o) => o.priority_score],
  ["Committee Level", (o) => o.committee_level],
  ["Idea Owner", (o) => o.idea_owner],
  ["Purchasing Owner", (o) => o.purchasing_owner],
  ["Project Owner", (o) => o.project_owner],
  ["Conversion Owner", (o) => o.conversion_owner],
  ["Plant", (o) => o.plant_name],
  ["Plant City", (o) => o.plant_city],
  ["Currency", (o) => o.currency],
  ["FX Rate to EUR", (o) => o.fx_rate_to_eur],
  ["Expected Annual Saving", (o) => o.expected_annual_saving],
  ["Value of Opportunity", (o) => o.value_of_opportunity],
  ["Period Saving", (o) => o.period_saving],
  ["Cash Impact", (o) => o.cash_impact],
  ["Total Investment", (o) => o.total_investment],
  ["ROI %", (o) => o.roi_percent],
  ["Duration (months)", (o) => o.duration_months],
  ["Budget Year", (o) => o.budget_year],
  // Per-fiscal-year budget commitment (opp.budget_years)
  ["Budgeted", (o) => (budgetedFiscalYears(o).length > 0 ? "Yes" : "No")],
  ["Budgeted FY(s)", (o) => budgetedFiscalYears(o).join(", ")],
  ["Additional Opportunity", (o) => (isAdditional(o) ? "Yes" : "No")],
  [
    "Budget by FY",
    (o) =>
      (o.budget_years ?? [])
        .slice()
        .sort((a, b) => a.fiscal_year - b.fiscal_year)
        .map((by) => {
          const status = by.budget_status || "Empty";
          const amt =
            by.applicable_amount != null
              ? ` ${Math.round(Number(by.applicable_amount))}`
              : "";
          const add = by.is_additional ? " [Additional]" : "";
          return `FY${by.fiscal_year}: ${status}${amt}${add}`;
        })
        .join("; "),
  ],
  [
    "Saving to Budget by Year",
    (o) =>
      o.saving_to_budget_by_year
        ? Object.entries(o.saving_to_budget_by_year)
            .map(([y, v]) => `${y}: ${Math.round(Number(v))}`)
            .join("; ")
        : "",
  ],
  ["Change Mode", (o) => o.change_mode],
  ["Proposed Supplier", (o) => o.proposed_supplier_name],
  ["Current Price", (o) => o.current_price],
  ["Proposed Price", (o) => o.proposed_price],
  ["Study Start", (o) => o.study_start_date],
  ["Planned Start", (o) => o.planned_start_date],
  ["Planned End", (o) => o.planned_end_date],
  ["Real Start", (o) => o.real_start_date],
  ["Execution Start", (o) => o.execution_start_date],
  ["Created At", (o) => o.created_at],
  ["Created By", (o) => o.created_by],
  ["Updated At", (o) => o.updated_at],
  ["Description", (o) => o.description],
  ["Comments", (o) => o.comments],
];

// Sheet 2 — one row per financial line. This is where Phase 2+ execution lives:
// actual (cumulated real) vs expected savings, YTD delta, on-time/late pacing,
// forecast, and the escalation + recovery action taken when a line falls behind.
// Columns take (opportunity, line) so each row carries its parent opp context.
const FIN_LINE_COLUMNS: [string, (o: Opp, l: FinLine) => unknown][] = [
  ["Opp ID", (o) => o.opportunity_id],
  ["Opp Name", (o) => o.opportunity_name],
  ["Type", (o) => o.opportunity_type],
  ["Phase", (o) => o.phase_status],
  ["Opp Status", (o) => o.status],
  ["Plant", (o) => o.plant_name],
  ["Purchasing Owner", (o) => o.purchasing_owner],
  ["Currency", (o) => o.currency],
  ["Line ID", (_o, l) => l.financial_line_id],
  ["Line Name", (_o, l) => l.line_name],
  ["Line Validation", (_o, l) => l.validation_status],
  ["Line Status", (_o, l) => l.status],
  ["Expected Annual Saving", (_o, l) => l.expected_annual_saving],
  ["Budget Value", (_o, l) => l.budget_value],
  ["Actual Saving (cumulated real)", (_o, l) => l.cumulated_real_saving],
  ["Delta vs Expected (YTD)", (_o, l) => l.delta_vs_expected_ytd],
  ["Forecast EOY", (_o, l) => l.forecast_eoy_current],
  ["Pacing (on-time / late)", (_o, l) => l.pacing_status],
  ["Escalated?", (_o, l) => (l.is_escalated ? "Yes" : "No")],
  ["Escalated At", (_o, l) => l.escalated_at],
  ["Escalated By", (_o, l) => l.escalated_by],
  ["Escalation Reason", (_o, l) => l.escalation_reason],
  ["Recovery Status", (_o, l) => l.recovery_status],
  ["Recovery Note", (_o, l) => l.recovery_note],
  ["Recovery Target Date", (_o, l) => l.recovery_target_date],
  ["Recovery Amount", (_o, l) => l.recovery_amount],
  ["Planned Start", (_o, l) => l.planned_start_date],
  ["Duration (months)", (_o, l) => l.duration_months],
];

// Sheet 3 — one row per monthly financial record (month-by-month breakdown).
const MONTHLY_COLUMNS: [string, (o: Opp, l: FinLine, m: MonthlyRow) => unknown][] =
  [
    ["Opp ID", (o) => o.opportunity_id],
    ["Opp Name", (o) => o.opportunity_name],
    ["Phase", (o) => o.phase_status],
    ["Currency", (o) => o.currency],
    ["Line ID", (_o, l) => l.financial_line_id],
    ["Line Name", (_o, l) => l.line_name],
    ["Month", (_o, _l, m) => m.period_month],
    ["Expected Saving", (_o, _l, m) => m.expected_saving],
    ["Actual Saving", (_o, _l, m) => m.actual_saving],
    ["Cumulated Expected", (_o, _l, m) => m.cumulated_expected],
    ["Cumulated Actual", (_o, _l, m) => m.cumulated_actual],
    ["Delta vs Expected", (_o, _l, m) => m.delta_vs_expected],
    ["Forecast EOY", (_o, _l, m) => m.forecast_eoy_saving],
    ["Monthly Outcome", (_o, _l, m) => m.monthly_outcome],
    ["Cash Expected", (_o, _l, m) => m.cash_expected],
    ["Cash Actual", (_o, _l, m) => m.cash_actual],
    ["Cumulated Cash Actual", (_o, _l, m) => m.cumulated_cash_actual],
    ["Forecast Comment", (_o, _l, m) => m.forecast_comment],
    ["Comment", (_o, _l, m) => m.comment],
    ["Updated At", (_o, _l, m) => m.updated_at],
    ["Updated By", (_o, _l, m) => m.updated_by],
  ];

// Sheet 4 — one row per action (flattened from action-plan sujet/action trees).
const ACTION_COLUMNS = [
  "Opp ID",
  "Opp Name",
  "Phase",
  "Plan Title",
  "Plan Code",
  "Sujet",
  "Action",
  "Description",
  "Responsable",
  "Status",
  "Due Date",
  "Closed Date",
  "Timeliness",
] as const;

// Derive an on-time / late label for an action from its due & closed dates.
function actionTimeliness(a: ActionNode, todayIso: string): string {
  const closed = (a.status ?? "").toLowerCase() === "closed" || !!a.closed_date;
  if (!a.due_date) return closed ? "Closed" : "No due date";
  if (closed) {
    const c = a.closed_date ?? "";
    return c && c > a.due_date ? "Closed late" : "Closed on time";
  }
  return todayIso > a.due_date ? "Late" : "On time";
}

// Walk a sujet tree, emitting one flat row per action (and nested sous_actions).
function flattenActions(
  o: Opp,
  plan: ActionPlanRecord,
  sujets: SujetNode[],
  todayIso: string,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const walkSujet = (sujet: SujetNode, sujetPath: string) => {
    const path = sujetPath
      ? `${sujetPath} › ${sujet.titre ?? ""}`
      : sujet.titre ?? "";
    const walkAction = (a: ActionNode, actionPath: string) => {
      const title = actionPath
        ? `${actionPath} › ${a.titre ?? ""}`
        : a.titre ?? "";
      rows.push({
        "Opp ID": o.opportunity_id,
        "Opp Name": o.opportunity_name ?? "",
        Phase: plan.phase_status ?? o.phase_status ?? "",
        "Plan Title": plan.plan_title ?? "",
        "Plan Code": plan.plan_code ?? "",
        Sujet: path,
        Action: title,
        Description: a.description ?? "",
        Responsable: a.responsable ?? "",
        Status: a.status ?? "",
        "Due Date": a.due_date ?? "",
        "Closed Date": a.closed_date ?? "",
        Timeliness: actionTimeliness(a, todayIso),
      });
      for (const child of a.sous_actions ?? []) walkAction(child, title);
    };
    for (const a of sujet.actions ?? []) walkAction(a, "");
    for (const child of sujet.sous_sujets ?? []) walkSujet(child, path);
  };
  for (const s of sujets) walkSujet(s, "");
  return rows;
}

function exportOpportunitiesToExcel(
  opps: Opp[],
  plansByOpp: Map<number, ActionPlanRecord[]>,
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1 — one row per opportunity
  const oppRows = opps.map((o) => {
    const row: Record<string, unknown> = {};
    for (const [header, accessor] of EXPORT_COLUMNS) {
      const v = accessor(o);
      row[header] = v == null ? "" : v;
    }
    return row;
  });
  const wsOpps = XLSX.utils.json_to_sheet(oppRows, {
    header: EXPORT_COLUMNS.map(([h]) => h),
  });
  XLSX.utils.book_append_sheet(wb, wsOpps, "Opportunities");

  // Sheet 2 — one row per financial line (Phase 2+ execution / savings tracking)
  const lineRows: Record<string, unknown>[] = [];
  for (const o of opps) {
    for (const l of o.financial_lines ?? []) {
      const row: Record<string, unknown> = {};
      for (const [header, accessor] of FIN_LINE_COLUMNS) {
        const v = accessor(o, l);
        row[header] = v == null ? "" : v;
      }
      lineRows.push(row);
    }
  }
  const lineHeaders = FIN_LINE_COLUMNS.map(([h]) => h);
  const wsLines =
    lineRows.length > 0
      ? XLSX.utils.json_to_sheet(lineRows, { header: lineHeaders })
      : XLSX.utils.aoa_to_sheet([lineHeaders]);
  XLSX.utils.book_append_sheet(wb, wsLines, "Financial Lines");

  // Sheet 3 — one row per monthly financial record (month-by-month breakdown)
  const monthRows: Record<string, unknown>[] = [];
  for (const o of opps) {
    for (const l of o.financial_lines ?? []) {
      for (const m of l.monthly_financials ?? []) {
        const row: Record<string, unknown> = {};
        for (const [header, accessor] of MONTHLY_COLUMNS) {
          const v = accessor(o, l, m);
          row[header] = v == null ? "" : v;
        }
        monthRows.push(row);
      }
    }
  }
  const monthHeaders = MONTHLY_COLUMNS.map(([h]) => h);
  const wsMonths =
    monthRows.length > 0
      ? XLSX.utils.json_to_sheet(monthRows, { header: monthHeaders })
      : XLSX.utils.aoa_to_sheet([monthHeaders]);
  XLSX.utils.book_append_sheet(wb, wsMonths, "Monthly Breakdown");

  // Sheet 4 — one row per action (flattened from each opportunity's action plans)
  const todayIso = new Date().toISOString().slice(0, 10);
  const actionRows: Record<string, unknown>[] = [];
  for (const o of opps) {
    for (const plan of plansByOpp.get(o.opportunity_id) ?? []) {
      const sujets = plan.plan_data?.sujets ?? [];
      actionRows.push(...flattenActions(o, plan, sujets, todayIso));
    }
  }
  const wsActions =
    actionRows.length > 0
      ? XLSX.utils.json_to_sheet(actionRows, { header: [...ACTION_COLUMNS] })
      : XLSX.utils.aoa_to_sheet([[...ACTION_COLUMNS]]);
  XLSX.utils.book_append_sheet(wb, wsActions, "Action Plans");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `purchasing-value-opportunities-${stamp}.xlsx`);
}


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// Real opportunity types (creation) — "Cash" is not a type, it's a cash_impact
// value any of these types can carry. See FILTER_TYPES for the filter pill,
// which filters by "has a cash_impact" instead of a Cash opportunity_type.
const TYPES = ["Negotiation", "Sourcing", "Technical Productivity"];
const FILTER_TYPES = [...TYPES, "Cash"];
// Profiles allowed to create/duplicate opportunities (mirrors backend _NON_VIEWER).
const EDITOR_PROFILES = [
  "purchasing_manager",
  "vp_conversion",
  "purchasing_director",
  "supplier_owner",
  "global_purchaser",
  "local_purchaser",
];

// ---------------------------------------------------------------------------
// Filter persistence — remembered per logged-in user across navigation/reload
// (kanban filters used to reset every time you left the page and came back).
// See utils/persistedFilters.ts — the same helper is reused by other
// filter-heavy pages (KPI dashboard, SB1 supplier panel, etc).
// ---------------------------------------------------------------------------
const OPPORTUNITY_DELETE_PROFILES = ["vp_conversion", "purchasing_director"];
const PV_FILTERS_PAGE_KEY = "purchasing-value";

interface PvFilters {
  filterType: string;
  filterStatus: string;
  filterBudget: string;
  filterPriority: string;
  filterPlant: string;
  filterPM: string;
  filterPurchasingOwner: string;
  filterConversionOwner: string;
  filterPilot: string;
  filterBudgetYear: string;
  filterEscalated: boolean;
  filterValidation: string;
  showClosed: boolean;
}

const PV_FILTERS_DEFAULT: PvFilters = {
  filterType: "All",
  filterStatus: "All",
  filterBudget: "All",
  filterPriority: "All",
  filterPlant: "All",
  filterPM: "All",
  filterPurchasingOwner: "All",
  filterConversionOwner: "All",
  filterPilot: "All",
  filterBudgetYear: "All",
  filterEscalated: false,
  filterValidation: "All",
  showClosed: false,
};
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
  Negotiation:
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
  Sourcing:
    "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25",
  "Technical Productivity":
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
  Cash: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
};
const STATUS_COLORS: Record<string, string> = {
  Assigned:
    "bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-300",
  "Working on it":
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "Awaiting Validation":
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "Under Committee Review":
    "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  "Needs Rework":
    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  Validated:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Stuck:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  Complete: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  "Customer Refusal":
    "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
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

// Currency symbols (RMB/INR aren't always rendered by Intl currency style, so we
// prefix a symbol ourselves and keep plain grouped numbers).
const CUR_SYMBOL: Record<string, string> = {
  EUR: "€",
  USD: "$",
  RMB: "¥",
  INR: "₹",
};
const curSym = (currency?: string | null) =>
  CUR_SYMBOL[currency ?? "EUR"] ?? `${currency} `;

const fmt = (n?: number | null, currency = "EUR") => {
  if (n == null || (typeof n === "number" && isNaN(n))) return "—";
  const body = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  return `${n < 0 ? "-" : ""}${curSym(currency)}${body}`;
};

// Thousands separators for number INPUTS (display formatted, store raw digits).
const groupDigits = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// Integer field (e.g. annual quantities): "1000000" → "1,000,000"
const fmtIntInput = (s: string) =>
  s ? groupDigits(s.replace(/[^\d]/g, "")) : "";
const stripInt = (s: string) => s.replace(/[^\d]/g, "");
// Decimal field (e.g. costs): group the integer part, keep the decimal portion
const fmtDecInput = (s: string) => {
  if (!s) return "";
  const cleaned = s.replace(/[^\d.]/g, "");
  const [intPart, ...rest] = cleaned.split(".");
  const gi = groupDigits(intPart);
  return rest.length ? `${gi}.${rest.join("")}` : gi;
};
const stripDec = (s: string) => {
  const c = s.replace(/[^\d.]/g, "");
  const p = c.split(".");
  return p.length > 1 ? `${p[0]}.${p.slice(1).join("")}` : c;
};
// Space-grouped variant (e.g. Est. Annual Saving): "1000000" → "1 000 000"
const groupDigitsSpace = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const fmtDecInputSpace = (s: string) => {
  if (!s) return "";
  const cleaned = s.replace(/[^\d.]/g, "");
  const [intPart, ...rest] = cleaned.split(".");
  const gi = groupDigitsSpace(intPart);
  return rest.length ? `${gi}.${rest.join("")}` : gi;
};

// Per-unit prices need decimals (e.g. €0.20), unlike whole-euro totals.
const fmtPrice = (n?: number | string | null, currency = "EUR") => {
  if (n == null || n === "") return "—";
  const v = Number(n);
  const body = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Math.abs(v));
  return `${v < 0 ? "-" : ""}${curSym(currency)}${body}`;
};

const fmtDate = (s?: string | null) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
        day: "numeric",
      })
    : "-";

// Date + time, e.g. "12 Jul, 14:30" — used for reminder timestamps.
const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const fmtMonths = (months?: number | null) => {
  if (months == null || Number.isNaN(Number(months))) return "-";
  const value = Number(months);
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.00$/, "");
};

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
      <span
        className={`break-all text-sm ${valueClassName ?? "text-slate-700 dark:text-slate-200"}`}
      >
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
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
        {value}
      </p>
      {sub && (
        <p
          className={`mt-0.5 text-[10px] ${subClassName ?? "text-slate-400 dark:text-slate-500"}`}
        >
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
    saving_nature: "",
    entry_mode: "",
    idea_owner: userEmail,
    description: "",
    plant_id: "",
    // budget_status removed — only settable after Phase 0 Go (Olivier: "tant que c'est working on it, on n'a pas le droit de le budgeter")
  });
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  // Plant is mandatory for every opportunity type — it drives budgeting, supplier
  // evaluation and per-plant KPI roll-up.
  const needsPlant = true;

  useEffect(() => {
    supplierAPI
      .listSiteOptions()
      .then((r: { data?: SiteOption[] }) => setSites(r.data ?? []))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.plant_id) {
      setError("Plant is required to create an opportunity.");
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
              onChange={(e) =>
                // Reset entry_mode: Bonus/Rework are tied to a specific type.
                setForm((f) => ({
                  ...f,
                  opportunity_type: e.target.value,
                  entry_mode: "",
                }))
              }
            >
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          {(form.opportunity_type === "Negotiation" ||
            form.opportunity_type === "Technical Productivity") && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Mode
              </label>
              <select
                className={inp}
                value={form.entry_mode}
                onChange={(e) => set("entry_mode", e.target.value)}
              >
                <option value="">Standard (price × quantity)</option>
                {form.opportunity_type === "Negotiation" && (
                  <option value="Bonus">Bonus — single one-time gain</option>
                )}
                {form.opportunity_type === "Technical Productivity" && (
                  <option value="Rework">Rework — single one-time gain</option>
                )}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Saving nature
            </label>
            <select
              className={inp}
              value={form.saving_nature}
              onChange={(e) => set("saving_nature", e.target.value)}
            >
              <option value="">— Not classified —</option>
              <option value="Hard">Hard — cost reduction</option>
              <option value="Soft">Soft — cost avoidance</option>
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
type Tab =
  | "overview"
  | "edit"
  | "gate"
  | "financial"
  | "project"
  | "files"
  | "action-plan";

function OverviewTab({ opp }: { opp: Opp }) {
  const pldReady =
    opp.payback_score && opp.lead_time_score && opp.difficulty_score;
  const cur = opp.currency || "EUR";
  const [phaseHistory, setPhaseHistory] = useState<PhaseHistoryEntry[]>([]);

  useEffect(() => {
    let active = true;
    supplierAPI
      .getOpportunityPhaseHistory(opp.opportunity_id)
      .then((res) => {
        if (active) setPhaseHistory((res?.data as PhaseHistoryEntry[]) ?? []);
      })
      .catch(() => {
        if (active) setPhaseHistory([]);
      });
    return () => {
      active = false;
    };
  }, [opp.opportunity_id]);

  const budgetLocks = [...(opp.budget_years ?? [])]
    .filter((by) => by.status_locked_at)
    .sort((a, b) => a.fiscal_year - b.fiscal_year);

  const auditHighlights = [
    {
      label: "Created",
      value: fmtDate(opp.created_at),
      sub: opp.created_by
        ? `by ${opp.created_by}`
        : "Record timestamp from the opportunity table",
    },
    {
      label: "Last update",
      value: fmtDate(opp.updated_at),
      sub: "Latest saved change on this opportunity",
    },
    {
      label: "Budget confirmation",
      value: opp.budget_confirmed_at ? fmtDate(opp.budget_confirmed_at) : "-",
      sub: opp.budget_confirmed_by
        ? `by ${opp.budget_confirmed_by}`
        : "Not budget-confirmed yet",
    },
    {
      label: "Gate decisions",
      value: phaseHistory.length ? String(phaseHistory.length) : "0",
      sub: phaseHistory.length
        ? "Immutable phase snapshots available"
        : "No recorded gate snapshot yet",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_340px]">
      <div className="space-y-5">
        {opp.description && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 leading-relaxed">
            {opp.description}
          </p>
        )}
        {cur !== "EUR" && (
          <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-700">
            Amounts are in <strong>{cur}</strong> (rate{" "}
            {opp.fx_rate_to_eur ?? 1} to EUR). Consolidated reports (Budgeting,
            Monthly Follow-up) convert to EUR.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={<TrendingUp size={12} />}
            label={`Est. Annual Saving (${cur})`}
            value={fmt(opp.expected_annual_saving, cur)}
          />
          <MetricCard
            icon={<Banknote size={12} />}
            label={`Cash Impact (${cur})`}
            value={fmt(opp.cash_impact, cur)}
          />
          <MetricCard
            icon={<Clock size={12} />}
            label="Duration"
            value={
              opp.duration_months != null
                ? `${fmtMonths(opp.duration_months)} months`
                : "-"
            }
          />
          <MetricCard
            icon={<FileText size={12} />}
            label="Budget Year"
            value={opp.budget_year ? String(opp.budget_year) : "-"}
            sub={opp.validation_status ?? undefined}
            subClassName={
              opp.validation_status === "Budgeted"
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
                ? `${opp.plant_name}${opp.plant_city ? ` (${opp.plant_city})` : ""}`
                : opp.plant_id
                  ? `#${opp.plant_id}`
                  : null
            }
          />
          {opp.secondary_plants && (
            <InfoRow label="Secondary Plants" value={opp.secondary_plants} />
          )}
          <InfoRow label="Change Mode" value={opp.change_mode} />
          <InfoRow
            label="Currency"
            value={
              cur === "EUR"
                ? "EUR"
                : `${cur}, rate ${opp.fx_rate_to_eur ?? 1} to EUR`
            }
          />
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
              label="Price Before / After"
              value={`${fmtPrice(opp.current_price, cur)} / ${fmtPrice(opp.proposed_price, cur)}`}
            />
          )}
          {opp.total_investment != null && (
            <InfoRow
              label="Total Investment"
              value={`${fmt(Number(opp.total_investment), cur)} (ROI: ${opp.roi_percent ?? "?"}%)`}
            />
          )}
          {opp.period_saving != null && (
            <InfoRow
              label="Value of Opportunity (total gain N→N+3)"
              value={`${fmt(Number(opp.period_saving), cur)}${opp.roi_period_percent != null ? ` (ROI: ${opp.roi_period_percent}%)` : ""}`}
            />
          )}
          {[
            ["N", opp.saving_year_n],
            ["N+1", opp.saving_year_n1],
            ["N+2", opp.saving_year_n2],
            ["N+3", opp.saving_year_n3],
          ].map(([yr, val]) =>
            val != null ? (
              <InfoRow
                key={yr as string}
                label={`Est. Saving Year ${yr}`}
                value={fmt(Number(val), cur)}
              />
            ) : null,
          )}
          {/* Saving à budgéter — incremental year-over-year drop that actually gets
              budgeted. "budget = Oui" when the year carries a non-zero increment. */}
          {opp.saving_to_budget_by_year &&
            Object.entries(opp.saving_to_budget_by_year)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([yr, val]) => (
                <InfoRow
                  key={`stb-${yr}`}
                  label={`Saving à budgéter ${yr}`}
                  value={`${fmt(Number(val), cur)} — budget : ${Math.abs(Number(val)) >= 0.005 ? "Oui" : "Non (0)"}`}
                />
              ))}
          {opp.budget_years && opp.budget_years.length > 0 && (
            <>
              {[...opp.budget_years]
                .sort((a, b) => a.fiscal_year - b.fiscal_year)
                .map((by) => (
                  <InfoRow
                    key={`by-${by.id}`}
                    label={`Budget ${by.fiscal_year} (${by.portion_kind ?? "-"})`}
                    value={`${fmt(Number(by.applicable_amount ?? 0), cur)} | ${by.budget_status ?? "Empty"} | ${by.suggested_status === "Validate" ? "Validated" : "Forecast"}${by.status_locked_at ? ` | locked ${fmtDate(by.status_locked_at)}${by.status_locked_by ? ` by ${by.status_locked_by}` : ""}` : ""}`}
                  />
                ))}
            </>
          )}
          {opp.cash_inventory_gap != null && (
            <InfoRow
              label="Est. Inventory Gap"
              value={fmt(Number(opp.cash_inventory_gap), cur)}
            />
          )}
          {opp.cash_ap_gap != null && (
            <InfoRow
              label="Est. AP Gap"
              value={fmt(Number(opp.cash_ap_gap), cur)}
            />
          )}
          <InfoRow label="Record Created" value={fmtDate(opp.created_at)} />
          <InfoRow label="Created By" value={opp.created_by} />
          <InfoRow
            label="Last Opportunity Update"
            value={fmtDate(opp.updated_at)}
          />
          <InfoRow
            label="Planned Start"
            value={fmtDate(opp.planned_start_date)}
          />
          <InfoRow label="Planned End" value={fmtDate(opp.planned_end_date)} />
          <InfoRow
            label="Execution Start (Phase 2)"
            value={fmtDate(opp.execution_start_date)}
          />
          <InfoRow
            label="Deployment Start (Phase 3)"
            value={fmtDate(opp.real_start_date)}
          />
          <InfoRow
            label="Validation Date (Phase 0 Go)"
            value={fmtDate(opp.val_date)}
          />
          <InfoRow
            label="Validation Status"
            value={
              opp.validation_status
                ? `${opp.validation_status}${opp.budget_confirmed_at ? ` | confirmed ${fmtDate(opp.budget_confirmed_at)}${opp.budget_confirmed_by ? ` by ${opp.budget_confirmed_by}` : ""}` : ""}`
                : undefined
            }
            valueClassName={
              opp.validation_status === "Budgeted"
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

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4 text-white shadow-[0_14px_38px_rgba(15,23,42,0.18)]">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-200/80">
            Audit Snapshot
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {auditHighlights.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-100/70">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {item.value}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-blue-100/70">
                  {item.sub}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
              Approval Timeline
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {phaseHistory.length} event{phaseHistory.length === 1 ? "" : "s"}
            </span>
          </div>
          {phaseHistory.length === 0 ? (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              No immutable gate snapshot has been recorded yet for this
              opportunity.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {[...phaseHistory].reverse().map((entry) => (
                <div
                  key={entry.snapshot_id}
                  className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-700">
                      {entry.phase_from ?? "-"} to {entry.phase_to ?? "-"}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${entry.gate_decision === "Go" ? "bg-emerald-100 text-emerald-700" : entry.gate_decision === "No Go" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {entry.gate_decision ?? "Decision"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-slate-500">
                    {entry.decided_by ?? "Unknown"} |{" "}
                    {fmtDate(entry.decided_at)}
                  </p>
                  {entry.gate_comments && (
                    <p className="mt-1 text-[10.5px] italic text-slate-600">
                      "{entry.gate_comments}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
            Budget Locks
          </p>
          {budgetLocks.length === 0 ? (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              No budget row is locked yet for this opportunity.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {budgetLocks.map((by) => (
                <div
                  key={`lock-${by.id}`}
                  className="rounded-xl border border-slate-100 bg-white px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-700">
                      FY {by.fiscal_year} | {by.budget_status ?? "Empty"}
                    </p>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                      {by.portion_kind ?? "Budget row"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-slate-500">
                    Locked {fmtDate(by.status_locked_at)}
                    {by.status_locked_by ? ` by ${by.status_locked_by}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Collapsible card used to group the (long) STP study sub-sections.
function FormSection({
  title,
  defaultOpen = true,
  accent,
  highlight,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  accent?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-xl border bg-white ${highlight ? "border-2 border-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]" : "border-slate-200"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${highlight ? "text-rose-600" : (accent ?? "text-slate-400")}`}
        >
          {title}
        </span>
        <ChevronRight
          size={14}
          className={`text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function EditTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [suppliersForPlant, setSuppliersForPlant] = useState<SupplierOption[]>(
    [],
  );
  const isSourced = ["Sourcing", "Technical Productivity"].includes(
    opp.opportunity_type ?? "",
  );
  // Negotiation/Cash opportunities skip PLD scoring entirely — no fields, no requirement.
  const isFlatType = ["Negotiation", "Cash"].includes(
    opp.opportunity_type ?? "",
  );
  // Negotiation has no execution/tooling phase (no supplier qualification, no
  // PPAP work) — only the Deployment Start Date (when the negotiated price
  // actually takes effect) matters, so Execution Start Date is skipped entirely.
  const isNegotiation = opp.opportunity_type === "Negotiation";
  // Bonus (Negotiation) / Rework (Technical Productivity) = a single lump gain
  // entered directly, one-time over 1 month — no price grid, no cash.
  const isDirectGain =
    opp.entry_mode === "Bonus" || opp.entry_mode === "Rework";
  // The STP price×quantity section now applies to Negotiation (standard mode) too,
  // not just Sourcing/Technical Productivity — a negotiation carries prices, quantities,
  // scope and (via renegotiated terms) cash. Direct-gain modes never use it.
  const usesStp = (isSourced || isNegotiation) && !isDirectGain;
  const { user } = useAuth();
  // The only two roles allowed to (a) Approve/Reject a pending STP revision
  // request, AND (b) edit the Phase 2/3 STP baseline directly without going
  // through the request/approve workflow at all. Mirrors the backend's
  // _PRIVILEGED check (router.py) and the actor_role bypass in
  // update_opportunity (service.py) — keep both in sync if this list changes.
  const canDecideStpRevision =
    user?.access_profile === "purchasing_director" ||
    user?.access_profile === "vp_conversion";

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
  // Highlight still-missing required fields for any open opportunity — not just
  // Phase 0 — so a user arriving from the Gate tab's "Complete before sending"
  // list can immediately spot what to fill in, regardless of current phase.
  const gateHighlight = opp.phase_status !== "Closed";
  const missingFlags = {
    scope: !opp.scope_in || !opp.customers,
    scopeIn: !opp.scope_in,
    customers: !opp.customers,
    quantity: !(opp.annual_quantity_n1 && opp.annual_quantity_n1 > 0),
    prices: !(opp.current_price && opp.proposed_price),
    supplierName: !opp.proposed_supplier_name && !opp.proposed_supplier_id,
    logistics: !(
      opp.incoterms_before &&
      opp.incoterms_after &&
      opp.country_after
    ),
    countryAfter: !opp.country_after,
    incoterms: !(opp.incoterms_before && opp.incoterms_after),
    risks: !(
      opp.stp_risks?.material_indexation_before &&
      opp.stp_risks?.material_indexation_after
    ),
    benefits: !(opp.stp_benefits?.if_we_do || opp.stp_benefits?.if_not),
    // Negotiation may leave the STP phase weeks at 0 (no planning ramp), so the
    // Phase 1 weeks are only "missing" for the other types.
    planning: !isNegotiation && !(opp.phase1_weeks && opp.phase1_weeks > 0),
    executionStartDate:
      !isNegotiation &&
      (isSourced
        ? ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]
        : ["Phase 2", "Phase 3", "Phase 4"]
      ).includes(opp.phase_status ?? "") &&
      !opp.execution_start_date,
    realStartDate:
      ["Phase 3", "Phase 4"].includes(opp.phase_status ?? "") &&
      !(opp.budget_years?.some((by) => by.status_locked_at != null) ?? false) &&
      !opp.real_start_date,
  };
  const goApplied = opp.validation_decision === "Go";
  const stpEditablePhases = ["Assigned", "Phase 0", "Phase 1"];
  const showStpSection = usesStp;
  // STP inputs become read-only past the editable phases. They are ALSO locked while
  // the STP is awaiting a gate decision (submitted to a PM / committee) — so the
  // approved document can't be silently changed out from under the reviewer. A
  // "Review / Needs Rework" outcome moves status off these values and unlocks editing.
  const pendingApproval = [
    "Awaiting Validation",
    "Under Committee Review",
  ].includes(opp.status ?? "");
  const isStpPhase23 =
    isSourced && ["Phase 2", "Phase 3"].includes(opp.phase_status ?? "");
  const hasPendingSTPRevision = isStpPhase23 && !!opp.pending_stp_revision;
  // Purchasing Director / VP Conversion ARE the approvers — they can edit the
  // committed STP baseline directly in Phase 2/3 instead of going through the
  // request/approve workflow, as long as there isn't already a pending
  // revision request awaiting their decision (that must be resolved first).
  const canEditStpDirectly =
    canDecideStpRevision && isStpPhase23 && !hasPendingSTPRevision;
  const stpReadOnly =
    (!stpEditablePhases.includes(opp.phase_status ?? "") || pendingApproval) &&
    !canEditStpDirectly;
  // Budget status is derived from validation (Validate→Budgeted). The financial
  // baseline locks once the opportunity is validated/budgeted.
  const isBudgeted = opp.validation_status === "Budgeted";
  const isFxLocked =
    (opp.budget_years ?? []).some((by) => by.budget_status === "Budgeted") ||
    (opp.financial_lines ?? []).some((fl) =>
      (fl.monthly_financials ?? []).some((m) => m.actual_saving != null),
    );
  const locked = isBudgeted;

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
    saving_nature: opp.saving_nature ?? "",
    entry_mode: opp.entry_mode ?? "",
    description: opp.description ?? "",
    // Strip Python Decimal trailing zeros ("12.00"→"12", "2700.00"→"2700")
    // Prevents French locale browser rendering "12,00" in number inputs
    expected_annual_saving:
      opp.expected_annual_saving != null
        ? String(parseFloat(String(opp.expected_annual_saving)))
        : "",
    cash_impact:
      opp.cash_impact != null
        ? String(parseFloat(String(opp.cash_impact)))
        : "",
    duration_months: opp.duration_months
      ? String(parseInt(String(opp.duration_months)))
      : "",
    planned_start_date: opp.planned_start_date ?? "",
    execution_start_date: opp.execution_start_date ?? "",
    real_start_date: opp.real_start_date ?? "",
    budget_year: opp.budget_year
      ? String(parseInt(String(opp.budget_year)))
      : "",
    change_mode: normalizeChangeMode(opp.change_mode),
    currency: opp.currency ?? "EUR",
    fx_rate_to_eur:
      opp.fx_rate_to_eur != null ? String(opp.fx_rate_to_eur) : "1",
    assumptions_summary: opp.assumptions_summary ?? "",
    comments: opp.comments ?? "",
    purchasing_owner: opp.purchasing_owner ?? "",
    // Default conversion_owner to purchasing_owner if not set
    conversion_owner: opp.conversion_owner ?? opp.purchasing_owner ?? "",
    payback_score: opp.payback_score ?? ("" as number | ""),
    lead_time_score: opp.lead_time_score ?? ("" as number | ""),
    difficulty_score: opp.difficulty_score ?? ("" as number | ""),
    // forced_priority = the manually overridden category; "" = auto (PLD)
    forced_priority:
      opp.priority_locked && opp.priority_category ? opp.priority_category : "",
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
    supplier_id: opp.supplier_id ? String(opp.supplier_id) : "",
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
    place_of_incoterms_before: opp.place_of_incoterms_before ?? "",
    place_of_incoterms_after: opp.place_of_incoterms_after ?? "",
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
    risk_material_indexation_before:
      opp.stp_risks?.material_indexation_before ?? "",
    risk_material_indexation_after:
      opp.stp_risks?.material_indexation_after ?? "",
    risk_material_indexation_desc:
      opp.stp_risks?.material_indexation_desc ?? "",
    risk_exchange_rate_before: opp.stp_risks?.exchange_rate_before ?? "",
    risk_exchange_rate_after: opp.stp_risks?.exchange_rate_after ?? "",
    risk_exchange_rate_desc: opp.stp_risks?.exchange_rate_desc ?? "",
    risk_local_content_before: opp.stp_risks?.local_content_before ?? "",
    risk_local_content_after: opp.stp_risks?.local_content_after ?? "",
    risk_local_content_desc: opp.stp_risks?.local_content_desc ?? "",
    risk_quality_before: opp.stp_risks?.quality_before ?? "",
    risk_quality_after: opp.stp_risks?.quality_after ?? "",
    risk_quality_desc: opp.stp_risks?.quality_desc ?? "",
    risk_other_before: opp.stp_risks?.other_before ?? "",
    risk_other_after: opp.stp_risks?.other_after ?? "",
    risk_other_desc: opp.stp_risks?.other_desc ?? "",
    material_same_spec: opp.stp_risks?.material_same_spec ?? "",
    same_tooling: opp.stp_risks?.same_tooling ?? "",
    same_dimension: opp.stp_risks?.same_dimension ?? "",
    same_process: opp.stp_risks?.same_process ?? "",
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
    secondary_plants: opp.secondary_plants ?? "",
    plant_id: opp.plant_id ? String(opp.plant_id) : "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Non-blocking "still needed before you can request approval" notice, shown
  // after a successful save. Saving is intentionally permissive (the user can
  // fill fields incrementally); these fields are only *enforced* at the gate.
  const [saveNotice, setSaveNotice] = useState<string[] | null>(null);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // Negotiation opportunities usually keep the SAME supplier — it's a
  // renegotiated price, not a re-source. Default the proposed/new supplier to
  // the current supplier so the user doesn't have to re-enter it. Only fills
  // when the proposed fields are still empty, so it stays fully editable and a
  // deliberate change is never overwritten.
  useEffect(() => {
    if (!isNegotiation) return;
    const currentId = form.supplier_id;
    if (!currentId) return;
    const current = suppliersForPlant.find(
      (s) => String(s.id_supplier_unit) === String(currentId),
    );
    setForm((f) => {
      const patch: Record<string, string> = {};
      if (!f.proposed_supplier_id) patch.proposed_supplier_id = String(currentId);
      if (!f.proposed_supplier_name && current?.supplier_name)
        patch.proposed_supplier_name = current.supplier_name;
      return Object.keys(patch).length ? { ...f, ...patch } : f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNegotiation, form.supplier_id, suppliersForPlant]);

  // STP revision request modal (Phase 2/3) — inputs here are the NEW proposed
  // values, independent of the (disabled) main STP form. Left blank = unchanged.
  const [stpRevModal, setStpRevModal] = useState(false);
  const emptyStpRevForm = {
    note: "",
    current_price: "",
    proposed_price: "",
    current_price_n1: "",
    current_price_n2: "",
    current_price_n3: "",
    proposed_price_n1: "",
    proposed_price_n2: "",
    proposed_price_n3: "",
    annual_quantity_n1: "",
    annual_quantity_n2: "",
    annual_quantity_n3: "",
    annual_quantity_n4: "",
    bonus_before: "",
    bonus_after: "",
  };
  const [stpRevForm, setStpRevForm] = useState(emptyStpRevForm);
  const [stpRevLoading, setStpRevLoading] = useState(false);
  const [stpRevError, setStpRevError] = useState<string | null>(null);
  const stpRevHasChange = Object.entries(stpRevForm).some(
    ([k, v]) => k !== "note" && String(v).trim() !== "",
  );

  // STP revision decision modal (Director)
  const [stpDecModal, setStpDecModal] = useState(false);
  const [stpDecForm, setStpDecForm] = useState({
    decision: "Approved",
    note: "",
  });
  const [stpDecLoading, setStpDecLoading] = useState(false);
  const [stpDecError, setStpDecError] = useState<string | null>(null);

  // Live-computed end date: last day of the final month in the period
  // duration=1, start=Oct → 31 Oct | duration=12, start=Oct → 30 Sep next year
  const computedEndDate = (() => {
    const start = form.planned_start_date || opp.planned_start_date;
    const dur = form.duration_months
      ? parseInt(form.duration_months)
      : opp.duration_months
        ? Number(opp.duration_months)
        : null;
    if (!start || !dur || dur <= 0) return null;
    const d = new Date(start);
    d.setMonth(d.getMonth() + dur - 1);
    d.setMonth(d.getMonth() + 1, 0);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  })();

  // Recommended savings start = study/planned anchor + planned phase 1–3 weeks
  // (study + feasibility + deployment). A suggestion the user can apply to Planned
  // Start; mirrors the backend recommend_savings_start_date().
  const recommendedSavingsStart = (() => {
    const anchor =
      form.execution_start_date ||
      opp.execution_start_date ||
      opp.study_start_date ||
      form.planned_start_date ||
      opp.planned_start_date;
    if (!anchor) return null;
    const d = new Date(anchor);
    if (isNaN(d.getTime())) return null;
    const weeks =
      (parseInt(form.phase1_weeks || "0") || 0) +
      (parseInt(form.phase2_weeks || "0") || 0) +
      (parseInt(form.phase3_weeks || "0") || 0);
    if (weeks > 0) d.setDate(d.getDate() + weeks * 7);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      iso,
      label: d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    };
  })();

  // Live PLD computation (component-level so submit handler can use them too)
  const _pldTotalInv =
    (parseFloat(form.tooling_cost || "0") || 0) +
    (parseFloat(form.travel_cost || "0") || 0) +
    (parseFloat(form.qualification_cost || "0") || 0) +
    (parseFloat(form.other_cost || "0") || 0);
  const _pldAnnSaving = parseFloat(form.expected_annual_saving || "0") || 0;
  const _pldHasInvData = _pldAnnSaving > 0 || _pldTotalInv > 0;
  const _pldPaybackMonths =
    _pldAnnSaving > 0
      ? _pldTotalInv / (_pldAnnSaving / 12)
      : _pldTotalInv > 0
        ? 999
        : 0;
  // Auto-calculated P from investment/savings (STP types only)
  const _autoP = !_pldHasInvData
    ? null
    : _pldPaybackMonths === 0
      ? 1
      : _pldPaybackMonths <= 2
        ? 2
        : _pldPaybackMonths <= 4
          ? 3
          : _pldPaybackMonths <= 12
            ? 4
            : 5;
  // Manual value in form overrides auto-calc for both STP and non-STP types
  const livePScore = form.payback_score
    ? Number(form.payback_score)
    : isSourced
      ? _autoP
      : null;
  const _pldTotalWeeks =
    (parseInt(form.phase1_weeks || "0") || 0) +
    (parseInt(form.phase2_weeks || "0") || 0) +
    (parseInt(form.phase3_weeks || "0") || 0);
  const _pldLeadMonths = _pldTotalWeeks / 4.33;
  // Auto-calculated L from phase weeks (STP types only)
  const _autoL =
    _pldTotalWeeks === 0
      ? null
      : _pldLeadMonths < 1
        ? 1
        : _pldLeadMonths < 2
          ? 2
          : _pldLeadMonths < 4
            ? 3
            : _pldLeadMonths < 6
              ? 4
              : 5;
  // Manual value in form overrides auto-calc for both STP and non-STP types
  const liveLScore = form.lead_time_score
    ? Number(form.lead_time_score)
    : isSourced
      ? _autoL
      : null;
  const liveDScore = form.difficulty_score
    ? Number(form.difficulty_score)
    : null;

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

  // ── STP financials — live, exact formulas from Excel "format STP rev 1.2" ──
  // Full year (D51) = (E26-G26)*D13 + E30-G30
  // Period   (D52)  = Σ qty_Nx × (price_before_x − price_after_x) + bonus delta
  // ROI full (F51)  = (D51-D45)/D51   ROI period (F52) = (D52-D41)/D41
  // Inventory gap (D55) / AP gap (D56) — blanks count as 0, AVERAGE ignores blanks
  const num = (v: string) => (v ? parseFloat(v) || 0 : 0);
  const stpPricesBefore = [
    num(form.current_price),
    num(form.current_price_n1),
    num(form.current_price_n2),
    num(form.current_price_n3),
  ];
  const stpPricesAfter = [
    num(form.proposed_price),
    num(form.proposed_price_n1),
    num(form.proposed_price_n2),
    num(form.proposed_price_n3),
  ];
  const stpQty = [
    form.annual_quantity_n1,
    form.annual_quantity_n2,
    form.annual_quantity_n3,
    form.annual_quantity_n4,
  ].map((v) => (v ? parseInt(v) || 0 : null));
  const bonusDelta = num(form.bonus_before) - num(form.bonus_after);
  const hasBasePrices = !!form.current_price && !!form.proposed_price;
  const fullYearSaving =
    hasBasePrices && stpQty[0]
      ? (stpPricesBefore[0] - stpPricesAfter[0]) * stpQty[0] + bonusDelta
      : null;
  const periodSaving =
    fullYearSaving != null
      ? stpQty.reduce(
          (sum: number, q, i) =>
            sum + (q ?? 0) * (stpPricesBefore[i] - stpPricesAfter[i]),
          0,
        ) + bonusDelta
      : null;
  // Estimated saving per year (year N incl. bonus; sum == periodSaving)
  const savingPerYear =
    fullYearSaving != null
      ? stpQty.map(
          (q, i) =>
            (q ?? 0) * (stpPricesBefore[i] - stpPricesAfter[i]) +
            (i === 0 ? bonusDelta : 0),
        )
      : null;
  // Budget-year prorated split — budget year N = 01 Dec N-1 -> 30 Nov N.
  // Allocation is by actual days from the savings start, mirroring
  // compute_budget_year_portions backend.
  const savingByYear = (() => {
    if (savingPerYear == null) return null;
    const projectAnchor =
      opp.study_start_date || form.planned_start_date || opp.planned_start_date;
    if (!projectAnchor) return null;
    const parseLocalDate = (value: string) => {
      const [y, m, d] = value.split("-").map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    let start: Date;
    const realStart = form.real_start_date || opp.real_start_date;
    if (realStart) {
      start = parseLocalDate(realStart);
    } else {
      start = parseLocalDate(projectAnchor);
      if (isNaN(start.getTime())) return null;
      // Phases 1–3 only — savings flow once deployment ends, before Phase 4 closure.
      const weeks =
        (parseInt(form.phase1_weeks || "0") || 0) +
        (parseInt(form.phase2_weeks || "0") || 0) +
        (parseInt(form.phase3_weeks || "0") || 0);
      start.setDate(start.getDate() + weeks * 7);
    }
    if (isNaN(start.getTime())) return null;
    const maxMonths = 12 * savingPerYear.length;
    const durMonths = parseInt(form.duration_months || "0") || 0;
    const months = durMonths > 0 ? Math.min(durMonths, maxMonths) : maxMonths;
    const addMonthsPreserveDay = (base: Date, offsetMonths: number) => {
      const d = new Date(base);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const target = new Date(year, month + offsetMonths, 1);
      const lastDay = new Date(
        target.getFullYear(),
        target.getMonth() + 1,
        0,
      ).getDate();
      return new Date(
        target.getFullYear(),
        target.getMonth(),
        Math.min(day, lastDay),
      );
    };
    const budgetYearForDate = (d: Date) =>
      d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
    const budgetYearEndExclusive = (fy: number) => new Date(fy, 11, 1);
    const acc: Record<number, number> = {};
    const overallEnd = addMonthsPreserveDay(start, months);

    for (let i = 0; i < savingPerYear.length; i++) {
      const annual = savingPerYear[i];
      if (annual == null) continue;
      const windowStart = addMonthsPreserveDay(start, i * 12);
      const windowEnd = addMonthsPreserveDay(start, (i + 1) * 12);
      if (windowStart >= overallEnd) break;
      const effectiveEnd = windowEnd < overallEnd ? windowEnd : overallEnd;
      const windowDays =
        (windowEnd.getTime() - windowStart.getTime()) / 86400000;
      if (windowDays <= 0 || effectiveEnd <= windowStart) continue;

      let cursor = windowStart;
      while (cursor < effectiveEnd) {
        const fy = budgetYearForDate(cursor);
        const fyEnd = budgetYearEndExclusive(fy);
        const sliceEnd = fyEnd < effectiveEnd ? fyEnd : effectiveEnd;
        const days = (sliceEnd.getTime() - cursor.getTime()) / 86400000;
        if (days > 0) {
          acc[fy] = (acc[fy] || 0) + (annual * days) / windowDays;
        }
        cursor = sliceEnd;
      }
    }
    return Object.entries(acc)
      .map(([y, v]) => ({ year: Number(y), amount: v }))
      .sort((a, b) => a.year - b.year);
  })();
  // ROI = gain ÷ TOTAL investment × 100 (purchasing-director rule 17/06/2026)
  const roiFullYear =
    fullYearSaving != null && _pldTotalInv > 0
      ? (fullYearSaving / _pldTotalInv) * 100
      : null;
  const roiPeriod =
    periodSaving != null && _pldTotalInv > 0
      ? (periodSaving / _pldTotalInv) * 100
      : null;
  const presentQty = stpQty.filter((q): q is number => q != null);
  const avgQty = presentQty.length
    ? presentQty.reduce((a, b) => a + b, 0) / presentQty.length
    : null;
  const inventoryGap =
    avgQty != null && hasBasePrices
      ? (form.consignment_before === "Yes"
          ? 0
          : ((num(form.transit_days_before) + 14) * avgQty) / 360) *
          stpPricesBefore[0] -
        (form.consignment_after === "Yes"
          ? 0
          : ((num(form.transit_days_after) + 14) * avgQty) / 360) *
          stpPricesAfter[0]
      : null;
  const apGap =
    avgQty != null && hasBasePrices
      ? (-avgQty *
          (num(form.top_days_before) * stpPricesBefore[0] -
            num(form.top_days_after) * stpPricesAfter[0])) /
        360
      : null;
  // Chained phase dates (Excel planning: end = start + weeks×7, next phase starts at previous end)
  const phaseDates = (() => {
    // Phase 1 start = manual execution_start_date entry, else fall back to study/planned anchor
    const anchor =
      form.execution_start_date ||
      opp.execution_start_date ||
      opp.study_start_date ||
      form.planned_start_date ||
      opp.planned_start_date;
    const weeks = [
      form.phase1_weeks,
      form.phase2_weeks,
      form.phase3_weeks,
      form.phase4_weeks,
    ].map((v) => (v ? parseInt(v) || 0 : 0));
    if (!anchor || !weeks.some((w) => w > 0)) return null;
    let cursor = new Date(anchor);
    if (isNaN(cursor.getTime())) return null;
    const fmtD = (d: Date) =>
      d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      });
    return weeks.map((w) => {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + w * 7);
      cursor = end;
      return { start: fmtD(start), end: fmtD(end) };
    });
  })();

  // EBITDA Period (all fulfilled years) is the STP headline saving; Cash Impact =
  // Inventory + AP gap. Both auto-calculated & read-only for STP types.
  const autoSaving = periodSaving != null ? Math.round(periodSaving) : null;
  const autoCashImpact =
    inventoryGap != null || apGap != null
      ? Math.round((inventoryGap ?? 0) + (apGap ?? 0))
      : null;

  useEffect(() => {
    if (autoSaving != null && autoSaving > 0 && !locked) {
      setForm((f) =>
        f.expected_annual_saving
          ? f // never overwrite a value the user already entered or that was loaded
          : { ...f, expected_annual_saving: autoSaving.toString() },
      );
    }
  }, [
    form.current_price,
    form.proposed_price,
    form.annual_quantity_n1,
    form.bonus_before,
    form.bonus_after,
  ]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    // Required-field completeness is ADVISORY at save time — the user can save a
    // partially-filled opportunity and finish the rest later. The same list is
    // surfaced as a non-blocking notice after saving (setSaveNotice) and is
    // ENFORCED (blocking) only at the gate/committee request. This replaces the
    // old behaviour where saving was blocked until every field was filled.
    const missing: string[] = [];
    {
      const phase = opp.phase_status ?? "";

      if (["Phase 0", "Phase 1"].includes(phase)) {
        // Direct-gain (Bonus/Rework) duration is fixed at 1 month and the field
        // is read-only — don't require the user to fill it.
        if (
          !isDirectGain &&
          (!form.duration_months || parseInt(form.duration_months) <= 0)
        ) {
          missing.push("Duration (months)");
        }
        if (
          form.expected_annual_saving.trim() === "" ||
          parseFloat(form.expected_annual_saving) < 0
        ) {
          missing.push("Est. Annual Saving");
        }
        if (!form.planned_start_date) {
          missing.push("Planned Start Date");
        }
        // Negotiation/Cash skip PLD scoring; Bonus/Rework (direct-gain) also skip the
        // STP price/quantity/scope requirements — they only carry a single gain.
        if (!isFlatType && !isDirectGain) {
          if (!form.plant_id) missing.push("Plant");
          if (!form.scope_in) missing.push("Scope IN");
          if (!form.proposed_supplier_name) {
            missing.push("Proposed supplier name");
          }
          // All four years of quantity + current price + proposed price are required
          // (Olivier, call 2026-07-10): the per-year saving and the "saving à budgéter"
          // only make sense with every year filled in.
          const yrLabels = ["N", "N+1", "N+2", "N+3"];
          const qtyFields = [
            form.annual_quantity_n1,
            form.annual_quantity_n2,
            form.annual_quantity_n3,
            form.annual_quantity_n4,
          ];
          const currentPriceFields = [
            form.current_price,
            form.current_price_n1,
            form.current_price_n2,
            form.current_price_n3,
          ];
          const proposedPriceFields = [
            form.proposed_price,
            form.proposed_price_n1,
            form.proposed_price_n2,
            form.proposed_price_n3,
          ];
          yrLabels.forEach((lbl, i) => {
            if (!qtyFields[i] || parseInt(qtyFields[i]) <= 0) {
              missing.push(`Quantity (Year ${lbl})`);
            }
            if (
              !currentPriceFields[i] ||
              parseFloat(currentPriceFields[i]) <= 0
            ) {
              missing.push(`Current Price (Year ${lbl})`);
            }
            if (
              !proposedPriceFields[i] ||
              parseFloat(proposedPriceFields[i]) <= 0
            ) {
              missing.push(`Proposed Price (Year ${lbl})`);
            }
          });
        }
      }

      // Phase 1 Starting Date / Execution Start Date — same underlying field.
      // Sourcing/Technical Productivity opportunities expose it as "Phase 1
      // Starting Date" already in Phase 1 (STP planning section), so it's
      // required from there; other types only get the field from Phase 2.
      // Negotiation has no execution/tooling phase, so it never requires it.
      const executionDateRequiredPhases = isNegotiation
        ? []
        : isSourced
          ? ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]
          : ["Phase 2", "Phase 3", "Phase 4"];
      if (
        executionDateRequiredPhases.includes(phase) &&
        !form.execution_start_date
      ) {
        missing.push(
          isSourced && phase === "Phase 1"
            ? "Phase 1 Starting Date"
            : "Execution Start Date",
        );
      }

      // Phase 3 — savings are flowing, so the real deployment start date must be
      // recorded (unless the budget year is already closed and the field is locked).
      if (["Phase 3", "Phase 4"].includes(phase)) {
        const budgetLocked =
          opp.budget_years?.some((by) => by.status_locked_at != null) ?? false;
        if (!budgetLocked && !form.real_start_date) {
          missing.push("Deployment Start Date (Real Savings Start)");
        }
      }
    }

    // Client-side FX guard — catch the obvious case before hitting the API.
    // This one STAYS blocking: the backend rejects a non-EUR opportunity saved
    // without a conversion rate (service.py FX final-state guard), so allowing
    // the save would just fail server-side.
    if (form.currency && form.currency !== "EUR") {
      const rate = parseFloat(form.fx_rate_to_eur ?? "0");
      if (!rate || rate <= 0) {
        setError(
          `FX rate to EUR is required for ${form.currency} opportunities. ` +
            `Enter the conversion rate (e.g. 0.920000 means 1 ${form.currency} = 0.92 EUR) ` +
            `before saving. Without it, consolidated KPI totals will be wrong.`,
        );
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSaveNotice(null);

    // Budget status / year are derived from validation — nothing to validate here.

    try {
      const res = await supplierAPI.updateOpportunity(opp.opportunity_id, {
        opportunity_name: form.opportunity_name || undefined,
        saving_nature: form.saving_nature || undefined,
        // "" → "Standard" so a user can switch a Bonus/Rework back to standard STP.
        entry_mode: form.entry_mode || "Standard",
        // Send "" (not undefined) so clearing the field actually erases the
        // description — undefined is dropped by JSON.stringify, so the backend
        // would never receive the change and nothing would happen.
        description: form.description ?? "",
        expected_annual_saving: form.expected_annual_saving
          ? parseFloat(form.expected_annual_saving)
          : undefined,
        cash_impact: form.cash_impact
          ? parseFloat(form.cash_impact)
          : undefined,
        // Bonus/Rework are a single one-time gain — always 1 month, regardless
        // of the (read-only) form value.
        duration_months: isDirectGain
          ? 1
          : form.duration_months
            ? parseInt(form.duration_months)
            : undefined,
        planned_start_date: form.planned_start_date || undefined,
        execution_start_date: form.execution_start_date || undefined,
        real_start_date: form.real_start_date || undefined,
        change_mode: form.change_mode || undefined,
        currency: form.currency || undefined,
        fx_rate_to_eur: isFxLocked
          ? undefined
          : form.fx_rate_to_eur
            ? parseFloat(form.fx_rate_to_eur)
            : undefined,
        assumptions_summary: form.assumptions_summary || undefined,
        comments: form.comments || undefined,
        purchasing_owner: form.purchasing_owner || undefined,
        conversion_owner: form.conversion_owner || undefined,
        payback_score: livePScore ?? undefined,
        lead_time_score: liveLScore ?? undefined,
        difficulty_score: liveDScore ?? undefined,
        priority_locked: form.forced_priority !== "" ? true : false,
        priority_category_override: form.forced_priority || undefined,
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
        place_of_incoterms_before: form.place_of_incoterms_before || undefined,
        place_of_incoterms_after: form.place_of_incoterms_after || undefined,
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
        other_cost: form.other_cost ? parseFloat(form.other_cost) : undefined,
        stp_risks: {
          material_indexation_before:
            form.risk_material_indexation_before || undefined,
          material_indexation_after:
            form.risk_material_indexation_after || undefined,
          material_indexation_desc:
            form.risk_material_indexation_desc || undefined,
          exchange_rate_before: form.risk_exchange_rate_before || undefined,
          exchange_rate_after: form.risk_exchange_rate_after || undefined,
          exchange_rate_desc: form.risk_exchange_rate_desc || undefined,
          local_content_before: form.risk_local_content_before || undefined,
          local_content_after: form.risk_local_content_after || undefined,
          local_content_desc: form.risk_local_content_desc || undefined,
          quality_before: form.risk_quality_before || undefined,
          quality_after: form.risk_quality_after || undefined,
          quality_desc: form.risk_quality_desc || undefined,
          other_before: form.risk_other_before || undefined,
          other_after: form.risk_other_after || undefined,
          other_desc: form.risk_other_desc || undefined,
          material_same_spec: form.material_same_spec || undefined,
          same_tooling: form.same_tooling || undefined,
          same_dimension: form.same_dimension || undefined,
          same_process: form.same_process || undefined,
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
        secondary_plants: form.secondary_plants || undefined,
        changed_by: userEmail,
      });
      // Always refetch after save so server-computed fields (period saving, ROI,
      // cash gaps, total investment, rebuilt monthly profiles) are displayed
      // consistently — single refresh path regardless of which fields changed.
      try {
        const fresh = await supplierAPI.getOpportunity(opp.opportunity_id);
        onRefresh(fresh.data as Opp);
      } catch {
        onRefresh(res.data as Opp);
      }
      // Saved successfully — surface (without blocking) any fields still needed
      // before this opportunity can be sent for gate/committee approval.
      setSaveNotice(missing.length ? missing : null);
    } catch (err: unknown) {
      // Request Revision creation is disabled (see the DISABLED block below) —
      // a non-privileged user hitting STP_REQUIRES_APPROVAL just gets the plain
      // error message now instead of a modal that leads nowhere.
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitSTPRevisionRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!stpRevForm.note.trim() || !stpRevHasChange) return;
    setStpRevLoading(true);
    setStpRevError(null);
    try {
      await supplierAPI.requestSTPRevision(opp.opportunity_id, {
        note: stpRevForm.note.trim(),
        requested_by: userEmail,
        current_price: stpRevForm.current_price
          ? parseFloat(stpRevForm.current_price)
          : undefined,
        proposed_price: stpRevForm.proposed_price
          ? parseFloat(stpRevForm.proposed_price)
          : undefined,
        current_price_n1: stpRevForm.current_price_n1
          ? parseFloat(stpRevForm.current_price_n1)
          : undefined,
        current_price_n2: stpRevForm.current_price_n2
          ? parseFloat(stpRevForm.current_price_n2)
          : undefined,
        current_price_n3: stpRevForm.current_price_n3
          ? parseFloat(stpRevForm.current_price_n3)
          : undefined,
        proposed_price_n1: stpRevForm.proposed_price_n1
          ? parseFloat(stpRevForm.proposed_price_n1)
          : undefined,
        proposed_price_n2: stpRevForm.proposed_price_n2
          ? parseFloat(stpRevForm.proposed_price_n2)
          : undefined,
        proposed_price_n3: stpRevForm.proposed_price_n3
          ? parseFloat(stpRevForm.proposed_price_n3)
          : undefined,
        annual_quantity_n1: stpRevForm.annual_quantity_n1
          ? parseInt(stpRevForm.annual_quantity_n1)
          : undefined,
        annual_quantity_n2: stpRevForm.annual_quantity_n2
          ? parseInt(stpRevForm.annual_quantity_n2)
          : undefined,
        annual_quantity_n3: stpRevForm.annual_quantity_n3
          ? parseInt(stpRevForm.annual_quantity_n3)
          : undefined,
        annual_quantity_n4: stpRevForm.annual_quantity_n4
          ? parseInt(stpRevForm.annual_quantity_n4)
          : undefined,
        bonus_before: stpRevForm.bonus_before
          ? parseFloat(stpRevForm.bonus_before)
          : undefined,
        bonus_after: stpRevForm.bonus_after
          ? parseFloat(stpRevForm.bonus_after)
          : undefined,
      });
      setStpRevModal(false);
      setStpRevForm(emptyStpRevForm);
      const fresh = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(fresh.data as Opp);
    } catch (err: unknown) {
      setStpRevError(
        err instanceof Error
          ? err.message
          : "Failed to submit revision request.",
      );
    } finally {
      setStpRevLoading(false);
    }
  }

  async function submitSTPDecision(e: React.FormEvent) {
    e.preventDefault();
    setStpDecLoading(true);
    setStpDecError(null);
    try {
      await supplierAPI.decideSTPRevision(opp.opportunity_id, {
        decision: stpDecForm.decision,
        decided_by: userEmail,
        note: stpDecForm.note.trim() || undefined,
      });
      setStpDecModal(false);
      setStpDecForm({ decision: "Approved", note: "" });
      const fresh = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(fresh.data as Opp);
    } catch (err: unknown) {
      setStpDecError(
        err instanceof Error ? err.message : "Failed to record decision.",
      );
    } finally {
      setStpDecLoading(false);
    }
  }

  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const label = "mb-1 block text-xs font-semibold text-slate-600";
  const inpHi =
    "w-full rounded-xl border-2 border-rose-500 bg-rose-50 px-3 py-2 text-sm outline-none shadow-[0_0_0_3px_rgba(244,63,94,0.12)] focus:border-rose-600 focus:ring-2 focus:ring-rose-200";
  const labelHi = "mb-1 block text-xs font-bold text-rose-600";
  // Small table-style inputs (Logistics / Prices before-after grid) get a
  // slimmer highlighted variant instead of the full `inp`/`inpHi` treatment.
  const cellInp =
    "w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300";
  const cellInpHi =
    "w-full rounded border-2 border-rose-500 bg-rose-50 px-2 py-1 text-xs outline-none shadow-[0_0_0_2px_rgba(244,63,94,0.12)] focus:border-rose-600";
  const hi = (missing: boolean) => (gateHighlight && missing ? inpHi : inp);
  const hiLabel = (missing: boolean) =>
    gateHighlight && missing ? labelHi : label;
  const hiCell = (missing: boolean) =>
    gateHighlight && missing ? cellInpHi : cellInp;

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {saveNotice && saveNotice.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            <p className="font-semibold">
              Saved. These fields are still required before you can request
              approval:
            </p>
            <ul className="mt-1 list-disc pl-5">
              {saveNotice.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {phaseNote[opp.phase_status ?? ""] && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
            {phaseNote[opp.phase_status ?? ""]}
          </div>
        )}
        <div className="order-1">
          <label className={label}>Opportunity Name</label>
          <input
            className={inp}
            value={form.opportunity_name}
            onChange={(e) => set("opportunity_name", e.target.value)}
          />
        </div>
        <div className="order-2">
          <label className={label}>Description</label>
          <textarea
            rows={2}
            className={`${inp} resize-none`}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        {(opp.opportunity_type === "Negotiation" ||
          opp.opportunity_type === "Technical Productivity") && (
          <div className="order-3">
            <label className={label}>Mode</label>
            {/* Mode is fixed at creation (like opportunity_type) — switching it later
                would wipe the STP grid. To change it, duplicate or recreate. */}
            <div
              className={`${inp} bg-slate-100 text-slate-600 flex items-center justify-between`}
            >
              <span>
                {opp.entry_mode === "Bonus"
                  ? "Bonus — single one-time gain"
                  : opp.entry_mode === "Rework"
                    ? "Rework — single one-time gain"
                    : "Standard (price × quantity)"}
              </span>
              <span className="text-[10px] text-slate-400">
                set at creation
              </span>
            </div>
          </div>
        )}
        <div className="order-3">
          <label className={label}>Saving nature</label>
          <select
            className={inp}
            value={form.saving_nature}
            onChange={(e) => set("saving_nature", e.target.value)}
          >
            <option value="">— Not classified —</option>
            <option value="Hard">Hard — cost reduction</option>
            <option value="Soft">Soft — cost avoidance</option>
          </select>
        </div>
        {/* Other fields (baseline + alerts + PLD) — shown AFTER the STP study */}
        <div className="order-4 flex flex-col gap-4">
          {/* ---- FINANCIAL BASELINE (locked once Budgeted) ---- */}
          <div
            className={`rounded-xl p-4 space-y-3 ${locked ? "bg-slate-50 border border-slate-200" : ""}`}
          >
            {locked && (
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-400">
                <Lock size={10} /> Financial baseline — locked (real start date
                entered)
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className={
                    !usesStp
                      ? hiLabel(opp.expected_annual_saving == null)
                      : label
                  }
                >
                  {usesStp
                    ? "EBITDA Period (€)"
                    : isDirectGain
                      ? "Gain (€)"
                      : "Est. Annual Saving (€)"}
                  <span className="ml-1 font-normal text-slate-400">
                    {usesStp
                      ? "— auto, all years (N…N+3)"
                      : isDirectGain
                        ? "— one-time gain"
                        : ""}
                  </span>
                </label>
                {usesStp ? (
                  <div
                    className={`${inp} bg-emerald-50 font-bold text-emerald-700`}
                  >
                    {autoSaving != null
                      ? `€${autoSaving.toLocaleString("en-GB")}`
                      : opp.expected_annual_saving != null
                        ? fmt(opp.expected_annual_saving)
                        : "—"}
                  </div>
                ) : (
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={locked}
                    className={`${hi(opp.expected_annual_saving == null)} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                    value={fmtDecInputSpace(form.expected_annual_saving)}
                    onChange={(e) =>
                      set("expected_annual_saving", stripDec(e.target.value))
                    }
                  />
                )}
                {usesStp && (
                  <p className="text-[10px] text-emerald-600 mt-0.5">
                    Sum of the EBITDA savings across all fulfilled years (EBITDA
                    Period).
                  </p>
                )}
              </div>
              {/* A one-time Bonus/Rework gain has no cash impact — hide the field. */}
              {!isDirectGain && (
                <div>
                  <label className={label}>
                    Cash Impact (€){" "}
                    <span className="font-normal text-slate-400">
                      {usesStp
                        ? "— auto: Inventory gap + AP gap"
                        : "— total cash estimate, locked when Budgeted"}
                    </span>
                  </label>
                  {usesStp ? (
                    <div
                      className={`${inp} bg-emerald-50 font-bold text-emerald-700`}
                    >
                      {autoCashImpact != null
                        ? `€${autoCashImpact.toLocaleString("en-GB")}`
                        : opp.cash_impact != null
                          ? fmt(opp.cash_impact)
                          : "—"}
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      disabled={locked}
                      className={`${inp} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                      value={form.cash_impact}
                      onChange={(e) => set("cash_impact", e.target.value)}
                    />
                  )}
                </div>
              )}
              <div>
                <label
                  className={hiLabel(
                    !(opp.duration_months && opp.duration_months > 0),
                  )}
                >
                  Duration (months){" "}
                  <span className="font-normal text-slate-400">
                    — saving period length
                  </span>
                </label>
                {isDirectGain ? (
                  <div className={`${inp} bg-slate-100 text-slate-500`}>
                    1 month (one-time gain)
                  </div>
                ) : (
                  <select
                    disabled={locked}
                    className={`${hi(!(opp.duration_months && opp.duration_months > 0))} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                    value={form.duration_months}
                    onChange={(e) => set("duration_months", e.target.value)}
                  >
                    <option value="" disabled>
                      Select duration
                    </option>
                    {[1, 12].map((m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? "month" : "months"}
                      </option>
                    ))}
                    {form.duration_months &&
                      ![1, 12].includes(
                        Number(form.duration_months),
                      ) && (
                        <option value={form.duration_months}>
                          {form.duration_months} months (legacy)
                        </option>
                      )}
                  </select>
                )}
                {computedEndDate && (
                  <p className="mt-1 text-[10.5px] text-slate-500">
                    → Planned end:{" "}
                    <span className="font-semibold text-slate-700">
                      {computedEndDate}
                    </span>
                  </p>
                )}
                {!isDirectGain && (
                  <p className="mt-1 text-[10.5px] text-amber-600">
                    For STP opportunities the duration is recomputed on save from
                    the yearly prices (flat price → 12 months; each further year
                    of price change → +12).
                  </p>
                )}
              </div>
              <div>
                <label className={hiLabel(!opp.planned_start_date)}>
                  Planned Start (estimated savings start){" "}
                  <span className="font-normal text-slate-400">
                    — when real savings are expected to begin; drives planned
                    end &amp; the budget split
                  </span>
                </label>
                <input
                  type="date"
                  className={hi(!opp.planned_start_date)}
                  value={form.planned_start_date}
                  onChange={(e) => set("planned_start_date", e.target.value)}
                />
                {computedEndDate && (
                  <p className="mt-1 text-[10.5px] text-slate-500">
                    → Planned end:{" "}
                    <span className="font-semibold text-slate-700">
                      {computedEndDate}
                    </span>
                  </p>
                )}
                {!isDirectGain &&
                  recommendedSavingsStart &&
                  recommendedSavingsStart.iso !== form.planned_start_date && (
                    <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-blue-600">
                      <span>
                        Recommended (study start + Phase 1–3 weeks):{" "}
                        <span className="font-semibold">
                          {recommendedSavingsStart.label}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          set("planned_start_date", recommendedSavingsStart.iso)
                        }
                        className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        Apply
                      </button>
                    </p>
                  )}
                {form.planned_start_date &&
                  form.planned_start_date !== opp.planned_start_date &&
                  ["Phase 0", "Phase 1", "Phase 2", "Assigned"].includes(
                    opp.phase_status ?? "",
                  ) && (
                    <p className="mt-1 text-[10.5px] text-amber-600 font-medium">
                      ⚠ Date changed — monthly savings profile will be rebuilt
                      from {form.planned_start_date}
                    </p>
                  )}
                {form.planned_start_date &&
                  form.planned_start_date !== opp.planned_start_date &&
                  ["Phase 3", "Phase 4"].includes(opp.phase_status ?? "") && (
                    <p className="mt-1 text-[10.5px] text-blue-600 font-medium">
                      ℹ Savings have started — use Deployment Start Date (real)
                      to rebuild the profile.
                    </p>
                  )}
              </div>
              {/* Phase 2 date — when execution work began (not applicable to
                  Negotiation, which has no tooling/qualification phase) */}
              {!isNegotiation &&
                ["Phase 2", "Phase 3", "Phase 4"].includes(
                  opp.phase_status ?? "",
                ) && (
                  <div>
                    <label className={hiLabel(missingFlags.executionStartDate)}>
                      Execution Start Date
                      <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
                        Phase 2
                      </span>
                      <span className="ml-1 font-normal text-slate-400">
                        — when work began (tooling, qualification, supplier
                        contacted)
                      </span>
                    </label>
                    <input
                      type="date"
                      className={hi(missingFlags.executionStartDate)}
                      value={form.execution_start_date}
                      onChange={(e) =>
                        set("execution_start_date", e.target.value)
                      }
                    />
                  </div>
                )}
              {/* Phase 3 date — when savings actually started flowing */}
              {["Phase 3", "Phase 4"].includes(opp.phase_status ?? "") && (
                <div>
                  <label className={hiLabel(missingFlags.realStartDate)}>
                    Deployment Start Date (Real Savings Start)
                    <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">
                      Phase 3
                    </span>
                    <span className="ml-1 font-normal text-slate-400">
                      — when PPAP validated and Longrun/new parts entered
                      production
                    </span>
                  </label>
                  {(() => {
                    const isLocked =
                      opp.budget_years?.some(
                        (by) => by.status_locked_at != null,
                      ) ?? false;
                    return isLocked ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        🔒 Real start date is <strong>locked</strong> — this
                        opportunity is committed in a closed budget. Contact
                        your purchasing director to modify.
                      </div>
                    ) : (
                      <>
                        <input
                          type="date"
                          className={hi(missingFlags.realStartDate)}
                          value={form.real_start_date}
                          onChange={(e) =>
                            set("real_start_date", e.target.value)
                          }
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
                      </>
                    );
                  })()}
                  {/* R9 data-loss warning — rebuilding from a later start deletes the
                  months before it, including any actuals already entered there. */}
                  {form.real_start_date &&
                    form.real_start_date !== (opp.real_start_date ?? "") &&
                    (() => {
                      const newStart = form.real_start_date.slice(0, 7);
                      const droppedActuals = (
                        opp.financial_lines[0]?.monthly_financials ?? []
                      ).filter(
                        (m) =>
                          m.period_month != null &&
                          m.actual_saving != null &&
                          m.period_month.slice(0, 7) < newStart,
                      );
                      return droppedActuals.length > 0 ? (
                        <p className="mt-1 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5 text-[10px] font-semibold text-red-700">
                          ⚠ {droppedActuals.length} month
                          {droppedActuals.length !== 1 ? "s" : ""} before the
                          new start already{" "}
                          {droppedActuals.length !== 1 ? "have" : "has"} actual
                          savings entered. Changing the real start will DELETE
                          those months and their realized savings. Record/export
                          them before saving.
                        </p>
                      ) : null;
                    })()}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className={label}>Currency</label>
                <select
                  className={inp}
                  value={form.currency}
                  onChange={(e) => {
                    const c = e.target.value;
                    set("currency", c);
                    // EUR has no conversion — reset the rate so a stale non-1 value from a
                    // previous currency can't be saved against EUR.
                    if (c === "EUR") set("fx_rate_to_eur", "1");
                  }}
                >
                  {["EUR", "USD", "RMB", "INR"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>
                  FX rate → EUR{" "}
                  <span className="font-normal text-slate-400">
                    — {form.currency || "EUR"} amount × rate = EUR (for group
                    reporting)
                  </span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  disabled={form.currency === "EUR" || isFxLocked}
                  className={`${inp} ${
                    form.currency === "EUR" || isFxLocked
                      ? "bg-slate-100 cursor-not-allowed text-slate-500"
                      : !form.fx_rate_to_eur ||
                          parseFloat(form.fx_rate_to_eur) <= 0
                        ? "border-amber-400 focus:border-amber-500 focus:ring-amber-100"
                        : ""
                  }`}
                  value={form.currency === "EUR" ? "1" : form.fx_rate_to_eur}
                  onChange={(e) => set("fx_rate_to_eur", e.target.value)}
                />
                {isFxLocked && form.currency !== "EUR" && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    FX rate is locked — a Budgeted commitment or actual saving
                    has been recorded.
                  </p>
                )}
                {form.currency !== "EUR" &&
                  (!form.fx_rate_to_eur ||
                    parseFloat(form.fx_rate_to_eur) <= 0) && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                      <AlertTriangle size={10} className="shrink-0" />
                      Required — without this rate, all KPI and budget totals
                      for this opportunity will be wrong (counted at 1:1).
                    </p>
                  )}
              </div>
            </div>
          </div>
          {/* Alert recipients — required for delay alerts and escalations */}
          {!isPhase0 && (!form.purchasing_owner || !form.conversion_owner) && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>
                <strong>
                  Purchasing Owner and Conversion Owner are required
                </strong>{" "}
                to receive missing data alerts and escalation emails.
              </span>
            </div>
          )}
          {!isPhase0 && (
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
          )}
          {/* PLD scoring — compact — hidden for Negotiation/Cash, which skip PLD entirely */}
          {!isFlatType && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
                  PLD
                </span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {livePScore != null && (
                    <span className="text-slate-500">
                      P=<b className="text-slate-700">{livePScore}</b>
                    </span>
                  )}
                  {liveLScore != null && (
                    <span className="text-slate-400">
                      × L=<b className="text-slate-700">{liveLScore}</b>
                    </span>
                  )}
                  {liveDScore != null && (
                    <span className="text-slate-400">
                      × D=<b className="text-slate-700">{liveDScore}</b>
                    </span>
                  )}
                  {pScore != null ? (
                    <>
                      <span className="text-slate-400">=</span>
                      <span className="font-black text-blue-700 text-sm">
                        {pScore}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pldColor(pCat)}`}
                      >
                        {pCat}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-300 text-[10px]">
                      incomplete
                    </span>
                  )}
                </div>
              </div>

              {isSourced && (
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  {/* P */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-black text-blue-700">
                        P
                      </span>
                      <span className="text-slate-500 font-medium">
                        Pay-back
                      </span>
                    </div>
                    <div className="rounded bg-white border border-slate-100 px-2 py-1 text-[10px]">
                      {_pldHasInvData ? (
                        <span
                          className={`font-semibold ${livePScore! <= 2 ? "text-emerald-600" : livePScore! >= 4 ? "text-red-500" : "text-amber-500"}`}
                        >
                          {_pldPaybackMonths === 0
                            ? "0 mo."
                            : _pldPaybackMonths >= 999
                              ? "∞"
                              : `${_pldPaybackMonths.toFixed(1)} mo.`}
                          {livePScore != null && (
                            <span className="ml-1 text-slate-400">
                              → {livePScore}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">
                          fill costs + saving
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 space-y-0.5">
                      {(
                        [
                          ["0 mo.", "1 ★"],
                          ["≤2 mo.", "2"],
                          ["≤4 mo.", "3"],
                          ["≤12 mo.", "4"],
                          [">12 mo.", "5"],
                        ] as [string, string][]
                      ).map(([v, s]) => (
                        <div
                          key={s}
                          className={`flex justify-between px-1 rounded ${String(livePScore) === s.replace(" ★", "") ? "bg-blue-50 text-blue-600 font-semibold" : ""}`}
                        >
                          <span>{v}</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* L */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-black text-blue-700">
                        L
                      </span>
                      <span className="text-slate-500 font-medium">
                        Lead-time
                      </span>
                    </div>
                    <div className="rounded bg-white border border-slate-100 px-2 py-1 text-[10px]">
                      {_pldTotalWeeks > 0 ? (
                        <span
                          className={`font-semibold ${liveLScore! <= 2 ? "text-emerald-600" : liveLScore! >= 4 ? "text-red-500" : "text-amber-500"}`}
                        >
                          {_pldTotalWeeks} wks = {_pldLeadMonths.toFixed(1)} mo.
                          {liveLScore != null && (
                            <span className="ml-1 text-slate-400">
                              → {liveLScore}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">fill phase weeks</span>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-400 space-y-0.5">
                      {(
                        [
                          ["<1m", "1 ★"],
                          ["<2m", "2"],
                          ["<4m", "3"],
                          ["<6m", "4"],
                          ["≥6m", "5"],
                        ] as [string, string][]
                      ).map(([v, s]) => (
                        <div
                          key={s}
                          className={`flex justify-between px-1 rounded ${String(liveLScore) === s.replace(" ★", "") ? "bg-blue-50 text-blue-600 font-semibold" : ""}`}
                        >
                          <span>{v}</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* D */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-black text-blue-700">
                        D
                      </span>
                      <span className="text-slate-500 font-medium">
                        Difficulty
                      </span>
                    </div>
                    <select
                      className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] outline-none focus:border-blue-300"
                      value={liveDScore ?? ""}
                      onChange={(e) =>
                        set(
                          "difficulty_score",
                          e.target.value as unknown as number,
                        )
                      }
                    >
                      <option value="">— select —</option>
                      <option value="1">1 — Easy</option>
                      <option value="2">2 — Relatively easy</option>
                      <option value="3">3 — Moderately difficult</option>
                      <option value="4">4 — Difficult</option>
                      <option value="5">5 — Very Difficult</option>
                    </select>
                    <div className="text-[9px] text-slate-400 space-y-0.5">
                      {(
                        [
                          ["Easy", "1 ★"],
                          ["Rel. easy", "2"],
                          ["Moderate", "3"],
                          ["Difficult", "4"],
                          ["Very diff.", "5"],
                        ] as [string, string][]
                      ).map(([v, s]) => (
                        <div
                          key={s}
                          className={`flex justify-between px-1 rounded ${String(liveDScore) === s.replace(" ★", "") ? "bg-blue-50 text-blue-600 font-semibold" : ""}`}
                        >
                          <span>{v}</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* PLD scores — manual for STP; hidden entirely for Negotiation/Cash */}
          {!isFlatType && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  PLD Scores
                </p>
                {isSourced && (
                  <p className="text-[10px] text-slate-400 text-right leading-relaxed">
                    P &amp; L auto-calculated — set to override, clear to reset
                  </p>
                )}
              </div>
              {isSourced && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[10.5px] text-blue-700 flex flex-wrap gap-3">
                  <span>
                    Auto P: <strong>{_autoP ?? "—"}</strong>
                  </span>
                  <span>
                    Auto L: <strong>{_autoL ?? "—"}</strong>
                  </span>
                  {(form.payback_score || form.lead_time_score) && (
                    <button
                      type="button"
                      onClick={() => {
                        set("payback_score", "" as unknown as number);
                        set("lead_time_score", "" as unknown as number);
                      }}
                      className="ml-auto text-blue-500 hover:text-blue-700 underline text-[10px]"
                    >
                      Reset P &amp; L to auto
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={label}>
                    P — Pay-back
                    <span className="ml-1 font-normal text-slate-400">
                      (1 = quick)
                    </span>
                  </label>
                  <select
                    className={inp}
                    value={form.payback_score ?? ""}
                    onChange={(e) =>
                      set("payback_score", e.target.value as unknown as number)
                    }
                  >
                    <option value="">— select —</option>
                    <option value="1">1 — Immediate / &lt;1 mo.</option>
                    <option value="2">2 — ≤2 months</option>
                    <option value="3">3 — ≤4 months</option>
                    <option value="4">4 — ≤12 months</option>
                    <option value="5">5 — &gt;12 months</option>
                  </select>
                </div>
                <div>
                  <label className={label}>
                    L — Lead-time
                    <span className="ml-1 font-normal text-slate-400">
                      (1 = fast)
                    </span>
                  </label>
                  <select
                    className={inp}
                    value={form.lead_time_score ?? ""}
                    onChange={(e) =>
                      set(
                        "lead_time_score",
                        e.target.value as unknown as number,
                      )
                    }
                  >
                    <option value="">— select —</option>
                    <option value="1">1 — &lt;1 month</option>
                    <option value="2">2 — &lt;2 months</option>
                    <option value="3">3 — &lt;4 months</option>
                    <option value="4">4 — &lt;6 months</option>
                    <option value="5">5 — ≥6 months</option>
                  </select>
                </div>
                <div>
                  <label className={label}>
                    D — Difficulty
                    <span className="ml-1 font-normal text-slate-400">
                      (1 = easy)
                    </span>
                  </label>
                  <select
                    className={inp}
                    value={form.difficulty_score ?? ""}
                    onChange={(e) =>
                      set(
                        "difficulty_score",
                        e.target.value as unknown as number,
                      )
                    }
                  >
                    <option value="">— select —</option>
                    <option value="1">1 — Easy</option>
                    <option value="2">2 — Relatively easy</option>
                    <option value="3">3 — Moderately difficult</option>
                    <option value="4">4 — Difficult</option>
                    <option value="5">5 — Very Difficult</option>
                  </select>
                </div>
              </div>
              {/* Force priority override */}
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[10.5px] font-semibold text-slate-500 shrink-0">
                    Force priority:
                  </span>
                  <select
                    className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                    value={form.forced_priority}
                    onChange={(e) => set("forced_priority", e.target.value)}
                  >
                    <option value="">— auto (P×L×D) —</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                {form.forced_priority ? (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={10} /> Manual override active — PLD
                    score ignored
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    Auto: P×L×D ={" "}
                    {pScore != null ? (
                      <span className="font-semibold">{pScore}</span>
                    ) : (
                      "—"
                    )}{" "}
                    → <span className="font-semibold">{pCat ?? "—"}</span>
                  </p>
                )}
              </div>
            </div>
          )}
          <div>
            <label className={label}>Comments</label>
            <textarea
              rows={2}
              className={`${inp} resize-none`}
              value={form.comments}
              onChange={(e) => set("comments", e.target.value)}
            />
          </div>
        </div>

        {/* STP study — only for Sourcing / Technical Productivity, same form & save */}
        {showStpSection && (
          <div className="order-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <FileText size={11} /> STP Study — Sourcing &amp; Technical
              Productivity
            </p>
            <p className="text-[11px] text-slate-500">
              Workbook-aligned inputs. Prices &amp; quantities below drive the
              savings estimate shown in the Financial baseline above.
            </p>

            {canEditStpDirectly && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <strong>Director / VP override.</strong> The STP baseline is
                normally locked in execution, but as an approver you can edit
                prices, quantities and bonuses directly here — changes save
                immediately, no revision request needed.
              </div>
            )}

            {stpReadOnly && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {pendingApproval ? (
                  <>
                    <strong>STP awaiting a gate decision.</strong> It has been
                    submitted for review, so it is locked to keep it identical
                    to the version the reviewer received. It unlocks if the gate
                    returns it for rework.
                  </>
                ) : isStpPhase23 ? (
                  <div className="flex flex-col gap-2">
                    <p>
                      <strong>STP locked in execution.</strong> Prices and
                      quantities are committed. Only the Purchasing Director or
                      VP Conversion can change them at this stage.
                    </p>
                    {/* DISABLED — Request Revision creation turned off; PD/VPC edit
                        directly instead (see canEditStpDirectly above). Re-enable by
                        uncommenting this block and the matching backend endpoint in
                        purchasing_value/router.py. */}
                    {false && !hasPendingSTPRevision && (
                      <button
                        type="button"
                        onClick={() => setStpRevModal(true)}
                        className="self-start rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Request Revision
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <strong>STP locked.</strong> Prices, quantities and the
                    savings baseline can be filled and revised in Phase 0–1.
                    From Phase 2 onward the opportunity is committed to
                    execution, so the STP is read-only here.
                    {isBudgeted &&
                      " Changing a committed baseline requires a reviewed Revise, not a silent edit."}
                  </>
                )}
              </div>
            )}

            {/* Pending revision banner — shown while awaiting Director decision */}
            {hasPendingSTPRevision &&
              (() => {
                const rev = opp.pending_stp_revision as Record<string, unknown>;
                const requested_at = rev.requested_at as string | undefined;
                const director_emails = rev.director_emails as
                  | string[]
                  | undefined;
                const note = rev.note as string | undefined;
                const proposed = rev.proposed_fields as
                  | Record<string, unknown>
                  | undefined;
                const preview = rev.computed_preview as
                  | Record<string, unknown>
                  | undefined;
                return (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                        <Clock size={13} /> Revision pending Director approval
                      </p>
                      {canDecideStpRevision && (
                        <button
                          type="button"
                          onClick={() => setStpDecModal(true)}
                          className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800"
                        >
                          Approve / Reject
                        </button>
                      )}
                    </div>
                    {director_emails && director_emails.length > 0 && (
                      <p className="text-xs text-blue-700">
                        Sent to <strong>{director_emails.join(", ")}</strong>
                        {requested_at &&
                          ` on ${new Date(requested_at).toLocaleDateString("en-GB")}`}
                      </p>
                    )}
                    {note && (
                      <p className="text-xs text-blue-600 italic">"{note}"</p>
                    )}
                    {proposed && (
                      <div className="text-xs text-blue-700 grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1">
                        {(
                          [
                            "current_price",
                            "proposed_price",
                            "proposed_price_n1",
                            "proposed_price_n2",
                            "proposed_price_n3",
                          ] as const
                        ).map((k) =>
                          proposed[k] != null ? (
                            <span key={k}>
                              <span className="font-semibold">
                                {k.replace(/_/g, " ")}
                              </span>
                              : {String(proposed[k])}
                            </span>
                          ) : null,
                        )}
                        {preview && preview.period_saving != null && (
                          <span className="col-span-2 font-semibold text-blue-800 pt-0.5">
                            Projected saving: €
                            {Number(preview.period_saving).toLocaleString(
                              "en-GB",
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            <fieldset
              disabled={stpReadOnly}
              className={stpReadOnly ? "space-y-4 opacity-80" : "space-y-4"}
            >
              {/* Why checkboxes */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Why
                </p>
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

              {/* Scope, customers, plants & annual quantities */}
              <div
                className={`rounded-xl border bg-white p-3 space-y-3 ${gateHighlight && missingFlags.scope ? "border-2 border-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]" : "border-slate-200"}`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest ${gateHighlight && missingFlags.scope ? "text-rose-600" : "text-slate-400"}`}
                >
                  Scope &amp; Customers
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={hiLabel(missingFlags.scopeIn)}>
                      Scope IN (part numbers)
                    </label>
                    <input
                      disabled={locked}
                      className={`${hi(missingFlags.scopeIn)} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
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
                    <label className={hiLabel(missingFlags.customers)}>
                      Customers
                    </label>
                    <input
                      className={hi(missingFlags.customers)}
                      placeholder="Valeo, Multipe..."
                      value={form.customers}
                      onChange={(e) => set("customers", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Main Avocarbon Plant</label>
                    <select
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
                  <div>
                    <label className={label}>Secondary plants</label>
                    <input
                      className={inp}
                      placeholder="Kunshan, Tianjin..."
                      value={form.secondary_plants}
                      onChange={(e) => set("secondary_plants", e.target.value)}
                    />
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <p className={label}>
                    Annual Quantities{" "}
                    <span className="font-normal text-slate-400">
                      — N1 is used to auto-calc the first-year saving
                    </span>
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {(
                      [
                        ["annual_quantity_n1", "N1"],
                        ["annual_quantity_n2", "N2"],
                        ["annual_quantity_n3", "N3"],
                        ["annual_quantity_n4", "N4"],
                      ] as [string, string][]
                    ).map(([k, lbl]) => {
                      const isMissing =
                        k === "annual_quantity_n1" && missingFlags.quantity;
                      return (
                        <div key={k}>
                          <label className={hiLabel(isMissing)}>{lbl}</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={locked}
                            className={`${hi(isMissing)} ${locked ? "bg-slate-100 cursor-not-allowed text-slate-500" : ""}`}
                            value={fmtIntInput(
                              form[k as keyof typeof form] as string,
                            )}
                            onChange={(e) => set(k, stripInt(e.target.value))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Initial Step */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Initial Step
                </p>
                <p className="text-[11px] text-slate-500">
                  Has the current supplier been formally given a chance to
                  decrease the price?
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
                      onChange={(e) =>
                        set("supplier_asked_result", e.target.value)
                      }
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
              <FormSection
                title="Supplier Comparison (Before → After)"
                defaultOpen={true}
                highlight={
                  gateHighlight &&
                  (missingFlags.prices ||
                    missingFlags.logistics ||
                    missingFlags.supplierName)
                }
              >
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
                            <option
                              key={s.id_supplier_unit}
                              value={s.id_supplier_unit}
                            >
                              {[s.group_name, s.supplier_name, s.city]
                                .filter(Boolean)
                                .join(" · ")}
                            </option>
                          ))}
                        </select>
                        {suppliersForPlant.length === 0 && opp.plant_id && (
                          <p className="text-[10px] text-amber-500 mt-1">
                            No suppliers linked to this plant yet.
                          </p>
                        )}
                      </>
                    ) : (
                      (() => {
                        const before = suppliersForPlant.find(
                          (s) =>
                            s.id_supplier_unit ===
                            (opp.supplier_id ??
                              parseInt(form.supplier_id || "0")),
                        );
                        return (
                          <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 min-h-[28px]">
                            {before
                              ? [
                                  before.group_name,
                                  before.supplier_name,
                                  before.city,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")
                              : opp.supplier_id
                                ? `ID ${opp.supplier_id}`
                                : "—"}
                          </div>
                        );
                      })()
                    )}
                  </div>
                  <div>
                    <label className={hiLabel(missingFlags.supplierName)}>
                      Proposed New Supplier — After
                    </label>
                    {isPhase0 ? (
                      <>
                        <input
                          className={hi(missingFlags.supplierName)}
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
                          className={hi(missingFlags.supplierName)}
                          value={form.proposed_supplier_id}
                          onChange={(e) =>
                            set("proposed_supplier_id", e.target.value)
                          }
                        >
                          <option value="">— Select from panel —</option>
                          {suppliersForPlant.map((s) => (
                            <option
                              key={s.id_supplier_unit}
                              value={s.id_supplier_unit}
                            >
                              {[s.group_name, s.supplier_name, s.city]
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
                <div className="scroll-x-visible">
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
                            (s) =>
                              s.id_supplier_unit ===
                              (parseInt(form.supplier_id || "0") ||
                                opp.supplier_id),
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
                                className={hiCell(missingFlags.countryAfter)}
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
                      {/* Incoterms — dropdown of the standard ICC abbreviations */}
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-semibold text-slate-500">
                          Incoterms
                        </td>
                        {(["incoterms_before", "incoterms_after"] as const).map(
                          (k) => (
                            <td key={k} className="px-3 py-1.5">
                              <select
                                className={hiCell(
                                  k === "incoterms_before" &&
                                    missingFlags.incoterms,
                                )}
                                value={form[k as keyof typeof form] as string}
                                onChange={(e) => set(k, e.target.value)}
                              >
                                <option value="">—</option>
                                {INCOTERMS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.value} — {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          ),
                        )}
                      </tr>
                      {/* Place of Incoterms — free text (e.g. named port/place) */}
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-semibold text-slate-500">
                          Place of Incoterms
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            className={hiCell(false)}
                            placeholder="Shanghai"
                            value={form.place_of_incoterms_before}
                            onChange={(e) =>
                              set("place_of_incoterms_before", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            className={hiCell(false)}
                            placeholder="Poitiers"
                            value={form.place_of_incoterms_after}
                            onChange={(e) =>
                              set("place_of_incoterms_after", e.target.value)
                            }
                          />
                        </td>
                      </tr>
                      {(
                        [
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
                      ).map(([kb, ka, lbl, ph1, ph2]) => {
                        const rowMissing =
                          kb === "incoterms_before" && missingFlags.incoterms;
                        return (
                          <tr key={kb} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 font-semibold text-slate-500">
                              {lbl}
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                className={hiCell(rowMissing)}
                                placeholder={ph1}
                                value={form[kb as keyof typeof form] as string}
                                onChange={(e) => set(kb, e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                className={hiCell(rowMissing)}
                                placeholder={ph2}
                                value={form[ka as keyof typeof form] as string}
                                onChange={(e) => set(ka, e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {/* Consignment — Yes/No selects (needed for inventory gap formula) */}
                      <tr className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-semibold text-slate-500">
                          Consignment
                        </td>
                        {(
                          ["consignment_before", "consignment_after"] as const
                        ).map((k) => (
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
                            "Delivered price, including taxes and freight (€/unit)",
                            "0.4000",
                            "0.1300",
                          ],
                          [
                            "current_price_n1",
                            "proposed_price_n1",
                            "Price N+1",
                            "0.3880",
                            "0.1261",
                          ],
                          [
                            "current_price_n2",
                            "proposed_price_n2",
                            "Price N+2",
                            "0.3762",
                            "0.1223",
                          ],
                          [
                            "current_price_n3",
                            "proposed_price_n3",
                            "Price N+3",
                            "0.3650",
                            "0.1186",
                          ],
                        ] as [string, string, string, string, string][]
                      ).map(([kb, ka, lbl, ph1, ph2]) => {
                        const rowMissing =
                          kb === "current_price" && missingFlags.prices;
                        return (
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
                                  className={`${hiCell(rowMissing)} ${locked ? "bg-slate-100" : ""}`}
                                  placeholder={ph1}
                                  value={
                                    form[kb as keyof typeof form] as string
                                  }
                                  onChange={(e) => set(kb, e.target.value)}
                                />
                              ) : (
                                <span className="text-slate-300 text-[10px]">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="number"
                                step="0.000001"
                                disabled={locked}
                                className={`${hiCell(rowMissing)} ${locked ? "bg-slate-100" : ""}`}
                                placeholder={ph2}
                                value={form[ka as keyof typeof form] as string}
                                onChange={(e) => set(ka, e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!locked && fullYearSaving != null && (
                    <p className="mt-1 text-[10px] text-emerald-600 font-semibold px-3">
                      Auto-calculated saving: (€
                      {parseFloat(form.current_price).toFixed(4)} − €
                      {parseFloat(form.proposed_price).toFixed(4)}) ×{" "}
                      {parseInt(form.annual_quantity_n1).toLocaleString(
                        "en-GB",
                      )}
                      {bonusDelta !== 0 && (
                        <>
                          {" "}
                          {bonusDelta > 0 ? "+" : "−"} €
                          {Math.abs(bonusDelta).toLocaleString("en-GB")} bonus
                        </>
                      )}{" "}
                      ={" "}
                      <strong>
                        €{autoSaving?.toLocaleString("en-GB")}/year
                      </strong>
                    </p>
                  )}
                </div>
              </FormSection>

              {/* Risks */}
              <FormSection
                title="Risks"
                highlight={
                  gateHighlight &&
                  !(
                    opp.stp_risks?.material_indexation_before &&
                    opp.stp_risks?.material_indexation_after
                  )
                }
              >
                <div className="scroll-x-visible">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 w-[22%]">
                          Risk
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 w-[14%]">
                          Before
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 w-[14%]">
                          After
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">
                          Description / Mitigation approach
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          [
                            "risk_material_indexation_before",
                            "risk_material_indexation_after",
                            "risk_material_indexation_desc",
                            "Material indexation",
                          ],
                          [
                            "risk_exchange_rate_before",
                            "risk_exchange_rate_after",
                            "risk_exchange_rate_desc",
                            "Exchange rate",
                          ],
                          [
                            "risk_local_content_before",
                            "risk_local_content_after",
                            "risk_local_content_desc",
                            "Local content",
                          ],
                          [
                            "risk_quality_before",
                            "risk_quality_after",
                            "risk_quality_desc",
                            "Quality",
                          ],
                          [
                            "risk_other_before",
                            "risk_other_after",
                            "risk_other_desc",
                            "Other",
                          ],
                        ] as [string, string, string, string][]
                      ).map(([kb, ka, kd, lbl]) => (
                        <tr key={kb} className="border-t border-slate-100">
                          <td className="px-3 py-1.5 font-semibold text-slate-500">
                            {lbl}
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                              value={form[kb as keyof typeof form] as string}
                              onChange={(e) => set(kb, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                              value={form[ka as keyof typeof form] as string}
                              onChange={(e) => set(ka, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300"
                              placeholder="If needed — describe risk or mitigation..."
                              value={form[kd as keyof typeof form] as string}
                              onChange={(e) => set(kd, e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                      {/* Divider before spec questions */}
                      <tr>
                        <td colSpan={4} className="px-3 pt-3 pb-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Specification Assumptions
                          </span>
                        </td>
                      </tr>
                      {(
                        [
                          [
                            "material_same_spec",
                            "Will material spec & appearance be the same?",
                          ],
                          ["same_tooling", "Same tooling?"],
                          ["same_dimension", "Same dimensions & appearance?"],
                          ["same_process", "Same process?"],
                        ] as [string, string][]
                      ).map(([k, lbl]) => (
                        <tr key={k} className="border-t border-slate-100">
                          <td
                            className="px-3 py-1.5 font-semibold text-slate-500"
                            colSpan={2}
                          >
                            {lbl}
                          </td>
                          <td className="px-3 py-1.5" colSpan={2}>
                            <select
                              className="w-36 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300 bg-white"
                              value={form[k as keyof typeof form] as string}
                              onChange={(e) => set(k, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FormSection>

              {/* Benefits */}
              <FormSection
                title="Benefits"
                highlight={
                  gateHighlight &&
                  !(opp.stp_benefits?.if_we_do || opp.stp_benefits?.if_not)
                }
              >
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
              </FormSection>

              {/* Investment costs */}
              <FormSection title="Investment Costs">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className={label}>Tooling (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inp}
                      value={fmtDecInput(form.tooling_cost)}
                      onChange={(e) =>
                        set("tooling_cost", stripDec(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className={label}>Travel (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inp}
                      value={fmtDecInput(form.travel_cost)}
                      onChange={(e) =>
                        set("travel_cost", stripDec(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className={label}>Qualification (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inp}
                      value={fmtDecInput(form.qualification_cost)}
                      onChange={(e) =>
                        set("qualification_cost", stripDec(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className={label}>Other (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inp}
                      value={fmtDecInput(form.other_cost)}
                      onChange={(e) =>
                        set("other_cost", stripDec(e.target.value))
                      }
                    />
                  </div>
                </div>
                {_pldTotalInv > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    Total investment:{" "}
                    <strong>€{_pldTotalInv.toLocaleString("en-GB")}</strong>
                  </div>
                )}
              </FormSection>

              {/* EBITDA & Cash savings — live, Excel "format STP rev 1.2" formulas */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  EBITDA &amp; Cash Savings — auto-calculated (STP rev 1.2
                  formulas)
                </p>
                <p className="text-[10px] text-emerald-500">
                  Computed live from prices, quantities, bonus, costs and
                  logistics — same formulas as the STP workbook.
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {(
                    [
                      ["EBITDA Full year (1st)", fullYearSaving, "€", ""],
                      ["EBITDA Period (N1–N4)", periodSaving, "€", ""],
                      ["ROI Full year", roiFullYear, "", "%"],
                      ["ROI Period", roiPeriod, "", "%"],
                      ["Est. Inventory gap", inventoryGap, "€", ""],
                      ["Est. AP gap", apGap, "€", ""],
                    ] as [string, number | null, string, string][]
                  ).map(([lbl, val, pre, suf]) => {
                    // Snap negative-zero / sub-cent values to 0 so they don't render as "-0"
                    const shown =
                      val != null && Math.abs(val) < 0.005 ? 0 : val;
                    return (
                      <div
                        key={lbl}
                        className="flex items-center justify-between gap-2 border-b border-emerald-100/60 pb-1"
                      >
                        <span className="text-slate-500">{lbl}</span>
                        <span
                          className={`font-bold ${shown != null && shown < 0 ? "text-red-600" : "text-slate-700"}`}
                        >
                          {shown != null
                            ? `${pre}${shown.toLocaleString("en-GB", { maximumFractionDigits: 2 })}${suf}`
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {savingPerYear != null && (
                  <div className="pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">
                      Est. Saving per year
                    </p>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {(["N", "N+1", "N+2", "N+3"] as const).map((yr, i) => (
                        <div
                          key={yr}
                          className="rounded-lg bg-white/70 border border-emerald-100 px-2 py-1"
                        >
                          <div className="text-[10px] text-slate-400">
                            Year {yr}
                          </div>
                          <div
                            className={`font-bold ${savingPerYear[i] < 0 ? "text-red-600" : "text-slate-700"}`}
                          >
                            €
                            {savingPerYear[i].toLocaleString("en-GB", {
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {savingByYear != null && savingByYear.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">
                      Est. Saving by calendar year (from savings start)
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {savingByYear.map(({ year, amount }) => (
                        <div
                          key={year}
                          className="rounded-lg bg-white/70 border border-emerald-100 px-2 py-1"
                        >
                          <div className="text-[10px] text-slate-400">
                            {year}
                          </div>
                          <div
                            className={`font-bold ${amount < 0 ? "text-red-600" : "text-slate-700"}`}
                          >
                            €
                            {amount.toLocaleString("en-GB", {
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Planning */}
              <FormSection
                title="Estimated Planning (weeks)"
                highlight={
                  gateHighlight &&
                  !isNegotiation &&
                  !(opp.phase1_weeks && opp.phase1_weeks > 0)
                }
              >
                <div>
                  <label className={label}>Phase 1 Starting Date</label>
                  <input
                    type="date"
                    className={inp}
                    value={form.execution_start_date}
                    onChange={(e) =>
                      set("execution_start_date", e.target.value)
                    }
                  />
                  <p className="text-[9.5px] text-slate-400 mt-0.5">
                    All phase dates chain from this. Defaults to study start if
                    not set.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ["phase1_weeks", "Phase 1 (weeks)"],
                    ["phase2_weeks", "Phase 2 (weeks)"],
                    ["phase3_weeks", "Phase 3 (weeks)"],
                    ["phase4_weeks", "Phase 4 (weeks)"],
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
                {phaseDates && (
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-500">
                    {phaseDates.map((p, i) => (
                      <div key={i}>
                        {p ? (
                          <>
                            {p.start} →{" "}
                            <span className="font-semibold">{p.end}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                    ))}
                    <p className="col-span-4 text-emerald-600 font-semibold">
                      Tentative date for start of savings (start of Phase 3):{" "}
                      {phaseDates[2]?.start ?? "—"}
                    </p>
                  </div>
                )}
              </FormSection>
            </fieldset>
          </div>
        )}

        {/* STP completeness bar — shown near Save so user sees it before submitting */}
        {showStpSection &&
          (() => {
            const stpSections = [
              { label: "Scope", ok: !!(form.scope_in && form.customers) },
              {
                label: "Quantities",
                ok: !!(
                  form.annual_quantity_n1 &&
                  parseInt(form.annual_quantity_n1) > 0
                ),
              },
              {
                label: "Prices",
                ok: !!(
                  form.current_price &&
                  parseFloat(form.current_price) > 0 &&
                  form.proposed_price &&
                  parseFloat(form.proposed_price) > 0
                ),
              },
              {
                label: "Logistics",
                ok: !!(
                  form.incoterms_before &&
                  form.incoterms_after &&
                  form.country_after
                ),
              },
              {
                label: "Risks",
                ok: !!(
                  form.risk_material_indexation_before &&
                  form.risk_material_indexation_after
                ),
              },
              {
                label: "Benefits",
                ok: !!(form.benefit_if_we_do || form.benefit_if_not),
              },
              {
                label: "Planning",
                // Negotiation may leave the phase weeks at 0 — not required.
                ok:
                  isNegotiation ||
                  !!(form.phase1_weeks && parseInt(form.phase1_weeks) > 0),
              },
            ];
            const done = stpSections.filter((s) => s.ok).length;
            const total = stpSections.length;
            const pct = Math.round((done / total) * 100);
            const incomplete = stpSections.filter((s) => !s.ok);
            const allDone = done === total;
            const barColor = allDone
              ? "bg-emerald-500"
              : done >= 5
                ? "bg-blue-400"
                : done >= 3
                  ? "bg-amber-400"
                  : "bg-slate-300";
            return (
              <div
                className={`order-4 rounded-xl border px-4 py-3 space-y-2 ${allDone ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    STP Completeness
                  </span>
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${allDone ? "text-emerald-600" : "text-amber-700"}`}
                  >
                    {done}/{total} sections filled
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stpSections.map((s) => (
                    <span
                      key={s.label}
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${s.ok ? "bg-emerald-100 text-emerald-700" : "bg-white border border-amber-200 text-amber-600"}`}
                    >
                      {s.ok ? "✓" : "○"} {s.label}
                    </span>
                  ))}
                </div>
                {!allDone && (
                  <p className="text-[10.5px] text-amber-600">
                    {incomplete.map((s) => s.label).join(", ")} — save first,
                    then complete before Gate review.
                  </p>
                )}
              </div>
            );
          })()}

        <div className="order-5 pt-2">
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
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <RefreshCw size={13} className="animate-spin" />} Save
              Changes
            </button>
          </div>
        </div>
      </form>

      {/* DISABLED — Request Revision creation turned off (backend endpoint
          commented out in purchasing_value/router.py). stpRevModal can never be
          set true from the UI anymore (button above is disabled too), but the
          `false &&` keeps this unreachable even if some other path still flips
          the state, and the whole block stays intact to re-enable later. */}
      {false &&
        stpRevModal &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-bold text-slate-800">
                  Request STP Baseline Revision
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setStpRevModal(false);
                    setStpRevError(null);
                  }}
                  className="rounded-lg p-1 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <form
                onSubmit={submitSTPRevisionRequest}
                className="space-y-4 overflow-y-auto px-6 py-5"
              >
                <p className="text-xs text-slate-500">
                  Enter only the values you want to change — leave the rest
                  blank. They will be sent to the Purchasing Director and VP
                  Conversion for approval; current figures remain active until a
                  Director approves.
                </p>

                {(() => {
                  const revInp =
                    "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
                  const revLabel =
                    "mb-1 block text-[11px] font-semibold text-slate-500";
                  const setRev = (k: keyof typeof stpRevForm, v: string) =>
                    setStpRevForm((f) => ({ ...f, [k]: v }));
                  const priceField = (
                    key: keyof typeof stpRevForm,
                    label: string,
                    current: unknown,
                  ) => (
                    <div key={key}>
                      <label className={revLabel}>{label}</label>
                      <input
                        type="number"
                        step="0.0001"
                        className={revInp}
                        placeholder={
                          current != null ? `Current: ${current}` : "New value"
                        }
                        value={stpRevForm[key]}
                        onChange={(e) => setRev(key, e.target.value)}
                      />
                    </div>
                  );
                  const qtyField = (
                    key: keyof typeof stpRevForm,
                    label: string,
                    current: unknown,
                  ) => (
                    <div key={key}>
                      <label className={revLabel}>{label}</label>
                      <input
                        type="number"
                        step="1"
                        className={revInp}
                        placeholder={
                          current != null ? `Current: ${current}` : "New value"
                        }
                        value={stpRevForm[key]}
                        onChange={(e) => setRev(key, e.target.value)}
                      />
                    </div>
                  );
                  return (
                    <div className="space-y-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                        Proposed New Values
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {priceField(
                          "current_price",
                          "Current Price (Year N)",
                          opp.current_price,
                        )}
                        {priceField(
                          "proposed_price",
                          "Proposed Price (Year N)",
                          opp.proposed_price,
                        )}
                        {priceField(
                          "proposed_price_n1",
                          "Proposed Price N+1",
                          opp.proposed_price_n1,
                        )}
                        {priceField(
                          "proposed_price_n2",
                          "Proposed Price N+2",
                          opp.proposed_price_n2,
                        )}
                        {priceField(
                          "proposed_price_n3",
                          "Proposed Price N+3",
                          opp.proposed_price_n3,
                        )}
                        {qtyField(
                          "annual_quantity_n1",
                          "Qty Year N",
                          opp.annual_quantity_n1,
                        )}
                        {qtyField(
                          "annual_quantity_n2",
                          "Qty Year N+1",
                          opp.annual_quantity_n2,
                        )}
                        {qtyField(
                          "annual_quantity_n3",
                          "Qty Year N+2",
                          opp.annual_quantity_n3,
                        )}
                        {qtyField(
                          "annual_quantity_n4",
                          "Qty Year N+3",
                          opp.annual_quantity_n4,
                        )}
                        {priceField(
                          "bonus_before",
                          "Bonus Before",
                          opp.bonus_before,
                        )}
                        {priceField(
                          "bonus_after",
                          "Bonus After",
                          opp.bonus_after,
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Justification <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Explain why the baseline needs to change (supplier renegotiation, volume update, etc.)"
                    value={stpRevForm.note}
                    onChange={(e) =>
                      setStpRevForm((f) => ({ ...f, note: e.target.value }))
                    }
                  />
                </div>
                {stpRevError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                    {stpRevError}
                  </p>
                )}
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStpRevModal(false);
                      setStpRevError(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      stpRevLoading ||
                      !stpRevForm.note.trim() ||
                      !stpRevHasChange
                    }
                    title={
                      !stpRevHasChange
                        ? "Enter at least one new value above"
                        : undefined
                    }
                    className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {stpRevLoading && (
                      <RefreshCw size={13} className="animate-spin" />
                    )}
                    Send for Approval
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* STP Revision Decision modal — portal to escape drawer stacking context & outer form */}
      {stpDecModal &&
        canDecideStpRevision &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-bold text-slate-800">
                  STP Revision Decision
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setStpDecModal(false);
                    setStpDecError(null);
                  }}
                  className="rounded-lg p-1 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <form
                onSubmit={submitSTPDecision}
                className="px-6 py-5 space-y-4"
              >
                <p className="text-xs text-slate-500">
                  Approving will immediately apply the proposed prices and
                  quantities and recompute the savings baseline. Rejecting keeps
                  current values.
                </p>
                <div className="flex gap-3">
                  {(["Approved", "Rejected"] as const).map((d) => (
                    <label
                      key={d}
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        stpDecForm.decision === d
                          ? d === "Approved"
                            ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                            : "border-red-300 bg-red-50 text-red-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="decision"
                        value={d}
                        checked={stpDecForm.decision === d}
                        onChange={() =>
                          setStpDecForm((f) => ({ ...f, decision: d }))
                        }
                      />
                      {d === "Approved" ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <XCircle size={14} />
                      )}
                      {d}
                    </label>
                  ))}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Note (optional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Reason or conditions..."
                    value={stpDecForm.note}
                    onChange={(e) =>
                      setStpDecForm((f) => ({ ...f, note: e.target.value }))
                    }
                  />
                </div>
                {stpDecError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                    {stpDecError}
                  </p>
                )}
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStpDecModal(false);
                      setStpDecError(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={stpDecLoading}
                    className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                      stpDecForm.decision === "Approved"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {stpDecLoading && (
                      <RefreshCw size={13} className="animate-spin" />
                    )}
                    {stpDecForm.decision === "Approved" ? "Approve" : "Reject"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
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
  const { user } = useAuth();
  // The per-reviewer approval/validation links (and the "Send Approval Links"
  // action) are only exposed to the Purchasing Director and the Conversion
  // owner (vp_conversion access profile) — same privileged pair used for STP
  // revision decisions. Everyone else still sees request status, just not the
  // copyable approval links.
  const canSeeApprovalLinks =
    user?.access_profile === "purchasing_director" ||
    user?.access_profile === "vp_conversion";
  // Reminders only re-send an approver their own existing link (never expose it
  // to the clicker), so they're open to any editor — broader than the copyable
  // approval links above.
  const canRemindApprovers = EDITOR_PROFILES.includes(
    user?.access_profile ?? "",
  );
  // Start study
  const [showStart, setShowStart] = useState(false);
  // Gate decision
  const [decision, setDecision] = useState<"Go" | "No Go" | "Review">("Go");
  const [pm, setPm] = useState(opp.project_owner ?? "");
  const [comments, setComments] = useState("");
  const [showGate, setShowGate] = useState(false);
  // Gate approval request (Phase 0)
  const [showApproval, setShowApproval] = useState(false);
  const [plantManagerEmail, setPlantManagerEmail] = useState("");
  const [purchasingManagerEmails, setPurchasingManagerEmails] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  // Reminder to pending approvers (re-sends the existing approval link) — the
  // confirmation + result is handled by RemindModal.
  const [remindOpen, setRemindOpen] = useState(false);
  // Negotiation: single approver (Purchasing Director or VP Conversion) —
  // used for both the Phase 0 request and every Phase 1-4 committee request,
  // replacing the Plant Manager/committee-tier flow for this opportunity type.
  const isNegotiation = opp.opportunity_type === "Negotiation";
  const [negotiationApproverRole, setNegotiationApproverRole] = useState<
    (typeof NEGOTIATION_APPROVER_ROLES)[number]
  >(NEGOTIATION_APPROVER_ROLES[0]);
  const [negotiationApproverEmail, setNegotiationApproverEmail] = useState("");
  // Purchasing Director / VP Conversion accounts, fetched so the approver
  // picker (Negotiation single-approver + committee required-approver rows
  // for these two roles) is a select instead of a free-text email field.
  const [approverAccounts, setApproverAccounts] = useState<
    {
      id_identity: number;
      full_name: string;
      email: string;
      access_profile: string;
    }[]
  >([]);
  useEffect(() => {
    supplierAPI
      .getNegotiationApprovers()
      .then((r: { data?: typeof approverAccounts }) =>
        setApproverAccounts(r.data ?? []),
      )
      .catch(() => {});
  }, []);
  const ROLE_LABEL_TO_PROFILE: Record<string, string> = {
    "Purchasing Director": "purchasing_director",
    "VP Conversion": "vp_conversion",
  };
  const accountsForRole = (roleLabel: string) =>
    approverAccounts.filter(
      (a) => a.access_profile === ROLE_LABEL_TO_PROFILE[roleLabel],
    );
  // Sourcing committee approval request (Phase 1-4)
  const [committeeLevel, setCommitteeLevel] = useState<CommitteeLevel | "">("");
  const [approverEmails, setApproverEmails] = useState<Record<string, string>>(
    {},
  );
  const [showOptionalApprovers, setShowOptionalApprovers] = useState(false);
  const [approvalRequests, setApprovalRequests] = useState<
    {
      request_id: number;
      phase_from: string | null;
      requested_by: string | null;
      requested_at: string | null;
      status: string | null;
      consensus_result: string | null;
      committee_level: string | null;
      pm_notified_email?: string | null;
      pm_notified_at?: string | null;
      pm_notification_status?: string | null;
      votes: {
        vote_id: number;
        approver_email: string | null;
        access_token: string | null;
        is_plant_manager: boolean | null;
        approver_role: string | null;
        decision: string | null;
        decided_at: string | null;
        comment: string | null;
        project_manager_email: string | null;
        reminder_count?: number;
        last_reminded_at?: string | null;
      }[];
    }[]
  >([]);

  useEffect(() => {
    supplierAPI
      .getGateApprovalStatus(opp.opportunity_id)
      .then((res) => {
        const requests = res.data ?? [];
        setApprovalRequests(requests);
        // Pre-fill PM email from the most recent approved vote that carries a PM designation
        const pmFromVotes = requests
          .flatMap(
            (r: {
              votes: {
                decision: string | null;
                project_manager_email: string | null;
              }[];
            }) => r.votes,
          )
          .find(
            (v: {
              decision: string | null;
              project_manager_email: string | null;
            }) => v.decision === "Approved" && v.project_manager_email,
          )?.project_manager_email;
        if (pmFromVotes) setPm(pmFromVotes);
      })
      .catch(() => {});
  }, [opp.opportunity_id, opp.phase_status]);

  // Phase 1-4 committee gate: pre-fill the Plant Manager approver with whoever
  // approved as plant manager at Phase 0. Only empty fields are seeded, so a
  // manual override is preserved. (The Project Manager / leader is no longer a
  // voter — the Plant Manager designates it on their own vote, pre-filled with
  // the Phase 0 carry-over; see the approval vote page.)
  useEffect(() => {
    if (!showApproval || isNegotiation) return;
    const plantManagerEmail = approvalRequests
      .flatMap((r) => r.votes)
      .find((v) => v.is_plant_manager && v.approver_email)?.approver_email;
    if (!plantManagerEmail) return;
    setApproverEmails((m) =>
      m["Plant Manager"]?.trim()
        ? m
        : { ...m, "Plant Manager": plantManagerEmail },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showApproval, isNegotiation, approvalRequests]);

  async function submitApprovalRequest() {
    // Block submission if STP format is incomplete for Sourcing/Technical types
    if (opp.phase_status === "Phase 0" && phase0Missing.length > 0) {
      setApprovalError(
        `Complete all required fields before sending: ${phase0Missing.map((c) => c.label).join(", ")}`,
      );
      return;
    }
    let requestPayload: {
      plant_manager_email?: string;
      purchasing_manager_emails?: string[];
      approver_role?: string;
      approver_email?: string;
      message?: string;
    };
    if (isNegotiation) {
      const approverEmail = negotiationApproverEmail.trim();
      if (!approverEmail) {
        setApprovalError("Approver email is required.");
        return;
      }
      requestPayload = {
        approver_role: negotiationApproverRole,
        approver_email: approverEmail,
        plant_manager_email: plantManagerEmail.trim() || undefined,
        message: approvalMessage || undefined,
      };
    } else {
      const pm = plantManagerEmail.trim();
      if (!pm) {
        setApprovalError("Plant Manager email is required.");
        return;
      }
      const purchasing = purchasingManagerEmails
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      requestPayload = {
        plant_manager_email: pm,
        purchasing_manager_emails: purchasing,
        message: approvalMessage || undefined,
      };
    }
    setApprovalSubmitting(true);
    setApprovalError(null);
    try {
      await supplierAPI.requestGateApproval(opp.opportunity_id, requestPayload);
      const res = await supplierAPI.getGateApprovalStatus(opp.opportunity_id);
      const requests = res.data ?? [];
      setApprovalRequests(requests);
      const pmFromVotes = requests
        .flatMap(
          (r: {
            votes: {
              decision: string | null;
              project_manager_email: string | null;
            }[];
          }) => r.votes,
        )
        .find(
          (v: {
            decision: string | null;
            project_manager_email: string | null;
          }) => v.decision === "Approved" && v.project_manager_email,
        )?.project_manager_email;
      if (pmFromVotes) setPm(pmFromVotes);
      setShowApproval(false);
      setPlantManagerEmail("");
      setPurchasingManagerEmails("");
      setNegotiationApproverEmail("");
      setApprovalMessage("");
    } catch (e: unknown) {
      setApprovalError(e instanceof Error ? e.message : "Failed");
    } finally {
      setApprovalSubmitting(false);
    }
  }

  async function submitCommitteeApprovalRequest() {
    if (committeeMissing.length > 0) {
      setApprovalError(
        `Complete all required fields before sending: ${committeeMissing.map((c) => c.label).join(", ")}`,
      );
      return;
    }
    let committee_level: string | undefined;
    let approvers: { role: string; email: string }[];
    if (isNegotiation) {
      const approverEmail = negotiationApproverEmail.trim();
      if (!approverEmail) {
        setApprovalError("Approver email is required.");
        return;
      }
      committee_level = undefined;
      approvers = [{ role: negotiationApproverRole, email: approverEmail }];
    } else {
      const tier =
        opp.committee_level ||
        committeeLevel ||
        (opp.phase_status !== "Phase 1" ? "Light" : "");
      if (!tier) {
        setApprovalError(
          "Select a committee level (Light, Intermediate or Full).",
        );
        return;
      }
      const mandatoryRoles = mandatoryRolesForPhase(
        opp.phase_status,
        tier as CommitteeLevel,
      );
      const missing = mandatoryRoles.filter(
        (r) => !(approverEmails[r] ?? "").trim(),
      );
      if (missing.length) {
        setApprovalError(`Missing required approver(s): ${missing.join(", ")}`);
        return;
      }
      committee_level = opp.committee_level ? undefined : tier;
      approvers = Object.entries(approverEmails)
        .filter(([, email]) => email.trim())
        .map(([role, email]) => ({ role, email: email.trim() }));
    }
    setApprovalSubmitting(true);
    setApprovalError(null);
    try {
      await supplierAPI.requestCommitteeGateApproval(opp.opportunity_id, {
        committee_level,
        approvers,
        message: approvalMessage || undefined,
      });
      const res = await supplierAPI.getGateApprovalStatus(opp.opportunity_id);
      setApprovalRequests(res.data ?? []);
      setShowApproval(false);
      setApproverEmails({});
      setNegotiationApproverEmail("");
      setApprovalMessage("");
    } catch (e: unknown) {
      setApprovalError(e instanceof Error ? e.message : "Failed");
    } finally {
      setApprovalSubmitting(false);
    }
  }

  // After a reminder is sent from the modal, refresh the request so the
  // "reminded N× · date" counts update in place.
  async function refreshApprovalStatus() {
    try {
      const st = await supplierAPI.getGateApprovalStatus(opp.opportunity_id);
      setApprovalRequests(st.data ?? []);
    } catch {
      /* non-blocking */
    }
  }

  // Manually (re)send the Project Manager handover email for a given gate.
  const [pmSendingId, setPmSendingId] = useState<number | null>(null);
  const [pmMsg, setPmMsg] = useState<Record<number, string>>({});
  async function resendPmEmail(requestId: number) {
    setPmSendingId(requestId);
    setPmMsg((m) => ({ ...m, [requestId]: "" }));
    try {
      const res = await supplierAPI.resendPmNotification(requestId);
      setPmMsg((m) => ({
        ...m,
        [requestId]:
          res.delivery === "sent"
            ? `Email sent to ${res.pm_email}.`
            : `Delivery failed for ${res.pm_email} — check SMTP / try again.`,
      }));
      await refreshApprovalStatus();
    } catch (e: unknown) {
      setPmMsg((m) => ({
        ...m,
        [requestId]: e instanceof Error ? e.message : "Failed to send.",
      }));
    } finally {
      setPmSendingId(null);
    }
  }

  const isAssigned = opp.status === "Assigned";
  const isWorkingOn =
    opp.status === "Working on it" || opp.status === "Needs Rework";
  // Phase 0 uses "Awaiting Validation"; Phase 1-4 committee gates use
  // "Under Committee Review" (see GateApprovalService.create_committee_approval_request) —
  // the opportunity is locked in whichever status until quorum is reached.
  const isAwaitingGate =
    opp.status === "Awaiting Validation" && opp.phase_status === "Phase 0";
  const isPhase1Working =
    opp.phase_status === "Phase 1" &&
    (opp.status === "Working on it" || opp.status === "Needs Rework");
  const isUnderCommittee =
    opp.status === "Under Committee Review" &&
    ["Phase 1", "Phase 2", "Phase 3", "Phase 4"].includes(
      opp.phase_status ?? "",
    );
  const isPendingGateDecision = isAwaitingGate || isUnderCommittee;
  const isClosed = opp.phase_status === "Closed";
  // Gate-approval requests for whichever phase the opportunity is currently
  // in (Phase 0-3 are all gate-eligible on the backend — see
  // GateApprovalService._GATE_ELIGIBLE_PHASES).
  const activeGateRequests = approvalRequests.filter(
    (r) => r.phase_from === opp.phase_status && r.status !== "Superseded",
  );
  const allGateApproved = activeGateRequests.some(
    (r) => r.status === "Completed" && r.consensus_result === "Go",
  );
  const needsPm =
    decision === "Go" &&
    opp.opportunity_type &&
    !["Negotiation", "Cash"].includes(opp.opportunity_type) &&
    opp.phase_status === "Phase 0";
  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const GATE_ELIGIBLE_PHASES = [
    "Phase 0",
    "Phase 1",
    "Phase 2",
    "Phase 3",
    "Phase 4",
  ];
  // Negotiation skips Phase 2 entirely — Phase 1 Go lands directly on Phase 3.
  const NEXT_GATE_PHASE: Record<string, string> = {
    "Phase 0": "Phase 1",
    "Phase 1": isNegotiation ? "Phase 3" : "Phase 2",
    "Phase 2": "Phase 3",
    "Phase 3": "Phase 4",
    "Phase 4": "Closed",
  };

  // ── STP section completeness (saved values on opp) ─────────────────
  const isStpType = !["Negotiation", "Cash"].includes(
    opp.opportunity_type ?? "",
  );
  const stpGateSections = isStpType
    ? [
        {
          label: "Scope (Scope IN + Customers)",
          ok: !!(opp.scope_in && opp.customers),
        },
        {
          label: "Quantities (Annual N1)",
          ok: !!(opp.annual_quantity_n1 && opp.annual_quantity_n1 > 0),
        },
        {
          label: "Prices (Before/After)",
          ok: !!(opp.current_price && opp.proposed_price),
        },
        {
          label: "Logistics (Incoterms + Country after)",
          ok: !!(
            opp.incoterms_before &&
            opp.incoterms_after &&
            opp.country_after
          ),
        },
        {
          label: "Risks (Material indexation Before/After)",
          ok: !!(
            opp.stp_risks?.material_indexation_before &&
            opp.stp_risks?.material_indexation_after
          ),
        },
        {
          label: "Benefits (If we do)",
          ok: !!(opp.stp_benefits?.if_we_do || opp.stp_benefits?.if_not),
        },
        {
          label: "Planning (Phase 1 weeks)",
          ok: !!(opp.phase1_weeks && opp.phase1_weeks > 0),
        },
      ]
    : [];
  const stpGateMissing = stpGateSections.filter((s) => !s.ok);

  // ── Pre-submission validation checks ──────────────────────────────
  // Phase 0 → PM validation: what must be filled
  const phase0Checks = [
    {
      ok: opp.expected_annual_saving != null,
      label: "Est. Annual Saving is required",
    },
    {
      ok: !!opp.duration_months && opp.duration_months > 0,
      label: "Duration (months) is required",
    },
    { ok: !!opp.planned_start_date, label: "Planned Start Date is required" },
    {
      ok:
        (opp.currency ?? "EUR") === "EUR" ||
        (!!opp.fx_rate_to_eur && opp.fx_rate_to_eur > 0),
      label: `FX rate to EUR required — opportunity uses ${opp.currency ?? "EUR"} with no conversion rate set`,
    },
    // Phase 3/4: the real deployment start must be recorded before a review can
    // be requested — savings are flowing, so the timing must be firm. (It can
    // also be entered from the Budgeting page for opportunities that reached
    // Phase 3 without it.) Mirrors the backend committee-request guard.
    ...(["Phase 3", "Phase 4"].includes(opp.phase_status ?? "")
      ? [
          {
            ok: !!opp.real_start_date,
            label: "Deployment Start Date (Real Savings Start) is required",
          },
        ]
      : []),
    // Execution start date: required for non-Negotiation types from the first
    // committee phase (Phase 1) onward — Negotiation has no execution/tooling
    // phase so it never needs one. Mirrors the backend committee-request guard.
    ...(!["Negotiation", "Cash"].includes(opp.opportunity_type ?? "") &&
    ["Phase 1", "Phase 2", "Phase 3", "Phase 4"].includes(
      opp.phase_status ?? "",
    )
      ? [
          {
            ok: !!opp.execution_start_date,
            label: "Execution Start Date is required",
          },
        ]
      : []),
    // Purchasing Owner + Conversion Owner become mandatory from Phase 2: the
    // Purchasing Owner receives tracking/escalation alerts and the Conversion
    // Owner enters the monthly actuals that start flowing in execution — the
    // opportunity can't be tracked past Phase 2 without them. Applies to every
    // opportunity type. Mirrors the backend committee-request guard.
    ...(["Phase 2", "Phase 3", "Phase 4"].includes(opp.phase_status ?? "")
      ? [
          {
            ok: !!opp.purchasing_owner,
            label: "Purchasing Owner is required",
          },
          {
            ok: !!opp.conversion_owner,
            label: "Conversion Owner is required",
          },
        ]
      : []),
    ...(!["Negotiation", "Cash"].includes(opp.opportunity_type ?? "")
      ? [
          {
            ok: !!opp.plant_id,
            label: "Plant selected (Sourcing / Technical)",
          },
          { ok: !!opp.scope_in, label: "Scope IN required (part number)" },
          // "Proposed New Supplier — After" only becomes mandatory from Phase 1:
          // Phase 0 is an exploratory study (free-text candidate is optional), and
          // from Phase 1 the field is a panel dropdown that writes
          // proposed_supplier_id (NOT proposed_supplier_name), so the gate must
          // validate the id — matching the missingFlags.supplierName highlight.
          ...((opp.phase_status ?? "") === "Phase 0"
            ? []
            : [
                {
                  ok: !!opp.proposed_supplier_id,
                  label: "Proposed New Supplier — After (from panel) required",
                },
              ]),
          {
            ok: !!opp.current_price && !!opp.proposed_price,
            label: "Before/After unit prices required",
          },
          ...stpGateMissing,
        ]
      : []), // Negotiation/Cash skip PLD scoring — nothing extra required here.
  ];
  const phase0Missing = phase0Checks.filter((c) => !c.ok);
  // Same completeness checklist (STP fields, duration, planned start date,
  // FX rate, etc.) reused for the Phase 1-4 sourcing committee request — the
  // underlying data these gates decide on shouldn't be incomplete either.
  const committeeMissing = phase0Missing;

  // Shared "single approver" picker for Negotiation — Purchasing Director or
  // VP Conversion — reused for both the Phase 0 request and every Phase 1-4
  // committee request.
  const negotiationApproverFields = (
    <div className="space-y-2">
      <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
        Approver <span className="text-red-500">*</span>
      </label>
      <p className="text-[10px] text-slate-400 mb-1">
        Either role can decide this gate alone.
      </p>
      <div className="flex gap-2">
        {NEGOTIATION_APPROVER_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setNegotiationApproverRole(role)}
            className={`flex-1 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
              negotiationApproverRole === role
                ? "border-amber-400 bg-amber-100 text-amber-800"
                : "border-slate-200 bg-white text-slate-500 hover:border-amber-300"
            }`}
          >
            {role}
          </button>
        ))}
      </div>
      <select
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        value={negotiationApproverEmail}
        onChange={(e) => setNegotiationApproverEmail(e.target.value)}
      >
        <option value="">— select {negotiationApproverRole} —</option>
        {accountsForRole(negotiationApproverRole).map((a) => (
          <option key={a.id_identity} value={a.email}>
            {a.full_name} ({a.email})
          </option>
        ))}
      </select>
    </div>
  );

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
                onNavigate("edit");
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

      {/* STEP 2 — Submit & Request Gate Approval (merged).
          Gate approval is required by the backend for Phase 0-3 (see
          GateApprovalService._GATE_ELIGIBLE_PHASES / apply_gate_decision's
          GATE_APPROVAL_REQUIRED guard) — this block used to only render for
          Phase 0, leaving Phase 1-3 with no way to actually request the
          quorum vote the "Apply decision" button demands. */}
      {isWorkingOn && GATE_ELIGIBLE_PHASES.includes(opp.phase_status ?? "") && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-3">
          {/* Context badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full bg-amber-200/70 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
              {opp.phase_status}
            </span>
            {opp.phase_status === "Phase 0" && (
              <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                STP Opportunity Study
              </span>
            )}
            <span className="text-[10px] text-amber-500">
              Gate: {opp.phase_status} →{" "}
              {NEXT_GATE_PHASE[opp.phase_status ?? ""] ?? "next phase"}
            </span>
          </div>

          {/* Pre-submission checklist — Phase 0 only; Phase 1-3 have no
              equivalent backend pre-checks before a gate approval request. */}
          {opp.phase_status === "Phase 0" ? (
            phase0Missing.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-white p-3 space-y-1.5">
                <p className="text-[10.5px] font-bold text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> {phase0Missing.length} item
                  {phase0Missing.length > 1 ? "s" : ""} missing before
                  submission:
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
                <CheckCircle2 size={11} /> All checks passed — ready to submit
                to PM
              </div>
            )
          ) : (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={11} /> Ready to request the {opp.phase_status}{" "}
              gate approval.
            </div>
          )}

          {/* Formal approval with unique links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-700">
                Request Formal Approval
              </p>
              {!isClosed && (
                <button
                  onClick={() => setShowApproval((v) => !v)}
                  className="text-[11px] font-semibold text-amber-600 hover:underline"
                >
                  {showApproval ? "Cancel" : "+ Request →"}
                </button>
              )}
            </div>
            <p className="text-[11px] text-amber-600">
              Send each reviewer a unique link — they see the full opportunity
              dossier and vote Approved / Rejected / Needs Review.
            </p>

            {showApproval && opp.phase_status === "Phase 0" && (
              <div className="rounded-xl border border-amber-200 bg-white p-3 space-y-3">
                {phase0Missing.length > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-[10.5px] font-bold text-orange-700 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Complete before sending
                    </p>
                    <ul className="space-y-1">
                      {phase0Missing.map((c, idx) => (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() => onNavigate("edit")}
                            className="flex w-full items-center gap-1.5 text-left text-[10px] text-orange-700 hover:text-orange-900 hover:underline"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                            {c.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {approvalError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {approvalError}
                  </p>
                )}
                {isNegotiation ? (
                  <>
                    {negotiationApproverFields}
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                        Plant Manager email (optional — informational only)
                      </label>
                      <p className="text-[10px] text-slate-400 mb-1">
                        Notified by email only — does not vote.
                      </p>
                      <input
                        type="email"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="plant.manager@avocarbon.com"
                        value={plantManagerEmail}
                        onChange={(e) => setPlantManagerEmail(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                        Plant Manager email{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <p className="text-[10px] text-slate-400 mb-1">
                        Will vote and designate the Project Manager upon
                        approval.
                      </p>
                      <input
                        type="email"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="plant.manager@avocarbon.com"
                        value={plantManagerEmail}
                        onChange={(e) => setPlantManagerEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                        Purchasing Manager email(s)
                      </label>
                      <p className="text-[10px] text-slate-400 mb-1">
                        Additional approvers — vote only, no PM designation.
                      </p>
                      <input
                        type="text"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="purchasing@avocarbon.com, director@avocarbon.com"
                        value={purchasingManagerEmails}
                        onChange={(e) =>
                          setPurchasingManagerEmails(e.target.value)
                        }
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Message (optional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Context or specific points for the reviewers…"
                    value={approvalMessage}
                    onChange={(e) => setApprovalMessage(e.target.value)}
                  />
                </div>
                <button
                  disabled={approvalSubmitting || phase0Missing.length > 0}
                  onClick={submitApprovalRequest}
                  className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                  title={
                    phase0Missing.length > 0
                      ? `Complete required fields first: ${phase0Missing.map((c) => c.label).join(", ")}`
                      : undefined
                  }
                >
                  {approvalSubmitting ? "Sending…" : "Send Approval Links"}
                </button>
              </div>
            )}

            {showApproval && opp.phase_status !== "Phase 0" && (
              <div className="rounded-xl border border-amber-200 bg-white p-3 space-y-3">
                {committeeMissing.length > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-[10.5px] font-bold text-orange-700 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Complete before sending
                    </p>
                    <ul className="space-y-1">
                      {committeeMissing.map((c, idx) => (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() => onNavigate("edit")}
                            className="flex w-full items-center gap-1.5 text-left text-[10px] text-orange-700 hover:text-orange-900 hover:underline"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                            {c.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {approvalError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {approvalError}
                  </p>
                )}
                {isNegotiation ? (
                  negotiationApproverFields
                ) : (
                  <>
                    {/* Committee level is only chosen/shown at Phase 1 — Phase 2/3/4
                        reuse the locked tier silently (it no longer affects which
                        roles are mandatory there, see mandatoryRolesForPhase), so
                        we skip straight to Required approvers / Add optional
                        reviewers instead of showing the tier picker or badge again. */}
                    {opp.phase_status === "Phase 1" &&
                      (opp.committee_level ? (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
                          Committee level locked at{" "}
                          <span className="font-bold text-slate-800">
                            {opp.committee_level}
                          </span>{" "}
                          (chosen at Phase 1).
                        </div>
                      ) : (
                        <div>
                          <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                            Committee level{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-2">
                            {COMMITTEE_LEVELS.map((lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => setCommitteeLevel(lvl)}
                                className={`flex-1 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                                  committeeLevel === lvl
                                    ? "border-amber-400 bg-amber-100 text-amber-800"
                                    : "border-slate-200 bg-white text-slate-500 hover:border-amber-300"
                                }`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                    {(() => {
                      // Phase 2-4 don't need a tier to determine mandatory roles
                      // (see mandatoryRolesForPhase) — default to "Light" so the
                      // required-approvers section still renders even for legacy
                      // opportunities that never had a committee_level recorded
                      // (e.g. their Phase 1 gate predates this feature).
                      const tier = (opp.committee_level ||
                        committeeLevel ||
                        (opp.phase_status !== "Phase 1" ? "Light" : "")) as
                        | CommitteeLevel
                        | "";
                      if (!tier) return null;
                      const mandatoryRoles = mandatoryRolesForPhase(
                        opp.phase_status,
                        tier,
                      );
                      const optionalRoles = ALL_ROLES.filter(
                        (r) => !mandatoryRoles.includes(r),
                      );
                      return (
                        <>
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              {opp.phase_status === "Phase 1"
                                ? `Required approvers — ${tier} Committee`
                                : `Required approvers — ${opp.phase_status}`}
                            </p>
                            {mandatoryRoles.map((role) => (
                              <div
                                key={role}
                                className="flex items-center gap-2"
                              >
                                <span className="w-40 shrink-0 text-[10.5px] font-semibold text-slate-500">
                                  {role} <span className="text-red-500">*</span>
                                </span>
                                {ROLE_LABEL_TO_PROFILE[role] ? (
                                  <select
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    value={approverEmails[role] ?? ""}
                                    onChange={(e) =>
                                      setApproverEmails((m) => ({
                                        ...m,
                                        [role]: e.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">— select {role} —</option>
                                    {accountsForRole(role).map((a) => (
                                      <option
                                        key={a.id_identity}
                                        value={a.email}
                                      >
                                        {a.full_name} ({a.email})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="email"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    placeholder="name@avocarbon.com"
                                    value={approverEmails[role] ?? ""}
                                    onChange={(e) =>
                                      setApproverEmails((m) => ({
                                        ...m,
                                        [role]: e.target.value,
                                      }))
                                    }
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                setShowOptionalApprovers((s) => !s)
                              }
                              className="text-[11px] font-semibold text-amber-600 hover:underline"
                            >
                              {showOptionalApprovers ? "Hide" : "+ Add"}{" "}
                              optional reviewers
                            </button>
                            {showOptionalApprovers && (
                              <div className="mt-2 space-y-2">
                                {optionalRoles.map((role) => (
                                  <div
                                    key={role}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="w-40 shrink-0 text-[10.5px] font-semibold text-slate-400">
                                      {role}
                                    </span>
                                    {ROLE_LABEL_TO_PROFILE[role] ? (
                                      <select
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        value={approverEmails[role] ?? ""}
                                        onChange={(e) =>
                                          setApproverEmails((m) => ({
                                            ...m,
                                            [role]: e.target.value,
                                          }))
                                        }
                                      >
                                        <option value="">
                                          — select {role} (optional) —
                                        </option>
                                        {accountsForRole(role).map((a) => (
                                          <option
                                            key={a.id_identity}
                                            value={a.email}
                                          >
                                            {a.full_name} ({a.email})
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type="email"
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        placeholder="name@avocarbon.com (optional)"
                                        value={approverEmails[role] ?? ""}
                                        onChange={(e) =>
                                          setApproverEmails((m) => ({
                                            ...m,
                                            [role]: e.target.value,
                                          }))
                                        }
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}

                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Message (optional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Context or specific points for the reviewers…"
                    value={approvalMessage}
                    onChange={(e) => setApprovalMessage(e.target.value)}
                  />
                </div>
                <button
                  disabled={
                    approvalSubmitting ||
                    committeeMissing.length > 0 ||
                    (isNegotiation
                      ? !negotiationApproverEmail.trim()
                      : !(
                          opp.committee_level ||
                          committeeLevel ||
                          (opp.phase_status !== "Phase 1" ? "Light" : "")
                        ))
                  }
                  onClick={submitCommitteeApprovalRequest}
                  className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                  title={
                    committeeMissing.length > 0
                      ? `Complete required fields first: ${committeeMissing.map((c) => c.label).join(", ")}`
                      : undefined
                  }
                >
                  {approvalSubmitting ? "Sending…" : "Send Approval Links"}
                </button>
              </div>
            )}

            {/* Existing approval requests for the current gate (exclude superseded) */}
            {activeGateRequests.map((req) => (
              <div
                key={req.request_id}
                className="rounded-xl border border-amber-200 bg-white p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-700">
                    by {req.requested_by ?? "—"}
                    {req.requested_at ? ` · ${fmtDate(req.requested_at)}` : ""}
                    {req.committee_level && (
                      <span className="ml-1.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                        {req.committee_level}
                      </span>
                    )}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      req.status === "Completed" &&
                      req.consensus_result === "Go"
                        ? "bg-emerald-100 text-emerald-700"
                        : req.status === "Completed" &&
                            req.consensus_result === "No Go"
                          ? "bg-red-100 text-red-700"
                          : req.status === "Completed"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {req.status === "Completed"
                      ? req.consensus_result
                      : "Pending"}
                  </span>
                </div>
                <div className="space-y-2">
                  {req.votes.map((v) => (
                    <div key={v.vote_id} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600">
                            {v.approver_email}
                          </span>
                          {v.approver_role ? (
                            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                              {v.approver_role}
                            </span>
                          ) : (
                            v.is_plant_manager && (
                              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                                Plant Mgr
                              </span>
                            )
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {v.decision ? (
                            <>
                              <span
                                className={`font-semibold ${
                                  v.decision === "Approved"
                                    ? "text-emerald-600"
                                    : v.decision === "Rejected"
                                      ? "text-red-600"
                                      : "text-amber-600"
                                }`}
                              >
                                {v.decision === "Approved"
                                  ? "✅"
                                  : v.decision === "Rejected"
                                    ? "❌"
                                    : "🔄"}{" "}
                                {v.decision}
                              </span>
                              {v.decided_at && (
                                <span className="text-slate-400">
                                  {fmtDate(v.decided_at)}
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 italic">
                                Pending…
                              </span>
                              {v.access_token && canSeeApprovalLinks && (
                                <button
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      `${window.location.origin}/approve/${v.access_token}`,
                                    )
                                  }
                                  className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                                  title="Copy approval link to clipboard"
                                >
                                  Copy link
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Show designated PM below the vote row */}
                      {v.is_plant_manager && v.project_manager_email && (
                        <p className="text-[10px] text-green-700 pl-1">
                          PM assigned:{" "}
                          <span className="font-semibold">
                            {v.project_manager_email}
                          </span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {req.votes.some((v) => v.comment) && (
                  <div className="border-t border-slate-200 pt-2 space-y-1">
                    {req.votes
                      .filter((v) => v.comment)
                      .map((v) => (
                        <p
                          key={v.vote_id}
                          className="text-[10.5px] text-slate-500 italic"
                        >
                          {v.approver_email}: &ldquo;{v.comment}&rdquo;
                        </p>
                      ))}
                  </div>
                )}
              </div>
            ))}
            {activeGateRequests.length === 0 && !showApproval && (
              <p className="text-[11px] text-amber-500/70">
                No formal approval requests yet for this gate.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Awaiting review banners */}
      {isAwaitingGate && !allGateApproved && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <p className="font-bold flex items-center gap-1.5">
            <Clock size={12} /> Awaiting Validation
          </p>
          <p className="mt-0.5">
            Approval request sent
            {opp.validation_request_sent_at
              ? ` on ${fmtDate(opp.validation_request_sent_at)}`
              : ""}
            . Waiting for all approvers to vote.
          </p>
        </div>
      )}
      {isAwaitingGate && allGateApproved && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs">
          <p className="font-bold flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 size={12} /> All Approvers Validated — Ready to Apply
            Gate
          </p>
          <p className="mt-0.5 text-emerald-600">
            All reviewers have given their Go. Click{" "}
            <strong>"Apply decision"</strong> below, select <strong>Go</strong>,
            and confirm to advance to{" "}
            {NEXT_GATE_PHASE[opp.phase_status ?? ""] ?? "the next phase"}.
          </p>
        </div>
      )}
      {isUnderCommittee && !allGateApproved && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-xs text-purple-700">
          <p className="font-bold flex items-center gap-1.5">
            <Users size={12} /> Under Committee Review
          </p>
          <p className="mt-0.5">
            {opp.committee_level ? `${opp.committee_level} Committee — ` : ""}
            approval request sent
            {opp.validation_request_sent_at
              ? ` on ${fmtDate(opp.validation_request_sent_at)}`
              : ""}
            . Waiting for all approvers to vote.
          </p>
        </div>
      )}
      {isUnderCommittee && allGateApproved && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs">
          <p className="font-bold flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 size={12} /> All Approvers Validated — Ready to Apply
            Gate
          </p>
          <p className="mt-0.5 text-emerald-600">
            All reviewers have given their Go. Click{" "}
            <strong>"Apply decision"</strong> below, select <strong>Go</strong>,
            and confirm to advance to{" "}
            {NEXT_GATE_PHASE[opp.phase_status ?? ""] ?? "the next phase"}.
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

      {/* GATE DECISION — manual apply is only ever accepted by the backend at
          Phase 0 (see apply_gate_decision's GATE_APPROVAL_REQUIRED guard in
          purchasing_value/service.py); Phase 1-4 can ONLY advance via the gate
          approval vote flow above, so this section is hidden for those phases
          to avoid a button that always fails. */}
      {isAwaitingGate && (
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
          {showGate && isStpType && stpGateMissing.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
              <p className="text-[10.5px] font-bold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle size={11} /> STP incomplete —{" "}
                {stpGateMissing.length} section
                {stpGateMissing.length > 1 ? "s" : ""} missing:
              </p>
              {stpGateMissing.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onNavigate("edit")}
                  className="flex w-full items-start gap-1.5 text-left text-[11px] text-amber-600 hover:text-amber-800 hover:underline"
                >
                  <span className="shrink-0 text-amber-400">✗</span> {s.label}
                </button>
              ))}
              <p className="text-[10.5px] text-amber-500 pt-0.5">
                Click a section above to jump to the STP Study tab, fill it in
                and save before applying a Go decision.
              </p>
            </div>
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
                    if (updated.phase_status === "Phase 1")
                      onNavigate("project");
                    else if (
                      ["Phase 2", "Phase 3", "Phase 4"].includes(
                        updated.phase_status ?? "",
                      )
                    )
                      onNavigate("financial");
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
                disabled={
                  loading ||
                  (decision === "Go" && isStpType && stpGateMissing.length > 0)
                }
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${decision === "Go" ? "bg-emerald-600 hover:bg-emerald-700" : decision === "No Go" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}
              >
                {loading && <RefreshCw size={13} className="animate-spin" />}{" "}
                Apply {decision}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Approval Status — only shown outside of Phase 0 / Phase 1 working cards */}
      {!(isWorkingOn && opp.phase_status === "Phase 0") &&
        !isPhase1Working &&
        approvalRequests.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
              Approval Requests
            </p>
            {approvalRequests.map((req) => (
              <div
                key={req.request_id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-700">
                    Phase {req.phase_from} → next &nbsp;·&nbsp; by{" "}
                    {req.requested_by ?? "—"}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      req.status === "Completed" &&
                      req.consensus_result === "Go"
                        ? "bg-emerald-100 text-emerald-700"
                        : req.status === "Completed" &&
                            req.consensus_result === "No Go"
                          ? "bg-red-100 text-red-700"
                          : req.status === "Completed"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {req.status === "Completed"
                      ? req.consensus_result
                      : "Pending"}
                  </span>
                </div>
                <div className="space-y-1">
                  {req.votes.map((v) => (
                    <div
                      key={v.vote_id}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="text-slate-600">{v.approver_email}</span>
                      <div className="flex items-center gap-2">
                        {v.decision ? (
                          <>
                            <span
                              className={`font-semibold ${
                                v.decision === "Approved"
                                  ? "text-emerald-600"
                                  : v.decision === "Rejected"
                                    ? "text-red-600"
                                    : "text-amber-600"
                              }`}
                            >
                              {v.decision === "Approved"
                                ? "✅"
                                : v.decision === "Rejected"
                                  ? "❌"
                                  : "🔄"}{" "}
                              {v.decision}
                            </span>
                            {v.decided_at && (
                              <span className="text-slate-400">
                                {fmtDate(v.decided_at)}
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 italic">
                              Pending…
                            </span>
                            {(v.reminder_count ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                <Bell size={9} />
                                {v.reminder_count}×
                                {v.last_reminded_at && (
                                  <span className="font-medium text-amber-600/80">
                                    · {fmtDateTime(v.last_reminded_at)}
                                  </span>
                                )}
                              </span>
                            )}
                            {v.access_token && canSeeApprovalLinks && (
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/approve/${v.access_token}`,
                                  )
                                }
                                className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                              >
                                Copy link
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Project Manager handover — per gate: confirm the PM was
                    emailed once the panel approved, and allow a manual (re)send
                    (e.g. if the automatic email failed). */}
                {req.status === "Completed" &&
                  req.consensus_result === "Go" && (
                    <div className="space-y-1.5 border-t border-slate-200 pt-2 text-[10.5px]">
                      {req.pm_notified_email &&
                      req.pm_notification_status === "sent" ? (
                        <p className="flex items-start gap-1.5 text-slate-600">
                          <CheckCircle2
                            size={12}
                            className="mt-0.5 shrink-0 text-emerald-500"
                          />
                          <span>
                            Project Manager notified:{" "}
                            <span className="font-semibold text-slate-700">
                              {req.pm_notified_email}
                            </span>
                            {req.pm_notified_at && (
                              <span className="text-slate-400">
                                {" "}
                                · {fmtDateTime(req.pm_notified_at)}
                              </span>
                            )}
                          </span>
                        </p>
                      ) : req.pm_notified_email ? (
                        <p className="flex items-start gap-1.5 text-red-600">
                          <AlertTriangle
                            size={12}
                            className="mt-0.5 shrink-0 text-red-500"
                          />
                          <span>
                            PM email failed to send to{" "}
                            <span className="font-semibold">
                              {req.pm_notified_email}
                            </span>
                            .
                          </span>
                        </p>
                      ) : (
                        <p className="flex items-start gap-1.5 text-slate-500">
                          <AlertTriangle
                            size={12}
                            className="mt-0.5 shrink-0 text-amber-500"
                          />
                          <span>Project Manager not yet emailed.</span>
                        </p>
                      )}
                      {canRemindApprovers && (
                        <button
                          onClick={() => resendPmEmail(req.request_id)}
                          disabled={pmSendingId === req.request_id}
                          title="Send the opportunity handover email to the Project Manager"
                          className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                        >
                          <Mail size={12} />
                          {pmSendingId === req.request_id
                            ? "Sending…"
                            : req.pm_notification_status === "sent"
                              ? "Resend PM email"
                              : "Send PM email"}
                        </button>
                      )}
                      {pmMsg[req.request_id] && (
                        <p className="text-[10.5px] text-slate-500">
                          {pmMsg[req.request_id]}
                        </p>
                      )}
                    </div>
                  )}
                {req.votes.some((v) => v.comment) && (
                  <div className="border-t border-slate-200 pt-2 space-y-1">
                    {req.votes
                      .filter((v) => v.comment)
                      .map((v) => (
                        <p
                          key={v.vote_id}
                          className="text-[10.5px] text-slate-500 italic"
                        >
                          {v.approver_email}: &ldquo;{v.comment}&rdquo;
                        </p>
                      ))}
                  </div>
                )}
                {/* Reminder — still-open request with at least one undecided
                    approver, restricted to the same privileged pair that can
                    send approval links. Re-sends each pending approver their
                    existing link; anyone who already voted is skipped. */}
                {req.status === "Pending" &&
                  req.votes.some((v) => !v.decision) &&
                  canRemindApprovers && (
                    <div className="space-y-1.5 border-t border-slate-200 pt-2">
                      {req.votes.some((v) => (v.reminder_count ?? 0) > 0) && (
                        <p className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                          <Bell size={11} className="text-amber-500" />
                          {req.votes.reduce(
                            (s, v) => s + (v.reminder_count ?? 0),
                            0,
                          )}{" "}
                          reminder
                          {req.votes.reduce(
                            (s, v) => s + (v.reminder_count ?? 0),
                            0,
                          ) === 1
                            ? ""
                            : "s"}{" "}
                          sent
                          {(() => {
                            const last = req.votes
                              .map((v) => v.last_reminded_at)
                              .filter(Boolean)
                              .sort()
                              .pop();
                            return last ? ` · last ${fmtDateTime(last)}` : "";
                          })()}
                        </p>
                      )}
                      <button
                        onClick={() => setRemindOpen(true)}
                        title="Re-send the approval link to approvers who haven't decided yet"
                        className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        <Bell size={12} />
                        Send reminder to pending approvers
                      </button>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}

      {remindOpen && (
        <RemindModal
          oppName={opp.opportunity_name ?? `#${opp.opportunity_id}`}
          opportunityId={opp.opportunity_id}
          onClose={() => setRemindOpen(false)}
          onSent={refreshApprovalStatus}
        />
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

// Manual Revise-Baseline tool — the ONLY way to correct price/quantity/bonus (or
// the flat annual saving for Negotiation/Cash) once actuals already exist; direct
// STP editing is unconditionally blocked past that point (BASELINE_LOCKED_ACTUALS
// in update_opportunity), even for purchasing_director/vp_conversion. Recomputes
// through compute_stp_financials (same engine as the rest of the app), preserves
// every actual already entered, propagates to all fiscal-year budget rows, and
// keeps a permanent structured history (opp.revision_history).
// Note: expected-saving changes BEFORE actuals exist are already handled automatically
// (the monthly grid regenerates on save); this tool is only needed to re-baseline a
// line that ALREADY has entered actuals while preserving them.
const REVISE_BASELINE_ENABLED = true;

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
    title: "Not Started",
    guidance:
      "No financial line yet — it is created automatically when Phase 2 is validated (Go to deployment).",
    canRevise: false,
    showActuals: false,
  },
  "Phase 1": {
    color: "blue",
    title: "Feasibility Phase",
    guidance:
      "No financial line yet — created at Phase 2 Go. Adjust the estimated annual saving on the opportunity form if the committee revises the figure.",
    canRevise: false,
    showActuals: false,
  },
  "Phase 2": {
    color: "indigo",
    title: "Line Created",
    guidance:
      "Financial line created. The monthly tracking grid is generated once you enter the Real Start Date in Phase 3 (deployment).",
    canRevise: false,
    showActuals: false,
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
  const [showCashEntry, setShowCashEntry] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
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
  // Revise committed baseline (Phase 3, actuals already exist) — inputs are the
  // NEW proposed values; for Sourcing/Technical Productivity this is the real
  // STP price/quantity/bonus fields (recomputed through the same formula engine
  // as everywhere else); for Negotiation/Cash (no price/quantity breakdown) it's
  // the flat revised annual saving.
  const isStpType = ["Sourcing", "Technical Productivity"].includes(
    opp.opportunity_type ?? "",
  );
  const [showRevise, setShowRevise] = useState(false);
  const emptyReviseForm = {
    note: "",
    revised_saving: "",
    current_price: "",
    proposed_price: "",
    current_price_n1: "",
    current_price_n2: "",
    current_price_n3: "",
    proposed_price_n1: "",
    proposed_price_n2: "",
    proposed_price_n3: "",
    annual_quantity_n1: "",
    annual_quantity_n2: "",
    annual_quantity_n3: "",
    annual_quantity_n4: "",
    bonus_before: "",
    bonus_after: "",
  };
  const [reviseForm, setReviseForm] = useState(emptyReviseForm);
  const reviseHasStpChange = Object.entries(reviseForm).some(
    ([k, v]) => k !== "note" && k !== "revised_saving" && v.trim() !== "",
  );

  // FinancialLine/MonthlyFinancial amounts are stored in the opportunity's
  // native currency (no FX conversion applied at this level — see
  // _create_financial_line / _ensure_monthly_rows on the backend), so this
  // tab must format with opp.currency, not fmt()'s "EUR" default.
  const fmtC = (n?: number | null) => fmt(n, opp.currency || "EUR");

  const phaseCtx =
    FINANCIAL_PHASE_CONTEXT[opp.phase_status ?? ""] ??
    FINANCIAL_PHASE_CONTEXT["Phase 3"];
  const isOwner =
    (opp.conversion_owner ?? "").trim().toLowerCase() ===
    userEmail.trim().toLowerCase();
  // Revise Baseline is restricted to purchasing_director/vp_conversion on the
  // backend (_PRIVILEGED, no ownership check) — mirror that here rather than
  // gating on isOwner, otherwise a non-owner PD/VP wouldn't see the button at
  // all, while an owner who isn't PD/VP would see it and get a 403.
  const { user } = useAuth();
  // Purchasing Director / VP Conversion may enter and overwrite real savings on
  // any opportunity, not just the ones they own — mirrors the backend, where
  // _PRIVILEGED clears both the first-entry (_NON_VIEWER) and overwrite checks
  // on PUT /monthly/{id}.
  const isPrivileged =
    user?.access_profile === "purchasing_director" ||
    user?.access_profile === "vp_conversion";
  const canReviseBaseline = isPrivileged;
  // Mirror the backend rule: actuals are editable while the financial line is Active
  // and the opportunity has reached execution (Phase 3+), including Phase 4 (LLC) and
  // closure-period realization — not only during Phase 3.
  // Editable by the conversion owner OR a privileged role (PD / VP Conversion).
  const canEditFinancialRows =
    (isOwner || isPrivileged) &&
    opp.financial_lines[0]?.status === "Active" &&
    !["Assigned", "Phase 0", "Phase 1", "Phase 2"].includes(
      opp.phase_status ?? "",
    );
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
          Created automatically when Phase 2 is validated (Go to deployment).
        </p>
      </div>
    );
  }

  const isBudgeted = opp.validation_status === "Budgeted";

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

  // Gap 1 — Year split: aggregate monthly rows by calendar year.
  // Expected uses the same exact-day prorata as the Budgeting page
  // (opp.budget_years[].applicable_amount) when available, so the two screens
  // agree — the monthly profile below is whole-month (lands on day 1) and would
  // otherwise show a different figure for the anchor year. Falls back to summing
  // the monthly rows for years the budgeting module hasn't produced yet.
  const budgetYearExpected: Record<number, number> = {};
  (opp.budget_years ?? []).forEach((by) => {
    if (by.applicable_amount != null) {
      budgetYearExpected[by.fiscal_year] = toNum(by.applicable_amount);
    }
  });
  const yearBreakdown = rows.reduce<
    Record<number, { expected: number; actual: number }>
  >((acc, row) => {
    if (!row.period_month) return acc;
    const yr = new Date(row.period_month).getFullYear();
    if (!acc[yr])
      acc[yr] = {
        expected: budgetYearExpected[yr] ?? 0,
        actual: 0,
      };
    if (budgetYearExpected[yr] == null)
      acc[yr].expected += toNum(row.expected_saving);
    if (row.actual_saving != null) acc[yr].actual += toNum(row.actual_saving);
    return acc;
  }, {});
  const yearEntries = Object.entries(yearBreakdown).sort(
    ([a], [b]) => Number(a) - Number(b),
  );

  // Cash tracking is visible whenever the opportunity carries a cash_impact —
  // any opportunity type can have one (not just Negotiation), so this checks
  // the actual data rather than opportunity_type.
  const showCash =
    opp.cash_impact != null || rows.some((r) => r.cash_expected != null);
  // cash_impact is a one-shot booked entirely into a single month (see backend
  // _one_shot_cash_ideals) — that's the one row with cash_expected set.
  const cashRow = rows.find((r) => r.cash_expected != null) ?? null;

  async function saveCashReceived(e: React.FormEvent) {
    e.preventDefault();
    if (!cashRow) return;
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.updateMonthlyActual(cashRow.monthly_financial_id, {
        cash_actual: cashAmount ? parseFloat(cashAmount) : undefined,
        updated_by: userEmail,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setShowCashEntry(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveRow(monthId: number) {
    if (!canEditFinancialRows) {
      setError(
        "Monthly actuals can only be edited while the financial line is Active and the opportunity has reached execution (Phase 3+).",
      );
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
        if (
          !updatedLine?.recovery_status ||
          updatedLine.recovery_status === "Done"
        ) {
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
    if (!reviseForm.note.trim()) {
      setError("Reason for revision is required for audit trail.");
      return;
    }
    if (isStpType) {
      if (!reviseHasStpChange) {
        setError("Enter at least one new value (price, quantity or bonus).");
        return;
      }
    } else if (
      !reviseForm.revised_saving ||
      parseFloat(reviseForm.revised_saving) <= 0
    ) {
      setError("Enter a valid revised saving.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await supplierAPI.reviseFinancialLineBaseline(line.financial_line_id, {
        note: reviseForm.note.trim(),
        revised_by: userEmail,
        revised_saving: reviseForm.revised_saving
          ? parseFloat(reviseForm.revised_saving)
          : undefined,
        current_price: reviseForm.current_price
          ? parseFloat(reviseForm.current_price)
          : undefined,
        proposed_price: reviseForm.proposed_price
          ? parseFloat(reviseForm.proposed_price)
          : undefined,
        current_price_n1: reviseForm.current_price_n1
          ? parseFloat(reviseForm.current_price_n1)
          : undefined,
        current_price_n2: reviseForm.current_price_n2
          ? parseFloat(reviseForm.current_price_n2)
          : undefined,
        current_price_n3: reviseForm.current_price_n3
          ? parseFloat(reviseForm.current_price_n3)
          : undefined,
        proposed_price_n1: reviseForm.proposed_price_n1
          ? parseFloat(reviseForm.proposed_price_n1)
          : undefined,
        proposed_price_n2: reviseForm.proposed_price_n2
          ? parseFloat(reviseForm.proposed_price_n2)
          : undefined,
        proposed_price_n3: reviseForm.proposed_price_n3
          ? parseFloat(reviseForm.proposed_price_n3)
          : undefined,
        annual_quantity_n1: reviseForm.annual_quantity_n1
          ? parseInt(reviseForm.annual_quantity_n1)
          : undefined,
        annual_quantity_n2: reviseForm.annual_quantity_n2
          ? parseInt(reviseForm.annual_quantity_n2)
          : undefined,
        annual_quantity_n3: reviseForm.annual_quantity_n3
          ? parseInt(reviseForm.annual_quantity_n3)
          : undefined,
        annual_quantity_n4: reviseForm.annual_quantity_n4
          ? parseInt(reviseForm.annual_quantity_n4)
          : undefined,
        bonus_before: reviseForm.bonus_before
          ? parseFloat(reviseForm.bonus_before)
          : undefined,
        bonus_after: reviseForm.bonus_after
          ? parseFloat(reviseForm.bonus_after)
          : undefined,
      });
      const res = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(res.data as Opp);
      setShowRevise(false);
      setReviseForm(emptyReviseForm);
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
        {!isOwner && !isPrivileged && (
          <p className={`mt-2 font-semibold text-${phaseCtx.color}-700`}>
            Read-only — you are not the conversion owner for this opportunity.
          </p>
        )}
        {(isOwner || isPrivileged) && !canEditFinancialRows && (
          <p className={`mt-2 font-semibold text-${phaseCtx.color}-700`}>
            Monthly actuals are editable once the line is active and the
            opportunity reaches deployment (Phase 3+).
          </p>
        )}
      </div>

      {/* Revise baseline saving — only in Phase 3 once the real start is set and the
          monthly grid exists (rebuild preserves entered actuals). Not available before
          rows exist; adjust the estimate on the opportunity form in earlier phases.
          Restricted to purchasing_director/vp_conversion, not opportunity ownership. */}
      {canReviseBaseline &&
        REVISE_BASELINE_ENABLED &&
        opp.phase_status === "Phase 3" &&
        opp.real_start_date &&
        rows.length > 0 &&
        !isCompleted && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-700">
                  Revise Baseline Saving
                </p>
                <p className="text-[11px] text-blue-500 mt-0.5">
                  Current baseline:{" "}
                  <strong>{fmtC(line.expected_annual_saving)}/year</strong> ·
                  Budget: <strong>{fmtC(line.budget_value)}/year</strong>{" "}
                  (locked)
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
                {isStpType ? (
                  (() => {
                    const revInp =
                      "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
                    const revLabel =
                      "mb-1 block text-[10.5px] font-semibold text-slate-600";
                    const setRev = (k: keyof typeof reviseForm, v: string) =>
                      setReviseForm((f) => ({ ...f, [k]: v }));
                    const priceField = (
                      key: keyof typeof reviseForm,
                      label: string,
                      current: unknown,
                    ) => (
                      <div key={key}>
                        <label className={revLabel}>{label}</label>
                        <input
                          type="number"
                          step="0.0001"
                          className={revInp}
                          placeholder={
                            current != null
                              ? `Current: ${current}`
                              : "New value"
                          }
                          value={reviseForm[key]}
                          onChange={(e) => setRev(key, e.target.value)}
                        />
                      </div>
                    );
                    const qtyField = (
                      key: keyof typeof reviseForm,
                      label: string,
                      current: unknown,
                    ) => (
                      <div key={key}>
                        <label className={revLabel}>{label}</label>
                        <input
                          type="number"
                          step="1"
                          className={revInp}
                          placeholder={
                            current != null
                              ? `Current: ${current}`
                              : "New value"
                          }
                          value={reviseForm[key]}
                          onChange={(e) => setRev(key, e.target.value)}
                        />
                      </div>
                    );
                    return (
                      <div className="space-y-2">
                        <p className="text-[10.5px] text-slate-500">
                          Enter only the values that changed — leave the rest
                          blank. Expected saving, ROI and cash impact recompute
                          automatically from these.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {priceField(
                            "current_price",
                            "Current Price (Year N)",
                            opp.current_price,
                          )}
                          {priceField(
                            "proposed_price",
                            "Proposed Price (Year N)",
                            opp.proposed_price,
                          )}
                          {priceField(
                            "proposed_price_n1",
                            "Proposed Price N+1",
                            opp.proposed_price_n1,
                          )}
                          {priceField(
                            "proposed_price_n2",
                            "Proposed Price N+2",
                            opp.proposed_price_n2,
                          )}
                          {priceField(
                            "proposed_price_n3",
                            "Proposed Price N+3",
                            opp.proposed_price_n3,
                          )}
                          {qtyField(
                            "annual_quantity_n1",
                            "Qty Year N",
                            opp.annual_quantity_n1,
                          )}
                          {qtyField(
                            "annual_quantity_n2",
                            "Qty Year N+1",
                            opp.annual_quantity_n2,
                          )}
                          {qtyField(
                            "annual_quantity_n3",
                            "Qty Year N+2",
                            opp.annual_quantity_n3,
                          )}
                          {qtyField(
                            "annual_quantity_n4",
                            "Qty Year N+3",
                            opp.annual_quantity_n4,
                          )}
                          {priceField(
                            "bonus_before",
                            "Bonus Before",
                            opp.bonus_before,
                          )}
                          {priceField(
                            "bonus_after",
                            "Bonus After",
                            opp.bonus_after,
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
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
                      value={reviseForm.revised_saving}
                      onChange={(e) =>
                        setReviseForm((f) => ({
                          ...f,
                          revised_saving: e.target.value,
                        }))
                      }
                    />
                    {reviseForm.revised_saving &&
                      line.expected_annual_saving && (
                        <p
                          className={`text-[10px] mt-0.5 ${parseFloat(reviseForm.revised_saving) < Number(line.expected_annual_saving) ? "text-amber-600" : "text-emerald-600"}`}
                        >
                          {parseFloat(reviseForm.revised_saving) <
                          Number(line.expected_annual_saving)
                            ? "▼"
                            : "▲"}{" "}
                          Change: €
                          {Math.abs(
                            parseFloat(reviseForm.revised_saving) -
                              Number(line.expected_annual_saving),
                          ).toLocaleString("en-GB")}
                        </p>
                      )}
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Reason for revision *
                  </label>
                  <input
                    required
                    className={inp}
                    placeholder="e.g. Supplier renegotiated price mid-contract"
                    value={reviseForm.note}
                    onChange={(e) =>
                      setReviseForm((f) => ({ ...f, note: e.target.value }))
                    }
                  />
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[10.5px] text-amber-700">
                  ⚠ Every actual already entered is preserved — only the
                  remaining (not-yet-realized) months are rebuilt from the
                  corrected baseline.
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

      {/* Revision history — permanent audit trail of every committed-baseline
          correction (never trimmed/rewritten). */}
      {opp.revision_history != null && opp.revision_history.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-600">
            Baseline Revision History
          </p>
          <div className="space-y-2">
            {[...opp.revision_history].reverse().map((entry, i) => {
              const e = entry as Record<string, unknown>;
              const prevComputed =
                (e.previous_computed as Record<string, unknown>) || {};
              const newComputed =
                (e.new_computed as Record<string, unknown>) || {};
              return (
                <div
                  key={i}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span>
                      {e.revised_at
                        ? new Date(String(e.revised_at)).toLocaleString("en-GB")
                        : "—"}{" "}
                      · <strong>{String(e.revised_by ?? "unknown")}</strong>
                    </span>
                  </div>
                  {typeof e.note === "string" && e.note && (
                    <p className="mt-0.5 italic text-slate-600">"{e.note}"</p>
                  )}
                  <p className="mt-1 text-slate-600">
                    Annual saving: €
                    {Number(
                      prevComputed.expected_annual_saving ?? 0,
                    ).toLocaleString("en-GB")}{" "}
                    →{" "}
                    <strong>
                      €
                      {Number(
                        newComputed.expected_annual_saving ?? 0,
                      ).toLocaleString("en-GB")}
                    </strong>
                  </p>
                </div>
              );
            })}
          </div>
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
                <span>
                  Target: <strong>{fmtC(line.recovery_amount)}</strong>
                </span>
              )}
              {line.recovery_target_date && (
                <span>
                  By: <strong>{fmtDate(line.recovery_target_date)}</strong>
                </span>
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
          <p
            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2"
            title="Expected matches the Budgeting page's exact-day prorata; Actual is summed from monthly entries."
          >
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
            {["Sourcing", "Technical Productivity"].includes(
              opp.opportunity_type ?? "",
            )
              ? "Expected (period total)"
              : "Expected Annual"}
          </span>
          <p className="font-bold text-slate-800">
            {fmtC(line.expected_annual_saving)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">
            Actual (cumulative, all-time)
          </span>
          <p
            className={`font-bold ${(line.cumulated_real_saving ?? 0) >= (line.expected_annual_saving ?? Infinity) ? "text-emerald-700" : "text-slate-800"}`}
          >
            {fmtC(line.cumulated_real_saving)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">
            EOY Forecast
          </span>
          <p className="font-bold text-blue-700">
            {fmtC(line.forecast_eoy_current)}
          </p>
        </div>
        <div>
          <span className="block font-semibold text-slate-400">Delta YTD</span>
          <p
            className={`font-bold ${(line.delta_vs_expected_ytd ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {fmtC(line.delta_vs_expected_ytd)}
          </p>
        </div>
        {line.pacing_status && (
          <div>
            <span className="block font-semibold text-slate-400">Pacing</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                line.pacing_status === "Late"
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {line.pacing_status}
            </span>
          </div>
        )}
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
          {["Phase 3", "Phase 4"].includes(opp.phase_status ?? "") && (
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
                <span
                  className={`font-bold ${(line.delta_vs_expected_ytd ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}
                >
                  {fmtC(line.delta_vs_expected_ytd)}
                </span>
              </div>
              {(line.delta_vs_expected_ytd ?? 0) < 0 && (
                <button
                  type="button"
                  className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
                  onClick={() =>
                    setRecoveryForm((f) => ({
                      ...f,
                      recovery_amount: Math.abs(
                        line.delta_vs_expected_ytd ?? 0,
                      ).toString(),
                    }))
                  }
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
                  setRecoveryForm((f) => ({
                    ...f,
                    recovery_status: e.target.value,
                  }))
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
                  setRecoveryForm((f) => ({
                    ...f,
                    recovery_target_date: e.target.value,
                  }))
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
                setRecoveryForm((f) => ({
                  ...f,
                  recovery_amount: e.target.value,
                }))
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
                setRecoveryForm((f) => ({
                  ...f,
                  recovery_note: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {loading && <RefreshCw size={11} className="animate-spin" />} Save
              Recovery Plan
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRecovery(false);
                setPendingRecoveryPrompt(false);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            >
              {pendingRecoveryPrompt ? "Skip for now" : "Cancel"}
            </button>
          </div>

          {/* History timeline */}
          {line.recovery_history && (
            <div className="border-t border-amber-100 pt-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                History
              </p>
              {line.recovery_history
                .split("\n")
                .filter(Boolean)
                .reverse()
                .map((entry, i) => (
                  <p
                    key={i}
                    className="text-[10.5px] text-slate-500 font-mono leading-relaxed"
                  >
                    {entry}
                  </p>
                ))}
            </div>
          )}
        </form>
      )}

      {/* Line exists but no tracking grid yet — rows are built from the real start. */}
      {rows.length === 0 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-center">
          <p className="text-xs font-semibold text-blue-700">
            No monthly tracking rows yet
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Enter the <strong>Real Start Date</strong> in deployment (Phase 3)
            to generate the monthly grid. Rows are built once, from the date
            savings actually start flowing — there is no rebuild.
          </p>
        </div>
      )}

      {/* Phase 0/1: show expected profile as read-only preview, no actuals entry */}
      {rows.length > 0 && !phaseCtx.showActuals && (
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
                    {fmtC(row.expected_saving)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cash Impact — one-shot record, not a monthly grid. The rare case of cash
          trickling in over several months is still handled by editing each
          month's "Cash Act." cell directly in the table below. */}
      {showCash && cashRow && phaseCtx.showActuals && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-700">
                Cash Impact — one-time
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                Target: <strong>{fmtC(cashRow.cash_expected)}</strong>
                {cashRow.cash_actual != null && (
                  <>
                    {" "}
                    · Achieved: <strong>{fmtC(cashRow.cash_actual)}</strong>
                  </>
                )}
                {cashRow.period_month && (
                  <>
                    {" "}
                    (
                    {new Date(cashRow.period_month).toLocaleDateString(
                      "en-GB",
                      { month: "short", year: "numeric" },
                    )}
                    )
                  </>
                )}
              </p>
            </div>
            {canEditFinancialRows && (
              <button
                type="button"
                onClick={() => {
                  setCashAmount(
                    cashRow.cash_actual?.toString() ??
                      cashRow.cash_expected?.toString() ??
                      "",
                  );
                  setShowCashEntry((s) => !s);
                }}
                className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
              >
                {cashRow.cash_actual != null ? "Update" : "Record"} Cash
                Received →
              </button>
            )}
          </div>
          {showCashEntry && (
            <form
              onSubmit={saveCashReceived}
              className="mt-3 flex flex-wrap items-end gap-2"
            >
              <div>
                <label className="mb-1 block text-[10.5px] font-semibold text-amber-700">
                  Amount received ({opp.currency || "EUR"})
                </label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  className="w-40 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-100"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {loading && (
                  <RefreshCw size={11} className="mr-1 inline animate-spin" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowCashEntry(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600"
              >
                Cancel
              </button>
            </form>
          )}
          <p className="mt-2 text-[10px] text-amber-500">
            Exceptional case: if this cash is actually realized gradually across
            several months instead of at once, edit the "Cash Act." cell for
            each month directly in the table below.
          </p>
        </div>
      )}

      {/* Monthly table — Phase 2+ only */}
      {phaseCtx.showActuals && (
        <div className="scroll-x-visible rounded-xl border border-slate-100">
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
                <th
                  className="px-3 py-2 font-semibold text-blue-600"
                  title="Why did the EOY forecast change?"
                >
                  Forecast note
                </th>
                <th
                  className="px-3 py-2 font-semibold"
                  title="What happened this month?"
                >
                  Monthly note
                </th>
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
                      {fmtC(row.expected_saving)}
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
                        fmtC(row.actual_saving)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold ${delta == null ? "text-slate-300" : delta >= 0 ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {delta == null ? "—" : fmtC(delta)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {row.cumulated_actual != null
                        ? fmtC(row.cumulated_actual)
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
                              parseFloat(rowForm.forecast_eoy_saving) <
                                row.cumulated_actual
                                ? "border-red-400 bg-red-50"
                                : "border-blue-300"
                            }`}
                            value={rowForm.forecast_eoy_saving}
                            onChange={(e) =>
                              setRowForm((f) => ({
                                ...f,
                                forecast_eoy_saving: e.target.value,
                              }))
                            }
                            placeholder="0"
                          />
                          {rowForm.forecast_eoy_saving &&
                            row.cumulated_actual != null &&
                            parseFloat(rowForm.forecast_eoy_saving) <
                              row.cumulated_actual && (
                              <p className="text-[9px] text-red-500 mt-0.5 w-24">
                                Must be ≥ {fmtC(row.cumulated_actual)}
                              </p>
                            )}
                        </div>
                      ) : row.forecast_eoy_saving != null ? (
                        fmtC(row.forecast_eoy_saving)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Gap 3 — cash columns */}
                    {showCash && (
                      <td className="px-3 py-2 text-right text-amber-600 text-[11px]">
                        {row.cash_expected != null
                          ? fmtC(row.cash_expected)
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
                          fmtC(row.cash_actual)
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
                          {row.monthly_outcome === "Recover" &&
                            line.recovery_status && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[8.5px] font-semibold ${
                                  line.recovery_status === "Done"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : line.recovery_status === "In Progress"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                Plan: {line.recovery_status}
                              </span>
                            )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Forecast note — why did EOY forecast change? */}
                    <td
                      className="max-w-[120px] truncate px-3 py-2 text-blue-500 text-[11px]"
                      title={row.forecast_comment || ""}
                    >
                      {isEdit ? (
                        <input
                          className="w-28 rounded border border-blue-300 px-1.5 py-1 text-xs"
                          value={rowForm.forecast_comment}
                          onChange={(e) =>
                            setRowForm((f) => ({
                              ...f,
                              forecast_comment: e.target.value,
                            }))
                          }
                          placeholder="Why forecast changed…"
                        />
                      ) : row.forecast_comment ? (
                        <span className="text-blue-500">
                          {row.forecast_comment}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Monthly note — what happened this month? */}
                    <td
                      className="max-w-[120px] truncate px-3 py-2 text-slate-400 text-[11px]"
                      title={row.comment || ""}
                    >
                      {isEdit ? (
                        <input
                          className="w-28 rounded border border-slate-300 px-1.5 py-1 text-xs"
                          value={rowForm.comment}
                          onChange={(e) =>
                            setRowForm((f) => ({
                              ...f,
                              comment: e.target.value,
                            }))
                          }
                          placeholder="What happened…"
                        />
                      ) : row.comment ? (
                        <div className="space-y-0.5">
                          <span>{row.comment}</span>
                          {(row.updated_by || row.updated_at) && (
                            <div className="text-[9.5px] text-slate-300">
                              Last update{" "}
                              {row.updated_by
                                ? `by ${row.updated_by}`
                                : "saved"}
                              {row.updated_at
                                ? ` | ${fmtDate(row.updated_at)}`
                                : ""}
                            </div>
                          )}
                        </div>
                      ) : row.updated_by || row.updated_at ? (
                        <span className="text-[9.5px] text-slate-300">
                          Last update{" "}
                          {row.updated_by ? `by ${row.updated_by}` : "saved"}
                          {row.updated_at
                            ? ` | ${fmtDate(row.updated_at)}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-slate-200">-</span>
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
                {(doc.uploaded_by || doc.created_at) && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    {doc.uploaded_by
                      ? `Uploaded by ${doc.uploaded_by}`
                      : "Uploaded"}
                    {doc.created_at ? ` | ${fmtDate(doc.created_at)}` : ""}
                  </p>
                )}
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
        key: "status",
        label: "Project status",
        type: "select",
        options: ["On time", "Late", "On hold"],
      },
      {
        key: "change_mode",
        label: "Change type",
        type: "select",
        options: ["Standard", "Silent"],
        hint: "Standard = formal PPAP required · Silent = no plant validation needed",
      },
      {
        key: "change_mode_comment",
        label: "Change type comment",
        type: "textarea",
        hint: "Justification or context for this change type at this phase",
      },
    ],
  },
  "Phase 2": {
    title: "Completion / Execution",
    owner: "Project Manager (Purchasing support)",
    deliverable: "Execution package + off-tool first validation",
    fields: [
      {
        key: "status",
        label: "Project status",
        type: "select",
        options: ["On time", "Late", "On hold"],
      },
      {
        key: "change_mode",
        label: "Change type",
        type: "select",
        options: ["Standard", "Silent"],
        hint: "Standard = formal PPAP required · Silent = no plant validation needed",
      },
      {
        key: "change_mode_comment",
        label: "Change type comment",
        type: "textarea",
        hint: "Justification or context for this change type at this phase",
      },
    ],
  },
  "Phase 3": {
    title: "Deployment",
    owner: "Project Manager (Purchasing support)",
    deliverable: "PPAP validated + plant start",
    fields: [
      {
        key: "change_mode",
        label: "Change type",
        type: "select",
        options: ["Standard", "Silent"],
        hint: "Standard = formal PPAP required · Silent = no plant validation needed",
      },
      {
        key: "change_mode_comment",
        label: "Change type comment",
        type: "textarea",
        hint: "Justification or context for this change type at this phase",
      },
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
        key: "change_mode",
        label: "Change type (final)",
        type: "select",
        options: ["Standard", "Silent"],
        hint: "Confirm the final change type for closure records",
      },
      {
        key: "change_mode_comment",
        label: "Change type comment",
        type: "textarea",
        hint: "Final note on change type — confirm or amend the Phase 3 assessment",
      },
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

// ---------------------------------------------------------------------------
// Action Plan Tab
// ---------------------------------------------------------------------------

interface ActionNode {
  titre: string;
  description?: string;
  responsable?: string;
  email_responsable?: string;
  status?: string;
  due_date?: string | null;
  closed_date?: string | null;
  attachments: { name: string; url: string }[];
  sous_actions: ActionNode[];
}

interface SujetNode {
  titre: string;
  code?: string;
  description?: string;
  responsable?: string;
  email_responsable?: string;
  actions: ActionNode[];
  sous_sujets: SujetNode[];
}

interface ActionPlanRecord {
  action_plan_id: number;
  opportunity_id: number;
  phase_status?: string;
  plan_title?: string;
  plan_code?: string;
  plan_data?: {
    responsable?: string;
    email_responsable?: string;
    demandeur?: string;
    email_demandeur?: string;
    sujets?: SujetNode[];
  };
  external_push_status?: string;
  external_push_error?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

const AP_PHASE_OPTIONS = [
  "Assigned",
  "Phase 0",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Phase 4",
];
const AP_ACTION_STATUSES = ["open", "closed", "blocked"];

function emptyAction(): ActionNode {
  return {
    titre: "",
    status: "open",
    due_date: null,
    closed_date: null,
    attachments: [],
    sous_actions: [],
  };
}
function emptySujet(): SujetNode {
  return { titre: "", actions: [emptyAction()], sous_sujets: [] };
}
function emptyPlanForm() {
  return {
    plan_title: "",
    phase_status: "" as string,
    actions: [emptyAction()] as ActionNode[],
  };
}
function autoTitle(oppName: string | undefined, phase: string, date: string) {
  const base = oppName ? oppName : "Action Plan";
  const p = phase ? ` — ${phase}` : "";
  return `${base}${p} — ${date}`;
}

// Company emails follow firstname.lastname@company.com — derive a display name from it.
function fullNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function ActionPlanTab({
  opp,
  userEmail,
  onRefresh,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
}) {
  const [plans, setPlans] = useState<ActionPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyPlanForm());

  async function loadPlans() {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listActionPlans(opp.opportunity_id);
      setPlans(res?.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load action plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, [opp.opportunity_id]);

  function openCreate() {
    setEditingId(null);
    const phase = opp.phase_status ?? "";
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      ...emptyPlanForm(),
      phase_status: phase,
      plan_title: autoTitle(opp.opportunity_name, phase, today),
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(plan: ActionPlanRecord) {
    setEditingId(plan.action_plan_id);
    const firstSujet = plan.plan_data?.sujets?.[0];
    const savedActions = (firstSujet?.actions ?? [
      emptyAction(),
    ]) as ActionNode[];
    setForm({
      plan_title: plan.plan_title ?? "",
      phase_status: plan.phase_status ?? "",
      actions: savedActions.map((a) => ({ ...emptyAction(), ...a })),
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave() {
    if (!form.plan_title.trim()) {
      setError("Plan title is required.");
      return;
    }
    if (form.actions.some((a) => !a.titre.trim())) {
      setError("All action titles are required.");
      return;
    }
    if (form.actions.some((a) => !a.due_date)) {
      setError("Due date is required for all actions.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        plan_title: form.plan_title,
        phase_status: form.phase_status || null,
        // Wrap actions in a single sujet — the subject layer is hidden from the user
        sujets: [
          {
            titre: form.plan_title,
            actions: form.actions,
          },
        ],
      };
      if (editingId !== null) {
        await supplierAPI.updateActionPlan(
          opp.opportunity_id,
          editingId,
          payload,
        );
        // The enterprise-system push is currently disabled server-side
        // (external_push_status is always "pending" — see
        // purchasing_value/service.py create/update_action_plan), so don't
        // claim a sync happened that didn't.
        setSuccess("Action plan updated.");
      } else {
        await supplierAPI.createActionPlan(opp.opportunity_id, payload);
        setSuccess("Action plan created.");
      }
      await loadPlans();
      setShowForm(false);
      setEditingId(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save action plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(planId: number) {
    if (!confirm("Delete this action plan?")) return;
    setDeleting(planId);
    try {
      await supplierAPI.deleteActionPlan(opp.opportunity_id, planId);
      setPlans((prev) => prev.filter((p) => p.action_plan_id !== planId));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete action plan.");
    } finally {
      setDeleting(null);
    }
  }

  // ── action helpers ─────────────────────────────────────────────────────
  function setAction(ai: number, patch: Partial<ActionNode>) {
    setForm((f) => ({
      ...f,
      actions: f.actions.map((a, j) => (j === ai ? { ...a, ...patch } : a)),
    }));
  }
  function addAction() {
    setForm((f) => ({ ...f, actions: [...f.actions, emptyAction()] }));
  }
  function removeAction(ai: number) {
    setForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== ai) }));
  }

  const inp =
    "w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-[#1a2d42] dark:text-slate-100";
  const lbl =
    "block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5";
  const pushColor = (s?: string) =>
    s === "ok"
      ? "text-emerald-600"
      : s === "failed"
        ? "text-red-500"
        : "text-amber-500";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Action Plans
          </h3>
          <p className="text-[11px] text-slate-400">
            Phase-level actions pushed to the enterprise action plan system.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
          >
            <PlusCircle size={12} /> New Action Plan
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {success && !showForm && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-white/10 dark:bg-[#0d1c2e] space-y-4">
          {/* Context banner */}
          <div className="rounded-lg bg-slate-100 dark:bg-white/5 px-3 py-2 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Opportunity
            </span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
              {opp.opportunity_name ?? `#${opp.opportunity_id}`}
            </span>
            {opp.phase_status && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Phase
                </span>
                <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold">
                  {opp.phase_status}
                </span>
              </>
            )}
          </div>

          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {editingId ? "Edit Action Plan" : "New Action Plan"}
          </h4>

          {/* Plan-level fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Plan Title</label>
              <input
                className={inp}
                value={form.plan_title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, plan_title: e.target.value }))
                }
                placeholder="Auto-generated from opportunity and phase"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">
                Auto-filled — edit if needed.
              </p>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Project Phase</label>
              <select
                className={inp}
                value={form.phase_status}
                onChange={(e) => {
                  const phase = e.target.value;
                  const today = new Date().toISOString().slice(0, 10);
                  setForm((f) => ({
                    ...f,
                    phase_status: phase,
                    plan_title: autoTitle(opp.opportunity_name, phase, today),
                  }));
                }}
              >
                <option value="">— Select phase —</option>
                {AP_PHASE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Actions
              </span>
              <button
                onClick={addAction}
                className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
              >
                <PlusCircle size={10} /> Add Action
              </button>
            </div>

            {form.actions.map((action, ai) => (
              <div
                key={ai}
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#1a2d42] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-600">
                    Action {ai + 1}
                  </span>
                  {form.actions.length > 1 && (
                    <button
                      onClick={() => removeAction(ai)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className={lbl}>Title *</label>
                    <input
                      className={inp}
                      value={action.titre}
                      onChange={(e) => setAction(ai, { titre: e.target.value })}
                      placeholder="e.g. Conduct first article inspection"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={lbl}>Description</label>
                    <textarea
                      className={inp + " resize-none"}
                      rows={2}
                      value={action.description ?? ""}
                      onChange={(e) =>
                        setAction(ai, { description: e.target.value })
                      }
                      placeholder="What needs to be done…"
                    />
                  </div>
                  <div>
                    <label className={lbl}>Responsible Email</label>
                    <input
                      className={inp}
                      type="email"
                      value={action.email_responsable ?? ""}
                      onChange={(e) => {
                        const email = e.target.value;
                        setAction(ai, {
                          email_responsable: email || undefined,
                          responsable: email
                            ? fullNameFromEmail(email)
                            : undefined,
                        });
                      }}
                      placeholder="firstname.lastname@company.com"
                    />
                  </div>
                  <div>
                    <label className={lbl}>Responsible</label>
                    <input
                      className={inp + " bg-slate-50"}
                      value={action.responsable ?? ""}
                      readOnly
                      placeholder="Derived from email"
                    />
                  </div>
                  <div>
                    <label className={lbl}>
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={inp}
                      type="date"
                      required
                      value={action.due_date ?? ""}
                      onChange={(e) =>
                        setAction(ai, { due_date: e.target.value || null })
                      }
                    />
                  </div>
                  <div>
                    <label className={lbl}>Status</label>
                    <select
                      className={inp}
                      value={action.status ?? "open"}
                      onChange={(e) => {
                        const s = e.target.value;
                        setAction(ai, {
                          status: s,
                          closed_date:
                            s === "closed"
                              ? action.closed_date ||
                                new Date().toISOString().slice(0, 10)
                              : null,
                        });
                      }}
                    >
                      {AP_ACTION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  {action.status === "closed" && (
                    <>
                      <div>
                        <label className={lbl}>Closed Date</label>
                        <input
                          className={inp}
                          type="date"
                          value={action.closed_date ?? ""}
                          onChange={(e) =>
                            setAction(ai, {
                              closed_date: e.target.value || null,
                            })
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={lbl}>
                          Evidence (URL or reference)
                        </label>
                        <div className="space-y-1">
                          {action.attachments.map((att, ei) => (
                            <div key={ei} className="flex gap-1.5 items-center">
                              <input
                                className={inp + " flex-1"}
                                value={att.name}
                                onChange={(e) => {
                                  const next = action.attachments.map((a, i) =>
                                    i === ei
                                      ? { ...a, name: e.target.value }
                                      : a,
                                  );
                                  setAction(ai, { attachments: next });
                                }}
                                placeholder="Document name"
                              />
                              <input
                                className={inp + " flex-1"}
                                value={att.url}
                                onChange={(e) => {
                                  const next = action.attachments.map((a, i) =>
                                    i === ei
                                      ? { ...a, url: e.target.value }
                                      : a,
                                  );
                                  setAction(ai, { attachments: next });
                                }}
                                placeholder="URL or file path"
                              />
                              <button
                                onClick={() =>
                                  setAction(ai, {
                                    attachments: action.attachments.filter(
                                      (_, i) => i !== ei,
                                    ),
                                  })
                                }
                                className="text-red-400 hover:text-red-600 shrink-0"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() =>
                              setAction(ai, {
                                attachments: [
                                  ...action.attachments,
                                  { name: "", url: "" },
                                ],
                              })
                            }
                            className="text-[10px] text-blue-600 hover:underline"
                          >
                            + Add evidence
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw size={11} className="animate-spin" /> : null}
              {saving ? "Saving…" : editingId ? "Update Plan" : "Create Plan"}
            </button>
            <button
              onClick={cancelForm}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plan list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw size={18} className="animate-spin text-slate-300" />
        </div>
      ) : plans.length === 0 && !showForm ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No action plans yet. Click <strong>New Action Plan</strong> to get
          started.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const sujets = plan.plan_data?.sujets ?? [];
            const actions = sujets.flatMap((s) => s.actions ?? []);
            const actionCount = actions.length;
            return (
              <div
                key={plan.action_plan_id}
                className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0d1c2e]"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {plan.plan_title}
                      </span>
                      {plan.phase_status && (
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                          {plan.phase_status}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold ${pushColor(plan.external_push_status)}`}
                      >
                        ●{" "}
                        {plan.external_push_status === "ok"
                          ? "Synced"
                          : plan.external_push_status === "failed"
                            ? "Sync failed"
                            : "Pending sync"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {plan.plan_code && (
                        <span className="font-mono mr-2 text-slate-300">
                          {plan.plan_code}
                        </span>
                      )}
                      {actionCount} action{actionCount !== 1 ? "s" : ""}
                    </p>
                    {plan.plan_data?.responsable && (
                      <p className="text-[11px] text-slate-500">
                        <span className="font-semibold">Responsible:</span>{" "}
                        {plan.plan_data.responsable}
                        {plan.plan_data.email_responsable && (
                          <span className="text-slate-400">
                            {" "}
                            · {plan.plan_data.email_responsable}
                          </span>
                        )}
                      </p>
                    )}
                    {plan.external_push_error &&
                      plan.external_push_status === "failed" && (
                        <p className="text-[10px] text-red-500 truncate max-w-sm">
                          {plan.external_push_error}
                        </p>
                      )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(plan)}
                      className="rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(plan.action_plan_id)}
                      disabled={deleting === plan.action_plan_id}
                      className="rounded border border-red-100 px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40"
                    >
                      {deleting === plan.action_plan_id ? (
                        <RefreshCw size={10} className="animate-spin" />
                      ) : (
                        <Trash2 size={10} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions preview */}
                {actions.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-white/[0.06] px-4 py-2.5 space-y-1.5">
                    {actions.map((a, j) => {
                      const statusColor: Record<string, string> = {
                        open: "bg-slate-100 text-slate-500",
                        closed: "bg-emerald-100 text-emerald-700",
                        blocked: "bg-red-100 text-red-500",
                      };
                      return (
                        <div
                          key={j}
                          className="flex items-start gap-2 flex-wrap"
                        >
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${statusColor[a.status ?? "open"] ?? statusColor.open}`}
                          >
                            {a.status ?? "open"}
                          </span>
                          <span className="text-[11px] text-slate-700 dark:text-slate-300 flex-1">
                            {a.titre}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                            {a.responsable && (
                              <span>
                                {a.responsable}
                                {a.email_responsable
                                  ? ` · ${a.email_responsable}`
                                  : ""}
                              </span>
                            )}
                            {a.due_date && <span>Due {a.due_date}</span>}
                            {a.closed_date && (
                              <span className="text-emerald-600">
                                Closed {a.closed_date}
                              </span>
                            )}
                            {(a.attachments?.length ?? 0) > 0 && (
                              <span className="text-blue-500">
                                {a.attachments.length} evidence
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
      await supplierAPI.downloadStpPdf(
        opportunityId,
        phase,
        oppName ?? undefined,
      );
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

function FullReportDownloadButton({
  opportunityId,
  oppName,
}: {
  opportunityId: number;
  oppName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(false);
    try {
      await supplierAPI.downloadFullReportPdf(
        opportunityId,
        oppName ?? undefined,
      );
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
      title="Download Full Opportunity Report PDF"
      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-semibold transition-colors disabled:opacity-60 ${
        error
          ? "border-red-300 bg-red-50 text-red-600"
          : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
      }`}
    >
      {loading ? (
        <RefreshCw size={11} className="animate-spin" />
      ) : (
        <Download size={11} />
      )}
      Full Report
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
  onDeleted,
  userEmail,
}: {
  opp: Opp;
  onClose: () => void;
  onRefresh: (o: Opp) => void;
  onDeleted: (opportunityId: number) => void;
  userEmail: string;
}) {
  const { user } = useAuth();
  const canDelete = OPPORTUNITY_DELETE_PROFILES.includes(
    user?.access_profile ?? "",
  );
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await supplierAPI.deleteOpportunity(opp.opportunity_id);
      setConfirmOpen(false);
      onDeleted(opp.opportunity_id);
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Failed to delete opportunity.",
      );
    } finally {
      setDeleting(false);
    }
  }
  const defaultTab = (o: Opp): Tab => {
    const ps = o.phase_status ?? "";
    const st = o.status ?? "";
    if (st === "Assigned") return "edit";
    if (ps === "Phase 0" && ["Working on it", "Needs Rework"].includes(st))
      return "edit";
    if (st === "Awaiting Validation" || st === "Under Committee Review")
      return "gate";
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
  const missingFinancialMonths = (() => {
    const line = opp.financial_lines?.[0];
    if (!line?.monthly_financials?.length) return 0;
    const todayFirst = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    return line.monthly_financials.filter((r) => {
      if (!r.period_month) return false;
      return new Date(r.period_month) < todayFirst && r.actual_saving == null;
    }).length;
  })();
  const TABS: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { id: "overview", label: "Overview", icon: <Layers size={11} /> },
    // One editing tab — labelled "STP Study" for Sourcing/Tech-Productivity
    // (general + STP in one form), "Edit" for Negotiation/Cash (general only).
    {
      id: "edit",
      label: showStpTab ? "STP Study" : "Edit",
      icon: <FileText size={11} />,
    },
    { id: "gate", label: "Gate", icon: <CheckCircle2 size={11} /> },
    { id: "project", label: "Project", icon: <FolderOpen size={11} /> },
    {
      id: "financial",
      label: "Financial",
      icon: <BarChart2 size={11} />,
      badge: missingFinancialMonths || undefined,
    },
    {
      id: "files",
      label: `Files${docCount ? ` (${docCount})` : ""}`,
      icon: <Paperclip size={11} />,
    },
    { id: "action-plan", label: "Action Plan", icon: <CircleDot size={11} /> },
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
              {opp.validation_status === "Budgeted" && (
                <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold text-violet-600">
                  Validated
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
            {["Sourcing", "Technical Productivity"].includes(
              opp.opportunity_type ?? "",
            ) && (
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
            {/* Full Opportunity Report — any type, any phase */}
            <div className="mr-2">
              <FullReportDownloadButton
                opportunityId={opp.opportunity_id}
                oppName={opp.opportunity_name}
              />
            </div>
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
            {canDelete && (
              <button
                onClick={() => {
                  setDeleteError(null);
                  setConfirmOpen(true);
                }}
                disabled={deleting}
                title="Delete opportunity"
                className="mr-1 rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 size={16} />
              </button>
            )}
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
                {t.badge ? (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                    {t.badge}
                  </span>
                ) : null}
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
          {tab === "gate" && (
            <GateTab
              opp={opp}
              userEmail={userEmail}
              onRefresh={onRefresh}
              onNavigate={setTab}
            />
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
          {tab === "action-plan" && (
            <ActionPlanTab
              opp={opp}
              userEmail={userEmail}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </div>
      {confirmOpen && (
        <DeleteOpportunityModal
          oppName={opp.opportunity_name ?? `#${opp.opportunity_id}`}
          loading={deleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------
function DeleteOpportunityModal({
  oppName,
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  oppName: string;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-white/[0.08] dark:bg-[#0f1e30]"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Delete opportunity?
            </h3>
            <p className="mt-1 text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {oppName}
              </span>{" "}
              will be permanently removed from all views. This cannot be undone.
            </p>
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading && <RefreshCw size={12} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Reminder confirmation modal — confirm → send → clear result, no double-send
// ---------------------------------------------------------------------------
function RemindModal({
  oppName,
  opportunityId,
  onClose,
  onSent,
}: {
  oppName: string;
  opportunityId: number;
  onClose: () => void;
  onSent?: (count: number) => void;
}) {
  const [phase, setPhase] = useState<"confirm" | "sending" | "sent" | "error">(
    "confirm",
  );
  const [count, setCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sending = phase === "sending";

  async function send() {
    setPhase("sending");
    setErrorMsg(null);
    try {
      const res = await supplierAPI.remindGateApproval(opportunityId);
      const n = (res?.count as number) ?? 0;
      setCount(n);
      setPhase("sent");
      onSent?.(n);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to send reminder.",
      );
      setPhase("error");
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={sending ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-white/[0.08] dark:bg-[#0f1e30]"
      >
        {phase === "sent" ? (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Reminder sent
                </h3>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">
                  {count > 0
                    ? `A reminder email was sent to ${count} pending approver${
                        count === 1 ? "" : "s"
                      }.`
                    : "Everyone has already recorded their decision — no reminders were sent."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <Bell size={18} />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Send reminder?
                </h3>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">
                  Re-send the approval link to approvers on{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {oppName}
                  </span>{" "}
                  who haven't voted yet. Anyone who already decided is skipped.
                </p>
              </div>
            </div>
            {phase === "error" && errorMsg && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
                {errorMsg}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={sending}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {sending && <RefreshCw size={12} className="animate-spin" />}
                {phase === "error"
                  ? "Retry"
                  : sending
                    ? "Sending…"
                    : "Send reminder"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Opportunity Card
// ---------------------------------------------------------------------------
function OppCard({
  opp,
  onClick,
  onRefresh,
  onDeleted,
  onDuplicated,
  userEmail,
  compact = false,
}: {
  opp: Opp;
  onClick: () => void;
  onRefresh?: (o: Opp) => void;
  onDeleted?: (opportunityId: number) => void;
  onDuplicated?: (o: Opp) => void;
  userEmail?: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const canDelete = OPPORTUNITY_DELETE_PROFILES.includes(
    user?.access_profile ?? "",
  );
  const canDuplicate = EDITOR_PROFILES.includes(user?.access_profile ?? "");
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  function openConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteError(null);
    setConfirmOpen(true);
  }

  async function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    if (duplicating) return;
    setDuplicating(true);
    try {
      const res = await supplierAPI.duplicateOpportunity(opp.opportunity_id);
      onDuplicated?.(res.data as Opp);
    } catch {
      // Non-blocking: a failed duplicate leaves the board unchanged.
    } finally {
      setDuplicating(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await supplierAPI.deleteOpportunity(opp.opportunity_id);
      setConfirmOpen(false);
      onDeleted?.(opp.opportunity_id);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete opportunity.",
      );
    } finally {
      setDeleting(false);
    }
  }

  // Remind pending approvers straight from the card. Only meaningful while the
  // opportunity is awaiting a gate decision — the backend re-sends each pending
  // approver their existing link and skips anyone who already voted.
  const canRemind =
    (opp.status === "Awaiting Validation" ||
      opp.status === "Under Committee Review") &&
    EDITOR_PROFILES.includes(user?.access_profile ?? "");
  const [remindOpen, setRemindOpen] = useState(false);
  // Locally bump the sent count so the badge updates instantly after sending,
  // without waiting for the next board reload. send_reminders returns exactly
  // how many approvers were reminded this action.
  const [reminderBump, setReminderBump] = useState(0);
  const remindersSent = (opp.reminders_sent ?? 0) + reminderBump;
  const pendingApprovers = opp.pending_approvers ?? 0;
  function openRemind(e: React.MouseEvent) {
    e.stopPropagation();
    setRemindOpen(true);
  }
  const remindModal = remindOpen && canRemind && (
    <RemindModal
      oppName={opp.opportunity_name ?? `#${opp.opportunity_id}`}
      opportunityId={opp.opportunity_id}
      onClose={() => setRemindOpen(false)}
      onSent={(n) => setReminderBump((b) => b + n)}
    />
  );

  const deleteModal = confirmOpen && (
    <DeleteOpportunityModal
      oppName={opp.opportunity_name ?? `#${opp.opportunity_id}`}
      loading={deleting}
      error={deleteError}
      onConfirm={handleConfirmDelete}
      onCancel={() => setConfirmOpen(false)}
    />
  );

  const typeClass =
    TYPE_COLORS[opp.opportunity_type ?? ""] ??
    "bg-slate-100 text-slate-600 border-slate-200";
  const hasFinancial = opp.financial_lines.length > 0;
  const line = opp.financial_lines[0];

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="group flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 transition-all hover:border-blue-200 hover:bg-blue-50/40 dark:border-white/[0.08] dark:bg-[#111e30] dark:hover:border-blue-500/30 dark:hover:bg-[#152035]"
      >
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${typeClass}`}
        >
          {opp.opportunity_type?.slice(0, 3)}
        </span>
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-800 dark:text-slate-100">
          {opp.opportunity_name}
        </p>
        {opp.expected_annual_saving && (
          <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            {fmt(opp.expected_annual_saving, opp.currency || "EUR")}
          </span>
        )}
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${STATUS_COLORS[opp.status ?? ""] ?? "bg-slate-100 text-slate-500"}`}
        >
          {opp.status === "Awaiting Validation"
            ? "Awaiting"
            : opp.status === "Under Committee Review"
              ? "Committee"
              : opp.status === "Working on it"
                ? "Working"
                : opp.status === "Needs Rework"
                  ? "Rework"
                  : opp.status}
        </span>
        {canRemind && (
          <button
            onClick={openRemind}
            title={`${remindersSent} reminder${
              remindersSent === 1 ? "" : "s"
            } sent · ${pendingApprovers} approver${
              pendingApprovers === 1 ? "" : "s"
            } pending`}
            className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-1 text-amber-500 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-500/10"
          >
            <Bell size={12} />
            <span className="text-[9px] font-bold leading-none">
              {remindersSent}
            </span>
          </button>
        )}
        {canDuplicate && (
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            title="Duplicate opportunity"
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
          >
            <Copy size={12} />
          </button>
        )}
        {canDelete && (
          <button
            onClick={openConfirm}
            disabled={deleting}
            title="Delete opportunity"
            className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <Trash2 size={12} />
          </button>
        )}
        {deleteModal}
        {remindModal}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md dark:border-white/[0.08] dark:bg-[#111e30] dark:hover:border-blue-500/30 dark:hover:bg-[#152035]${canDelete || canDuplicate || canRemind ? " pb-9" : ""}`}
    >
      {canRemind && (
        <button
          onClick={openRemind}
          title={`${remindersSent} reminder${
            remindersSent === 1 ? "" : "s"
          } sent · ${pendingApprovers} approver${
            pendingApprovers === 1 ? "" : "s"
          } pending`}
          className={`absolute bottom-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-amber-400 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:text-amber-500 dark:hover:bg-amber-500/10 ${
            canDuplicate && canDelete
              ? "right-16"
              : canDuplicate || canDelete
                ? "right-9"
                : "right-2"
          }`}
        >
          <Bell size={12} />
          {remindersSent > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-bold leading-none text-white">
              {remindersSent}
            </span>
          )}
        </button>
      )}
      {canDuplicate && (
        <button
          onClick={handleDuplicate}
          disabled={duplicating}
          title="Duplicate opportunity"
          className={`absolute bottom-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50 dark:text-slate-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400 ${canDelete ? "right-9" : "right-2"}`}
        >
          <Copy size={12} />
        </button>
      )}
      {canDelete && (
        <button
          onClick={openConfirm}
          disabled={deleting}
          title="Delete opportunity"
          className="absolute bottom-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-slate-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      )}
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="line-clamp-2 pr-3 text-[12.5px] font-bold leading-snug text-slate-800 dark:text-slate-100">
          {opp.opportunity_name}
        </p>
        <ChevronRight
          size={13}
          className="mt-0.5 shrink-0 text-slate-300 group-hover:text-blue-400 dark:text-slate-600 dark:group-hover:text-blue-400"
        />
      </div>
      <p className="mb-2 text-[10.5px] text-slate-400 dark:text-slate-500">
        {opp.idea_owner}
      </p>
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
        {opp.validation_status === "Budgeted" && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9.5px] font-semibold text-violet-600 border border-violet-100">
            Validated
          </span>
        )}
      </div>
      {(opp.expected_annual_saving || opp.priority_category) && (
        <div className="flex items-center gap-3 border-t border-slate-50 pt-2 dark:border-white/[0.06]">
          {opp.expected_annual_saving && (
            <div className="flex items-center gap-1">
              <TrendingUp size={10} className="text-emerald-500" />
              <span className="text-[10.5px] font-semibold text-emerald-700">
                {fmt(opp.expected_annual_saving, opp.currency || "EUR")}
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
                {fmt(line.cumulated_real_saving, opp.currency || "EUR")}
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
      {deleteModal}
      {remindModal}
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
  onDeleted,
  onDuplicated,
  userEmail,
  compact = false,
}: {
  phase: string;
  opps: Opp[];
  onSelect: (o: Opp) => void;
  onRefresh?: (o: Opp) => void;
  onDeleted?: (opportunityId: number) => void;
  onDuplicated?: (o: Opp) => void;
  userEmail?: string;
  compact?: boolean;
}) {
  const cfg = PHASE_CONFIG[phase] ?? { color: "text-slate-500", desc: "" };
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <CircleDot size={13} className={cfg.color} />
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">
            {phase}
          </p>
          <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">
            {cfg.desc}
          </p>
        </div>
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
          {opps.length}
        </span>
      </div>
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto space-y-1.5 pr-0.5 [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.200)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.1)_transparent]">
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
              onDeleted={onDeleted}
              onDuplicated={onDuplicated}
              userEmail={userEmail}
              compact={compact}
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




