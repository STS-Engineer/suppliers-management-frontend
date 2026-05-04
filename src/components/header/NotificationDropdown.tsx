import { Bell } from "lucide-react";

export default function NotificationDropdown() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#bfd4ee] hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-[#2d4f7a]"
    >
      <Bell size={18} />
      <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900" />
    </button>
  );
}
