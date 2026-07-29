import * as XLSX from "xlsx";
import type { Opp, FinLine, MonthlyRow, ActionNode, SujetNode, ActionPlanRecord } from "./types";
import { CUR_SYMBOL } from "./constants";

export const CANONICAL_TYPES: Record<string, string> = {
  negotiation: "Negotiation",
  sourcing: "Sourcing",
  "technical productivity": "Technical Productivity",
};
export function isPriceIncrease(o: Opp): boolean {
  return (o.opportunity_type ?? "").trim().toLowerCase() === "price increase";
}
export function canonicalType(o: Opp): string {
  const raw = (o.opportunity_type ?? "").trim();
  if (!raw || isPriceIncrease(o)) return "";
  return CANONICAL_TYPES[raw.toLowerCase()] ?? raw;
}

// Budget commitment lives per fiscal-year in opp.budget_years (not the single
// opp.budget_year planning field). Summarize it: is it budgeted, in which FY(s),
// and is any of it an "Additional" (post-closure) commitment.
export function budgetedFiscalYears(o: Opp): number[] {
  return (o.budget_years ?? [])
    .filter((by) => by.budget_status === "Budgeted")
    .map((by) => by.fiscal_year)
    .sort((a, b) => a - b);
}
export function isAdditional(o: Opp): boolean {
  return (o.budget_years ?? []).some(
    (by) => by.is_additional && by.budget_status === "Budgeted",
  );
}

// Ordered [header, accessor] pairs. Keeping this explicit (rather than dumping
// every Opp key) gives readable headers, a sensible column order, and lets us
// derive/format values (dates, "Validated" flag, joined year maps, etc.).
export const EXPORT_COLUMNS: [string, (o: Opp) => unknown][] = [
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
export const FIN_LINE_COLUMNS: [string, (o: Opp, l: FinLine) => unknown][] = [
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
export const MONTHLY_COLUMNS: [string, (o: Opp, l: FinLine, m: MonthlyRow) => unknown][] =
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
export const ACTION_COLUMNS = [
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
export function actionTimeliness(a: ActionNode, todayIso: string): string {
  const closed = (a.status ?? "").toLowerCase() === "closed" || !!a.closed_date;
  if (!a.due_date) return closed ? "Closed" : "No due date";
  if (closed) {
    const c = a.closed_date ?? "";
    return c && c > a.due_date ? "Closed late" : "Closed on time";
  }
  return todayIso > a.due_date ? "Late" : "On time";
}

// Walk a sujet tree, emitting one flat row per action (and nested sous_actions).
export function flattenActions(
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

export function exportOpportunitiesToExcel(
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
export const curSym = (currency?: string | null) =>
  CUR_SYMBOL[currency ?? "EUR"] ?? `${currency} `;

export const fmt = (n?: number | null, currency = "EUR") => {
  if (n == null || (typeof n === "number" && isNaN(n))) return "—";
  const body = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  return `${n < 0 ? "-" : ""}${curSym(currency)}${body}`;
};

// Thousands separators for number INPUTS (display formatted, store raw digits).
export const groupDigits = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// Integer field (e.g. annual quantities): "1000000" → "1,000,000"
export const fmtIntInput = (s: string) =>
  s ? groupDigits(s.replace(/[^\d]/g, "")) : "";
export const stripInt = (s: string) => s.replace(/[^\d]/g, "");
// Decimal field (e.g. costs): group the integer part, keep the decimal portion
export const fmtDecInput = (s: string) => {
  if (!s) return "";
  const cleaned = s.replace(/[^\d.]/g, "");
  const [intPart, ...rest] = cleaned.split(".");
  const gi = groupDigits(intPart);
  return rest.length ? `${gi}.${rest.join("")}` : gi;
};
export const stripDec = (s: string) => {
  const c = s.replace(/[^\d.]/g, "");
  const p = c.split(".");
  return p.length > 1 ? `${p[0]}.${p.slice(1).join("")}` : c;
};
// Space-grouped variant (e.g. Est. Annual Saving): "1000000" → "1 000 000"
export const groupDigitsSpace = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
export const fmtDecInputSpace = (s: string) => {
  if (!s) return "";
  const cleaned = s.replace(/[^\d.]/g, "");
  const [intPart, ...rest] = cleaned.split(".");
  const gi = groupDigitsSpace(intPart);
  return rest.length ? `${gi}.${rest.join("")}` : gi;
};

// Per-unit prices need decimals (e.g. €0.20), unlike whole-euro totals.
export const fmtPrice = (n?: number | string | null, currency = "EUR") => {
  if (n == null || n === "") return "—";
  const v = Number(n);
  const body = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Math.abs(v));
  return `${v < 0 ? "-" : ""}${curSym(currency)}${body}`;
};

export const fmtDate = (s?: string | null) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
        day: "numeric",
      })
    : "-";

// Date + time, e.g. "12 Jul, 14:30" — used for reminder timestamps.
export const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

export const fmtMonths = (months?: number | null) => {
  if (months == null || Number.isNaN(Number(months))) return "-";
  const value = Number(months);
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.00$/, "");
};

export const pldColor = (cat?: string | null) =>
  cat === "High"
    ? "text-emerald-600 bg-emerald-50"
    : cat === "Medium"
      ? "text-amber-600 bg-amber-50"
      : "text-red-500 bg-red-50";

// Module-level helper — used in both FinancialTab and PurchasingValuePage KPI strip
export const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
export const normalizeChangeMode = (value?: string | null) => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "standard") return "Standard";
  if (normalized === "silent") return "Silent";
  return value ?? "";
};

// ---------------------------------------------------------------------------
// Small shared components
// ---------------------------------------------------------------------------
export function emptyAction(): ActionNode {
  return {
    titre: "",
    status: "open",
    due_date: null,
    closed_date: null,
    attachments: [],
    sous_actions: [],
  };
}
export function emptySujet(): SujetNode {
  return { titre: "", actions: [emptyAction()], sous_sujets: [] };
}
export function emptyPlanForm() {
  return {
    plan_title: "",
    phase_status: "" as string,
    actions: [emptyAction()] as ActionNode[],
  };
}
export function autoTitle(oppName: string | undefined, phase: string, date: string) {
  const base = oppName ? oppName : "Action Plan";
  const p = phase ? ` — ${phase}` : "";
  return `${base}${p} — ${date}`;
}

// Company emails follow firstname.lastname@company.com — derive a display name from it.
export function fullNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

