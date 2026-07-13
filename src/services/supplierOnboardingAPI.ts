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

export const API_URL =
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
  registration_status: string;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AccountRequestRecord = {
  id_identity: number;
  email: string;
  full_name: string;
  requested_role: string;
  registration_status: string;
  created_at?: string | null;
};

export type NotificationRecord = {
  id: number;
  notification_type: string;
  title: string;
  body?: string | null;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
};

export type PendingValidationRecord = {
  group_id: number;
  group_name: string | null;
  group_code: string | null;
  validation_status: string;
  unit_id: number;
  unit_code: string | null;
  unit_country: string | null;
  relation_id: number;
  site_id: number;
  site_name: string | null;
  supplier_scope: string | null;
  supplier_owner: string | null;
  created_at: string | null;
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

  // ---------------------------------------------------------------------------
  // Account self-registration and approval workflow
  // ---------------------------------------------------------------------------

  async signUp(data: {
    email: string;
    full_name: string;
    requested_role: string;
  }): Promise<{
    status: string;
    data: { message: string; email: string };
  }> {
    return this.request(
      `${this.baseUrl}/auth/signup`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to submit the account request.",
    );
  }

  async forgotPassword(email: string): Promise<{
    status: string;
    data: { message: string };
  }> {
    return this.request(
      `${this.baseUrl}/auth/forgot-password`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email }),
      },
      "Failed to request a password reset.",
    );
  }

  async verifyOtp(data: {
    email: string;
    otp: string;
  }): Promise<{
    status: string;
    data: { reset_token: string; message: string };
  }> {
    return this.request(
      `${this.baseUrl}/auth/verify-otp`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to verify the OTP.",
    );
  }

  async resetPasswordWithToken(data: {
    reset_token: string;
    new_password: string;
  }): Promise<{
    status: string;
    data: { email: string; changed_at: string };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/auth/reset-password`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to reset the password.",
    );
  }

  async activateAccount(data: {
    token: string;
    new_password: string;
  }): Promise<{
    status: string;
    data: { email: string; changed_at: string };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/auth/activate`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to activate the account.",
    );
  }

  async listAccountRequests(status?: string): Promise<{
    status: string;
    data: { items: AccountRequestRecord[]; count: number };
  }> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(
      `${this.baseUrl}/auth/account-requests${query}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load account requests.",
    );
  }

  async approveAccountRequest(
    identityId: number,
    message?: string,
  ): Promise<{ status: string; data: { message: string } }> {
    return this.request(
      `${this.baseUrl}/auth/account-requests/${identityId}/approve`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ message: message ?? null }),
      },
      "Failed to approve the account request.",
    );
  }

  async rejectAccountRequest(
    identityId: number,
    reason?: string,
  ): Promise<{ status: string; data: { message: string } }> {
    return this.request(
      `${this.baseUrl}/auth/account-requests/${identityId}/reject`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ reason: reason ?? null }),
      },
      "Failed to reject the account request.",
    );
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  async getUnreadNotificationCount(): Promise<{
    status: string;
    data: { count: number };
  }> {
    return this.request(
      `${this.baseUrl}/notifications/unread-count`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to fetch notification count.",
    );
  }

  async listNotifications(unreadOnly = false): Promise<{
    status: string;
    data: { items: NotificationRecord[]; count: number };
  }> {
    const query = unreadOnly ? "?unread_only=true" : "";
    return this.request(
      `${this.baseUrl}/notifications${query}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to fetch notifications.",
    );
  }

  async markNotificationRead(id: number): Promise<{ status: string }> {
    return this.request(
      `${this.baseUrl}/notifications/${id}/read`,
      { method: "POST", headers: this.getAuthHeaders() },
      "Failed to mark notification as read.",
    );
  }

  async markAllNotificationsRead(): Promise<{ status: string }> {
    return this.request(
      `${this.baseUrl}/notifications/read-all`,
      { method: "POST", headers: this.getAuthHeaders() },
      "Failed to mark all notifications as read.",
    );
  }

  // ── Supplier Validation ────────────────────────────────────────────────────

  async listPendingValidationSuppliers(): Promise<{
    status: string;
    data: PendingValidationRecord[];
    total: number;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/pending-validation`,
      { headers: this.getAuthHeaders() },
      "Failed to load pending validation suppliers.",
    );
  }

  async approveSupplier(
    groupId: number,
    comment?: string,
  ): Promise<{ status: string; message: string }> {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}/approve`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment ?? null }),
      },
      "Failed to approve the supplier.",
    );
  }

  async rejectSupplier(
    groupId: number,
    comment?: string,
  ): Promise<{ status: string; message: string }> {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}/reject`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment ?? null }),
      },
      "Failed to reject the supplier.",
    );
  }

  // ── Relation Validation Flow ────────────────────────────────────────────────

  async submitRelationForReview(
    relationId: number,
  ): Promise<{ status: string; message: string }> {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/submit-for-review`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      "Failed to submit relation for review.",
    );
  }

  async approveRelationReview(
    relationId: number,
    comment?: string,
  ): Promise<{ status: string; message: string }> {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/approve-review`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment ?? null }),
      },
      "Failed to approve relation.",
    );
  }

  async rejectRelationReview(
    relationId: number,
    comment?: string,
  ): Promise<{ status: string; message: string }> {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/reject-review`,
      {
        method: "POST",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment ?? null }),
      },
      "Failed to reject relation.",
    );
  }

  async resetRelationToDraft(
    relationId: number,
  ): Promise<{ status: string; message: string }> {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/reset-to-draft`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
      "Failed to reset relation to draft.",
    );
  }

  async listPendingRelationReviews(): Promise<{ status: string; data: any[]; total: number }> {
    return this.request(
      `${this.baseUrl}/supplier-relations/pending-review`,
      { headers: this.getAuthHeaders() },
      "Failed to load pending relation reviews.",
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
        cache: "no-store",
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
    alias?: string;
    group_name?: string;
    unit_name?: string;
    include_inactive?: boolean;
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
    if (params.alias) query.set("alias", params.alias);
    if (params.group_name) query.set("group_name", params.group_name);
    if (params.unit_name) query.set("unit_name", params.unit_name);
    if (params.include_inactive) query.set("include_inactive", "true");

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
    limit: number = 100,
    status: "active" | "inactive" | "all" = "active",
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
      `${this.baseUrl}/suppliers/groups?skip=${skip}&limit=${limit}&status=${status}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load supplier groups.",
    );
  }

  async setGroupActiveStatus(groupId: number, isActive: boolean): Promise<{
    status: string;
    data: {
      group: SupplierGroupSummary;
      units_affected: number;
      relations_affected: number;
    };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}/status`,
      {
        method: "PATCH",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      },
      "Failed to update the supplier group's status.",
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
      strategique: boolean;
      monopolistique: boolean;
      directed: boolean;
      multi_site: boolean;
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

  async listUnitsForGroup(
    groupId: number,
    status: "active" | "inactive" | "all" = "active",
  ) {
    return this.request(
      `${this.baseUrl}/suppliers/groups/${groupId}/units?status=${status}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load units for this supplier group.",
    );
  }

  async setUnitActiveStatus(unitId: number, isActive: boolean): Promise<{
    status: string;
    data: { unit: Record<string, unknown>; relations_affected: number };
    message?: string;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/status`,
      {
        method: "PATCH",
        headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      },
      "Failed to update the supplier unit's status.",
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

  async getSitePurchasers(siteId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/purchasers?site_id=${siteId}`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load purchasers for this site.",
    );
  }

  async getNegotiationApprovers() {
    return this.request(
      `${this.baseUrl}/purchasing-value/negotiation-approvers`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load Purchasing Director / VP Conversion approvers.",
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

  async getCriteriaValidityBulk() {
    return this.request(
      `${this.baseUrl}/supplier-relations/criteria-validity`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
      },
      "Failed to load criteria validity data.",
    );
  }

  async getRelationEvaluationWorkspace(relationId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/evaluation-workspace`,
      {
        method: "GET",
        headers: this.getAuthHeaders(),
        cache: "no-store",
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
        cache: "no-store",
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

  async saveEvaluationDraft(relationId: number, data: Record<string, any>) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/evaluation-draft`,
      {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to save evaluation draft.",
    );
  }

  async clearEvaluationDraft(relationId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/evaluation-draft`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      },
      "Failed to clear evaluation draft.",
    );
  }

  async getCycleHistory(relationId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/evaluation-cycle-history`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load cycle history.",
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
    saving_nature?: string;
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

  async getOpportunityPhaseHistory(opportunityId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/phase-history`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load opportunity phase history.",
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
      saving_nature?: string;
      description?: string;
      assumptions_summary?: string;
      comments?: string;
      // Financial (locked after Go)
      expected_annual_saving?: number;
      cash_impact?: number;
      duration_months?: number;
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
      priority_locked?: boolean;
      priority_category_override?: string;
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
        same_process?: string;
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

  async deleteOpportunity(opportunityId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      },
      "Failed to delete opportunity.",
    );
  }

  async duplicateOpportunity(opportunityId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/duplicate`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
      "Failed to duplicate opportunity.",
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

  async getPurchasingKpis(year?: number, filters?: { plantIds?: number[]; categories?: string[]; buyers?: string[] }) {
    const p = new URLSearchParams();
    if (year) p.set("year", String(year));
    if (filters?.plantIds?.length) p.set("plant_ids", filters.plantIds.join(","));
    if (filters?.categories?.length) p.set("categories", filters.categories.join(","));
    if (filters?.buyers?.length) p.set("buyers", filters.buyers.join(","));
    const q = p.toString() ? `?${p.toString()}` : "";
    return this.request(
      `${this.baseUrl}/purchasing-value/kpis${q}`,
      { method: "GET", headers: this.getAuthHeaders(), cache: "no-store" },
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
    decisions: { opportunity_id: number; budget_status: string; is_additional?: boolean; /* delta_reason?: string[] */ }[],
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

  async getBudgetYearClosure(fiscalYear: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/budget-years/${fiscalYear}/closure`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load budget year closure status.",
    );
  }

  async closeBudgetYear(fiscalYear: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/budget-years/${fiscalYear}/close`,
      { method: "POST", headers: this.getAuthHeaders() },
      "Failed to close budget year.",
    );
  }

  // async updateDeltaReasons(
  //   fiscalYear: number,
  //   decisions: { opportunity_id: number; delta_reason: string[] }[],
  // ) {
  //   return this.request(
  //     `${this.baseUrl}/purchasing-value/budgets/${fiscalYear}/delta-reasons`,
  //     {
  //       method: "POST",
  //       headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" },
  //       body: JSON.stringify({ decisions }),
  //     },
  //     "Failed to save delta reasons.",
  //   );
  // }

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
      recovery_note?: string | null;
      recovery_target_date?: string | null;
      recovery_amount?: number | null;
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

  async reviseFinancialLineBaseline(
    lineId: number,
    data: {
      note: string;
      revised_by?: string;
      // Negotiation / Cash types only
      revised_saving?: number;
      // Sourcing / Technical Productivity types only (any subset)
      current_price?: number;
      proposed_price?: number;
      current_price_n1?: number;
      current_price_n2?: number;
      current_price_n3?: number;
      proposed_price_n1?: number;
      proposed_price_n2?: number;
      proposed_price_n3?: number;
      annual_quantity_n1?: number;
      annual_quantity_n2?: number;
      annual_quantity_n3?: number;
      annual_quantity_n4?: number;
      bonus_before?: number;
      bonus_after?: number;
    },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/financial-lines/${lineId}/revise-baseline`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to revise financial baseline.",
    );
  }

  async requestSTPRevision(
    opportunityId: number,
    data: {
      note: string;
      requested_by?: string;
      current_price?: number;
      proposed_price?: number;
      current_price_n1?: number;
      current_price_n2?: number;
      current_price_n3?: number;
      proposed_price_n1?: number;
      proposed_price_n2?: number;
      proposed_price_n3?: number;
      annual_quantity_n1?: number;
      annual_quantity_n2?: number;
      annual_quantity_n3?: number;
      annual_quantity_n4?: number;
      bonus_before?: number;
      bonus_after?: number;
    },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/request-stp-revision`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to submit STP revision request.",
    );
  }

  async decideSTPRevision(
    opportunityId: number,
    data: { decision: string; decided_by?: string; note?: string },
  ) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/decide-stp-revision`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to record STP revision decision.",
    );
  }

  async requestGateApproval(
    opportunityId: number,
    data: {
      plant_manager_email?: string;
      purchasing_manager_emails?: string[];
      approver_role?: string;
      approver_email?: string;
      message?: string;
    },
  ) {
    return this.request(
      `${this.baseUrl}/gate-approvals/opportunities/${opportunityId}/request`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to submit gate approval request.",
    );
  }

  async requestCommitteeGateApproval(
    opportunityId: number,
    data: { committee_level?: string; approvers: { role: string; email: string }[]; message?: string },
  ) {
    return this.request(
      `${this.baseUrl}/gate-approvals/opportunities/${opportunityId}/committee-request`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data) },
      "Failed to submit committee gate approval request.",
    );
  }

  async getGateApprovalStatus(opportunityId: number) {
    return this.request(
      `${this.baseUrl}/gate-approvals/opportunities/${opportunityId}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load gate approval status.",
    );
  }

  // Public — no auth
  async getVoteForm(token: string) {
    const res = await fetch(`${this.baseUrl}/gate-approvals/vote/${token}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.detail?.message || body?.message || "Approval link not found or expired.";
      throw new Error(msg);
    }
    return res.json();
  }

  async submitVote(token: string, data: { decision: string; comment?: string; project_manager_email?: string }) {
    const res = await fetch(`${this.baseUrl}/gate-approvals/vote/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail?.message || body?.message || "Failed to submit decision.");
    }
    return res.json();
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
  // Opportunity Action Plans
  // ========================================================================

  async listActionPlans(opportunityId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/action-plans`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load action plans.",
    );
  }

  async createActionPlan(opportunityId: number, payload: object) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/action-plans`,
      { method: "POST", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      "Failed to create action plan.",
    );
  }

  async updateActionPlan(opportunityId: number, actionPlanId: number, payload: object) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/action-plans/${actionPlanId}`,
      { method: "PUT", headers: { ...this.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      "Failed to update action plan.",
    );
  }

  async deleteActionPlan(opportunityId: number, actionPlanId: number) {
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/action-plans/${actionPlanId}`,
      { method: "DELETE", headers: this.getAuthHeaders() },
      "Failed to delete action plan.",
    );
  }

  async listAllActionItems(params?: { responsible_email?: string; status?: string; opportunity_id?: number }) {
    const q = new URLSearchParams();
    if (params?.responsible_email) q.set("responsible_email", params.responsible_email);
    if (params?.status) q.set("status", params.status);
    if (params?.opportunity_id != null) q.set("opportunity_id", String(params.opportunity_id));
    const qs = q.toString() ? `?${q}` : "";
    return this.request(
      `${this.baseUrl}/purchasing-value/action-plans/all-items${qs}`,
      { method: "GET", headers: this.getAuthHeaders(), cache: "no-store" },
      "Failed to load action items.",
    );
  }

  async uploadActionEvidence(
    opportunityId: number,
    actionPlanId: number,
    sujetIdx: number,
    actionIdx: number,
    file: File,
  ) {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("auth_token");
    return this.request(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/action-plans/${actionPlanId}/evidence?sujet_idx=${sujetIdx}&action_idx=${actionIdx}`,
      { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData },
      "Failed to upload evidence.",
    );
  }

  async updateActionItemStatus(
    planId: number,
    sujetIdx: number,
    actionIdx: number,
    status: string,
    implementationDate?: string,
  ) {
    const q = new URLSearchParams({
      sujet_idx: String(sujetIdx),
      action_idx: String(actionIdx),
      status,
    });
    if (implementationDate) q.set("implementation_date", implementationDate);
    return this.request(
      `${this.baseUrl}/purchasing-value/action-plans/${planId}/item-status?${q}`,
      { method: "PATCH", headers: this.getAuthHeaders() },
      "Failed to update action status.",
    );
  }

  async remindActionItem(planId: number, sujetIdx: number, actionIdx: number) {
    const q = new URLSearchParams({
      sujet_idx: String(sujetIdx),
      action_idx: String(actionIdx),
    });
    return this.request(
      `${this.baseUrl}/purchasing-value/action-plans/${planId}/items/remind?${q}`,
      { method: "POST", headers: this.getAuthHeaders() },
      "Failed to send reminder.",
    );
  }

  async escalateActionItem(
    planId: number,
    sujetIdx: number,
    actionIdx: number,
    data: { recipient_email: string; subject: string; message?: string },
  ) {
    const q = new URLSearchParams({
      sujet_idx: String(sujetIdx),
      action_idx: String(actionIdx),
    });
    return this.request(
      `${this.baseUrl}/purchasing-value/action-plans/${planId}/items/escalate?${q}`,
      {
        method: "POST",
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
      "Failed to escalate.",
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
    return `${this.baseUrl}/evaluations/template/prefilled?filter=all`;
  }

  /** URL for downloading the pre-filled XLSX filtered to overdue/due-soon/never-evaluated only */
  getEvaluationDueOnlyTemplateUrl(): string {
    return `${this.baseUrl}/evaluations/template/prefilled?filter=due`;
  }

  /** POST /evaluations/trigger-notifications — notify vp_conversion + purchasing_director of overdue/due evaluations */
  async triggerEvaluationNotifications() {
    return this.request(
      `${this.baseUrl}/evaluations/trigger-notifications`,
      { method: "POST", headers: this.getAuthHeaders() },
      "Failed to send evaluation notifications.",
    );
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
   * Download the Full Opportunity Report as a PDF — a live cross-phase snapshot,
   * available for any opportunity type/phase. Uses fetch + blob for the auth header.
   */
  async downloadFullReportPdf(opportunityId: number, oppName?: string): Promise<void> {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(
      `${this.baseUrl}/purchasing-value/opportunities/${opportunityId}/export-full-report`,
      { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = (oppName ?? `opp_${opportunityId}`).replace(/\s+/g, "_").slice(0, 50);
    a.download = `FullReport_${safe}.pdf`;
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

  /** Download the pre-filled template filtered to overdue/due-soon/never-evaluated only. */
  async downloadDueOnlyTemplate(): Promise<void> {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(this.getEvaluationDueOnlyTemplateUrl(), {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evaluation_due_only.xlsx";
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

  async uploadCertificationFile(
    unitId: number,
    certId: number,
    file: File,
  ): Promise<{ data: import("../types/onboarding").SupplierCertificationResponse; message: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("auth_token");
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/certifications/${certId}/file`,
      { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData },
      "Failed to upload certification file.",
    );
  }

  async patchCertification(
    unitId: number,
    certId: number,
    data: {
      standard_type?: string | null;
      certification_type?: string | null;
      certificate_name?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      comments?: string | null;
      file_name?: string | null;
      file_url?: string | null;
    },
  ): Promise<{
    data: import("../types/onboarding").SupplierCertificationResponse;
    affected_evaluations: Array<{
      relation_id: number;
      previous_quality_cert: string | null;
      new_quality_cert: string | null;
      new_class_score: number | null;
      new_class_value: number | null;
    }>;
    message: string;
  }> {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}/certifications/${certId}`,
      {
        method: "PATCH",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to update certification.",
    );
  }

  async getCertificationsSummary(params?: {
    standard_type?: string;
    q?: string;
  }): Promise<{ total: number; unfiltered_total: number; expired: number; expiring: number; valid: number; no_date: number; quality_expired: number }> {
    const query = new URLSearchParams();
    if (params?.standard_type) query.set("standard_type", params.standard_type);
    if (params?.q) query.set("q", params.q);
    const qs = query.toString();
    const res = await this.request<{ data: { total: number; unfiltered_total: number; expired: number; expiring: number; valid: number; no_date: number; quality_expired: number } }>(
      `${this.baseUrl}/suppliers/certifications/summary${qs ? `?${qs}` : ""}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load certifications summary.",
    );
    return res.data;
  }

  async listAllCertifications(params?: {
    skip?: number;
    limit?: number;
    standard_type?: string;
    expired_only?: boolean;
    expiring_days?: number;
    valid_only?: boolean;
    q?: string;
  }): Promise<{ items: SupplierCertificationResponse[]; total: number; skip: number; limit: number }> {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set("skip", String(params.skip));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.standard_type) query.set("standard_type", params.standard_type);
    if (params?.expired_only) query.set("expired_only", "true");
    if (params?.expiring_days !== undefined) query.set("expiring_days", String(params.expiring_days));
    if (params?.valid_only) query.set("valid_only", "true");
    if (params?.q) query.set("q", params.q);
    const qs = query.toString();
    const res = await this.request<{ data: { items: SupplierCertificationResponse[]; total: number; skip: number; limit: number } }>(
      `${this.baseUrl}/suppliers/certifications${qs ? `?${qs}` : ""}`,
      { method: "GET", headers: this.getAuthHeaders() },
      "Failed to load certifications data.",
    );
    return res.data;
  }

  async updateSupplierUnit(unitId: number, data: Record<string, unknown>) {
    return this.request(
      `${this.baseUrl}/suppliers/units/${unitId}`,
      {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to update supplier unit.",
    );
  }

  async patchRelation(relationId: number, data: Record<string, unknown>) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}`,
      {
        method: "PATCH",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to update relation.",
    );
  }

  // ── Committee Review ──────────────────────────────────────────────────

  async initiateCommitteeReview(relationId: number) {
    return this.request(
      `${this.baseUrl}/committee-reviews`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ relation_id: relationId }),
      },
      "Failed to initiate committee review.",
    );
  }

  async getLatestCommitteeReview(relationId: number) {
    return this.request(
      `${this.baseUrl}/committee-reviews/relation/${relationId}`,
      { headers: this.getAuthHeaders() },
      "Failed to load committee review.",
    );
  }

  async getCommitteeReview(reviewId: number) {
    return this.request(
      `${this.baseUrl}/committee-reviews/${reviewId}`,
      { headers: this.getAuthHeaders() },
      "Failed to load committee review.",
    );
  }

  async submitCommitteeFinalDecision(
    reviewId: number,
    decision: "approved" | "rejected",
    comments?: string,
  ) {
    return this.request(
      `${this.baseUrl}/committee-reviews/${reviewId}/final-decision`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ decision, comments }),
      },
      "Failed to submit final decision.",
    );
  }

  async listCommitteeMembers() {
    return this.request(
      `${this.baseUrl}/committee-reviews/members/list`,
      { headers: this.getAuthHeaders() },
      "Failed to load committee members.",
    );
  }

  async createCommitteeMember(data: {
    name: string;
    position: string;
    email: string;
    is_active?: boolean;
  }) {
    return this.request(
      `${this.baseUrl}/committee-reviews/members`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to create committee member.",
    );
  }

  async updateCommitteeMember(
    idMember: number,
    data: Partial<{ name: string; position: string; email: string; is_active: boolean }>,
  ) {
    return this.request(
      `${this.baseUrl}/committee-reviews/members/${idMember}`,
      {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to update committee member.",
    );
  }

  // ── Committee Vote (public — no auth) ─────────────────────────────────

  async getCommitteeVoteForm(token: string) {
    return this.request(
      `${this.baseUrl}/committee-reviews/vote/${token}`,
      {},
      "Failed to load committee vote form.",
    );
  }

  // ── Annual Spend by Year ──────────────────────────────────────────────────

  async listRelationSpend(relationId: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/spend`,
      { headers: this.getAuthHeaders() },
      "Failed to load annual spend history.",
    );
  }

  async upsertRelationSpend(
    relationId: number,
    fiscalYear: number,
    data: { spend_value: number; spend_currency: string },
  ) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/spend/${fiscalYear}`,
      {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      },
      "Failed to save spend entry.",
    );
  }

  async deleteRelationSpend(relationId: number, fiscalYear: number) {
    return this.request(
      `${this.baseUrl}/supplier-relations/${relationId}/spend/${fiscalYear}`,
      { method: "DELETE", headers: this.getAuthHeaders() },
      "Failed to delete spend entry.",
    );
  }

  async submitCommitteeVote(
    token: string,
    decision: "approved" | "rejected",
    comments?: string,
    suggestedSupplierStatus?: string,
    suggestedStrategicMention?: string,
  ) {
    return this.request(
      `${this.baseUrl}/committee-reviews/vote/${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          comments,
          suggested_supplier_status: suggestedSupplierStatus || null,
          suggested_strategic_mention: suggestedStrategicMention || null,
        }),
      },
      "Failed to submit committee vote.",
    );
  }
}

export const supplierAPI = new SupplierOnboardingAPI();
export type { OnboardingResponse };
// export { OnboardingRequest, OnboardingResponse };
export default supplierAPI;
