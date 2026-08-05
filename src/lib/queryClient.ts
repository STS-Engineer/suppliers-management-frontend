import { QueryClient } from "@tanstack/react-query";

// Shared server-state cache for the whole app.
//
// Defaults chosen for a dashboard/CRUD app where "close enough to real-time"
// matters more than shaving off network calls:
// - staleTime: data is considered fresh for 15s after a fetch, so navigating
//   between pages that share a query key doesn't refetch on every mount.
// - refetchOnWindowFocus: coming back to a tab (or an already-open tab you
//   switch into) refreshes anything stale — this is what fixes the
//   "edited it in another tab, this one still shows the old value" symptom
//   without needing a websocket.
// - retry: a couple of retries for transient network blips, but don't hammer
//   the API on a real 4xx/5xx.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Central place for query keys so every page/hook that reads or invalidates
// the same resource agrees on the same key. Add to this as more resources
// are migrated (Step 2/3).
export const queryKeys = {
  accountRequests: (status?: string) =>
    ["accountRequests", status ?? "all"] as const,
  // Shared by RelationEvaluationPage and ActiveSuppliersPage's detail modal —
  // both read the same relation-evaluation workspace payload, so they must
  // share one cache entry keyed by relation id (invalidating one refreshes
  // the other, wherever it's currently mounted).
  relationWorkspace: (relId: string | number) =>
    ["relationWorkspace", String(relId)] as const,
  // ActiveSuppliersPage's site panel list, keyed by a serialized snapshot of
  // its current filters/pagination so each distinct filter combination gets
  // its own cache entry (mirrors the effect's old dependency array).
  sitePanel: (paramsKey: string) => ["sitePanel", paramsKey] as const,
  // Opportunity list — shared by MonthlyFollowUpPage and PurchasingValuePage,
  // which both load the *entire* unfiltered list and filter client-side, so
  // they use the same paramsKey ("all") and therefore the same cache entry:
  // a refresh on either page feeds the other.
  opportunities: (paramsKey: string) => ["opportunities", paramsKey] as const,
  // A single opportunity's detail payload (getOpportunity). Not fetched via a
  // dedicated hook everywhere yet, but every mutation site invalidates this
  // key so any future/existing single-opportunity reader stays in sync.
  opportunity: (id: string | number) => ["opportunity", String(id)] as const,
  // Purchasing Value KPI dashboard — aggregates opportunities, so it must be
  // invalidated alongside them (see invalidateOpportunity).
  purchasingKpis: (paramsKey: string) => ["purchasingKpis", paramsKey] as const,
  // PurchasingActionPlansPage's flat cross-opportunity action item list
  // (listAllActionItems). Not filtered server-side by opportunity, so — like
  // "opportunities" — every reader uses the same paramsKey ("all") today.
  actionItems: (paramsKey: string) => ["actionItems", paramsKey] as const,
  // ActionPlanTab's per-opportunity action plan list (listActionPlans). Keyed
  // by opportunity id so each opportunity's tab gets its own cache entry, kept
  // in sync with the cross-opportunity view above (see invalidateActionPlans).
  actionPlans: (opportunityId: string | number) =>
    ["actionPlans", String(opportunityId)] as const,
  // PurchasingRecoveryPage's cross-opportunity recovery-plan list
  // (getRecoveryPlans). Not filtered server-side, so — like "opportunities"/
  // "actionItems" — every reader uses the same paramsKey ("all") today.
  recoveryPlans: (paramsKey: string) => ["recoveryPlans", paramsKey] as const,
  // Supplier groups list (listSupplierGroups). Shared prefix across
  // SupplierManagementPage ("all" — active+inactive, up to 1000) and
  // CarbonFootprintPage ("carbon-footprint-page" — active only, up to 200):
  // different paramsKey per distinct fetch shape, but invalidating the
  // "supplierGroups" prefix (see invalidateSupplierGroups) refreshes both.
  supplierGroups: (paramsKey: string) => ["supplierGroups", paramsKey] as const,
  // SupplierMonitoringPage's overview dashboard (getSupplierMonitoringOverview),
  // keyed by a serialized snapshot of its current filters/pagination.
  monitoringOverview: (paramsKey: string) =>
    ["monitoringOverview", paramsKey] as const,
  // PendingValidationPage's pending-supplier queue (listPendingValidationSuppliers).
  pendingValidations: () => ["pendingValidations"] as const,
  // RelationReviewQueuePage's pending-relation-review queue (listPendingRelationReviews).
  pendingRelationReviews: () => ["pendingRelationReviews"] as const,
};
