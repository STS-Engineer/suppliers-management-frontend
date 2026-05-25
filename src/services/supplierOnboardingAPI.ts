import {
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

const rawApiUrl = import.meta.env.VITE_API_URL?.trim();

const normalizeApiUrl = (url?: string) => {
  if (!url) return url;
  if (typeof window === "undefined") return url;
  if (window.location.protocol === "https:" && url.startsWith("http://")) {
    return url.replace(/^http:\/\//, "https://");
  }
  return url;
};

const API_URL =
  normalizeApiUrl(rawApiUrl) ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://supp-back-cbc7g9avb5b7cjbd.francecentral-01.azurewebsites.net/api/v1"
    : "http://localhost:8000/api/v1");
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

    return new SupplierApiError(message, statusCode, errorCode, details);
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
}

export const supplierAPI = new SupplierOnboardingAPI();
export type { OnboardingResponse };
// export { OnboardingRequest, OnboardingResponse };
export default supplierAPI;
