import type { QueryClient } from "@tanstack/react-query";
import { broadcastInvalidate } from "../lib/crossTabSync";

// Call after any mutation touching a supplier group (updateSupplierGroup,
// setGroupActiveStatus, ...). Two views read the same underlying list under
// different paramsKeys (see queryKeys.supplierGroups):
// - SupplierManagementPage: the full active+inactive list ("all", up to 1000)
// - CarbonFootprintPage: an active-only selector list ("carbon-footprint-page",
//   up to 200), read-only in that page
// Invalidating the shared "supplierGroups" prefix refreshes every reader
// regardless of which paramsKey it used, wherever it's currently mounted —
// including other browser tabs via crossTabSync.
export function invalidateSupplierGroups(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "supplierGroups",
  });
  broadcastInvalidate("supplierGroups");
}
