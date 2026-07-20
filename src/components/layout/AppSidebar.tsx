import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  GitBranchPlus,
  PanelLeft,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { useSidebar } from "../../context/SidebarContext";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import supplierAPI from "../../services/supplierOnboardingAPI";
import { ThemeToggleButton } from "../common/ThemeToggleButton";
import UserDropdown from "../header/UserDropdown";
import logoAvocarbonWide from "../../assets/logo/logo-avocarbon.png";

const APPROVER_ROLES = ["purchasing_manager", "vp_conversion", "purchasing_director", "supplier_owner"];

type SubItem = {
  name: string;
  path: string;
};

type NavItem = {
  name: string;
  label: string;
  icon: LucideIcon;
  subItems: SubItem[];
};

const PRIMARY_NAV: NavItem[] = [
  {
    name: "Supplier Lifecycle",
    label: "Lifecycle",
    icon: GitBranchPlus,
    subItems: [
      { name: "New Supplier Master", path: "/suppliers/onboarding" },
      { name: "Group Management (SB9)", path: "/suppliers/manage" },
    ],
  },
  {
    name: "Suppliers",
    label: "Portfolio",
    icon: Building2,
    subItems: [
      { name: "Supplier Panel (SB1)", path: "/suppliers" },
      { name: "Supplier Monitoring", path: "/suppliers/monitoring" },
      {
        name: "Development Plans (SB22)",
        path: "/suppliers/development-plans",
      },
      // { name: "src/pages/CertificationsTrackingPage.tsxon Footprint (SB8)", path: "/suppliers/carbon-footprint" },
      // { name: "Directory Admin", path: "/suppliers/directory-admin" },
    ],
  },
  {
    name: "Evaluations",
    label: "Evaluations",
    icon: ClipboardList,
    subItems: [
      { name: "Certifications Tracker", path: "/suppliers/certifications" },
      {
        name: "Criteria Validity Tracker",
        path: "/suppliers/documents-validity",
      },
      { name: "Evaluation Scorecards", path: "/evaluations" },
    ],
  },
  {
    name: "Purchasing Value",
    label: "Value Mgmt",
    icon: TrendingUp,
    subItems: [
      { name: "Opportunities", path: "/purchasing-value" },
      { name: "Monthly Follow-up", path: "/purchasing-value/monthly" },
      { name: "Budgeting", path: "/purchasing-value/budgeting" },
      { name: "Recovery Plans", path: "/purchasing-value/recovery" },
      { name: "KPIs", path: "/purchasing-value/kpis" },
      { name: "Action Plans", path: "/purchasing-value/action-plans" },
    ],
  },
  // {
  //   name: "Access Management",
  //   label: "Security",
  //   icon: KeyRound,
  //   subItems: [{ name: "Access Identities", path: "/access-management" }],
  // },
];

