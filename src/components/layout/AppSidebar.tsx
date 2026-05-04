import { Link, NavLink } from "react-router-dom";
import {
  Blocks,
  Factory,
  LayoutDashboard,
  ShieldCheck,
  FolderKanban,
} from "lucide-react";
import { useSidebar } from "../../context/SidebarContext";
import logoAvocarbonWide from "../../assets/logo/logo-avocarbon.png";

type NavItem = {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  highlight?: string;
};

const navItems: NavItem[] = [
  //   {
  //     name: "Dashboard",
  //     icon: LayoutDashboard,
  //     path: "/dashboard",
  //     highlight: "Overview",
  //   },
  {
    name: "Suppliers",
    icon: Factory,
    path: "/suppliers",
    highlight: "Portfolio",
  },
  //   {
  //     name: "Onboarding",
  //     icon: Workflow,
  //     path: "/onboarding",
  //     highlight: "Intake",
  //   },
  // {
  //   name: "Evaluations",
  //   icon: ShieldCheck,
  //   path: "/evaluations",
  //   highlight: "Scorecards",
  // },

  //   {
  //     name: "Reports",
  //     icon: BarChart2,
  //     path: "/reports",
  //     highlight: "Insights",
  //   },
];

const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    setIsHovered,
    toggleMobileSidebar,
  } = useSidebar();

  const sidebarExpanded = isExpanded || isHovered || isMobileOpen;

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={`fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm transition duration-300 lg:hidden ${
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={toggleMobileSidebar}
      />

      <aside
        className={`
        fixed top-0 left-0 flex flex-col
        mt-[60px] lg:mt-0
        h-screen
        bg-gradient-to-b from-[#10649b] via-[#0c5381] to-[#094065]
        bg-gradient-to-b from-[#063452] via-[#073655] to-[#052941]
        border-r border-[#1e4ed8]
        transition-all duration-300 ease-in-out
        z-[60] shadow-[2px_0_22px_0_rgba(6,25,100,0.35)]
        ${isExpanded || isMobileOpen ? "w-[272px]" : isHovered ? "w-[272px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
      `}
        onMouseEnter={() => !isExpanded && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10 backdrop-blur">
              <img
                src={logoAvocarbonWide}
                alt="Avocarbon"
                className="h-7 w-7 object-contain"
              />
            </div>
            {sidebarExpanded && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-[0.2em] text-white/55">
                  AVOCARBON
                </p>
                <p className="truncate text-base font-semibold text-white">
                  Supplier Management
                </p>
              </div>
            )}
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <div
            className={`mb-4 ${sidebarExpanded ? "px-2" : "flex justify-center"}`}
          >
            {sidebarExpanded ? (
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8fb6dd]">
                Navigation
              </span>
            ) : (
              <Blocks className="h-4 w-4 text-[#8fb6dd]" />
            )}
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-200 ${
                      isActive
                        ? "border-white/30 bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_32px_rgba(8,15,25,0.24)]"
                        : "border-transparent text-[#c3daf4] hover:border-white/10 hover:bg-white/8 hover:text-white"
                    } ${sidebarExpanded ? "" : "justify-center"}`
                  }
                  title={!sidebarExpanded ? item.name : undefined}
                  onClick={() => {
                    if (isMobileOpen) {
                      toggleMobileSidebar();
                    }
                  }}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          isActive
                            ? "bg-white text-[#12345c]"
                            : "bg-white/8 text-[#a8c8e8] group-hover:bg-white/12 group-hover:text-white"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>

                      {sidebarExpanded && (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-semibold">
                              {item.name}
                            </span>
                            <span className="block truncate text-xs text-white/55">
                              {item.highlight}
                            </span>
                          </span>

                          {isActive && (
                            <span className="h-8 w-[3px] rounded-full bg-[#f6c453]" />
                          )}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 p-3">
          <div
            className={`rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur ${
              sidebarExpanded ? "block" : "hidden"
            }`}
          >
            <div className="mb-3 flex items-center gap-2 text-white">
              <FolderKanban className="h-4 w-4 text-[#8ed6ff]" />
              <span className="text-sm font-semibold">Operations Brief</span>
            </div>
            <p className="text-xs leading-5 text-[#aac6e5]">
              Supplier panel, governance activity, and tracking performance in
              one consolidated navigation space.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
