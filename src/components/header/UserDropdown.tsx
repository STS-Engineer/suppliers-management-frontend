import { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { getReadableAuthError, useAuth } from "../../context/AuthContext";
import supplierAPI from "../../services/supplierOnboardingAPI";

const ACCESS_PROFILE_LABELS: Record<string, string> = {
  purchasing_manager: "Purchasing Manager",
  supplier_owner: "Supplier Owner",
};

export default function UserDropdown() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number; bottom?: number; left?: number; right?: number;
  }>({});

  const initials = useMemo(() => {
    const source = user?.full_name || user?.email || "User";
    return source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }, [user?.email, user?.full_name]);

  const roleLabel = user?.access_profile
    ? ACCESS_PROFILE_LABELS[user.access_profile] || user.access_profile
    : "Authenticated User";

  useEffect(() => {
    if (!open) return undefined;

    const syncMenuPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const PANEL_WIDTH = 288; // w-72
      const GAP = 10;

      // ── Horizontal: open to the right if trigger is on the left half ──
      const midX = (rect.left + rect.right) / 2;
      let h: { left?: number; right?: number };
      if (midX < window.innerWidth / 2) {
        // Sidebar / left side → open to the right of the trigger
        h = { left: Math.min(rect.right + GAP, window.innerWidth - PANEL_WIDTH - 16) };
      } else {
        // Right side → open to the left (original behaviour)
        h = { right: Math.max(window.innerWidth - rect.left + GAP, 16) };
      }

      // ── Vertical: open upward when near the bottom ──
      const spaceBelow = window.innerHeight - rect.bottom;
      const v = spaceBelow < 240
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP };

      setMenuPosition({ ...h, ...v });
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      const clickedTrigger =
        triggerRef.current && triggerRef.current.contains(event.target);
      const clickedPanel =
        panelRef.current && panelRef.current.contains(event.target);

      if (clickedTrigger || clickedPanel) {
        return;
      }

      setOpen(false);
      setShowPasswordForm(false);
      setPasswordError(null);
      setPasswordMessage(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setShowPasswordForm(false);
      }
    };

    syncMenuPosition();
    window.addEventListener("resize", syncMenuPosition);
    window.addEventListener("scroll", syncMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", syncMenuPosition);
      window.removeEventListener("scroll", syncMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handlePasswordChange = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    setIsUpdatingPassword(true);

    try {
      await supplierAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMessage("Password updated successfully.");
    } catch (error) {
      setPasswordError(getReadableAuthError(error));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const dropdownPanel = open ? (
    <div
      ref={panelRef}
      className="fixed z-[9999] w-72 rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_24px_50px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-slate-900"
      style={{
        top:    menuPosition.top    != null ? `${menuPosition.top}px`    : undefined,
        bottom: menuPosition.bottom != null ? `${menuPosition.bottom}px` : undefined,
        left:   menuPosition.left   != null ? `${menuPosition.left}px`   : undefined,
        right:  menuPosition.right  != null ? `${menuPosition.right}px`  : undefined,
      }}
    >
      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl bg-sky-100 p-2 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {user?.full_name || "User"}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {user?.email || "-"}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              {roleLabel}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setShowPasswordForm((value) => !value);
          setPasswordError(null);
          setPasswordMessage(null);
        }}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
      >
        <KeyRound className="h-4 w-4" />
        Change password
      </button>

      {showPasswordForm ? (
        <form
          onSubmit={handlePasswordChange}
          className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]"
        >
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-900"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-900"
            required
          />
          {passwordError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              {passwordError}
            </div>
          ) : null}
          {passwordMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {passwordMessage}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={isUpdatingPassword}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isUpdatingPassword ? "Updating..." : "Update password"}
          </button>
        </form>
      ) : null}

      <button
        type="button"
        onClick={() => {
          signOut();
          navigate("/signin", { replace: true });
        }}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  ) : null;

  return (
    <div ref={triggerRef} className="relative z-40 w-full min-w-0">
      <button
        type="button"
        aria-label="User menu"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-white/55 bg-white/80 px-3 py-2 text-left text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#bfd4ee] dark:border-white/10 dark:bg-slate-900/70 dark:text-white"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#123c68] to-[#1f67a6] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(6,55,112,0.28)]">
          {initials || "U"}
        </span>
        <span className="hidden min-w-0 flex-1 sm:block">
          <span className="block truncate text-sm font-semibold">
            {user?.full_name || "User"}
          </span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {roleLabel}
          </span>
        </span>
      </button>

      {typeof document !== "undefined" && dropdownPanel
        ? createPortal(dropdownPanel, document.body)
        : null}
    </div>
  );
}
