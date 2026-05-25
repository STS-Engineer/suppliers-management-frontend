import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  Award,
  Building2,
  CalendarDays,
  ChevronDown,
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

function StatCard({
  label,
  value,
  helper,
  icon,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
  tone?: "blue" | "green" | "purple" | "amber" | "red";
}) {
  const iconStyles = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    purple: "bg-violet-50 text-violet-600 ring-violet-100",
    amber: "bg-orange-50 text-orange-600 ring-orange-100",
    red: "bg-rose-50 text-rose-600 ring-rose-100",
  };

  return (
    <div className="group rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)]">
      <div
        className={`grid h-10 w-10 place-items-center rounded-2xl ring-1 ${iconStyles[tone]}`}
      >
        {icon}
      </div>
      <div className="mt-4 text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-400">{helper}</div>
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
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50/90">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {headers.map((h) => (
                <th key={h} className="px-5 py-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length > 0 ? (
              rows.map((row, ri) => (
                <tr key={ri} className="transition hover:bg-slate-50">
                  {row.map((cell, ci) => (
                    <td
                      key={`${ri}-${ci}`}
                      className="px-5 py-4 align-top text-slate-600"
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
                  className="px-5 py-12 text-center text-sm text-slate-400"
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
  const archivedCount = bundle.relations.filter((entry) => {
    const normalizedStatus = normalizeText(entry.relation.supplier_status);
    return (
      entry.relation.panel_decision === "panel_reject" ||
      entry.relation.inactivated_at != null ||
      normalizedStatus.includes("hold")
    );
  }).length;

  const panelReadyCount = bundle.relations.filter(
    (entry) =>
      entry.relation.panel_decision === "panel_add" ||
      entry.relation.panel_decision === "panel_add_exec_committee",
  ).length;

  const latestEvaluation = bundle.relations
    .map((entry) => entry.relation.last_evaluation_date)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)))
    .pop();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-[1.75rem] border p-5 text-left transition-all duration-300 ${
        isSelected
          ? "border-[#062B49] bg-[#062B49] text-white shadow-[0_24px_70px_rgba(6,43,73,0.35)]"
          : "border-slate-200 bg-white text-slate-900 shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)]"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.24),transparent_35%)] opacity-0 transition group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div
            className={`text-xs font-semibold uppercase tracking-[0.22em] ${
              isSelected ? "text-blue-100" : "text-slate-400"
            }`}
          >
            Avocarbon Site
          </div>

          <div className="mt-2 text-xl font-bold tracking-tight">
            {bundle.site.site_name || "Unnamed site"}
          </div>

          <div
            className={`mt-1 text-sm ${
              isSelected ? "text-blue-100/80" : "text-slate-500"
            }`}
          >
            {[bundle.site.city, bundle.site.country]
              .filter(Boolean)
              .join(", ") || "Location not set"}
          </div>
        </div>

        <div
          className={`rounded-2xl px-3 py-2 text-right ${
            isSelected ? "bg-white/10" : "bg-slate-50"
          }`}
        >
          <div
            className={
              isSelected ? "text-xs text-blue-100/80" : "text-xs text-slate-400"
            }
          >
            Relations
          </div>
          <div className="text-xl font-bold">{bundle.relation_count}</div>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        <Badge text={`${panelReadyCount} panel-ready`} tone="green" />
        <Badge text={`${archivedCount} archived`} tone="red" />
        <Badge text={`Groups ${bundle.group_count}`} tone="slate" />
        <Badge
          text={`Last eval ${formatDate(latestEvaluation)}`}
          tone="amber"
        />
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-xl">
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_30px_100px_rgba(6,43,73,0.45)]">
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

        <div className="flex-1 overflow-y-auto bg-slate-100 px-8 py-7">
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <StatCard
              label="Final Grade"
              value={record.finalGrade || "-"}
              helper="Latest consolidated grade"
              icon={<Award className="h-4 w-4" />}
              tone="blue"
            />
            <StatCard
              label="Class Score"
              value={
                workspace?.class_score != null
                  ? Number(workspace.class_score).toFixed(1)
                  : "-"
              }
              helper="Class evaluation score"
              icon={<Layers3 className="h-4 w-4" />}
              tone="purple"
            />
            <StatCard
              label="Operational Score"
              value={
                workspace?.operational_score != null
                  ? Number(workspace.operational_score).toFixed(1)
                  : "-"
              }
              helper="Operational maturity"
              icon={<ClipboardCheck className="h-4 w-4" />}
              tone="green"
            />
            <StatCard
              label="Impact Score"
              value={workspace?.impact_score ?? "-"}
              helper="Business impact signal"
              icon={<AlertCircle className="h-4 w-4" />}
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
      r.panelDecision === "panel_add_exec_committee",
  ).length;

  const archivedCount = relationRecords.filter((r) => r.isArchived).length;

  return {
    relationRecords,
    latestEvaluation,
    panelReady,
    archivedCount,
  };
};

