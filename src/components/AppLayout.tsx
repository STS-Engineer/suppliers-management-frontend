import type { ReactNode } from "react";
import { Activity } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import AppHeader from "./layout/AppHeader";
import AppSidebar from "./layout/AppSidebar";

const routeMeta: Record<
  string,
  { eyebrow: string; context: string; summary: string; cadence: string }
> = {
  "/dashboard": {
    eyebrow: "Overview",
    context: "Network health and action visibility",
    summary:
      "A concise snapshot of supplier performance, review pressure, and operational attention areas.",
    cadence: "Updated from current workflow activity",
  },
  "/suppliers": {
    eyebrow: "Panel",
    context: "Portfolio mapping and supplier drill-down",
    summary:
      "Browse grouped suppliers, compare records, and move into detailed panels without losing orientation.",
    cadence: "Organized by supplier group and status",
  },
  "/onboarding": {
    eyebrow: "Qualification",
    context: "Structured intake and readiness tracking",
    summary:
      "Guide new suppliers through setup, document collection, scoring, and committee readiness.",
    cadence: "Stage-based review and completion flow",
  },
  "/evaluations": {
    eyebrow: "Evaluation",
    context: "Scoring, calibration, and action tracking",
    summary:
      "Review supplier evaluation results with clearer priorities, outcomes, and next actions.",
    cadence: "Cycle-based scoring and follow-up",
  },
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const location = useLocation();
  const sidebarExpanded = isExpanded || isHovered || isMobileOpen;
  const meta = routeMeta[location.pathname] ?? routeMeta["/dashboard"];

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(47,111,237,0.12),transparent_30%),linear-gradient(180deg,#eef4fa_0%,#e9f0f8_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_right,rgba(45,96,160,0.18),transparent_30%),linear-gradient(180deg,#07111d_0%,#0b1727_100%)] dark:text-white">
      <AppSidebar />

      <main
        className={`min-h-screen transition-all duration-300 ${
          sidebarExpanded ? "lg:pl-[17rem]" : "lg:pl-[4.75rem]"
        }`}
      >
        <AppHeader />
        <section
          className={`py-4 transition-all duration-300 sm:py-6 ${
            sidebarExpanded ? "p-3 sm:p-4" : "p-2.5 sm:p-3"
          }`}
        >
          <div
            className={`mx-auto ${sidebarExpanded ? "max-w-[1680px]" : "max-w-none"}`}
          >
            <div
              className={`relative overflow-hidden rounded-[32px] border border-white/60 bg-white/45 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 dark:border-white/8 dark:bg-slate-950/25 ${
                sidebarExpanded ? "p-2 sm:p-3" : "p-1.5 sm:p-2"
              }`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(84,152,240,0.2),transparent_55%)]" />

              <div
                className={`relative rounded-[28px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.56),rgba(247,250,255,0.78))] shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] transition-all duration-300 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.32),rgba(10,18,30,0.5))] ${
                  sidebarExpanded ? "p-2 sm:p-3" : "p-1.5 sm:p-2"
                }`}
              >
                {children}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
