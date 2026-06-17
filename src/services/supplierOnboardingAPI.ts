import {
  CarbonFootprintRecord,
  ContactResponse,
  OnboardingRequest,
  OnboardingResponse,
  OnboardingSelectionOptions,
  SitePanelBundle,
  SupplierAuditEvent,
  SupplierCertificationResponse,
  SupplierMasterCreationResponse,
  SupplierGroupSummary,
} from "../types/onboarding";

const API_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  "https://supp-back-cbc7g9avb5b7cjbd.francecentral-01.azurewebsites.net/api/v1";
  
const AUTH_TOKEN_STORAGE_KEY = "auth_token";

type ApiErrorPayload = {
  message?: string;
  detail?: string | { message?: string; error_code?: string; details?: unknown };
  error_code?: string;
  details?: unknown;
};

export class SupplierApiError extends Error {
  statusCode: number;
  errorCode?: string;
  details?: unknown;

  constructor(message: string, statusCode: number, errorCode?: string, details?: unknown) {
    super(message);
    this.name = "SupplierApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

function humanizeApiMessage(message: string, statusCode: number) {
  const trimmed = message.trim();

  const notFoundMatchers: Array<[RegExp, string]> = [
    [/^Site with ID \d+ not found$/i, "The selected site could not be found."],
    [
      /^Avocarbon site with ID \d+ not found$/i,
      "The selected Avocarbon site could not be found.",
    ],
    [
      /^Supplier relation with ID \d+ not found$/i,
      "The selected supplier relation could not be found.",
    ],
    [
      /^Supplier group with ID \d+ not found$/i,
      "The selected supplier group could not be found.",
    ],
    [
      /^Supplier unit with ID \d+ not found$/i,
      "The selected supplier unit could not be found.",
    ],
  ];

  for (const [pattern, replacement] of notFoundMatchers) {
    if (pattern.test(trimmed)) {
      return replacement;
    }
  }

  const unitAlreadyLinkedMatch = trimmed.match(
    /^Unit\s+\d+\s+is already linked to site\s+\d+$/i,
  );
  if (unitAlreadyLinkedMatch) {
    return "This supplier unit is already linked to the selected site.";
  }

  const unitNotLinkedMatch = trimmed.match(
    /^Unit\s+\d+\s+is not linked to site\s+\d+$/i,
  );
  if (unitNotLinkedMatch) {
    return "This supplier unit is not linked to the selected site.";
  }

  if (/^Supplier group with name '.+' already exists$/i.test(trimmed)) {
    return "A supplier group with this name already exists.";
  }

  if (/^Supplier unit with code '.+' already exists$/i.test(trimmed)) {
    return "A supplier unit with this supplier code already exists.";
  }

  if (
    /^An access identity already exists for this email\.$/i.test(trimmed)
  ) {
    return "An account already exists for this email address.";
  }

  if (/already exists/i.test(trimmed) && statusCode === 409) {
    return "This record already exists. Please review the existing data before creating another one.";
  }

  if (
    /^A global supplier owner email is required before creating this relation$/i.test(
      trimmed,
    )
  ) {
    return "Enter the global supplier owner email before creating this relation.";
  }

  if (
    /^Supplier owner email is required for local or regional site assignments$/i.test(
      trimmed,
    )
  ) {
    return "Enter a supplier owner email before assigning this unit to the selected site.";
  }

  if (/^No primary contact found for supplier$/i.test(trimmed)) {
    return "Add a primary contact before continuing.";
  }

  if (/^Unsupported criteria type '.+'$/i.test(trimmed)) {
    return "The selected evaluation criterion is not supported.";
  }

  if (
    /^Criteria document deletion is not available because id_document is missing from pld_class_criteria_detail\.$/i.test(
      trimmed,
    )
  ) {
    return "This document cannot be deleted yet because the evaluation document link is missing in the database.";
  }

  if (/^Uploaded file is empty\.$/i.test(trimmed)) {
    return "The selected file is empty. Please choose another file.";
  }

  if (/^File too large \(.+Max allowed: .+\.$/i.test(trimmed)) {
    return trimmed.replace(/^File too large/i, "The selected file is too large");
  }

  if (/^File type '.+' is not allowed\./i.test(trimmed)) {
    return trimmed.replace(/^File type/i, "This file type");
  }

  if (/^Invalid or expired token$/i.test(trimmed)) {
    return "Your session has expired. Please sign in again.";
  }

  if (/^Not authenticated$/i.test(trimmed)) {
    return "Please sign in to continue.";
  }

  if (/^Invalid email or password\.$/i.test(trimmed)) {
    return "The email or password you entered is incorrect.";
  }

  return trimmed;
}

export type AuthenticatedAppUser = {
  email: string;
  full_name: string;
  access_profile: string;
};

export type AccessIdentityRecord = {
  id_identity: number;
  email: string;
  full_name: string;
  access_profile: string;
  auth_source: string;
  external_subject?: string | null;
  external_directory?: string | null;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

class SupplierOnboardingAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders() {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const headers: any = {
      "Content-Type": "application/json",
    };
    
    // Only add Authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private getAuthHeadersWithoutContentType() {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const headers: any = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T = any>(
    url: string,
    init: RequestInit,
    fallbackMessage: string,
  ): Promise<T> {
    const response = await fetch(url, init);
    const payload = await this.parseJsonResponse(response);

    if (!response.ok) {
      throw this.buildApiError(response.status, payload, fallbackMessage);
    }

    return payload as T;
  }

  private async parseJsonResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  private buildApiError(
    statusCode: number,
    payload: unknown,
    fallbackMessage: string,
  ) {
    const data = (payload ?? {}) as ApiErrorPayload;
    const nestedDetail =
      data.detail && typeof data.detail === "object" ? data.detail : undefined;
    const message =
      data.message ||
      (typeof data.detail === "string" ? data.detail : undefined) ||
      nestedDetail?.message ||
      this.getFriendlyFallbackMessage(statusCode, fallbackMessage);
    const errorCode = data.error_code || nestedDetail?.error_code;
    const details = data.details ?? nestedDetail?.details;

    return new SupplierApiError(
      humanizeApiMessage(message, statusCode),
      statusCode,
      errorCode,
      details,
    );
  }

  private getFriendlyFallbackMessage(statusCode: number, fallbackMessage: string) {
    if (statusCode === 401) return "Your session has expired. Please sign in and try again.";
    if (statusCode === 403) return "You do not have permission to perform this action.";
    if (statusCode === 404) return "The requested record could not be found.";
    if (statusCode === 409) return "This action conflicts with the current supplier data.";
    if (statusCode === 422) return "Some submitted data is invalid. Please review the form and try again.";
    if (statusCode >= 500) return "The server could not complete this request right now. Please try again.";
    return fallbackMessage;
  }

  setAuthToken(token: string | null) {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      return;
    }
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }

  getStoredAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  }

  async signIn(email: string, password: string): Promise<{
    status: string;
      data: {
        access_token: string;
        token_type: string;
        expires_in_seconds: number;
      user: AuthenticatedAppUser;
    };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/auth/signin`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email, password }),
      },
      "Failed to sign in.",
    );
  }

  async getCurrentUser(): Promise<{
    status: string;
    data: AuthenticatedAppUser;
  }> {
    return this.request(
      `${this.baseUrl}/auth/me`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load your session.",
    );
  }

  async listAccessIdentities(): Promise<{
    status: string;
    data: {
      items: AccessIdentityRecord[];
      count: number;
    };
  }> {
    return this.request(
      `${this.baseUrl}/auth/access-identities`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load access identities.",
    );
  }

  async createAccessIdentity(data: {
    email: string;
    full_name: string;
    access_profile: string;
    password: string;
    auth_source?: string;
    external_subject?: string;
    external_directory?: string;
    is_active?: boolean;
  }): Promise<{
    status: string;
    data: AccessIdentityRecord;
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/auth/access-identities`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to create the access identity.",
    );
  }

