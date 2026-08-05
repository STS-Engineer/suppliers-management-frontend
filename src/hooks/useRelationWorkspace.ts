import { useQuery, type QueryClient } from "@tanstack/react-query";
import supplierAPI from "../services/supplierOnboardingAPI";
import { queryKeys } from "../lib/queryClient";
import { broadcastInvalidate } from "../lib/crossTabSync";

// Single source of truth for a relation's evaluation workspace payload.
// RelationEvaluationPage (the full evaluation form) and ActiveSuppliersPage's
// relation detail modal both read this same data -- sharing one query key
// means a mutation from either page (or another browser tab, via
// crossTabSync) refreshes both places without a manual reload.
export function useRelationWorkspaceQuery(relId: number | string | null | undefined) {
  const enabled =
    relId !== null && relId !== undefined && relId !== "" && !Number.isNaN(Number(relId));
  return useQuery({
    queryKey: queryKeys.relationWorkspace(relId ?? "unset"),
    queryFn: () => supplierAPI.getRelationEvaluationWorkspace(Number(relId)),
    enabled,
  });
}

// Call after any mutation that changes a relation's evaluation/status data.
// Invalidates this relation's workspace cache entry AND every "sitePanel"
// list entry (the Supplier Panel's list rows embed status/grade fields that
// come from the same mutations), then broadcasts both invalidations to other
// open tabs.
export function invalidateRelationWorkspace(
  queryClient: QueryClient,
  relId: number | string,
) {
  const relKey = String(relId);
  queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "relationWorkspace" && query.queryKey[1] === relKey,
  });
  queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "sitePanel",
  });
  broadcastInvalidate("relationWorkspace", relKey);
  broadcastInvalidate("sitePanel");
}
