export default function UserDropdown() {
  return (
    <button
      type="button"
      aria-label="User menu"
      className="flex items-center gap-3 rounded-2xl border border-white/55 bg-white/80 px-3 py-2 text-left text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#bfd4ee] dark:border-white/10 dark:bg-slate-900/70 dark:text-white"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f2744] via-[#123c68] to-[#1f67a6] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(6,55,112,0.28)]">
        HR
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="block text-sm font-semibold">Hayfa RAJHI</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          Purshasing Manager
        </span>
      </span>
    </button>
  );
}