function isPathActive(pathname: string, path: string) {
  if (path === "/suppliers") return pathname === "/suppliers";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function SidebarButton({
  children,
  title,
  onClick,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.06] text-white/65 transition hover:bg-white/[0.12] hover:text-white",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function AdminNavLink({
  to,
  icon,
  label,
  sublabel,
  badge = 0,
  open,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  badge?: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={!open ? label : undefined}
      className={({ isActive }) =>
        [
          "group relative flex w-full items-center gap-2.5 rounded-[16px] border px-2.5 py-2.5 transition-all duration-200",
          open ? "" : "justify-center",
          isActive
            ? "border-white/[0.2] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.11))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_24px_rgba(0,0,0,0.22)]"
            : "border-transparent text-white/92 hover:border-white/[0.14] hover:bg-white/[0.09] hover:text-white",
        ].join(" ")
      }
    >
      <span
        className={[
          "relative grid shrink-0 place-items-center rounded-xl bg-white/[0.08] text-white/90 transition-all duration-200 group-hover:bg-white/[0.12] group-hover:text-white",
          open ? "h-8 w-8" : "h-9 w-9",
        ].join(" ")}
      >
        {icon}
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-[#0f1c2e]">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>

      {open && (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-bold tracking-[-0.01em] text-white">
              {label}
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-white/72">
              {sublabel}
            </span>
          </span>
          {badge > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </span>
      )}
    </NavLink>
  );
}

export default function AppSidebar() {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const {
    isExpanded,
    isMobileOpen,
    isHovered,
    setIsHovered,
    toggleSidebar,
    toggleMobileSidebar,
  } = useSidebar();

  const { user } = useAuth();
  useNotifications();
  const isApprover = APPROVER_ROLES.includes(user?.access_profile ?? "");
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  useEffect(() => {
    if (!isApprover) return;
    let cancelled = false;
    const fetch = () =>
      supplierAPI
        .listAccountRequests("pending")
        .then((res) => {
          if (!cancelled) setPendingRequestCount(res.data.count ?? res.data.items.length);
        })
        .catch(() => {});
    fetch();
    const id = setInterval(fetch, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isApprover]);

  const open = isExpanded || isHovered || isMobileOpen;
  const accentColor = "#93c5fd";
  const visibleNav = PRIMARY_NAV;

  useEffect(() => {
    const parent = visibleNav.find((item) =>
      item.subItems.some((subItem) =>
        isPathActive(location.pathname, subItem.path),
      ),
    );

    if (parent) {
      setExpandedGroups((current) => ({ ...current, [parent.name]: true }));
    }
  }, [location.pathname, visibleNav]);

  const closeMobile = () => {
    if (isMobileOpen) toggleMobileSidebar();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={[
          "fixed inset-0 z-40 bg-slate-950/65 backdrop-blur-sm transition-all duration-300 lg:hidden",
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={toggleMobileSidebar}
      />

      <aside
        className={[
          "fixed left-0 top-0 z-[60] flex h-screen flex-col border-r border-white/10 bg-gradient-to-b from-slate-900 via-slate-800 to-blue-900 text-white shadow-sm transition-[width,transform] duration-300 ease-in-out",
          open ? "w-[260px]" : "w-[72px]",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
        onMouseEnter={() => !isExpanded && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-44 opacity-45"
          style={{
            background: `radial-gradient(circle at top, rgba(255,255,255,0.2) 0%, transparent 45%), radial-gradient(circle at top right, ${accentColor}40 0%, transparent 66%)`,
          }}
        />

        <div className="relative flex items-center justify-between border-b border-white/[0.12] px-3 py-4">
          <Link
            to="/"
            onClick={closeMobile}
            className="group flex min-w-0 items-center gap-2.5"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.09] ring-1 ring-white/10 transition-transform group-hover:scale-105">
              <img
                src={logoAvocarbonWide}
                alt="Avocarbon"
                className="h-5 w-5 object-contain"
              />
            </div>

            {open && (
              <div className="min-w-0">
                <p className="mb-0.5 text-[8.5px] font-black uppercase tracking-[0.42em] text-sky-100/60">
                  Avocarbon
                </p>
                <p className="truncate text-sm font-bold tracking-[-0.025em] text-white">
                  Supplier Mgmt
                </p>
              </div>
            )}
          </Link>

          {open && (
            <div className="flex items-center gap-1">
              <SidebarButton
                onClick={toggleSidebar}
                title={isExpanded ? "Collapse" : "Expand"}
                className="hidden lg:inline-flex"
              >
                <PanelLeft size={12} />
              </SidebarButton>

              <SidebarButton
                onClick={toggleMobileSidebar}
                className="lg:hidden"
              >
                <ChevronLeft size={12} />
              </SidebarButton>
            </div>
          )}
        </div>

        <nav className="relative flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className={
              open
                ? "mx-2 mb-3 flex items-center gap-2"
                : "mx-3 my-3 h-px bg-white/[0.12]"
            }
          >
            {open && (
              <>
                <span className="text-[9px] font-black uppercase tracking-[0.32em] text-sky-100/55">
                  Workspace
                </span>
                <span className="h-px flex-1 bg-white/[0.12]" />
              </>
            )}
          </div>

          <div className="space-y-1.5">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive = item.subItems.some((subItem) =>
                isPathActive(location.pathname, subItem.path),
              );
              const expanded = expandedGroups[item.name] ?? false;

              return (
                <div key={item.name} className="space-y-1">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    title={!open ? item.name : undefined}
                    onClick={() =>
                      setExpandedGroups((current) => ({
                        ...current,
                        [item.name]: !expanded,
                      }))
                    }
                    className={[
                      "group relative flex w-full items-center gap-2.5 rounded-[16px] border px-2.5 py-2.5 text-left transition-all duration-200",
                      open ? "" : "justify-center",
                      isActive || expanded
                        ? "border-white/[0.2] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.11))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_24px_rgba(0,0,0,0.22)]"
                        : "border-transparent text-white/92 hover:border-white/[0.14] hover:bg-white/[0.09] hover:text-white",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "grid shrink-0 place-items-center rounded-xl transition-all duration-200",
                        open ? "h-8 w-8" : "h-9 w-9",
                        isActive || expanded
                          ? "bg-white/[0.15] text-white"
                          : "bg-white/[0.08] text-white/90 group-hover:bg-white/[0.12] group-hover:text-white",
                      ].join(" ")}
                    >
                      <Icon size={15} />
                    </span>

                    {open && (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-bold tracking-[-0.01em] text-white">
                            {item.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-white/72">
                            {item.label}
                          </span>
                        </span>

                        <ChevronDown
                          size={12}
                          className={[
                            "shrink-0 text-white/72 transition-transform duration-200",
                            expanded ? "rotate-180 text-white" : "",
                          ].join(" ")}
                        />
                      </>
                    )}
                  </button>

                  {open && expanded && (
                    <div className="ml-[44px] space-y-1 border-l border-white/[0.12] py-1 pl-3">
                      {item.subItems.map((subItem) => {
                        const subActive = isPathActive(
                          location.pathname,
                          subItem.path,
                        );

                        return (
                          <NavLink
                            key={subItem.path}
                            to={subItem.path}
                            onClick={closeMobile}
                            className={[
                              "flex items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-semibold tracking-[-0.01em] transition-all duration-150",
                              subActive
                                ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                                : "text-white/86 hover:bg-white/[0.08] hover:text-white",
                            ].join(" ")}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: subActive
                                  ? accentColor
                                  : "rgba(186,230,253,0.72)",
                              }}
                            />
                            <span className="truncate">{subItem.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Administration — approvers only */}
          {isApprover && (
            <>
              <div
                className={
                  open
                    ? "mx-2 mb-3 mt-4 flex items-center gap-2"
                    : "mx-3 my-3 h-px bg-white/[0.12]"
                }
              >
                {open && (
                  <>
                    <span className="text-[9px] font-black uppercase tracking-[0.32em] text-sky-100/55">
                      Administration
                    </span>
                    <span className="h-px flex-1 bg-white/[0.12]" />
                  </>
                )}
              </div>

              {user?.access_profile === "vp_conversion" && (
                <AdminNavLink
                  to="/account-requests"
                  icon={<ShieldCheck size={15} />}
                  label="Account Requests"
                  sublabel="Approvals"
                  badge={pendingRequestCount}
                  open={open}
                  onClick={closeMobile}
                />
              )}

              <AdminNavLink
                to="/relation-review"
                icon={<ShieldAlert size={15} />}
                label="Relation Review"
                sublabel="Pending approvals"
                open={open}
                onClick={closeMobile}
              />
            </>
          )}
        </nav>

        <div className="relative shrink-0 border-t border-white/[0.12] p-2.5">
          {open ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] px-3 py-2 min-w-0">
              <div className="min-w-0 flex-1 overflow-hidden">
                <UserDropdown />
              </div>
              <ThemeToggleButton compact />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <UserDropdown />
              <ThemeToggleButton compact />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
