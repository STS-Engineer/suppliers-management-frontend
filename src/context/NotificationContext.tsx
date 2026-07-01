import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import supplierAPI, {
  type NotificationRecord,
} from "../services/supplierOnboardingAPI";
import { useAuth } from "./AuthContext";

const POLL_INTERVAL_MS = 30_000;

type NotificationContextValue = {
  unreadCount: number;
  notifications: NotificationRecord[];
  isLoadingList: boolean;
  fetchList: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lightweight poll — only fetches the count, not the full list.
  const refreshCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await supplierAPI.getUnreadNotificationCount();
      setUnreadCount(res.data.count);
    } catch {
      // Silently ignore poll errors.
    }
  }, [isAuthenticated]);

  // Full list — called when the dropdown opens.
  const fetchList = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingList(true);
    try {
      const res = await supplierAPI.listNotifications();
      setNotifications(res.data.items);
      // Sync the badge from the freshly loaded list.
      setUnreadCount(res.data.items.filter((n) => !n.is_read).length);
    } catch {
      // Ignore.
    } finally {
      setIsLoadingList(false);
    }
  }, [isAuthenticated]);

  const markRead = useCallback(async (id: number) => {
    await supplierAPI.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await supplierAPI.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  // Start / stop polling based on authentication state.
  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    // Initial fetch.
    refreshCount();

    // Pause while the tab is hidden; resume on visibility.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshCount();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    intervalRef.current = setInterval(refreshCount, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuthenticated, refreshCount]);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, notifications, isLoadingList, fetchList, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
