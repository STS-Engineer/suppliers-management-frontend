import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useSidebar } from "../../context/SidebarContext";
import { ThemeToggleButton } from "../common/ThemeToggleButton";
import UserDropdown from "../header/UserDropdown";
// import NotificationDropdown from "../header/NotificationDropdown";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/suppliers": "Suppliers",
  //   "/onboarding": "Onboarding",
  "/evaluations": "Evaluations",
  "/panel": "Panel Review",
  "/reports": "Reports",
};

const pageSummaries: Record<string, string> = {
  "/dashboard":
    "Monitor supplier health, pending actions, and review momentum across the network.",
  "/suppliers":
    "Review supplier records, classifications, and portfolio exposure from one place.",
  //   "/onboarding":
  //     "Coordinate qualification steps, ownership, and document readiness without losing context.",
  "/evaluations":
    "Track scorecards, risk signals, and follow-up actions in a focused review flow.",
};

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const location = useLocation();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  const pageTitle = pageTitles[location.pathname] ?? "Workspace";
  const pageSummary =
    pageSummaries[location.pathname] ??
    "Manage supplier operations, governance, and reporting from a unified workspace.";

  return (
    <header className="sticky top-0 z-50 h-auto w-full border-b border-white/10 bg-[linear-gradient(135deg,#0f2744_0%,#14365f_55%,#1c4a7d_100%)] shadow-[0_18px_40px_rgba(15,39,68,0.22)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[100px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-start gap-5">
          <button
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
            className="mt-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/14"
          >
            {isMobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.22 7.28a1 1 0 011.42-1.41L12 10.59l4.36-4.72a1 1 0 011.42 1.41L13.06 12l4.72 4.72a1 1 0 01-1.42 1.41L12 13.41l-4.36 4.72a1 1 0 01-1.42-1.41L10.94 12 6.22 7.28z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M0.583 1C0.583.586.919.25 1.333.25H14.667c.414 0 .75.336.75.75s-.336.75-.75.75H1.333C.919 1.75.583 1.414.583 1zm0 10c0-.414.336-.75.75-.75h13.334c.414 0 .75.336.75.75s-.336.75-.75.75H1.333c-.414 0-.75-.336-.75-.75zM1.333 5.25c-.414 0-.75.336-.75.75s.336.75.75.75H8c.414 0 .75-.336.75-.75s-.336-.75-.75-.75H1.333z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>

          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-[-0.02em] text-white sm:text-4xl">
              {pageTitle}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100/80 line-clamp-2">
              {pageSummary}
            </p>
          </div>
        </div>

        <div
          className={`${
            isApplicationMenuOpen ? "flex" : "hidden"
          } flex-col items-stretch gap-3 rounded-[28px] border border-white/10 bg-white/10 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur lg:flex lg:flex-row lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          <ThemeToggleButton />
          {/* <NotificationDropdown /> */}
          <UserDropdown />
        </div>

        <button
          onClick={toggleApplicationMenu}
          aria-label="Open quick actions"
          className="flex h-12 w-12 items-center justify-center self-start rounded-2xl border border-white/15 bg-white/10 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] lg:hidden"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
