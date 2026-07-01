import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  Award,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ExternalLink,
  Eye,
  Factory,
  Filter,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { Pagination } from "../components/common/Pagination";
import {
  InlineAlert,
  KeyValueRow,
  PageIntro,
  Pill,
  SectionCard,
} from "../components/UI";
import supplierAPI from "../services/supplierOnboardingAPI";
import type {
  AvocarbonSite,
  RelationEvaluationWorkspace,
  SitePanelBundle,
  SupplierDevelopmentPlan,
  SupplierGroupSummary,
  SupplierSiteRelation,
  SupplierUnitResponse,
} from "../types/onboarding";

type RelationRecord = {
  site: AvocarbonSite;
  unit: SupplierUnitResponse;
  group: SupplierGroupSummary;
  relation: SupplierSiteRelation;
  workspace: RelationEvaluationWorkspace | null;
  siteName: string;
  finalGrade: string | null;
  currentStatus: string | null;
  panelDecision: string | null;
  isArchived: boolean;
};

const PAGE_SIZE = 8;
const BRAND_DARK = "bg-[#062B49]";
const BRAND_DARK_HOVER = "hover:bg-[#0C5381]";

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const PANEL_DECISION_LABELS: Record<string, string> = {
  panel_add: "Can be added to panel",
  panel_add_exec_committee: "Needs exec committee agreement",
  panel_add_committee_validated: "Added to panel — Committee validated",
  panel_reject: "Cannot be added to panel",
};

const getPanelDecisionLabel = (value?: string | null) => {
  if (!value) return "Pending";
  return PANEL_DECISION_LABELS[value] || value;
};

const getPanelDecisionTone = (
  value?: string | null,
): "slate" | "green" | "amber" | "red" => {
  if (value === "panel_add") return "green";
  if (value === "panel_add_committee_validated") return "green";
  if (value === "panel_add_exec_committee") return "amber";
  if (value === "panel_reject") return "red";
  return "slate";
};

const getStatusTone = (
  value?: string | null,
): "slate" | "green" | "amber" | "red" => {
  const normalized = normalizeText(value);
  if (!normalized) return "slate";
  if (normalized.includes("not be awarded")) return "amber";
  if (normalized.includes("hold")) return "red";
  if (normalized.includes("can quote and be awarded")) return "green";
  if (normalized.includes("awarded")) return "green";
  return "slate";
};

const getGradeTone = (
  value?: string | null,
): "slate" | "green" | "amber" | "red" | "purple" => {
  const normalized = normalizeText(value);
  if (!normalized) return "slate";
  if (
    normalized.startsWith("a1") ||
    normalized.startsWith("b1") ||
    normalized.startsWith("a2") ||
    normalized.startsWith("b2")
  ) {
    return "green";
  }
  if (
    normalized.startsWith("a3") ||
    normalized.startsWith("b3") ||
    normalized.startsWith("c1") ||
    normalized.startsWith("c2") ||
    normalized.startsWith("c3")
  ) {
    return "amber";
  }
  if (
    normalized.startsWith("a4") ||
    normalized.startsWith("b4") ||
    normalized.startsWith("c4") ||
    normalized.startsWith("d")
  ) {
    return "red";
  }
  return "purple";
};

function Badge({
  text,
  tone = "slate",
}: {
  text: string;
  tone?: "slate" | "blue" | "green" | "amber" | "red" | "purple";
}) {
  const toneMap = {
    slate: "neutral",
    blue: "brand",
    green: "success",
    amber: "warning",
    red: "danger",
    purple: "brand",
  } as const;

  return <Pill text={text} tone={toneMap[tone]} />;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return <KeyValueRow label={label} value={value} />;
}

