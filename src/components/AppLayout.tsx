import type { ReactNode } from "react";
import { ChevronRight, Menu } from "lucide-react";
import { type Location, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import AppSidebar from "./layout/AppSidebar";

// ── Route breadcrumb registry ────────────────────────────────────────────────

type Crumb = { section: string; page: string };

const CRUMBS: Record<string, Crumb> = {
  "/dashboard": { section: "Overview", page: "Dashboard" },
  "/suppliers": { section: "Portfolio", page: "Supplier Panel" },
  // "/suppliers/sites-active":           { section: "Portfolio",          page: "Active Sites" },
  "/suppliers/development-plans": {
    section: "Lifecycle",
    page: "Development Plans",
  },
  "/suppliers/onboarding": {
    section: "Lifecycle",
    page: "New Supplier Master",
  },
  "/suppliers/manage": { section: "Lifecycle", page: "Group Management" },
  "/evaluations": { section: "Evaluations", page: "Evaluation Dashboard" },
  "/purchasing-value": { section: "Value Management", page: "Opportunities" },
  "/purchasing-value/recovery": { section: "Value Management", page: "Recovery Plans" },
  // "/purchasing-value/kpis":         { section: "Value Management",   page: "KPI Dashboard" },
};

function resolveCrumb(pathname: string): Crumb {
  if (
    pathname.startsWith("/supplier-relations/") &&
    pathname.endsWith("/evaluation")
  ) {
    return { section: "Evaluations", page: "Relation Scorecard" };
  }
  if (pathname.startsWith("/suppliers/") && pathname.includes("/manage")) {
    return { section: "Lifecycle", page: "Group Management" };
  }
  return CRUMBS[pathname] ?? { section: "Avocarbon SM", page: "Workspace" };
}

// ── Layout ───────────────────────────────────────────────────────────────────

export function AppLayout({
  children,
  routeLocation,
}: {
  children: ReactNode;
  routeLocation?: Location;
}) {
  const { isExpanded, isHovered, isMobileOpen, toggleMobileSidebar } =
    useSidebar();
  const location = useLocation();
  const effectiveLocation = routeLocation ?? location;
  const sidebarExpanded = isExpanded || isHovered || isMobileOpen;
  const crumb = resolveCrumb(effectiveLocation.pathname);

  return (
    <div className="relative h-screen overflow-hidden bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <AppSidebar />

      <main
        className={[
          "flex h-full flex-col min-w-0 transition-[padding] duration-300 ease-in-out",
          sidebarExpanded ? "lg:pl-[260px]" : "lg:pl-[72px]",
        ].join(" ")}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="relative z-10 flex h-11 shrink-0 items-center border-b border-white/[0.07] bg-[#0b1f38] px-4 sm:px-6">
          {/* Subtle inner highlight on top edge */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.08]" />

          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={toggleMobileSidebar}
            className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.06] text-white/60 transition hover:bg-white/[0.12] hover:text-white lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-3.5 w-3.5" />
          </button>

          {/* Breadcrumb */}
          <nav
            className="flex min-w-0 items-center gap-1.5"
            aria-label="Breadcrumb"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
              {crumb.section}
            </span>
            <ChevronRight className="h-3 w-3 flex-shrink-0 text-white/20" />
            <span className="truncate text-[12.5px] font-semibold text-white/75">
              {crumb.page}
            </span>
          </nav>

          {/* Right spacer — reserved for future controls */}
          <div className="ml-auto" />
        </header>

        {/* ── Page content ─────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 sm:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
