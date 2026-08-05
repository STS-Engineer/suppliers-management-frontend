import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import supplierAPI from "../services/supplierOnboardingAPI";
import { queryKeys } from "../lib/queryClient";
import { broadcastInvalidate } from "../lib/crossTabSync";

// Single source of truth for "account requests" data. Any component that
// needs the list (AccountRequestsPage) or just the pending count (sidebar
// badge) reads through this hook, sharing one TanStack Query cache entry per
// status. Approving/rejecting invalidates every "accountRequests" entry
// (regardless of status filter) so the sidebar badge and the requests table
// update immediately — no more waiting on the 60s poll or a manual refresh.
export function useAccountRequestsQuery(status?: string, mineOnly?: boolean) {
  return useQuery({
    queryKey: queryKeys.accountRequests(status),
    queryFn: () => supplierAPI.listAccountRequests(status, mineOnly),
    select: (res) => res.data,
  });
}

// Convenience hook for the sidebar badge — just the pending count, polled as
// a safety net (refetchInterval) in addition to the shared-cache invalidation
// above and the refetchOnWindowFocus default.
export function usePendingAccountRequestCount(enabled: boolean) {
  const query = useAccountRequestsQueryWithPolling(enabled);
  return query.data?.count ?? query.data?.items.length ?? 0;
}

function useAccountRequestsQueryWithPolling(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.accountRequests("pending"),
    queryFn: () => supplierAPI.listAccountRequests("pending"),
    select: (res) => res.data,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useAccountRequestMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "accountRequests",
    });
    // Also tell other open tabs to invalidate their own copy of this cache
    // entry (see src/lib/crossTabSync.ts) -- otherwise only this tab's
    // sidebar badge/requests table refreshes.
    broadcastInvalidate("accountRequests");
  };

  const approve = useMutation({
    mutationFn: ({ id, message }: { id: number; message?: string }) =>
      supplierAPI.approveAccountRequest(id, message),
    onSuccess: invalidateAll,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      supplierAPI.rejectAccountRequest(id, reason),
    onSuccess: invalidateAll,
  });

  return { approve, reject };
}