function StatPill({
  icon,
  value,
  label,
  tone = "slate",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    slate: "text-slate-600 dark:text-slate-300",
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-rose-600 dark:text-rose-400",
    blue: "text-blue-600 dark:text-blue-400",
  }[tone];

  return (
    <div className="flex items-center gap-1.5">
      <span className={`${toneClass} opacity-70`}>{icon}</span>
      <span className={`text-sm font-bold ${toneClass}`}>{value}</span>
      <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-white/[0.06]">
          <thead className="bg-slate-50/90 dark:bg-[#0d1929]">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {headers.map((h) => (
                <th key={h} className="px-5 py-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white dark:divide-white/[0.06] dark:bg-[#111e30]">
            {rows.length > 0 ? (
              rows.map((row, ri) => (
                <tr key={ri} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.035]">
                  {row.map((cell, ci) => (
                    <td
                      key={`${ri}-${ci}`}
                      className="px-5 py-4 align-top text-slate-600 dark:text-slate-300"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-5 py-12 text-center text-sm text-slate-400 dark:text-slate-500"
                >
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SiteCard({
  bundle,
  isSelected,
  onSelect,
}: {
  bundle: SitePanelBundle;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const location = [bundle.site.city, bundle.site.country].filter(Boolean).join(", ");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ${
        isSelected
          ? "border-[#062B49] bg-[#062B49] text-white shadow-lg dark:border-sky-500/60 dark:bg-sky-900/50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-white/[0.08] dark:bg-[#111e30] dark:hover:border-white/[0.16] dark:hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={`truncate font-semibold ${isSelected ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>
            {bundle.site.site_name || "Unnamed site"}
          </div>
          {location && (
            <div className={`mt-0.5 truncate text-xs ${isSelected ? "text-blue-200" : "text-slate-400 dark:text-slate-500"}`}>
              {location}
            </div>
          )}
        </div>
        <span className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold ${
          isSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300"
        }`}>
          {bundle.relation_count}
        </span>
      </div>
    </button>
  );
}

function RelationDetailModal({
  record,
  onClose,
  onOpenEvaluation,
}: {
  record: RelationRecord;
  onClose: () => void;
  onOpenEvaluation: (relationId: number) => void;
}) {
  const workspace = record.workspace;

  const criteriaEntries = Object.entries(
    workspace?.class_criteria_details || {},
  ).filter(
    ([, detail]) =>
      detail &&
      Object.values(detail).some(
        (v) => v !== null && v !== undefined && v !== "",
      ),
  );

  const operationalRows = [
    ["Management System", workspace?.management_system],
    ["Customer Communication", workspace?.customer_communication],
    ["Development Design", workspace?.development_design],
    ["Production Manufacturing", workspace?.production_manufacturing],
    ["Quality Audits", workspace?.quality_audits],
    ["Suppliers / Subcontractors", workspace?.suppliers_subcontractors],
    ["Deliveries", workspace?.deliveries],
    ["Environment / Ethics Rules", workspace?.environment_ethic_rules],
  ];
  const developmentPlans = (workspace?.development_plans ||
    []) as SupplierDevelopmentPlan[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-xl">
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_30px_100px_rgba(6,43,73,0.45)] dark:bg-[#0f1e30] dark:shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
        <div className="relative overflow-hidden border-b border-white/10 bg-[#062B49] px-8 py-7 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.42),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.18),transparent_42%)]" />

          <div className="relative flex items-start justify-between gap-6">
            <div>
              {/* <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                Relation Intelligence
              </span> */}

              <h3 className="mt-4 text-3xl font-bold tracking-tight">
                {record.relation.relation_code ||
                  `REL-${String(record.relation.id_relation).padStart(6, "0")}`}
                <span className="mx-3 text-blue-200/50">/</span>
                {record.siteName}
              </h3>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100/80">
                Consolidated supplier relation status, evaluation metrics,
                operational maturity, decision trail and supporting evidence.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/10 p-2.5 text-blue-100 backdrop-blur transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-6 flex flex-wrap gap-2">
            <Badge
              text={
                record.unit.unit_code ||
                `UNT-${String(record.unit.id_supplier_unit).padStart(6, "0")}`
              }
              tone="blue"
            />
            <Badge text={record.siteName} tone="slate" />
            <Badge
              text={record.finalGrade || "Pending grade"}
              tone={getGradeTone(record.finalGrade)}
            />
            <Badge
              text={record.currentStatus || "Pending status"}
              tone={getStatusTone(record.currentStatus)}
            />
            <Badge
              text={getPanelDecisionLabel(record.panelDecision)}
              tone={getPanelDecisionTone(record.panelDecision)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5 dark:bg-[#0a1929] sm:px-8 sm:py-7">
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
            <StatPill
              icon={<Award className="h-3.5 w-3.5" />}
              value={record.finalGrade || "—"}
              label="grade"
              tone="blue"
            />
            <span className="h-4 w-px bg-slate-200 dark:bg-white/[0.08]" />
            <StatPill
              icon={<Layers3 className="h-3.5 w-3.5" />}
              value={workspace?.class_score != null ? Number(workspace.class_score).toFixed(1) : "—"}
              label="class score"
              tone="slate"
            />
            <span className="h-4 w-px bg-slate-200 dark:bg-white/[0.08]" />
            <StatPill
              icon={<ClipboardCheck className="h-3.5 w-3.5" />}
              value={workspace?.operational_score != null ? Number(workspace.operational_score).toFixed(1) : "—"}
              label="operational score"
              tone="green"
            />
            <span className="h-4 w-px bg-slate-200 dark:bg-white/[0.08]" />
            <StatPill
              icon={<AlertCircle className="h-3.5 w-3.5" />}
              value={workspace?.impact_score ?? "—"}
              label="impact score"
              tone="amber"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard
              title="Supplier Overview"
              subtitle="Current relation profile"
            >
              <Field label="Group" value={record.group.nom || "-"} />
              <Field
                label="Group Code"
                value={
                  record.group.group_code ||
                  `GRP-${String(record.group.id_group).padStart(6, "0")}`
                }
              />
              <Field
                label="Group Categories"
                value={record.group.supplier_type || "-"}
              />
              <Field
                label="Unit Code"
                value={
                  record.unit.unit_code ||
                  `UNT-${String(record.unit.id_supplier_unit).padStart(6, "0")}`
                }
              />
              <Field
                label="Relation Code"
                value={
                  record.relation.relation_code ||
                  `REL-${String(record.relation.id_relation).padStart(6, "0")}`
                }
              />
              <Field
                label="Supplier Scope"
                value={
                  record.relation.supplier_scope ||
                  record.group.supplier_scope ||
                  "-"
                }
              />
              <Field
                label="Supplier Owner"
                value={
                  record.relation.supplier_owner ||
                  record.group.supplier_owner ||
                  "-"
                }
              />
              <Field
                label="Current Status"
                value={record.currentStatus || "-"}
              />
              <Field
                label="Panel Decision"
                value={getPanelDecisionLabel(record.panelDecision)}
              />
              <Field
                label="Last Evaluation"
                value={formatDate(
                  workspace?.evaluation_date ||
                    record.relation.last_evaluation_date,
                )}
              />
            </SectionCard>

            <SectionCard
              title="Evaluation Insights"
              subtitle="Latest scoring and comments"
            >
              <Field
                label="Class / Operational"
                value={`${workspace?.class_value ?? record.relation.class_value ?? "-"} / ${workspace?.operational_grade ?? record.relation.operational_grade ?? "-"}`}
              />
              <Field
                label="Strategic Mention"
                value={
                  workspace?.strategic_mention ||
                  record.relation.strategic_mention ||
                  "-"
                }
              />
              <Field
                label="Comments"
                value={
                  workspace?.comments ||
                  record.relation.evaluation_comments ||
                  "-"
                }
              />
            </SectionCard>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h4 className="text-lg font-bold tracking-tight text-slate-950">
                Operational Self-Assessment
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Operational maturity declared across core supplier processes.
              </p>
            </div>

            <DataTable
              headers={["Criterion", "Value"]}
              rows={operationalRows.map(([label, value]) => [
                label,
                value != null ? String(value) : "-",
              ])}
            />
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h4 className="text-lg font-bold tracking-tight text-slate-950">
                Criteria Evidence
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Documents, validity windows, comments and score justification.
              </p>
            </div>

            <DataTable
              headers={[
                "Criterion",
                "Score",
                "Document",
                "Validity",
                "Comments",
              ]}
              rows={criteriaEntries.map(([criterionKey, detail]) => [
                criterionKey.replace(/_/g, " "),
                detail.score != null ? String(detail.score) : "-",
                detail.document_url ? (
                  <a
                    href={detail.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#062B49] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0C5381]"
                  >
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  detail.document_name || detail.evidence_file_name || "-"
                ),
                [
                  formatDate(detail.validity_start_date),
                  formatDate(detail.validity_end_date),
                ]
                  .filter((v) => v !== "-")
                  .join(" → ") || "-",
                detail.comments || "-",
              ])}
            />
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h4 className="text-lg font-bold tracking-tight text-slate-950">
                Development Plan History
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Manual tracking of the supplier development plan, due dates,
                file references and hold release history.
              </p>
            </div>

            <DataTable
              headers={[
                "Plan",
                "Status",
                "Issue / Due",
                "Submitted / Reviewed",
                "Hold / Escalation",
                "File",
              ]}
              rows={developmentPlans.map((plan) => [
                plan.plan_title || `Plan #${plan.id_development_plan}`,
                plan.plan_status || "-",
                `${formatDate(plan.issue_date)} / ${formatDate(plan.due_date)}`,
                `${formatDate(plan.submission_date)} / ${formatDate(plan.review_date)}`,
                `${plan.business_hold_active ? "On hold" : "Released"}${plan.escalated ? " · Escalated" : ""}${plan.is_overdue ? " · Overdue" : ""}`,
                plan.file_url ? (
                  <a
                    href={plan.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#062B49] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0C5381]"
                  >
                    {plan.file_name || "Open file"}{" "}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  plan.file_name || "-"
                ),
              ])}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-8 py-5">
          <p className="text-xs text-slate-400">
            Supplier relation record · Updated evaluation workspace
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => onOpenEvaluation(record.relation.id_relation)}
              className={`inline-flex items-center gap-2 rounded-2xl ${BRAND_DARK} px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition ${BRAND_DARK_HOVER}`}
            >
              Open full evaluation <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const buildRelationRecords = (bundle: SitePanelBundle): RelationRecord[] =>
  bundle.relations.map((entry) => {
    const currentStatus = entry.relation.supplier_status || null;
    const panelDecision = entry.relation.panel_decision || null;
    const normalizedStatus = normalizeText(currentStatus);
    const isArchived =
      panelDecision === "panel_reject" ||
      entry.relation.inactivated_at != null ||
      normalizedStatus.includes("hold");

    return {
      site: bundle.site,
      unit: entry.unit,
      group: entry.group,
      relation: entry.relation,
      workspace: null,
      siteName: bundle.site.site_name || `Site ${bundle.site.id_site}`,
      finalGrade: entry.relation.final_grade || null,
      currentStatus,
      panelDecision,
      isArchived,
    };
  });

const getSiteOverview = (bundle: SitePanelBundle) => {
  const relationRecords = buildRelationRecords(bundle);

  const latestEvaluation = relationRecords
    .map((r) => r.relation.last_evaluation_date)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .pop();

  const panelReady = relationRecords.filter(
    (r) =>
      r.panelDecision === "panel_add" ||
      r.panelDecision === "panel_add_committee_validated",
  ).length;

  const archivedCount = relationRecords.filter((r) => r.isArchived).length;

  return {
    relationRecords,
    latestEvaluation,
    panelReady,
    archivedCount,
  };
};


function RelationsTable({
  bundle,
  onViewRelation,
  onOpenEvaluation,
}: {
  bundle: SitePanelBundle;
  onViewRelation: (record: RelationRecord) => void;
  onOpenEvaluation: (relationId: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const records = buildRelationRecords(bundle);

  if (records.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-slate-400">
        No relations for this site.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left">
            <th className="w-8 px-3 py-3" />
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Supplier</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Category</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Grade</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Status</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Panel</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Last eval</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const isExpanded = expandedId === record.relation.id_relation;
            const gradeTone = getGradeTone(record.finalGrade);
            const gradeTileClass = {
              green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
              amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
              red: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
              slate: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
              purple: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
            }[gradeTone];

            return (
              <>
                <tr
                  key={record.relation.id_relation}
                  onClick={() => setExpandedId(isExpanded ? null : record.relation.id_relation)}
                  className={`cursor-pointer border-b transition-colors duration-100 ${isExpanded ? "border-slate-200 bg-slate-50" : "border-slate-50 hover:bg-slate-50/70"}`}
                >
                  {/* Expand chevron */}
                  <td className="px-3 py-3.5 text-slate-400">
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180 text-slate-600" : ""}`} />
                  </td>

                  {/* Supplier */}
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900">{record.group.nom || "—"}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                      {record.unit.unit_code || `UNT-${String(record.unit.id_supplier_unit).padStart(6, "0")}`}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3.5">
                    {record.group.supplier_type ? (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {record.group.supplier_type}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>

                  {/* Grade */}
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex h-8 w-10 items-center justify-center rounded-lg text-sm font-extrabold ${gradeTileClass}`}>
                      {record.finalGrade || "—"}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <Badge text={record.currentStatus || "Pending"} tone={getStatusTone(record.currentStatus)} />
                  </td>

                  {/* Panel */}
                  <td className="px-4 py-3.5">
                    <Badge text={getPanelDecisionLabel(record.panelDecision)} tone={getPanelDecisionTone(record.panelDecision)} />
                  </td>

                  {/* Last eval */}
                  <td className="px-4 py-3.5 text-xs text-slate-400">
                    {formatDate(record.relation.last_evaluation_date)}
                  </td>
                </tr>

                {/* ── Expanded detail row ── */}
                {isExpanded && (
                  <tr key={`${record.relation.id_relation}-detail`} className="border-b border-slate-100 bg-slate-50">
                    <td />
                    <td colSpan={6} className="px-4 pb-5 pt-3">
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Group</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{record.group.nom || "—"}</p>
                          <p className="text-xs text-slate-400">{record.group.group_code || `GRP-${String(record.group.id_group).padStart(6,"0")}`}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Owner · Scope</p>
                          <p className="mt-1 text-sm text-slate-700">{record.group.supplier_owner || "—"}</p>
                          <p className="text-xs text-slate-400">{record.group.supplier_scope || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Class · Operational</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {record.relation.class_value != null ? String(record.relation.class_value) : "—"}
                            <span className="mx-1.5 text-slate-300">/</span>
                            {record.relation.operational_grade || "—"}
                          </p>
                          <p className="text-xs text-slate-400">Strategic: {record.relation.strategic_mention || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Relation code</p>
                          <p className="mt-1 font-mono text-sm text-slate-700">
                            {record.relation.relation_code || `REL-${String(record.relation.id_relation).padStart(6,"0")}`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3">
                        <button type="button" onClick={(e) => { e.stopPropagation(); onViewRelation(record); }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900">
                          <Eye className="h-3.5 w-3.5" /> Full details
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenEvaluation(record.relation.id_relation); }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#062B49] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0C5381]">
                          <ExternalLink className="h-3.5 w-3.5" /> Open evaluation
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SuppliersPage() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [siteBundles, setSiteBundles] = useState<SitePanelBundle[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPanelDecision, setFilterPanelDecision] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterPurchaseManager, setFilterPurchaseManager] = useState("");
  const [filterPlantManager, setFilterPlantManager] = useState("");
  const [groupBy, setGroupBy] = useState("none");

  const [page, setPage] = useState(1);
  const [totalSites, setTotalSites] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRelationRecord, setSelectedRelationRecord] =
    useState<RelationRecord | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await supplierAPI.listSitePanel({
          skip: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
          site_name: search || undefined,
          supplier_owner: filterOwner || undefined,
          class_grade: filterGrade || undefined,
          status: filterStatus || undefined,
          panel_decision: filterPanelDecision || undefined,
          category: filterCategory || undefined,
          evaluation_start: filterStartDate || undefined,
          evaluation_end: filterEndDate || undefined,
          purchase_manager: filterPurchaseManager || undefined,
          plant_manager: filterPlantManager || undefined,
        });

        if (cancelled) return;

        const items = response.data?.items || [];

        setSiteBundles(items);
        setTotalSites(response.data?.total || items.length);

        if (items.length > 0) {
          setSelectedSiteId((current) => {
            if (current && items.some((b) => b.site.id_site === current)) {
              return current;
            }
            return items[0].site.id_site;
          });
        } else {
          setSelectedSiteId(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load sites");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [
    refreshTick,
    page,
    search,
    filterOwner,
    filterCategory,
    filterGrade,
    filterStatus,
    filterPanelDecision,
    filterStartDate,
    filterEndDate,
    filterPurchaseManager,
    filterPlantManager,
  ]);

  const allCategories = useMemo(
    () =>
      Array.from(
        new Set(
          siteBundles.flatMap((bundle) =>
            bundle.relations.flatMap((entry) => entry.group_categories),
          ),
        ),
      ).sort(),
    [siteBundles],
  );

  const gradeOptions = [
    "A1",
    "A2",
    "A3",
    "A4",
    "B1",
    "B2",
    "B3",
    "B4",
    "C1",
    "C2",
    "C3",
    "C4",
    "D",
  ];

  const statusOptions = [
    "Can Quote and Be Awarded",
    "Can Quote but Not be Awarded",
    "New business on Hold",
  ];

  const panelDecisionOptions = [
    "panel_add",
    "panel_add_committee_validated",
    "panel_add_exec_committee",
    "panel_reject",
  ];

  const groupedSites = useMemo(() => {
    if (groupBy === "country") {
      const buckets: Record<string, SitePanelBundle[]> = {};

      for (const bundle of siteBundles) {
        const key = bundle.site.country || "Unspecified";
        buckets[key] = buckets[key] || [];
        buckets[key].push(bundle);
      }

      return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0]));
    }

    return [["All Sites", siteBundles]] as [string, SitePanelBundle[]][];
  }, [siteBundles, groupBy]);

  const totalPages = Math.max(1, Math.ceil(totalSites / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const selectedBundle =
    siteBundles.find((bundle) => bundle.site.id_site === selectedSiteId) ||
    null;

  const selectedOverview = selectedBundle
    ? getSiteOverview(selectedBundle)
    : null;

  const openRelationEvaluation = (relationId: number) => {
    navigate(`/supplier-relations/${relationId}/evaluation`);
  };

  const openRelationDetail = async (record: RelationRecord) => {
    try {
      const response = await supplierAPI.getRelationEvaluationWorkspace(
        record.relation.id_relation,
      );

      setSelectedRelationRecord({
        ...record,
        workspace: response.data as RelationEvaluationWorkspace,
      });
    } catch (e) {
      setSelectedRelationRecord(record);
    }
  };

  useEffect(() => {
    if (currentPage !== page) setPage(currentPage);
  }, [currentPage, page]);

  return (
    <div className="mx-auto flex max-w-[1700px] flex-col gap-7 px-2">
      <PageIntro
        eyebrow="Portfolio"
        title="Active Sites"
        description="Site-by-site view of all active supplier relations, evaluations and panel status."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate("/suppliers/onboarding")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" /> Create Supplier Master
            </button>

            <button
              type="button"
              onClick={() => navigate("/suppliers/manage")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/18"
            >
              Group Management
            </button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-[1600px]">
        {/* ── Filter bar ── */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          {/* Primary row — always visible */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-[2]">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Site name</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by site name"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:bg-[#0d1929] dark:focus:ring-blue-500/10" />
              </div>
            </div>

            <div className="w-48">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Category</label>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10">
                  <option value="">All categories</option>
                  {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="w-36">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Grade</label>
              <div className="relative">
                <Award className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setPage(1); }}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10">
                  <option value="">All grades</option>
                  {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="min-w-[180px] flex-1">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Owner</label>
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={filterOwner} onChange={(e) => { setFilterOwner(e.target.value); setPage(1); }} placeholder="Owner name or email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:bg-[#0d1929] dark:focus:ring-blue-500/10" />
              </div>
            </div>

            <button type="button" onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/[0.15] dark:hover:text-slate-200">
              {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showFilters ? "Less" : "More filters"}
            </button>

            {(search || filterOwner || filterCategory || filterGrade || filterStatus || filterPanelDecision || filterStartDate || filterEndDate || filterPurchaseManager || filterPlantManager) && (
              <button type="button" onClick={() => { setSearch(""); setFilterCategory(""); setFilterOwner(""); setFilterGrade(""); setFilterStatus(""); setFilterPanelDecision(""); setFilterStartDate(""); setFilterEndDate(""); setFilterPurchaseManager(""); setFilterPlantManager(""); setPage(1); }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/[0.15] dark:hover:text-slate-200">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}

            <span className="ml-auto text-xs font-medium text-slate-400">{totalSites} site{totalSites !== 1 ? "s" : ""}</span>
          </div>

          {/* Secondary row — collapsed by default */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 dark:border-white/[0.08]">
              <div className="w-52">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</label>
                <div className="relative">
                  <AlertCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10">
                    <option value="">All statuses</option>
                    {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="w-52">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Panel decision</label>
                <div className="relative">
                  <ClipboardCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select value={filterPanelDecision} onChange={(e) => { setFilterPanelDecision(e.target.value); setPage(1); }}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10">
                    <option value="">All decisions</option>
                    {panelDecisionOptions.map((d) => <option key={d} value={d}>{getPanelDecisionLabel(d)}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="w-40">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Eval from</label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10 dark:[color-scheme:dark]" />
                </div>
              </div>

              <div className="w-40">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Eval to</label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10 dark:[color-scheme:dark]" />
                </div>
              </div>

              <div className="min-w-[180px] flex-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Purchase manager</label>
                <div className="relative">
                  <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={filterPurchaseManager} onChange={(e) => { setFilterPurchaseManager(e.target.value); setPage(1); }} placeholder="Name or role"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10" />
                </div>
              </div>

              <div className="min-w-[180px] flex-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Plant manager</label>
                <div className="relative">
                  <Factory className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={filterPlantManager} onChange={(e) => { setFilterPlantManager(e.target.value); setPage(1); }} placeholder="Name or role"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10" />
                </div>
              </div>

              <div className="w-40">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Group by</label>
                <div className="relative">
                  <Layers3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10">
                    <option value="none">None</option>
                    <option value="country">Country</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          {/* ── Site list ── */}
          <aside className="space-y-2">
            {error && (
              <InlineAlert title="We couldn't load the site workspace" message={error}
                action={<button type="button" onClick={() => setRefreshTick((v) => v + 1)} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100">Retry</button>}
              />
            )}

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : siteBundles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
                No sites match your filters.
              </div>
            ) : (
              groupedSites.map(([label, bundles]) => (
                <section key={label} className="space-y-1.5">
                  {groupBy !== "none" && (
                    <div className="flex items-center gap-2 px-1 py-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      <span>{label}</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  )}
                  {bundles.map((bundle) => (
                    <SiteCard key={bundle.site.id_site} bundle={bundle}
                      isSelected={bundle.site.id_site === selectedSiteId}
                      onSelect={() => setSelectedSiteId(bundle.site.id_site)} />
                  ))}
                </section>
              ))
            )}

            {totalSites > PAGE_SIZE && (
              <Pagination page={currentPage} totalPages={totalPages} totalItems={totalSites} pageSize={PAGE_SIZE} onPageChange={setPage} compact />
            )}
          </aside>

          {/* ── Site detail ── */}
          <section>
            {!selectedBundle ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center text-sm text-slate-400">
                Select a site to view its supplier relations.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="font-bold text-slate-900">{selectedBundle.site.site_name}</h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {[selectedBundle.site.city, selectedBundle.site.country].filter(Boolean).join(", ") || "Location not set"}
                      {" · "}
                      <span className="font-medium text-slate-600">{selectedBundle.relation_count} relation{selectedBundle.relation_count !== 1 ? "s" : ""}</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => setRefreshTick((v) => v + 1)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </button>
                </div>
                <RelationsTable
                  bundle={selectedBundle}
                  onViewRelation={openRelationDetail}
                  onOpenEvaluation={openRelationEvaluation}
                />
              </div>
            )}
          </section>
        </div>
      </main>

      {selectedRelationRecord && (
        <RelationDetailModal
          record={selectedRelationRecord}
          onClose={() => setSelectedRelationRecord(null)}
          onOpenEvaluation={openRelationEvaluation}
        />
      )}
    </div>
  );
}