const renderGroupsSummary = (bundle: SitePanelBundle) => {
  const groups = new Map<
    number,
    {
      group: SupplierGroupSummary;
      units: Set<number>;
      categories: Set<string>;
    }
  >();

  for (const entry of bundle.relations) {
    const existing = groups.get(entry.group.id_group) || {
      group: entry.group,
      units: new Set<number>(),
      categories: new Set<string>(),
    };

    existing.units.add(entry.unit.id_supplier_unit);
    entry.group_categories.forEach((c) => existing.categories.add(c));
    groups.set(entry.group.id_group, existing);
  }

  const rows = Array.from(groups.values()).map((item) => [
    <span className="font-bold text-[#062B49]">{item.group.nom}</span>,
    item.group.supplier_owner || "-",
    item.group.supplier_scope || "-",
    Array.from(item.categories).join(", ") || "-",
    item.units.size,
  ]);

  return (
    <DataTable
      headers={["Group", "Owner", "Scope", "Categories", "Units"]}
      rows={rows}
    />
  );
};

const renderRelationsTable = (
  bundle: SitePanelBundle,
  onViewRelation: (record: RelationRecord) => void,
  onOpenEvaluation: (relationId: number) => void,
) => {
  const relationRecords = buildRelationRecords(bundle);

  return (
    <DataTable
      headers={[
        "Unit",
        "Group",
        "Grade",
        "Class",
        "Status",
        "Panel",
        "Updated",
        "Actions",
      ]}
      rows={relationRecords.map((record) => [
        <div>
          <div className="font-bold text-[#062B49]">
            {record.unit.unit_code ||
              `UNT-${String(record.unit.id_supplier_unit).padStart(6, "0")}`}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {(record.group.group_code ||
              `GRP-${String(record.group.id_group).padStart(6, "0")}`) +
              " • " +
              (record.group.supplier_type || "Uncategorized")}
          </div>
        </div>,
        record.group.nom || "-",
        record.finalGrade ? (
          <Badge
            text={record.finalGrade}
            tone={getGradeTone(record.finalGrade)}
          />
        ) : (
          <Badge text="Pending" tone="amber" />
        ),
        record.relation.class_value != null
          ? String(record.relation.class_value)
          : "-",
        <Badge
          text={record.currentStatus || "Pending"}
          tone={getStatusTone(record.currentStatus)}
        />,
        <Badge
          text={getPanelDecisionLabel(record.panelDecision)}
          tone={getPanelDecisionTone(record.panelDecision)}
        />,
        formatDate(record.relation.last_evaluation_date),
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onViewRelation(record)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:text-[#0C5381]"
          >
            <Eye className="h-3.5 w-3.5" /> Details
          </button>
          <button
            type="button"
            onClick={() => onOpenEvaluation(record.relation.id_relation)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#062B49] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#0C5381]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </button>
        </div>,
      ])}
    />
  );
};

export default function SuppliersPage() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(true);
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
        eyebrow="Panel"
        title="Avocarbon Sites"
        description="Site-first view of suppliers, relations, and class evaluations."
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
        <div className="mb-6 rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Site Name
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search sites by name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Supplier Owner
              </label>
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={filterOwner}
                  onChange={(e) => {
                    setFilterOwner(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Owner email or name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="w-48">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Category
              </label>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">All categories</option>
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="w-40">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Class Grade
              </label>
              <div className="relative">
                <Award className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterGrade}
                  onChange={(e) => {
                    setFilterGrade(e.target.value);
                    setPage(1);
                  }}
                  className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">All grades</option>
                  {gradeOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="w-56">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Status
              </label>
              <div className="relative">
                <AlertCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="w-56">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Panel Decision
              </label>
              <div className="relative">
                <ClipboardCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={filterPanelDecision}
                  onChange={(e) => {
                    setFilterPanelDecision(e.target.value);
                    setPage(1);
                  }}
                  className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">All decisions</option>
                  {panelDecisionOptions.map((decision) => (
                    <option key={decision} value={decision}>
                      {getPanelDecisionLabel(decision)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="w-44">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                From
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => {
                    setFilterStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="w-44">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                To
              </label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => {
                    setFilterEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Purchase Manager
              </label>
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={filterPurchaseManager}
                  onChange={(e) => {
                    setFilterPurchaseManager(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Role or contact name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Plant Manager
              </label>
              <div className="relative">
                <Factory className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={filterPlantManager}
                  onChange={(e) => {
                    setFilterPlantManager(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Role or contact name"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="w-44">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                Group By
              </label>
              <div className="relative">
                <Layers3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option value="none">None</option>
                  <option value="country">Country</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {(search ||
              filterOwner ||
              filterCategory ||
              filterGrade ||
              filterStatus ||
              filterPanelDecision ||
              filterStartDate ||
              filterEndDate ||
              filterPurchaseManager ||
              filterPlantManager) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilterCategory("");
                  setFilterOwner("");
                  setFilterGrade("");
                  setFilterStatus("");
                  setFilterPanelDecision("");
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setFilterPurchaseManager("");
                  setFilterPlantManager("");
                  setPage(1);
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" /> Reset
              </button>
            )}

            <div className="ml-auto text-sm font-medium text-slate-400">
              {totalSites} site{totalSites !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div className="grid gap-7 xl:grid-cols-[440px_minmax(0,1fr)]">
          <aside className="space-y-6">
            {error && (
              <InlineAlert
                title="We couldn't load the site workspace"
                message={error}
                action={
                  <button
                    type="button"
                    onClick={() => setRefreshTick((value) => value + 1)}
                    className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
                  >
                    Retry
                  </button>
                }
              />
            )}

            {isLoading ? (
              <div className="rounded-[2rem] border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400">
                <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Loading sites…
              </div>
            ) : siteBundles.length === 0 ? (
              <div className="rounded-[2rem] border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400">
                No sites match your filters.
              </div>
            ) : (
              groupedSites.map(([label, bundles]) => (
                <section key={label} className="space-y-3">
                  {groupBy !== "none" && (
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      <span>{label}</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  )}

                  {bundles.map((bundle) => (
                    <SiteCard
                      key={bundle.site.id_site}
                      bundle={bundle}
                      isSelected={bundle.site.id_site === selectedSiteId}
                      onSelect={() => setSelectedSiteId(bundle.site.id_site)}
                    />
                  ))}
                </section>
              ))
            )}

            {totalSites > PAGE_SIZE && (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                totalItems={totalSites}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                compact
              />
            )}
          </aside>

          <section className="space-y-5">
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-6 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_45%)]" />

              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Selected Site
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                    {selectedBundle?.site.site_name || "Select a site"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedBundle
                      ? `Site ${selectedBundle.site.id_site} · ${
                          [
                            selectedBundle.site.city,
                            selectedBundle.site.country,
                          ]
                            .filter(Boolean)
                            .join(", ") || "Location pending"
                        }`
                      : "Click any site on the left to inspect details"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setRefreshTick((value) => value + 1)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-[#0C5381]"
                >
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
              </div>
            </div>

            {!selectedBundle || !selectedOverview ? (
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-4 py-16 text-center text-sm text-slate-400">
                Select a site from the left panel to see detailed information
                here.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Relations"
                    value={selectedBundle.relation_count}
                    helper="Active site relationships"
                    icon={<Layers3 className="h-4 w-4" />}
                    tone="blue"
                  />
                  <StatCard
                    label="Groups"
                    value={selectedBundle.group_count}
                    helper="Supplier groups linked"
                    icon={<Building2 className="h-4 w-4" />}
                    tone="purple"
                  />
                  <StatCard
                    label="Panel Ready"
                    value={selectedOverview.panelReady}
                    helper="Can be added to panel"
                    icon={<ClipboardCheck className="h-4 w-4" />}
                    tone="green"
                  />
                  <StatCard
                    label="On Hold / Archived"
                    value={selectedOverview.archivedCount}
                    helper="Rejected or on hold"
                    icon={<Archive className="h-4 w-4" />}
                    tone="red"
                  />
                </div>

                {/* <div className="grid gap-5 xl:grid-cols-2">
                  <SectionCard
                    title="Site Profile"
                    subtitle="Avocarbon site information"
                  >
                    <Field
                      label="Site Name"
                      value={selectedBundle.site.site_name || "-"}
                    />
                    <Field
                      label="City"
                      value={selectedBundle.site.city || "-"}
                    />
                    <Field
                      label="Country"
                      value={selectedBundle.site.country || "-"}
                    />
                    <Field
                      label="Address"
                      value={selectedBundle.site.address_line || "-"}
                    />
                    <Field
                      label="Last Evaluation"
                      value={formatDate(selectedOverview.latestEvaluation)}
                    />
                  </SectionCard>

                  <SectionCard
                    title="Coverage Snapshot"
                    subtitle="Supplier relationship coverage"
                  >
                    <Field
                      label="Relations"
                      value={selectedBundle.relation_count}
                    />
                    <Field label="Groups" value={selectedBundle.group_count} />
                    <Field
                      label="Panel Ready"
                      value={selectedOverview.panelReady}
                    />
                    <Field
                      label="Archived"
                      value={selectedOverview.archivedCount}
                    />
                  </SectionCard>
                </div> */}

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Relations
                      </p>
                      <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                        Supplier relations table
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Units, groups, grade, panel decision and latest
                        evaluation status for this site.
                      </p>
                    </div>
                  </div>

                  {renderRelationsTable(
                    selectedBundle,
                    openRelationDetail,
                    openRelationEvaluation,
                  )}
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Groups
                    </p>
                    <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                      Supplier group summary
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Group ownership, scope and categories linked to the
                      selected site.
                    </p>
                  </div>

                  {renderGroupsSummary(selectedBundle)}
                </div>
              </>
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
