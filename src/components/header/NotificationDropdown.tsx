import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, CheckCircle, ClipboardList, Gavel, Inbox, ShieldAlert, Users, XCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { useNotifications } from "../../context/NotificationContext";
import type { NotificationRecord } from "../../services/supplierOnboardingAPI";

// Map notification types to icons and accent colours.
function NotifIcon({ type }: { type: string }) {
  if (type === "account_request_pending")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
        <ClipboardList size={15} />
      </span>
    );
  if (type === "supplier_pending_validation")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
        <ShieldAlert size={15} />
      </span>
    );
  if (type === "supplier_approved")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
        <CheckCircle size={15} />
      </span>
    );
  if (type === "supplier_rejected")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">
        <XCircle size={15} />
      </span>
    );
  if (type === "committee_decision")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
        <Users size={15} />
      </span>
    );
  if (
    type === "gate_approval_requested" ||
    type === "gate_approval_vote_cast" ||
    type === "gate_approval_outcome" ||
    type === "gate_approval_pm_assigned"
  )
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
        <Gavel size={15} />
      </span>
    );
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
      <Bell size={15} />
    </span>
  );
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const { unreadCount, notifications, isLoadingList, fetchList, markRead, markAllRead } =
    useNotifications();

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<{
    top?: number; bottom?: number; left?: number; right?: number;
  }>({});

  // Fetch list + sync position when opening.
  useEffect(() => {
    if (!open) return;

    fetchList();

    const syncPos = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const PANEL_W = 360;
      const GAP = 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const v =
        spaceBelow < 360
          ? { bottom: window.innerHeight - rect.top + GAP }
          : { top: rect.bottom + GAP };
      const right = Math.max(window.innerWidth - rect.right, 16);
      setPanelPos({ right, ...v });
    };

    syncPos();
    window.addEventListener("resize", syncPos);
    window.addEventListener("scroll", syncPos, true);

    const onPointerDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (
        triggerRef.current?.contains(e.target) ||
        panelRef.current?.contains(e.target)
      )
        return;
      setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("resize", syncPos);
      window.removeEventListener("scroll", syncPos, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open, fetchList]);

  const handleNotifClick = async (n: NotificationRecord) => {
    if (!n.is_read) await markRead(n.id);
    setOpen(false);
    if (n.action_url) navigate(n.action_url);
  };

  const handleMarkAll = async () => {
    await markAllRead();
  };

  const panel = open ? (
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[360px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_50px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-slate-900"
      style={{
        top:    panelPos.top    != null ? `${panelPos.top}px`    : undefined,
        bottom: panelPos.bottom != null ? `${panelPos.bottom}px` : undefined,
        left:   panelPos.left   != null ? `${panelPos.left}px`   : undefined,
        right:  panelPos.right  != null ? `${panelPos.right}px`  : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-white">
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-200"
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto">
        {isLoadingList ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleNotifClick(n)}
              className={[
                "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition last:border-b-0",
                "hover:bg-slate-50 dark:hover:bg-white/[0.04]",
                n.is_read
                  ? "border-slate-100 dark:border-white/[0.05]"
                  : "border-slate-100 bg-sky-50/60 dark:border-white/[0.05] dark:bg-sky-500/[0.06]",
              ].join(" ")}
            >
              <NotifIcon type={n.notification_type} />
              <div className="min-w-0 flex-1">
                <p
                  className={[
                    "text-sm leading-snug",
                    n.is_read
                      ? "text-slate-600 dark:text-slate-300"
                      : "font-semibold text-slate-900 dark:text-white",
                  ].join(" ")}
                >
                  {n.title}
                </p>
                {n.body && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {n.body}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  {timeAgo(n.created_at)}
                </p>
              </div>
              {!n.is_read && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#bfd4ee] hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-[#2d4f7a]"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <Inbox size={32} className="text-slate-300 dark:text-slate-600" />
      <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
        No notifications yet
      </p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        You'll see alerts for pending actions here.
      </p>
    </div>
  );
}
