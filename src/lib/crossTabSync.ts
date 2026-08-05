import { useEffect } from "react";
import { queryClient } from "./queryClient";

// Cross-tab cache sync for the shared TanStack Query cache.
//
// TanStack Query already invalidates/refetches *within* a tab (mutation ->
// invalidateQueries -> any mounted useQuery for that key refetches). It does
// NOT know about other browser tabs/windows, each of which has its own
// QueryClient instance. BroadcastChannel closes that gap cheaply: when a
// mutation invalidates a query key in one tab, we also post a message so
// every other open tab invalidates the same key in its own cache.
//
// Not all embedding contexts support BroadcastChannel (older browsers, some
// webviews) -- everything here degrades to a same-tab-only no-op rather than
// throwing.
const CHANNEL_NAME = "suppliers-management-sync";

type SyncMessage = {
  queryKeyPrefix: string;
  extra?: string;
};

function openChannel(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel === "undefined") return null;
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

// Lazily-created, reused for every broadcastInvalidate call in this tab.
let senderChannel: BroadcastChannel | null | undefined;

// Call this right after invalidating a query key locally, so OTHER tabs
// invalidate the same key too. `extra`, when given, narrows the match to
// query keys whose second segment equals it (e.g. a specific relation id) --
// omit it to match every query key sharing that prefix (e.g. all
// "sitePanel" entries regardless of filters).
export function broadcastInvalidate(queryKeyPrefix: string, extra?: string) {
  if (senderChannel === undefined) senderChannel = openChannel();
  if (!senderChannel) return;
  try {
    senderChannel.postMessage({ queryKeyPrefix, extra } satisfies SyncMessage);
  } catch {
    // Ignore postMessage failures (e.g. channel closed) -- this is a
    // best-effort convenience, not a correctness requirement.
  }
}

// Mount once near the app root. Listens for invalidation messages posted by
// broadcastInvalidate() in other tabs and replays them against this tab's own
// QueryClient cache.
export function useCrossTabInvalidation() {
  useEffect(() => {
    const channel = openChannel();
    if (!channel) return;

    const onMessage = (event: MessageEvent<SyncMessage>) => {
      const { queryKeyPrefix, extra } = event.data || {};
      if (!queryKeyPrefix) return;
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === queryKeyPrefix &&
          (!extra || query.queryKey[1] === extra),
      });
    };

    channel.addEventListener("message", onMessage);
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, []);
}
