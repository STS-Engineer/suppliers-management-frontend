import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useSidebar } from "../../context/SidebarContext";
import { ThemeToggleButton } from "../common/ThemeToggleButton";
import UserDropdown from "../header/UserDropdown";

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-white/10 bg-[#0f2744] px-4 shadow-[0_4px_16px_rgba(15,39,68,0.18)] sm:px-6">
      {/* Sidebar toggle */}
      <button
        onClick={handleToggle}
        aria-label="Toggle Sidebar"
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
      >
        {isMobileOpen ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M6.22 7.28a1 1 0 011.42-1.41L12 10.59l4.36-4.72a1 1 0 011.42 1.41L13.06 12l4.72 4.72a1 1 0 01-1.42 1.41L12 13.41l-4.36 4.72a1 1 0 01-1.42-1.41L10.94 12 6.22 7.28z"
              fill="currentColor"
            />
          </svg>
        ) : (
          <svg width="14" height="10" viewBox="0 0 16 12" fill="none">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M0.583 1C0.583.586.919.25 1.333.25H14.667c.414 0 .75.336.75.75s-.336.75-.75.75H1.333C.919 1.75.583 1.414.583 1zm0 10c0-.414.336-.75.75-.75h13.334c.414 0 .75.336.75.75s-.336.75-.75.75H1.333c-.414 0-.75-.336-.75-.75zM1.333 5.25c-.414 0-.75.336-.75.75s.336.75.75.75H8c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H1.333z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>

      {/* Right controls */}
      <div
        className={`${
          isApplicationMenuOpen ? "flex" : "hidden"
        } items-center gap-2 lg:flex`}
      >
        <ThemeToggleButton />
        <UserDropdown />
      </div>

      <button
        onClick={() => setApplicationMenuOpen(!isApplicationMenuOpen)}
        aria-label="Open quick actions"
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white lg:hidden"
      >
        <MoreHorizontal size={16} />
      </button>
    </header>
  );
};

export default AppHeader;
