import type { QueryClient } from "@tanstack/react-query";
import { broadcastInvalidate } from "../lib/crossTabSync";

// Call after any mutation touching an action plan / action item (create,
// update, status change, escalate, remind, sync, evidence upload/delete,
// delete). Two very different views read the same underlying data:
// - PurchasingActionPlansPage: a flat, cross-opportunity list
//   (listAllActionItems), cached under queryKeys.actionItems("all") — it is
//   not filtered by opportunity, so ANY action-item mutation anywhere must
//   invalidate every "actionItems" entry regardless of which opportunity it
//   came from.
// - ActionPlanTab: a single opportunity's action plans (listActionPlans),
//   cached under queryKeys.actionPlans(opportunityId).
//
// Pass `opportunityId` whenever it's known (most call sites have the mutated
// item/plan in scope, which carries an opportunity_id) so the matching
// per-opportunity tab refreshes too. Omit it only for genuinely
// opportunity-less mutations (e.g. a "general" quick action with no
// opportunity_id) — the cross-opportunity list still gets invalidated.
//
// Both mounted useQuery hooks (this page, this tab, wherever else they're
// open — including other browser tabs via crossTabSync) pick this up
// automatically and refetch; no manual reload/refresh click needed.
export function invalidateActionPlans(
  queryClient: QueryClient,
  opportunityId?: number | string | null,
) {
  queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "actionItems",
  });
  broadcastInvalidate("actionItems");

  if (opportunityId !== null && opportunityId !== undefined) {
    const key = String(opportunityId);
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === "actionPlans" && query.queryKey[1] === key,
    });
    broadcastInvalidate("actionPlans", key);
  }
}
