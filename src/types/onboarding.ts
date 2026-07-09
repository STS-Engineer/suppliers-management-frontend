/**
 * Types for Supplier Onboarding Form
 */

export interface FormErrors {
  [key: string]: string;
}

export interface GroupFormData {
  nom: string;
  supplier_scope: string;
  supplier_owner: string;
  strategique: boolean;
  monopolistique: boolean;
  multi_site: boolean;
  directed: boolean;
}

export interface UnitFormData {
  supplier_name: string;
  address_line: string;
  city: string;
  country: string;
  continent: string;
  area: string;
  // Product classification
  commodity: string[];
  family: string[];
  sub_family: string[];
  product_line: string[];
  // Additional unit info
  website: string;
  carbon_footprint: string;
  green_electricity_pct: string;
  unit_contacts: ContactFormData[];
}

export interface ContactFormData {
  full_name: string;
  email: string;
  role_label: string;
  role_name: string;
  phone: string;
  is_primary_contact: boolean;
}

export interface ContactResponse {
  id_contact: number;
  id_supplier_group?: number | null;
  id_supplier_unit?: number | null;
  role_label?: string | null;
  role_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  is_primary_contact?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CertificationFormData {
  /** Standard category: quality | environmental | safety | energy | other */
  standard_type: string;
  /** Specific certification name per category: IATF 16949:2016 | ISO 9001 (cat BCD) | ISO 14001 | ... */
  certification_type: string;
  certificate_name: string;
  amount_value: string;
  amount_currency: string;
  start_date: string;
  end_date: string;
  expiry_mode: string;
  comments: string;
  /** Pending file selected by the user, not yet uploaded */
  file: File | null;
  file_name: string;
}

export interface SupplierCertificationResponse {
  id_certification: number;
  id_supplier_unit?: number | null;
  supplier_name?: string | null;
  group_nom?: string | null;
  standard_type?: string | null;
  certification_type?: string | null;
  certificate_name?: string | null;
  amount_value?: number | null;
  amount_currency?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  expiry_mode?: string | null;
  comments?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  file_size?: number | null;
}

export interface EvaluationDetailsFormData {
  evaluation_date?: string;
  cycle_type?: string;
  class_value?: number;
  class_score?: number;
  operational_grade?: string;
  operational_score?: number;
  impact_score?: number;
  strategic_mention?: string;
  panel_decision?: string;
  comments?: string;
  top?: string;
  lta?: string;
  sqma?: string;
  quality_certification?: string;
  family_coverage?: string;
  competitiveness?: string;
  geo_coverage?: string;
  cons_or_wd?: string;
  financial_health?: string;
  prod_lia_ins?: string;
  prod?: string;
  class_criteria_details?: Record<string, ClassCriterionDetailFormData>;
  management_system?: number;
  customer_communication?: number;
  development_design?: number;
  production_manufacturing?: number;
  quality_audits?: number;
  suppliers_subcontractors?: number;
  deliveries?: number;
  environment_ethic_rules?: number;
  impact_question_1?: string;
  impact_question_2?: string;
  impact_question_3?: string;
  impact_question_4?: string;
  impact_question_5?: string;
  impact_question_6?: string;
}

export interface ClassCriterionDetailFormData {
  document_id?: number;
  document_name?: string;
  document_url?: string;
  document_mime_type?: string;
  document_size?: number;
  evidence_file_name?: string;
  validity_start_date?: string;
  validity_end_date?: string;
  signature_date?: string;
  last_update_date?: string;
  amount_value?: number;
  amount_currency?: string;
  auto_validity_end_date?: boolean;
  comments?: string;
  score?: number;
}

export interface SupplierStatusHistoryEntry {
  id_history: number;
  old_status?: string | null;
  new_status?: string | null;
  old_class?: number | null;
  new_class?: number | null;
  old_grade?: string | null;
  new_grade?: string | null;
  old_final_grade?: string | null;
  new_final_grade?: string | null;
  old_strategic_mention?: string | null;
  new_strategic_mention?: string | null;
  old_panel_decision?: string | null;
  new_panel_decision?: string | null;
  change_reason?: string | null;
  changed_by?: string | null;
  changed_at?: string | null;
  created_at?: string | null;
}

export interface SupplierStatusOverride {
  active: boolean;
  status?: string | null;
  reason?: string | null;
  changed_by?: string | null;
  changed_at?: string | null;
  computed_status?: string | null;
}

export interface PlanDocument {
  id_document: number;
  file_name?: string | null;
  file_url?: string | null;
  file_notes?: string | null;
  uploaded_at?: string | null;
  comments?: string | null;
}

export interface SupplierDevelopmentPlan {
  id_development_plan: number;
  id_relation: number;
  plan_title?: string | null;
  plan_status?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  submission_date?: string | null;
  review_date?: string | null;
  decision_date?: string | null;
  reviewed_by?: string | null;
  approved_by?: string | null;
  rejected_by?: string | null;
  business_hold_active?: boolean | null;
  escalated?: boolean | null;
  escalation_date?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  file_notes?: string | null;
  supplier_comments?: string | null;
  internal_comments?: string | null;
  decision?: string | null;
  commodity?: string | null;
  plant?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_overdue?: boolean;
  days_past_due?: number | null;
}

export interface DevelopmentPlanRegisterRow {
  relation: SupplierSiteRelation;
  development_plan: SupplierDevelopmentPlan;
  documents?: PlanDocument[];
  site_name?: string | null;
  site_city?: string | null;
  site_country?: string | null;
  unit_supplier_name?: string | null;
  unit_code?: string | null;
  group_id?: number | null;
  group_name?: string | null;
  group_code?: string | null;
}

export interface RelationEvaluationWorkspace {
  relation: SupplierSiteRelation;
  evaluation_date?: string | null;
  status_history: SupplierStatusHistoryEntry[];
  development_plans?: SupplierDevelopmentPlan[];
  computed_supplier_status?: string | null;
  effective_supplier_status?: string | null;
  status_override?: SupplierStatusOverride | null;
  comments?: string | null;
  impact_score?: number | null;
  class_value?: number | null;
  class_score?: number | null;
  operational_grade?: string | null;
  operational_score?: number | null;
  strategic_mention?: string | null;
  panel_decision?: string | null;
  top?: string | null;
  lta?: string | null;
  sqma?: string | null;
  quality_certification?: string | null;
  family_coverage?: string | null;
  competitiveness?: string | null;
  geo_coverage?: string | null;
  cons_or_wd?: string | null;
  financial_health?: string | null;
  prod_lia_ins?: string | null;
  prod?: string | null;
  management_system?: number | null;
  customer_communication?: number | null;
  development_design?: number | null;
  production_manufacturing?: number | null;
  quality_audits?: number | null;
  suppliers_subcontractors?: number | null;
  deliveries?: number | null;
  environment_ethic_rules?: number | null;
  class_criteria_details?: Record<string, ClassCriterionDetailFormData>;
}

export interface OnboardingFormData {
  group: GroupFormData;
  unit: UnitFormData;
  contacts: ContactFormData[];
  certifications: CertificationFormData[];
  evaluation: EvaluationDetailsFormData;
  site_id: number | '';
  supplier_scope: string;
  supplier_owner: string;
  annual_spend_value: string;
  template_id: number | '';
}

export type OnboardingStep =
  | 'supplier'
  | 'unit'
  | 'contacts'
  | 'certifications'
  | 'evaluation'
  | 'configuration'
  | 'review';

type SubmittedUnitFormData = UnitFormData;

type SubmittedCertificationFormData = Omit<
  CertificationFormData,
  'amount_value' | 'start_date' | 'end_date' | 'file'
> & {
  amount_value: string | null;
  start_date: string | null;
  end_date: string | null;
};

// API Request/Response Types
export interface OnboardingRequest {
  group: GroupFormData;
  unit: SubmittedUnitFormData;
  contacts: ContactFormData[];
  unit_contacts?: ContactFormData[];
  certifications: SubmittedCertificationFormData[];
  evaluation: EvaluationDetailsFormData;
  site_id: number;
  supplier_scope: string;
  supplier_owner: string;
  annual_spend_value: string | null;
  template_id: number | null;
}

export interface OnboardingResponse {
  status?: 'success' | 'partial_success' | 'failed';
  message?: string;
  data?: {
    status?: string;
    supplier: {
      group_id: number;
      group_name: string;
      unit_id: number;
      unit_code: string;
    };
    relation?: {
      relation_id: number;
      site_id: number;
      supplier_scope: string;
      supplier_owner: string;
    };
    prequalification?: {
      cycle_id: number | null;
      assessment_id: number | null;
      template_id: number | null;
      score_card_id?: number | null;
      classification_id?: number | null;
    };
    emails?: {
      creation_notification: boolean;
      owner_assignment: boolean;
      assessment_template: boolean;
      prequalification_launch: boolean;
    };
  };
}

export interface SupplierMasterCreationResponse {
  status?: 'success' | 'partial_success' | 'failed';
  message?: string;
  data?: {
    group_id: number;
    group_code?: string;
    group_name: string;
    unit_id: number;
    unit_code: string;
    unit_reference_code?: string;
    contacts_count?: number;
    certifications_count?: number;
  };
  details?: {
    group?: unknown;
    unit?: unknown;
    contacts?: unknown[];
    certifications?: unknown[];
  };
}

export interface SupplierGroupSummary {
  id_group: number;
  group_code?: string;
  nom: string;
  supplier_scope?: string;
  supplier_owner?: string;
  strategique?: boolean;
  monopolistique?: boolean;
  directed?: boolean;
  multi_site?: boolean;
  validation_status?: string;
  is_active?: boolean;
  inactivated_at?: string | null;
  created_at?: string;
  updated_at?: string;
  units?: SupplierUnitResponse[];
  contacts?: ContactResponse[];
  /** Read-only, aggregated from this group's supplier units' commodity field. */
  commodities?: string[];
}

// ============================================================================
// Multi-Unit & Multi-Site Management Types
// ============================================================================

export interface SupplierUnitResponse {
  id_supplier_unit: number;
  id_group: number;
  unit_code?: string;
  supplier_name: string;
  address_line?: string;
  city?: string;
  country?: string;
  continent?: string | null;
  area?: string | null;
  commodity?: string | null;
  family?: string | null;
  sub_family?: string | null;
  product_line?: string | null;
  website?: string | null;
  carbon_footprint?: string | null;
  green_electricity_pct?: string | null;
  strategique?: boolean;
  monopolistique?: boolean;
  directed?: boolean;
  is_active?: boolean;
  inactivated_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SiteRelationData {
  supplier_scope?: string;
  supplier_owner?: string;
  annual_spend_value?: number | string;
  operational_grade?: string;
  class_value?: number;
  evaluation_frequency?: string;
  final_grade?: string;
  strategic_mention?: string;
  panel_decision?: string;
  supplier_status?: string;
  alias_1?: string;
}

/** A selectable class-criteria value with its live score, sourced from
 * pld_scoring_rules (see GET /suppliers/onboarding/options). `score` is
 * absent when using the static onboarding.ts fallback lists. */
export interface OnboardingCriteriaOption {
  value: string;
  label: string;
  score?: number | null;
}

export interface OnboardingSelectionOptions {
  top: OnboardingCriteriaOption[];
  lta: OnboardingCriteriaOption[];
  sqma: OnboardingCriteriaOption[];
  quality_certification?: OnboardingCriteriaOption[];
  family_coverage: OnboardingCriteriaOption[];
  competitiveness: OnboardingCriteriaOption[];
  geo_coverage: OnboardingCriteriaOption[];
  cons_or_wd: OnboardingCriteriaOption[];
  financial_health: OnboardingCriteriaOption[];
  certification_types: Array<{ value: string; label: string }>;
  prod_lia_ins: OnboardingCriteriaOption[];
  prod: OnboardingCriteriaOption[];
}

export interface SupplierSiteRelation {
  id_relation: number;
  id_site: number;
  id_supplier_unit: number;
  relation_code?: string;
  unit_code?: string;
  supplier_scope?: string;
  supplier_owner?: string;
  annual_spend_value?: number | null;
  operational_grade?: string;
  class_value?: number;
  evaluation_frequency?: string;
  final_grade?: string;
  strategic_mention?: string;
  panel_decision?: string;
  supplier_status?: string;
  alias_1?: string;
  global_status?: string;
  created_at?: string;
  last_evaluation_date?: string;
  next_evaluation_date?: string;
  inactivated_at?: string;
  last_status_change?: string;
  evaluation_comments?: string;
  // Supplier Panel (SB1) fields
  last_eval_score?: number | null;
  is_active?: boolean;
}

// Carbon Footprint (SB8)
export interface CarbonFootprintRecord {
  id_carbon_footprint: number;
  id_supplier_unit?: number | null;
  id_relation?: number | null;
  year?: number | null;
  carbon_fp_grade?: string | null;
  purchase_amount?: number | null;
  weighted_footprint?: number | null;
  production_fp_grade?: string | null;
  transport_impact?: number | null;
  global_fp_impact?: number | null;
  supplier_origin?: string | null;
  supplier_continent?: string | null;
  site_location?: string | null;
  site_continent?: string | null;
  supplier_unit_code?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InitialUnitEvaluationResponse {
  unit_id: number;
  relation_id: number;
  cycle_id: number;
  score_card_id?: number | null;
  classification_id?: number | null;
  status_history_id?: number | null;
  final_grade?: string | null;
  class_value?: number | null;
  operational_grade?: string | null;
  panel_decision?: string | null;
}

export interface UnitEvaluationSummary {
  unit_id: number;
  relation_id?: number | null;
  class_value?: number | null;
  class_score?: number | null;
  operational_grade?: string | null;
  operational_score?: number | null;
  final_grade?: string | null;
  strategic_mention?: string | null;
  panel_decision?: string | null;
  impact_score?: number | null;
  last_evaluation_date?: string | null;
  evaluation_comments?: string | null;
  site_relations_count: number;
}

export interface SupplierAuditEvent {
  id_audit_event: number;
  event_uuid?: string | null;
  table_name: string;
  record_pk: string;
  action: string;
  changed_by?: string | null;
  changed_at?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  reason_code?: string | null;
  reason_comment?: string | null;
  source_system?: string | null;
  source_ip?: string | null;
  correlation_id?: string | null;
  batch_id?: string | null;
  is_system_event?: boolean;
}

export interface AvocarbonSite {
  id_site: number;
  site_name: string;
  address_line: string;
  city: string;
  country: string;
  active: boolean;
}

export interface SitePanelRelation {
  relation: SupplierSiteRelation;
  unit: SupplierUnitResponse;
  group: SupplierGroupSummary;
  has_development_plan?: boolean;
  development_plan_status?: string | null;
  committee_review_status?: string | null;
}

export interface SitePanelBundle {
  site: AvocarbonSite;
  relations: SitePanelRelation[];
  relation_count: number;
  unit_count: number;
  group_count: number;
}

export interface UnitManagementState {
  units: SupplierUnitResponse[];
  selectedUnitId: number | null;
  siteRelations: SupplierSiteRelation[];
  availableSites: AvocarbonSite[];
  isLoading: boolean;
  error: string | null;
}

