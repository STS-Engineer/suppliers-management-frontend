import type { QueryClient } from "@tanstack/react-query";
import { broadcastInvalidate } from "../lib/crossTabSync";
import { invalidateOpportunity } from "./useOpportunity";

// Call after any mutation touching a financial line's recovery plan (or any
// financial-line mutation that can change what the recovery dashboard shows —
// escalate/de-escalate, complete, revise baseline, monthly actuals, ...).
// Three views read/derive the same underlying data and must stay in sync
// without a manual reload:
// - PurchasingRecoveryPage: a flat, cross-opportunity list (getRecoveryPlans),
//   cached under queryKeys.recoveryPlans("all") — not filtered server-side,
//   so ANY recovery-relevant mutation anywhere must invalidate every
//   "recoveryPlans" entry regardless of which opportunity it came from.
// - MonthlyFollowUpPage / PurchasingValuePage / PurchasingKpiPage: all read
//   the shared "opportunity"/"opportunities"/"purchasingKpis" cache, which is
//   what invalidateOpportunity() below takes care of.
//
// Pass `opportunityId` whenever it's known (most call sites have the mutated
// financial line's owning opportunity in scope) so the opportunity-derived
// caches refresh too; omit it only when it's genuinely not available at the
// call site — the recovery-plans list still gets invalidated.
export function invalidateRecoveryAndOpportunity(
  queryClient: QueryClient,
  opportunityId?: number | string | null,
) {
  queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "recoveryPlans",
  });
  broadcastInvalidate("recoveryPlans");

  if (opportunityId !== null && opportunityId !== undefined) {
    invalidateOpportunity(queryClient, opportunityId);
  }
}