  async updateAccessIdentity(
    identityId: number,
    data: {
      full_name?: string;
      access_profile?: string;
      auth_source?: string;
      external_subject?: string | null;
      external_directory?: string | null;
      is_active?: boolean;
    },
  ): Promise<{
    status: string;
    data: AccessIdentityRecord;
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/auth/access-identities/${identityId}`,
      {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to update the access identity.",
    );
  }

  async changePassword(data: {
    current_password: string;
    new_password: string;
  }): Promise<{
    status: string;
    data: {
      email: string;
      changed_at: string;
    };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/auth/change-password`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to update your password.",
    );
  }

  async resetAccessIdentityPassword(
    identityId: number,
    data: {
      new_password: string;
    },
  ): Promise<{
    status: string;
    data: {
      email: string;
      changed_at: string;
    };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/auth/access-identities/${identityId}/reset-password`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to reset the password.",
    );
  }

  async createSupplierOnboarding(
    data: OnboardingRequest
  ): Promise<OnboardingResponse> {
    return this.request<OnboardingResponse>(
      `${this.baseUrl}/suppliers/onboarding/complete`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to create supplier onboarding.",
    );
  }

  async createSupplierMaster(data: {
    group: Record<string, unknown>;
    unit: OnboardingRequest["unit"];
    contacts: OnboardingRequest["contacts"];
    certifications: OnboardingRequest["certifications"];
  }): Promise<SupplierMasterCreationResponse> {
    return this.request<SupplierMasterCreationResponse>(
      `${this.baseUrl}/suppliers`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to create supplier master.",
    );
  }

  async listSites() {
    const payload = await this.request<any>(
      `${this.baseUrl}/sites`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load sites.",
    );

    return {
      ...payload,
      data: Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.data?.items)
          ? payload.data.items
          : [],
    };
  }

  async listSitePanel(params: {
    skip?: number;
    limit?: number;
    site_name?: string;
    supplier_owner?: string;
    class_grade?: string;
    status?: string;
    panel_decision?: string;
    category?: string;
    evaluation_start?: string;
    evaluation_end?: string;
    purchase_manager?: string;
    plant_manager?: string;
    scope?: string;
    family?: string;
    sub_family?: string;
    product_line?: string;
    supplier_name?: string;
  }): Promise<{
    status: string;
    data: {
      items: SitePanelBundle[];
      total: number;
      skip: number;
      limit: number;
    };
    message?: string;
  }> {
    const query = new URLSearchParams();
    if (params.skip != null) query.set("skip", String(params.skip));
    if (params.limit != null) query.set("limit", String(params.limit));
    if (params.site_name) query.set("site_name", params.site_name);
    if (params.supplier_owner) query.set("supplier_owner", params.supplier_owner);
    if (params.class_grade) query.set("class_grade", params.class_grade);
    if (params.status) query.set("status", params.status);
    if (params.panel_decision) query.set("panel_decision", params.panel_decision);
    if (params.category) query.set("category", params.category);
    if (params.evaluation_start)
      query.set("evaluation_start", params.evaluation_start);
    if (params.evaluation_end)
      query.set("evaluation_end", params.evaluation_end);
    if (params.purchase_manager)
      query.set("purchase_manager", params.purchase_manager);
    if (params.plant_manager)
      query.set("plant_manager", params.plant_manager);
    if (params.scope) query.set("scope", params.scope);
    if (params.family) query.set("family", params.family);
    if (params.sub_family) query.set("sub_family", params.sub_family);
    if (params.product_line) query.set("product_line", params.product_line);
    if (params.supplier_name) query.set("supplier_name", params.supplier_name);

    return this.request(
      `${this.baseUrl}/sites/panel?${query.toString()}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the site panel.",
    );
  }
  async listSiteOptions() {
    return this.request(
      `${this.baseUrl}/sites/options`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load site options.",
    );
  }

  async listAssessmentTemplates() {
    return this.request(
      `${this.baseUrl}/suppliers/assessment-templates`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load assessment templates.",
    );
  }

  async getOnboardingOptions(): Promise<{
    status: string;
    data: OnboardingSelectionOptions;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/onboarding/options`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load onboarding options.",
    );
  }

  async listSuppliers() {
    return this.request(
      `${this.baseUrl}/suppliers`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load suppliers.",
    );
  }

  async listSupplierGroups(
    skip: number = 0,
    limit: number = 100
  ): Promise<{
    status: string;
    data: {
      items: SupplierGroupSummary[];
      total: number;
      skip: number;
      limit: number;
    };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/groups?skip=${skip}&limit=${limit}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load supplier groups.",
    );
  }

  async getSupplierGroup(groupId: number): Promise<{
    status: string;
    data: SupplierGroupSummary;
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the supplier group.",
    );
  }

  async updateSupplierGroup(
    groupId: number,
    data: Partial<{
      nom: string;
      supplier_scope: string;
      supplier_owner: string;
      supplier_type: string;
      strategique: boolean;
      monopolistique: boolean;
      directed: boolean;
      multi_site: boolean;
      exit_supplier: boolean;
      strategic_reason: string;
    }>,
  ): Promise<{ status: string; data: SupplierGroupSummary }> {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}`,
      {
        method: "PUT",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      "Failed to update the supplier group.",
    );
  }

  async getGroupAuditTrail(groupId: number, limit: number = 25): Promise<{
    status: string;
    data: {
      items: SupplierAuditEvent[];
      count: number;
      limit: number;
    };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}/audit-trail?limit=${limit}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the group audit trail.",
    );
  }

  async listContactsForGroup(groupId: number): Promise<{
    status: string;
    data: {
      items: ContactResponse[];
      count: number;
    };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}/contacts`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load group contacts.",
    );
  }

  async listRelationContacts(relationId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/contacts`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load relation contacts.",
    );
  }

  async addContactToRelation(relationId: number, data: {
    contact_id?: number;
    full_name?: string;
    email?: string;
    phone?: string;
    role_label?: string;
    id_supplier_unit?: number;
  }) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/contacts`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to add contact to relation.",
    );
  }

  async listContactsForUnit(unitId: number): Promise<{
    status: string;
    data: { items: ContactResponse[]; count: number };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/contacts`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load unit contacts.",
    );
  }

  async addContactToUnit(unitId: number, data: any) {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/contacts`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to add contact to unit.",
    );
  }

  async getSupplierById(supplierId: string) {
    return this.request(
      `${this.baseUrl}/suppliers/${supplierId}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the supplier.",
    );
  }

  // ========================================================================
  // Multi-Unit & Multi-Site Management APIs
  // ========================================================================

  async createUnitComplete(groupId: number, data: { unit: any; contacts: any[]; certifications: any[] }) {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}/units/complete`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to create unit.",
    );
  }

  async createSupplierUnit(groupId: number, data: any) {
    return this.request(
      `${this.baseUrl}/suppliers/units`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          id_group: groupId,
          ...data,
        }),
      },
      "Failed to create the supplier unit.",
    );
  }

  async listUnitsForGroup(groupId: number) {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}/units`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load units for this supplier group.",
    );
  }

  async linkUnitToSite(unitId: number, siteId: number, data?: any) {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/sites/${siteId}`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data || {}),
      },
      "Failed to link the supplier unit to the selected site.",
    );
  }

  async listSitesForUnit(unitId: number) {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/sites`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load linked sites for this unit.",
    );
  }

  async addCertificationToUnit(unitId: number, data: any) {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/certifications`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to add the certification.",
    );
  }

  async listCertificationsForUnit(unitId: number): Promise<{
    status: string;
    data: {
      items: SupplierCertificationResponse[];
      count: number;
    };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/certifications`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load unit certifications.",
    );
  }

  async createInitialUnitEvaluation(unitId: number, data: any) {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/initial-evaluation`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to save the initial unit evaluation.",
    );
  }

  async createInitialRelationEvaluation(relationId: number, data: any) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/initial-evaluation`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to save the initial relation evaluation.",
    );
  }

  async getSupplierRelation(relationId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the supplier relation.",
    );
  }

  async getRelationEvaluationWorkspace(relationId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/evaluation-workspace`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the relation evaluation workspace.",
    );
  }

  async getRelationStatusHistory(relationId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/status-history`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the relation status history.",
    );
  }

  async listRelationDevelopmentPlans(relationId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the supplier development plans.",
    );
  }

  async createRelationDevelopmentPlan(relationId: number, data: any) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to create the supplier development plan.",
    );
  }

  async uploadRelationDevelopmentPlanDocument(
    relationId: number,
    planId: number,
    file: File,
    comments?: string,
  ) {
    const formData = new FormData();
    formData.append("file", file);
    if (comments) {
      formData.append("comments", comments);
    }

    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}/document`,
      {
        method: "POST",
        headers: this.getAuthHeadersWithoutContentType(),
        body: formData,
      },
      "Failed to upload the development plan document.",
    );
  }

  async updateRelationDevelopmentPlan(
    relationId: number,
    planId: number,
    data: any,
  ) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}`,
      {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to update the supplier development plan.",
    );
  }

  async sendRelationDevelopmentPlanRequest(
    relationId: number,
    planId: number,
    data?: {
      custom_message?: string;
      changed_by?: string;
      to_emails?: string[];
      extra_cc_emails?: string[];
    },
  ) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}/send-request`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data || {}),
      },
      "Failed to send the development plan request email.",
    );
  }

  async sendRelationDevelopmentPlanReminder(
    relationId: number,
    planId: number,
    data?: {
      custom_message?: string;
      changed_by?: string;
      to_emails?: string[];
      extra_cc_emails?: string[];
    },
  ) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}/send-reminder`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data || {}),
      },
      "Failed to send the reminder email.",
    );
  }

  async sendRelationDevelopmentPlanRevisionRequest(
    relationId: number,
    planId: number,
    data?: { custom_message?: string; changed_by?: string; to_emails?: string[]; extra_cc_emails?: string[] },
  ) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}/send-revision-request`,
      { method: "POST", headers: this.getAuthHeaders(), body: JSON.stringify(data || {}) },
      "Failed to send the revision request email.",
    );
  }

  async sendRelationDevelopmentPlanDecisionNotification(
    relationId: number,
    planId: number,
    data: { decision: "approved" | "rejected"; custom_message?: string; changed_by?: string; to_emails?: string[]; extra_cc_emails?: string[] },
  ) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}/send-decision-notification`,
      { method: "POST", headers: this.getAuthHeaders(), body: JSON.stringify(data) },
      "Failed to send the decision notification email.",
    );
  }

  async listPlanDocuments(relationId: number, planId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}/documents`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load plan documents.",
    );
  }

  async deletePlanDocument(relationId: number, planId: number, documentId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}/documents/${documentId}`,
      { method: "DELETE", headers: this.getAuthHeaders() },
      "Failed to delete document.",
    );
  }

  async sendPlanReceivedNotification(
    relationId: number,
    planId: number,
    data: {
      to_emails: string[];
      extra_cc_emails?: string[];
      custom_message?: string;
      changed_by?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}/send-received-notification`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to send received notification email.",
    );
  }

  async sendRelationDevelopmentPlanReviewNotification(
    relationId: number,
    planId: number,
    data: {
      to_emails: string[];
      extra_cc_emails?: string[];
      custom_message?: string;
      review_deadline?: string;
      changed_by?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/development-plans/${planId}/send-review-notification`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to send the review notification email.",
    );
  }

  async listDevelopmentPlanRegister() {
    return this.request(
      `${this.baseUrl}/supplier-relations/development-plans/register`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the supplier development plan register.",
    );
  }

  async updateRelationClassEvaluation(relationId: number, data: any) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/class-evaluation`,
      {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to update the class evaluation.",
    );
  }

  async updateRelationOperationalEvaluation(relationId: number, data: any) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/operational-evaluation`,
      {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to update the operational evaluation.",
    );
  }

  async overrideRelationSupplierStatus(relationId: number, data: any) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/status-override`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to override the supplier status.",
    );
  }

  async uploadRelationCriterionDocument(
    relationId: number,
    criteriaType: string,
    file: File,
    comments?: string,
  ) {
    const formData = new FormData();
    formData.append("criteria_type", criteriaType);
    formData.append("file", file);
    if (comments) {
      formData.append("comments", comments);
    }

    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/criteria-documents`,
      {
        method: "POST",
        headers: this.getAuthHeadersWithoutContentType(),
        body: formData,
      },
      "Failed to upload the criterion document.",
    );
  }

  async deleteRelationCriterionDocument(
    relationId: number,
    criteriaType: string,
  ) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/criteria-documents/${criteriaType}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      },
      "Failed to delete the criterion document.",
    );
  }

  async getUnitEvaluationSummary(unitId: number) {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/evaluation-summary`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load the unit evaluation summary.",
    );
  }

  async unlinkUnitFromSite(unitId: number, siteId: number) {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/sites/${siteId}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      },
      "Failed to unlink the supplier unit from the site.",
    );
  }

  // ---------------------------------------------------------------------------
  // Purchasing Value Management
  // ---------------------------------------------------------------------------

  async listOpportunities() {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load opportunities.",
    );
  }

  async createOpportunity(data: {
    opportunity_name: string;
    opportunity_type: string;
    idea_owner: string;
    description?: string;
    plant_id?: number;
    supplier_id?: number;
    budget_year?: number;
  }) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      "Failed to create opportunity.",
    );
  }

  async getOpportunity(opportunityId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load opportunity.",
    );
  }

  async updateOpportunityPhase0(
    opportunityId: number,
    data: {
      opportunity_name?: string;
      description?: string;
      expected_annual_saving?: number;
      cash_impact?: number;
      lead_time?: number;
      plant_id?: number;
      supplier_id?: number;
      budget_year?: number;
      comments?: string;
      changed_by?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/phase0`,
      {
        method: "PUT",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      "Failed to update opportunity.",
    );
  }

  async sendValidationRequest(
    opportunityId: number,
    data: {
      to_emails: string[];
      extra_cc_emails?: string[];
      custom_message?: string;
      sent_by?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/send-validation-request`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      "Failed to send validation request.",
    );
  }

  async applyGateDecision(
    opportunityId: number,
    data: {
      decision: "Go" | "No Go" | "Review";
      decided_by?: string;
      comments?: string;
      project_manager?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/gate-decision`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      "Failed to apply gate decision.",
    );
  }

  async updateOpportunity(
    opportunityId: number,
    data: {
      // Core
      opportunity_name?: string;
      description?: string;
      assumptions_summary?: string;
      comments?: string;
      // Financial (locked after Go)
      expected_annual_saving?: number;
      cash_impact?: number;
      duration_months?: number;
      budget_status?: string;
      budget_year?: number;
      // Dates
      planned_start_date?: string;
      execution_start_date?: string;
      real_start_date?: string;
      // Context
      change_mode?: string;
      currency?: string;
      fx_rate_to_eur?: number;
      plant_id?: number;
      supplier_id?: number;
      // Owners
      purchasing_owner?: string;
      conversion_owner?: string;
      // PLD scoring
      payback_score?: number;
      lead_time_score?: number;
      difficulty_score?: number;
      // STP — scope & volumes
      scope_in?: string;
      scope_out?: string;
      customers?: string;
      annual_quantity_n1?: number;
      annual_quantity_n2?: number;
      annual_quantity_n3?: number;
      annual_quantity_n4?: number;
      // STP — initial step
      supplier_asked?: boolean;
      supplier_asked_result?: string;
      // STP — supplier comparison
      proposed_supplier_name?: string;
      proposed_supplier_id?: number;
      current_price?: number;
      current_price_n1?: number;
      current_price_n2?: number;
      current_price_n3?: number;
      proposed_price?: number;
      proposed_price_n1?: number;
      proposed_price_n2?: number;
      proposed_price_n3?: number;
      // country_before is read from SupplierUnit.country — not stored on Opportunity
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
      // STP — costs
      tooling_cost?: number;
      travel_cost?: number;
      qualification_cost?: number;
      other_cost?: number;
      // STP — risks
      stp_risks?: {
        material_indexation_before?: string;
        material_indexation_after?: string;
        material_indexation_desc?: string;
        exchange_rate_before?: string;
        exchange_rate_after?: string;
        exchange_rate_desc?: string;
        local_content_before?: string;
        local_content_after?: string;
        local_content_desc?: string;
        quality_before?: string;
        quality_after?: string;
        quality_desc?: string;
        other_before?: string;
        other_after?: string;
        other_desc?: string;
        material_same_spec?: string;
        same_tooling?: string;
        same_dimension?: string;
      };
      // STP — benefits
      stp_benefits?: {
        if_we_do?: string;
        if_not?: string;
      };
      // STP — planning
      phase1_weeks?: number;
      phase2_weeks?: number;
      phase3_weeks?: number;
      phase4_weeks?: number;
      // STP — why
      reason_productivity?: boolean;
      reason_quality?: boolean;
      reason_capacity?: boolean;
      reason_other?: string;
      // STP — missing workbook fields (rev 1.2)
      secondary_plants?: string;
      gate_conditions?: string;
      changed_by?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}`,
      {
        method: "PUT",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      "Failed to update opportunity.",
    );
  }

  async updateMonthlyActual(
    monthId: number,
    data: {
      actual_saving?: number;
      cash_actual?: number;
      forecast_eoy_saving?: number;
      forecast_comment?: string;
      comment?: string;
      monthly_outcome?: string;
      updated_by?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/monthly/${monthId}`,
      {
        method: "PUT",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      "Failed to update monthly actual.",
    );
  }

  // ---------------------------------------------------------------------------
  // Purchasing Value — documents
  // ---------------------------------------------------------------------------

  async listOpportunityDocuments(opportunityId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/documents`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load documents.",
    );
  }

  async uploadOpportunityDocument(
    opportunityId: number,
    file: File,
    phaseLabel: string,
    notes?: string,
    uploadedBy?: string,
  ) {
    const form = new FormData();
    form.append("file", file);
    form.append("phase_label", phaseLabel);
    if (notes) form.append("notes", notes);
    if (uploadedBy) form.append("uploaded_by", uploadedBy);
    // Must NOT set Content-Type manually — browser sets multipart/form-data + boundary automatically
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/documents`,
      { method: "POST", headers: this.getAuthHeadersWithoutContentType(), body: form },
      "Failed to upload document.",
    );
  }

  async deleteOpportunityDocument(docId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/documents/${docId}`,
      { method: "DELETE", headers: this.getAuthHeaders() },
      "Failed to delete document.",
    );
  }

  // ---------------------------------------------------------------------------
  // Purchasing Value — suppliers by plant
  // ---------------------------------------------------------------------------

  async rebuildFinancialLineProfile(lineId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/financial-lines/${lineId}/rebuild-profile`,
      { method: "POST", headers: this.getAuthHeaders() },
      "Failed to rebuild profile.",
    );
  }

  async getPurchasingKpis(year?: number) {
    const q = year ? `?year=${year}` : "";
    return this.request(
      `${this.baseUrl}/purchasing-value/kpis${q}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load purchasing KPIs.",
    );
  }

  async getCurrentSupplierEvaluation(opportunityId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/current-supplier-evaluation`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load supplier evaluation.",
    );
  }

  // Per-fiscal-year budgeting (status is derived from validation — read-only)
  async listBudgetYears(fiscalYear: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/budget-years?fiscal_year=${fiscalYear}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load budget records.",
    );
  }

  async assignBudget(
    fiscalYear: number,
    decisions: { opportunity_id: number; budget_status: string }[],
    decidedBy?: string,
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/budgets/${fiscalYear}/assign`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ decisions, decided_by: decidedBy }),
      },
      "Failed to save budget.",
    );
  }

  async getSuppliersByPlant(plantId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/suppliers-by-plant/${plantId}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load suppliers for this plant.",
    );
  }

  // ---------------------------------------------------------------------------
  // Purchasing Value — financial line actions
  // ---------------------------------------------------------------------------

  async startStudy(opportunityId: number, startedBy?: string) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/start-study`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ started_by: startedBy }) },
      "Failed to start study.",
    );
  }

  async submitForValidation(opportunityId: number, data: { to_emails: string[]; cc_emails?: string[]; message?: string; submitted_by?: string }) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/submit-for-validation`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to submit for validation.",
    );
  }

  async submitToCommittee(opportunityId: number, data: { to_emails?: string[]; cc_emails?: string[]; committee_type?: string; message?: string; submitted_by?: string }) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/submit-to-committee`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to submit to committee.",
    );
  }

  async updateProject(
    projectId: number,
    data: {
      project_owner?: string; status?: string; plant_validation?: string;
      planned_end_date?: string; actual_end_date?: string; comments?: string;
      phase_output_notes?: string; off_tool_date?: string;
      committee_review_date?: string; committee_members?: string;
      updated_by?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/projects/${projectId}`,
      { method: "PUT", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to update project.",
    );
  }

  async escalateFinancialLine(
    lineId: number,
    data: { escalation_reason: string; escalated_by?: string; extra_recipients?: string[] },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/financial-lines/${lineId}/escalate`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to escalate.",
    );
  }

  async deescalateFinancialLine(lineId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/financial-lines/${lineId}/deescalate`,
      { method: "POST", headers: this.getAuthHeaders() },
      "Failed to de-escalate.",
    );
  }

  async setRecovery(
    lineId: number,
    data: {
      recovery_status: string;
      recovery_note?: string;
      recovery_target_date?: string;
      recovery_amount?: number;
      updated_by?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/financial-lines/${lineId}/recovery`,
      { method: "PUT", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to update recovery.",
    );
  }

  async getRecoveryPlans() {
    return this.request(
      `${this.baseUrl}/purchasing-value/recovery-plans`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load recovery plans.",
    );
  }

  async addComponentLine(
    opportunityId: number,
    data: { component_name: string; component_pn?: string; expected_annual_saving: number; planned_start_date?: string; duration_months?: number; added_by?: string },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/financial-lines`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to add component line.",
    );
  }

  async reviseFinancialLineBaseline(lineId: number, data: { revised_saving: number; note?: string; revised_by?: string }) {
    return this.request(
      `${this.baseUrl}/purchasing-value/financial-lines/${lineId}/revise-baseline`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to revise financial baseline.",
    );
  }

  async completeFinancialLine(
    lineId: number,
    data: { completed_by?: string; comments?: string },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/financial-lines/${lineId}/complete`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to complete financial line.",
    );
  }

  // ========================================================================
  // Relation Evaluation Document APIs
  // ========================================================================

  async uploadEvaluationReference(relationId: number, file: File, comments?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (comments) formData.append("comments", comments);
    const token = localStorage.getItem("auth_token");
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/documents/evaluation-reference`,
      { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData },
      "Failed to upload evaluation reference.",
    );
  }

  async uploadLtaDocument(relationId: number, file: File, comments?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (comments) formData.append("comments", comments);
    const token = localStorage.getItem("auth_token");
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/documents/lta`,
      { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData },
      "Failed to upload LTA document.",
    );
  }

  // ========================================================================
  // Batch Evaluation APIs
  // ========================================================================

  /** GET /evaluations/due — supplier relations needing evaluation */
  async getEvaluationsDue() {
    return this.request(
      `${this.baseUrl}/evaluations/due`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load due evaluations.",
    );
  }

  /** POST /evaluations/batch-upload — upload Excel/CSV with evaluation results */
  async batchUploadEvaluations(file: File, dryRun = false) {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("auth_token");
    return this.request(
      `${this.baseUrl}/evaluations/batch-upload?dry_run=${dryRun}`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      },
      "Failed to upload evaluation file.",
    );
  }

  /** URL for downloading the blank CSV template */
  getEvaluationTemplateCsvUrl(): string {
    return `${this.baseUrl}/evaluations/template/csv`;
  }

  /** URL for downloading the blank XLSX template */
  getEvaluationTemplateXlsxUrl(): string {
    return `${this.baseUrl}/evaluations/template/xlsx`;
  }

  /** URL for downloading the pre-filled XLSX with all active supplier–plant relations */
  getEvaluationPrefilledTemplateUrl(): string {
    return `${this.baseUrl}/evaluations/template/prefilled`;
  }

  /**
   * Download the STP document as a PDF. Uses fetch + blob so the auth header is sent.
   */
  async downloadStpPdf(opportunityId: number, phase: 0 | 1, oppName?: string): Promise<void> {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/export-stp?phase=${phase}`,
      { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = (oppName ?? `opp_${opportunityId}`).replace(/\s+/g, "_").slice(0, 50);
    a.download = `STP_Phase${phase}_${safe}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Fetch the pre-filled template with auth header and trigger a browser download.
   * Required because <a href> doesn't send the Authorization header.
   */
  async downloadPrefilledTemplate(): Promise<void> {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(this.getEvaluationPrefilledTemplateUrl(), {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evaluation_prefilled.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  // ===========================================================================
  // Carbon Footprint (SB8)
  // ===========================================================================

  async listCarbonFootprints(params?: {
    skip?: number;
    limit?: number;
    unit_id?: number;
    relation_id?: number;
    year?: number;
    continent?: string;
    origin?: string;
    site_location?: string;
    supplier_unit_code?: string;
  }): Promise<{ items: CarbonFootprintRecord[]; total: number; total_all: number; skip: number; limit: number }> {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set("skip", String(params.skip));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.unit_id !== undefined) query.set("unit_id", String(params.unit_id));
    if (params?.relation_id !== undefined) query.set("relation_id", String(params.relation_id));
    if (params?.year !== undefined) query.set("year", String(params.year));
    if (params?.continent) query.set("continent", params.continent);
    if (params?.origin) query.set("origin", params.origin);
    if (params?.site_location) query.set("site_location", params.site_location);
    if (params?.supplier_unit_code) query.set("supplier_unit_code", params.supplier_unit_code);
    const qs = query.toString();
    const res = await this.request<{ data: { items: CarbonFootprintRecord[]; total: number; total_all: number; skip: number; limit: number } }>(
      `${this.baseUrl}/suppliers/carbon-footprints${qs ? `?${qs}` : ""}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load carbon footprint data.",
    );
    return res.data;
  }

  async updateCarbonFootprint(
    id: number,
    data: Partial<CarbonFootprintRecord>,
  ): Promise<CarbonFootprintRecord> {
    const res = await this.request<{ data: CarbonFootprintRecord }>(
      `${this.baseUrl}/suppliers/carbon-footprints/${id}`,
      {
        method: "PATCH",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      "Failed to update carbon footprint record.",
    );
    return res.data;
  }

  async createCarbonFootprint(
    data: Partial<CarbonFootprintRecord>,
  ): Promise<CarbonFootprintRecord> {
    const res = await this.request<{ data: CarbonFootprintRecord }>(
      `${this.baseUrl}/suppliers/carbon-footprints`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
      "Failed to create carbon footprint record.",
    );
    return res.data;
  }

  // ===========================================================================
  // Certifications Tracking
  // ===========================================================================

  async listAllCertifications(params?: {
    skip?: number;
    limit?: number;
    standard_type?: string;
    expired_only?: boolean;
    expiring_days?: number;
  }): Promise<{ items: SupplierCertificationResponse[]; total: number; skip: number; limit: number }> {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set("skip", String(params.skip));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.standard_type) query.set("standard_type", params.standard_type);
    if (params?.expired_only) query.set("expired_only", "true");
    if (params?.expiring_days !== undefined) query.set("expiring_days", String(params.expiring_days));
    const qs = query.toString();
    const res = await this.request<{ data: { items: SupplierCertificationResponse[]; total: number; skip: number; limit: number } }>(
      `${this.baseUrl}/suppliers/certifications${qs ? `?${qs}` : ""}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load certifications data.",
    );
    return res.data;
  }
}

export const supplierAPI = new SupplierOnboardingAPI();
export type { OnboardingResponse };
// export { OnboardingRequest, OnboardingResponse };
export default supplierAPI;
