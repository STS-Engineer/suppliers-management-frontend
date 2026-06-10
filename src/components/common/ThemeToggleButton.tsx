import { useTheme } from "../../context/ThemeContext";

export const ThemeToggleButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={
        compact
          ? "flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.06] text-white/60 transition hover:bg-white/[0.12] hover:text-white"
          : "flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-[#bfd4ee] hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-[#2d4f7a]"
      }
    >
      {theme === "dark" ? (
        <svg width={compact ? 16 : 20} height={compact ? 16 : 20} viewBox="0 0 20 20" fill="none">
          <path
            d="M10 4.25V2.5M10 17.5V15.75M15.75 10H17.5M2.5 10H4.25M14.065 5.935L15.305 4.695M4.695 15.305L5.935 14.065M14.065 14.065L15.305 15.305M4.695 4.695L5.935 5.935M13.25 10A3.25 3.25 0 1 1 6.75 10A3.25 3.25 0 0 1 13.25 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width={compact ? 16 : 20} height={compact ? 16 : 20} viewBox="0 0 20 20" fill="none">
          <path
            d="M16.042 11.17A6.667 6.667 0 1 1 8.83 3.958A5.417 5.417 0 1 0 16.042 11.17Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
};
