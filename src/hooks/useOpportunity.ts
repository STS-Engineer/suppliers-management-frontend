import { useQuery, type QueryClient } from "@tanstack/react-query";
import supplierAPI from "../services/supplierOnboardingAPI";
import { queryKeys } from "../lib/queryClient";
import { broadcastInvalidate } from "../lib/crossTabSync";

// Single source of truth for one opportunity's detail payload
// (GET /purchasing-value/opportunities/{id}). Not every page needs this yet
// (several still hold their own local `Opp` state fed by the opportunities
// list or by a mutation's response), but any reader that mounts this hook
// shares the same cache entry — and gets refreshed by invalidateOpportunity
// below, wherever the mutation happened (this page, another page, or another
// browser tab via crossTabSync).
export function useOpportunityQuery(id: number | string | null | undefined) {
  const enabled =
    id !== null && id !== undefined && id !== "" && !Number.isNaN(Number(id));
  return useQuery({
    queryKey: queryKeys.opportunity(id ?? "unset"),
    queryFn: () => supplierAPI.getOpportunity(Number(id)),
    enabled,
  });
}

// Call after any mutation that changes an opportunity (phase/status/gate
// decision, monthly actuals, project fields, budget assignment, real start
// date, ...). Invalidates:
// - this opportunity's own detail cache entry (queryKeys.opportunity)
// - every "opportunities" list entry (MonthlyFollowUpPage / PurchasingValuePage)
// - every "purchasingKpis" entry (the KPI dashboard aggregates opportunities,
//   so any opportunity mutation can change it even though the KPI page never
//   mutates anything itself)
// ...then broadcasts all three prefixes to other open tabs.
export function invalidateOpportunity(
  queryClient: QueryClient,
  id: number | string,
) {
  const key = String(id);
  queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "opportunity" && query.queryKey[1] === key,
  });
  queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "opportunities",
  });
  queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "purchasingKpis",
  });
  broadcastInvalidate("opportunity", key);
  broadcastInvalidate("opportunities");
  broadcastInvalidate("purchasingKpis");
}
