import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { NavLink, useLocation, type Location } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import AppSidebar from "./layout/AppSidebar";
import { ThemeToggleButton } from "./common/ThemeToggleButton";
import UserDropdown from "./header/UserDropdown";

type RouteMeta = {
  eyebrow: string;
  title: string;
  summary: string;
};

const routeMeta: Record<string, RouteMeta> = {
  "/dashboard": {
    eyebrow: "Overview",
    title: "Dashboard",
    summary:
      "Network health, performance snapshots, and operational attention areas.",
  },
  "/suppliers": {
    eyebrow: "Panel",
    title: "Suppliers",
    summary:
      "Browse grouped suppliers, compare records, and drill into detailed panels.",
  },
  "/suppliers/sites-active": {
    eyebrow: "Panel",
    title: "Active Sites",
    summary: "Track active site relations, statuses, and latest scores.",
  },
  "/suppliers/onboarding": {
    eyebrow: "Phase 1",
    title: "New Supplier Master",
    summary:
      "Create a supplier group, first unit, contacts, and certifications.",
  },
  "/suppliers/manage": {
    eyebrow: "Phase 2",
    title: "Existing Group Management",
    summary:
      "Find an existing supplier group, add units, and continue assignment.",
  },
  // "/access-management": {
  //   eyebrow: "Security",
  //   title: "Access Management",
  //   summary:
  //     "Provision application identities, manage account status, and maintain password access.",
  // },
  "/data-collection": {
    eyebrow: "Data",
    title: "Data Collection Center",
    summary: "Upload, register, and manage incoming supplier data packages.",
  },
  "/data-quality": {
    eyebrow: "Quality",
    title: "Data Quality Center",
    summary:
      "Validate, flag, and resolve data quality issues across submissions.",
  },
  "/plant-review": {
    eyebrow: "Review",
    title: "Plant Review Checklist",
    summary:
      "Step through structured plant-level review and sign-off checklist.",
  },
  "/supplier-kpis": {
    eyebrow: "Analytics",
    title: "Supplier KPI Dashboard",
    summary:
      "Track supplier KPIs with trend lines, benchmarks, and period comparisons.",
  },
};

const headerNavItems = [
  { label: "Suppliers", path: "/suppliers" },
  { label: "Active Sites", path: "/suppliers/sites-active" },
  { label: "Onboarding", path: "/suppliers/onboarding" },
  { label: "Group Mgmt", path: "/suppliers/manage" },
];

function isRouteActive(pathname: string, path: string) {
  if (path === "/suppliers") return pathname === "/suppliers";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function resolveMeta(pathname: string): RouteMeta {
  if (
    pathname.startsWith("/supplier-relations/") &&
    pathname.endsWith("/evaluation")
  ) {
    return {
      eyebrow: "Scorecard",
      title: "Relation Evaluation",
      summary:
        "Review and update the qualification scorecard for this supplier relation.",
    };
  }

  return routeMeta[pathname] ?? routeMeta["/suppliers"];
}

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
  const meta = resolveMeta(effectiveLocation.pathname);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,#f8fbff_0,#e8f0f8_34%,#dce8f4_100%)] text-slate-900 antialiased dark:bg-[radial-gradient(circle_at_top_left,#13243a_0,#07111a_46%,#050b12_100%)] dark:text-slate-100">
      <AppSidebar />

      <main
        className={[
          "min-w-0 min-h-screen transition-[padding] duration-300 ease-in-out",
          sidebarExpanded ? "lg:pl-[260px]" : "lg:pl-[72px]",
        ].join(" ")}
      >
        <div className="flex min-h-screen flex-col p-1.5 sm:p-3">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/55 shadow-[0_28px_90px_rgba(15,30,55,0.12)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-slate-950/35 dark:shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
            <header className="shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5 lg:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={toggleMobileSidebar}
                    className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
                    aria-label="Open navigation"
                  >
                    <Menu className="h-5 w-5" />
                  </button>

                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.32em] text-[#6a87a3] dark:text-slate-500">
                      {meta.eyebrow}
                    </p>
                    <h1 className="mt-1 truncate text-2xl font-bold tracking-[-0.035em] text-[#0f2237] dark:text-white sm:text-3xl">
                      {meta.title}
                    </h1>
                    <p className="mt-1 max-w-4xl text-sm leading-5 text-[#5f7893] dark:text-slate-400">
                      {meta.summary}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <ThemeToggleButton />
                  <UserDropdown />
                </div>
              </div>

              {/* <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <nav className="flex min-w-max items-center gap-2">
                  {headerNavItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={() =>
                        [
                          "inline-flex items-center rounded-xl border px-3.5 py-2 text-xs font-bold transition-all",
                          isRouteActive(effectiveLocation.pathname, item.path)
                            ? "border-[#0c5381] bg-[#0c5381] text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-[#0c5381]",
                          "dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]",
                        ].join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              </div> */}
            </header>

            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4 lg:p-5">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
