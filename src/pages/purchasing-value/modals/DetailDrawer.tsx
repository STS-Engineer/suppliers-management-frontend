import { useEffect, useRef, useState } from "react";
import {
  BarChart2,
  CheckCircle2,
  CircleDot,
  Download,
  FileText,
  FolderOpen,
  Layers,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import { useAuth } from "../../../context/AuthContext";
import type { Opp, Tab } from "../types";
import {
  OPPORTUNITY_DELETE_PROFILES,
  PRESET_LABELS,
  PRESET_WIDTHS,
  STATUS_COLORS,
  TYPE_COLORS,
} from "../constants";
import { pldColor } from "../utils";
import { OverviewTab } from "../tabs/OverviewTab";
import { EditTab } from "../tabs/EditTab";
import { GateTab } from "../tabs/GateTab";
import { FinancialTab } from "../tabs/FinancialTab";
import { FilesTab } from "../tabs/FilesTab";
import { ActionPlanTab } from "../tabs/ActionPlanTab";
import { ProjectTab } from "../tabs/ProjectTab";
import { StpDownloadButton } from "../components/StpDownloadButton";
import { FullReportDownloadButton } from "../components/FullReportDownloadButton";
import { DeleteOpportunityModal } from "./DeleteOpportunityModal";

export function DetailDrawer({
  opp,
  onClose,
  onRefresh,
  onDeleted,
  userEmail,
}: {
  opp: Opp;
  onClose: () => void;
  onRefresh: (o: Opp) => void;
  onDeleted: (opportunityId: number) => void;
  userEmail: string;
}) {
  const { user } = useAuth();
  const canDelete = OPPORTUNITY_DELETE_PROFILES.includes(
    user?.access_profile ?? "",
  );
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await supplierAPI.deleteOpportunity(opp.opportunity_id);
      setConfirmOpen(false);
      onDeleted(opp.opportunity_id);
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Failed to delete opportunity.",
      );
    } finally {
      setDeleting(false);
    }
  }
  const defaultTab = (o: Opp): Tab => {
    const ps = o.phase_status ?? "";
    const st = o.status ?? "";
    if (st === "Assigned") return "edit";
    if (ps === "Phase 0" && ["Working on it", "Needs Rework"].includes(st))
      return "edit";
    if (st === "Awaiting Validation" || st === "Under Committee Review")
      return "gate";
    if (ps === "Phase 1") return "project";
    if (["Phase 2", "Phase 3", "Phase 4"].includes(ps)) return "financial";
    if (ps === "Closed") return "overview";
    return "overview";
  };
  const [tab, setTab] = useState<Tab>(() => defaultTab(opp));
  const [drawerWidth, setDrawerWidth] = useState(720);
  const typeClass =
    TYPE_COLORS[opp.opportunity_type ?? ""] ??
    "bg-slate-100 text-slate-600 border-slate-200";
  const showStpTab = ["Sourcing", "Technical Productivity"].includes(
    opp.opportunity_type ?? "",
  );
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = drawerWidth;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      setDrawerWidth(
        Math.min(Math.max(startW.current + delta, 380), window.innerWidth - 60),
      );
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const docCount = opp.opp_documents?.length ?? 0;
  const missingFinancialMonths = (() => {
    const line = opp.financial_lines?.[0];
    if (!line?.monthly_financials?.length) return 0;
    const todayFirst = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    return line.monthly_financials.filter((r) => {
      if (!r.period_month) return false;
      return new Date(r.period_month) < todayFirst && r.actual_saving == null;
    }).length;
  })();
  const TABS: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { id: "overview", label: "Overview", icon: <Layers size={11} /> },
    // One editing tab — labelled "STP Study" for Sourcing/Tech-Productivity
    // (general + STP in one form), "Edit" for Negotiation/Cash (general only).
    {
      id: "edit",
      label: showStpTab ? "STP Study" : "Edit",
      icon: <FileText size={11} />,
    },
    { id: "gate", label: "Gate", icon: <CheckCircle2 size={11} /> },
    { id: "project", label: "Project", icon: <FolderOpen size={11} /> },
    {
      id: "financial",
      label: "Financial",
      icon: <BarChart2 size={11} />,
      badge: missingFinancialMonths || undefined,
    },
    {
      id: "files",
      label: `Files${docCount ? ` (${docCount})` : ""}`,
      icon: <Paperclip size={11} />,
    },
    { id: "action-plan", label: "Action Plan", icon: <CircleDot size={11} /> },
  ];

  const editDisabled = false; // always editable — phase note shown inside the form
  const gateDisabled = opp.phase_status === "Closed";
  const tabDisabled = (id: Tab) => id === "gate" && gateDisabled;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex flex-col bg-white shadow-2xl dark:bg-[#0f1e30]"
        style={{ width: drawerWidth }}
      >
        {/* Drag handle — left edge */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-transparent hover:bg-blue-400/30 transition-colors z-20"
          title="Drag to resize"
        />
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4 dark:border-white/[0.07] dark:from-[#0f1e30] dark:to-[#101f35]">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              #{opp.opportunity_id}
            </p>
            <h2 className="mt-0.5 max-w-md truncate text-base font-bold text-slate-800 dark:text-slate-100">
              {opp.opportunity_name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${typeClass}`}
              >
                {opp.opportunity_type}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[opp.status ?? ""] ?? "bg-slate-100 text-slate-600"}`}
              >
                {opp.status}
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600">
                {opp.phase_status}
              </span>
              {opp.validation_status === "Budgeted" && (
                <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold text-violet-600">
                  Validated
                </span>
              )}
              {opp.priority_category && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pldColor(opp.priority_category)}`}
                >
                  {opp.priority_category} priority
                </span>
              )}
            </div>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-1">
            {/* Download STP — only for Sourcing / Technical Productivity */}
            {["Sourcing", "Technical Productivity"].includes(
              opp.opportunity_type ?? "",
            ) && (
              <div className="flex gap-1 mr-2">
                {([0, 1] as const).map((ph) => (
                  <StpDownloadButton
                    key={ph}
                    opportunityId={opp.opportunity_id}
                    oppName={opp.opportunity_name}
                    phase={ph}
                  />
                ))}
              </div>
            )}
            {/* Full Opportunity Report — any type, any phase */}
            <div className="mr-2">
              <FullReportDownloadButton
                opportunityId={opp.opportunity_id}
                oppName={opp.opportunity_name}
              />
            </div>
            {/* Width presets */}
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 mr-1">
              {PRESET_WIDTHS.map((w, i) => (
                <button
                  key={w}
                  onClick={() => setDrawerWidth(w)}
                  title={`${w}px`}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors ${drawerWidth === w ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-700"}`}
                >
                  {PRESET_LABELS[i]}
                </button>
              ))}
            </div>
            {canDelete && (
              <button
                onClick={() => {
                  setDeleteError(null);
                  setConfirmOpen(true);
                }}
                disabled={deleting}
                title="Delete opportunity"
                className="mr-1 rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-slate-100 bg-white px-4 pt-2">
          {TABS.map((t) => {
            const disabled = tabDisabled(t.id);
            return (
              <button
                key={t.id}
                disabled={disabled}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11.5px] font-semibold border-b-2 -mb-px transition-colors ${tab === t.id ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"} disabled:opacity-35 disabled:cursor-not-allowed`}
              >
                {t.icon}
                {t.label}
                {t.badge ? (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "overview" && <OverviewTab opp={opp} onRefresh={onRefresh} />}
          {tab === "edit" && (
            <EditTab
              key={`edit-${opp.opportunity_id}-${opp.updated_at ?? ""}-${opp.budget_year ?? ""}-${opp.change_mode ?? ""}`}
              opp={opp}
              userEmail={userEmail}
              onRefresh={onRefresh}
            />
          )}
          {tab === "gate" && (
            <GateTab
              opp={opp}
              userEmail={userEmail}
              onRefresh={onRefresh}
              onNavigate={setTab}
            />
          )}
          {tab === "financial" && (
            <FinancialTab
              key={`financial-${opp.opportunity_id}-${opp.updated_at ?? ""}-${opp.real_start_date ?? ""}`}
              opp={opp}
              userEmail={userEmail}
              onRefresh={onRefresh}
            />
          )}
          {tab === "project" && (
            <ProjectTab opp={opp} userEmail={userEmail} onRefresh={onRefresh} />
          )}
          {tab === "files" && (
            <FilesTab opp={opp} userEmail={userEmail} onRefresh={onRefresh} />
          )}
          {tab === "action-plan" && (
            <ActionPlanTab
              opp={opp}
              userEmail={userEmail}
              onRefresh={onRefresh}
            />
          )}
        </div>
      </div>
      {confirmOpen && (
        <DeleteOpportunityModal
          oppName={opp.opportunity_name ?? `#${opp.opportunity_id}`}
          loading={deleting}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------
