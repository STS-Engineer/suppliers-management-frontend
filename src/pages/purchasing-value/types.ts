export interface MonthlyRow {
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
export interface FinLine {
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
export interface ProjectRec {
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
export interface OppDoc {
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

export interface PhaseHistoryEntry {
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
export interface SiteOption {
  id_site: number;
  site_name?: string;
  city?: string;
  country?: string;
}
export interface SupplierOption {
  id_supplier_unit: number;
  supplier_name?: string;
  group_name?: string;
  city?: string;
  country?: string;
}

export interface Opp {
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
export interface PvFilters {
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

export type Tab =
  | "overview"
  | "edit"
  | "gate"
  | "financial"
  | "project"
  | "files"
  | "action-plan";

export interface ActionNode {
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

export interface SujetNode {
  titre: string;
  code?: string;
  description?: string;
  responsable?: string;
  email_responsable?: string;
  actions: ActionNode[];
  sous_sujets: SujetNode[];
}

export interface ActionPlanRecord {
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

