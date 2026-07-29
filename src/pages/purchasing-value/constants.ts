import type { PvFilters } from "./types";

export const INCOTERMS_OPTIONS: { value: string; label: string }[] = [
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

export const TYPES = ["Negotiation", "Sourcing", "Technical Productivity"];
export const FILTER_TYPES = [...TYPES, "Cash"];
// Profiles allowed to create/duplicate opportunities (mirrors backend _NON_VIEWER).
export const EDITOR_PROFILES = [
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
export const OPPORTUNITY_DELETE_PROFILES = ["vp_conversion", "purchasing_director"];
export const PV_FILTERS_PAGE_KEY = "purchasing-value";

export const PV_FILTERS_DEFAULT: PvFilters = {
  filterType: "All",
  filterStatus: "All",
  filterBudget: "All",
  filterPriority: "All",
  filterPlant: "All",
  filterPM: "All",
  filterPurchasingOwner: "All",
  filterConversionOwner: "All",
  filterPilot: "All",
  filterPlantManager: "All",
  filterBudgetYear: "All",
  filterEscalated: false,
  filterValidation: "All",
  showClosed: false,
};
// "Assigned" is a STATUS on a Phase 0 card — not a separate phase column
export const PHASES = [
  "Phase 0",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Phase 4",
  "Closed",
];
export const TYPE_COLORS: Record<string, string> = {
  Negotiation:
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
  Sourcing:
    "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25",
  "Technical Productivity":
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
  Cash: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
};
export const STATUS_COLORS: Record<string, string> = {
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
export const PHASE_CONFIG: Record<string, { color: string; desc: string }> = {
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
export const CUR_SYMBOL: Record<string, string> = {
  EUR: "€",
  USD: "$",
  RMB: "¥",
  INR: "₹",
};
export const OUTCOME_CONFIG: Record<string, { label: string; color: string }> = {
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
export const REVISE_BASELINE_ENABLED = true;

// Phase-aware context for the financial tab
export const FINANCIAL_PHASE_CONTEXT: Record<
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

export const PHASE_OPTIONS = [
  "General",
  "Phase 0",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Phase 4",
  "STP Document",
  "Other",
];

export const PHASE_OUTPUT_DEF: Record<
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

export const PHASE_GUIDE: Record<
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

export const AP_PHASE_OPTIONS = [
  "Assigned",
  "Phase 0",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Phase 4",
];
export const AP_ACTION_STATUSES = ["open", "closed", "blocked"];

export const PRESET_WIDTHS = [520, 720, 960, 1200];
export const PRESET_LABELS = ["S", "M", "L", "XL"];

