import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  Filter,
  LayoutPanelLeft,
  Layers3,
  Search,
  ShieldCheck,
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

const PAGE_SIZE = 12;

type RelationRow = {
  site: AvocarbonSite;
  relation: SupplierSiteRelation;
  unit: SupplierUnitResponse;
  group: SupplierGroupSummary;
  workspace: RelationEvaluationWorkspace | null;
};

type MenuItem = {
  key: string;
  label: string;
  helper: string;
  icon: ReactNode;
  status?: string;
  panelDecision?: string;
};

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

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </div>
  );
}

function RelationDetailModal({
  record,
  onClose,
}: {
  record: RelationRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-8 backdrop-blur-xl">
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_30px_100px_rgba(2,6,23,0.6)]">
        <div className="relative overflow-hidden border-b border-white/10 bg-slate-950 px-8 py-7 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.18),transparent_42%)]" />

          <div className="relative flex items-start justify-between gap-6">
            <div>
              {/* <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                Relation Intelligence
              </span> */}

              <h3 className="mt-4 text-3xl font-bold tracking-tight">
                {record.site.site_name || "Unnamed site"}
                <span className="mx-3 text-slate-500">/</span>
                {record.relation.relation_code ||
                  `REL-${String(record.relation.id_relation).padStart(6, "0")}`}
              </h3>

              {/* <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Premium supplier relation view with site profile, current
                decision status, latest scoring, and operational classification.
              </p> */}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/10 p-2.5 text-slate-300 backdrop-blur transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-6 flex flex-wrap gap-2">
            <Badge text={record.site.site_name || "Site"} tone="blue" />
            <Badge
              text={
                record.unit.unit_code ||
                `UNT-${String(record.unit.id_supplier_unit).padStart(6, "0")}`
              }
              tone="slate"
            />
            <Badge
              text={record.relation.final_grade || "Pending grade"}
              tone={getGradeTone(record.relation.final_grade)}
            />
            <Badge
              text={record.relation.supplier_status || "Pending status"}
              tone={getStatusTone(record.relation.supplier_status)}
            />
            <Badge
              text={getPanelDecisionLabel(record.relation.panel_decision)}
              tone={getPanelDecisionTone(record.relation.panel_decision)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 px-8 py-7">
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Final Grade"
              value={record.relation.final_grade || "-"}
              helper="Consolidated supplier grade"
            />
            <MetricCard
              label="Class Value"
              value={record.relation.class_value ?? "-"}
              helper="Classification level"
            />
            <MetricCard
              label="Class Score"
              value={
                record.workspace?.class_score != null
                  ? Number(record.workspace.class_score).toFixed(1)
                  : "-"
              }
              helper="Latest class evaluation"
            />
            <MetricCard
              label="Operational Score"
              value={
                record.workspace?.operational_score != null
                  ? Number(record.workspace.operational_score).toFixed(1)
                  : "-"
              }
              helper="Operational maturity"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard
              title="Supplier Identity"
              subtitle="Site, group and unit information"
            >
              <Field label="Site" value={record.site.site_name || "-"} />
              <Field label="City" value={record.site.city || "-"} />
              <Field label="Country" value={record.site.country || "-"} />
              <Field label="Group" value={record.group.nom || "-"} />
              <Field
                label="Group Code"
                value={
                  record.group.group_code ||
                  `GRP-${String(record.group.id_group).padStart(6, "0")}`
                }
              />
              <Field
                label="Category"
                value={record.group.supplier_type || "-"}
              />
              <Field
                label="Unit"
                value={
                  record.unit.unit_code ||
                  `UNT-${String(record.unit.id_supplier_unit).padStart(6, "0")}`
                }
              />
              <Field
                label="Relation"
                value={
                  record.relation.relation_code ||
                  `REL-${String(record.relation.id_relation).padStart(6, "0")}`
                }
              />
            </SectionCard>

            <SectionCard
              title="Decision & Evaluation"
              subtitle="Latest relation status and panel signal"
            >
              <Field
                label="Supplier Status"
                value={record.relation.supplier_status || "-"}
              />
              <Field
                label="Panel Decision"
                value={getPanelDecisionLabel(record.relation.panel_decision)}
              />
              <Field
                label="Operational Grade"
                value={record.relation.operational_grade || "-"}
              />
              <Field
                label="Strategic Mention"
                value={record.relation.strategic_mention || "-"}
              />
              <Field
                label="Last Evaluation"
                value={formatDate(record.relation.last_evaluation_date)}
              />
            </SectionCard>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h4 className="text-lg font-bold tracking-tight text-slate-950">
                Relation Summary
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Executive overview of the selected supplier relation.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Current Supplier Status
                </p>
                <div className="mt-2">
                  <Badge
                    text={record.relation.supplier_status || "Pending"}
                    tone={getStatusTone(record.relation.supplier_status)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Panel Decision
                </p>
                <div className="mt-2">
                  <Badge
                    text={getPanelDecisionLabel(record.relation.panel_decision)}
                    tone={getPanelDecisionTone(record.relation.panel_decision)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-white/95 px-8 py-5 backdrop-blur-xl">
          <p className="text-xs text-slate-400">Supplier relation record </p>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActiveSitesPage() {
  const [siteBundles, setSiteBundles] = useState<SitePanelBundle[]>([]);
  const [selectedRow, setSelectedRow] = useState<RelationRow | null>(null);
  const [modalRow, setModalRow] = useState<RelationRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [activeMenu, setActiveMenu] = useState("active");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const selectedRowRequestRef = useRef(0);

  const menuItems: MenuItem[] = [
    {
      key: "active",
      label: "Active Sites",
      helper: "Live supplier relations",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      key: "panel",
      label: "Panel Ready",
      helper: "Ready for approval",
      icon: <ClipboardCheck className="h-4 w-4" />,
      panelDecision: "panel_add",
    },
    {
      key: "hold",
      label: "On Hold",
      helper: "Status is on hold",
      icon: <AlertCircle className="h-4 w-4" />,
      status: "hold",
    },
    {
      key: "archived",
      label: "Archived",
      helper: "Rejected or inactive",
      icon: <Archive className="h-4 w-4" />,
      panelDecision: "panel_reject",
    },
  ];

  const activeMenuItem =
    menuItems.find((item) => item.key === activeMenu) || menuItems[0];

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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await supplierAPI.listSitePanel({
          skip: 0,
          limit: 500,
          site_name: search || undefined,
          class_grade: filterGrade || undefined,
          status: filterStatus || activeMenuItem.status || undefined,
          panel_decision: activeMenuItem.panelDecision || "" || undefined,
          category: filterCategory || undefined,
        });

        if (cancelled) return;

        const items = response.data?.items || [];
        const activeSites = items.filter(
          (bundle) => bundle.site.active !== false,
        );

        setSiteBundles(activeSites);
        if (page !== 1) setPage(1);
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
    search,
    filterGrade,
    filterStatus,
    filterCategory,
    activeMenu,
    reloadTick,
  ]);

  const relationRows = useMemo(() => {
    return siteBundles.flatMap((bundle) =>
      bundle.relations.map((entry) => ({
        site: bundle.site,
        relation: entry.relation,
        unit: entry.unit,
        group: entry.group,
        workspace: null,
      })),
    );
  }, [siteBundles]);

  const filteredRows = useMemo(() => {
    if (!search) return relationRows;
    const keyword = normalizeText(search);
    return relationRows.filter((row) =>
      normalizeText(row.site.site_name).includes(keyword),
    );
  }, [relationRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (currentPage !== page) setPage(currentPage);
  }, [currentPage, page]);

  const counts = useMemo(() => {
    const base = { active: 0, panel: 0, hold: 0, archived: 0 };

    relationRows.forEach((row) => {
      const status = normalizeText(row.relation.supplier_status);

      if (row.relation.panel_decision === "panel_reject") {
        base.archived += 1;
        return;
      }

      if (status.includes("hold")) {
        base.hold += 1;
        return;
      }

      if (row.relation.panel_decision?.includes("panel_add")) {
        base.panel += 1;
      }

      base.active += 1;
    });

    return base;
  }, [relationRows]);

  const selectRow = async (row: RelationRow) => {
    const requestId = selectedRowRequestRef.current + 1;
    selectedRowRequestRef.current = requestId;
    setSelectedRow(row);

    try {
      const response = await supplierAPI.getRelationEvaluationWorkspace(
        row.relation.id_relation,
      );
      if (selectedRowRequestRef.current !== requestId) return;

      setSelectedRow({
        ...row,
        workspace: response.data as RelationEvaluationWorkspace,
      });
    } catch (e) {
      if (selectedRowRequestRef.current !== requestId) return;
      setSelectedRow(row);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col gap-7">
      <PageIntro
        eyebrow="Panel"
        title="Active Supplier Sites"
        description="Monitor live site relations, panel readiness, and supplier status signals from one structured workspace."
      />

      <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Site name
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search active sites"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="w-48">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Class Grade
            </label>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-9 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="">All grades</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="w-56">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Status
            </label>
            <div className="relative">
              <AlertCircle className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                placeholder="Filter status"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="w-56">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Category
            </label>
            <div className="relative">
              <Layers3 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                placeholder="Category contains"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-7 xl:grid-cols-[280px_minmax(0,1fr)_420px]">
        <aside className="space-y-4">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="bg-slate-950 px-5 py-4 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                <LayoutPanelLeft className="h-4 w-4" />
                Workspace
              </div>
            </div>

            <div className="space-y-2 p-3">
              {menuItems.map((item) => {
                const isActive = item.key === activeMenu;
                const count = counts[item.key as keyof typeof counts] || 0;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveMenu(item.key)}
                    className={`group w-full rounded-2xl border px-3.5 py-3 text-left transition-all duration-300 ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/20"
                        : "border-transparent bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                          isActive
                            ? "bg-white/12 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.icon}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-sm font-bold ${
                            isActive ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {item.label}
                        </div>
                        <div
                          className={`text-xs ${
                            isActive ? "text-slate-300" : "text-slate-400"
                          }`}
                        >
                          {item.helper}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${
                          isActive
                            ? "bg-white/12 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-6 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_45%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Active Sites
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  Supplier site activity
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Monitor active site relations, scores, statuses and panel
                  readiness.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white">
                <div className="text-xs text-slate-300">Relations</div>
                <div className="text-2xl font-bold">{filteredRows.length}</div>
              </div>
            </div>
          </div>

          {error && (
            <InlineAlert
              title="We couldn't load the active site panel"
              message={error}
              action={
                <button
                  type="button"
                  onClick={() => setReloadTick((value) => value + 1)}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
                >
                  Retry
                </button>
              }
            />
          )}

          {isLoading ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-400 shadow-sm">
              Loading active sites…
            </div>
          ) : pagedRows.length === 0 ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-400 shadow-sm">
              No active relations match your filters.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50/90">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <th className="px-5 py-4">Site / Unit</th>
                      <th className="px-5 py-4">Group</th>
                      <th className="px-5 py-4">Grade</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Panel</th>
                      <th className="px-5 py-4">Class</th>
                      <th className="px-5 py-4">Last Eval</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pagedRows.map((row) => {
                      const isSelected =
                        selectedRow?.relation.id_relation ===
                        row.relation.id_relation;

                      return (
                        <tr
                          key={row.relation.id_relation}
                          onClick={() => selectRow(row)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? "bg-slate-950 text-white"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-5 py-4">
                            <div
                              className={`text-xs font-semibold uppercase tracking-widest ${
                                isSelected ? "text-blue-200" : "text-slate-400"
                              }`}
                            >
                              {row.site.site_name || "Unnamed site"}
                            </div>
                            <div
                              className={`mt-1 font-bold ${
                                isSelected ? "text-white" : "text-slate-950"
                              }`}
                            >
                              {row.unit.unit_code ||
                                `UNT-${String(row.unit.id_supplier_unit).padStart(6, "0")}`}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div
                              className={`font-semibold ${
                                isSelected ? "text-white" : "text-slate-800"
                              }`}
                            >
                              {row.group.nom || "-"}
                            </div>
                            <div
                              className={`mt-0.5 text-xs ${
                                isSelected ? "text-slate-300" : "text-slate-400"
                              }`}
                            >
                              {row.group.supplier_type || "Uncategorized"}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <Badge
                              text={row.relation.final_grade || "Pending"}
                              tone={getGradeTone(row.relation.final_grade)}
                            />
                          </td>

                          <td className="px-5 py-4">
                            <Badge
                              text={row.relation.supplier_status || "Pending"}
                              tone={getStatusTone(row.relation.supplier_status)}
                            />
                          </td>

                          <td className="px-5 py-4">
                            <Badge
                              text={getPanelDecisionLabel(
                                row.relation.panel_decision,
                              )}
                              tone={getPanelDecisionTone(
                                row.relation.panel_decision,
                              )}
                            />
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`font-semibold ${
                                isSelected ? "text-white" : "text-slate-700"
                              }`}
                            >
                              {row.relation.class_value ?? "-"}
                            </span>
                          </td>

                          <td
                            className={`px-5 py-4 text-xs ${
                              isSelected ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {formatDate(row.relation.last_evaluation_date)}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setModalRow(row);
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                                isSelected
                                  ? "bg-white/12 text-white hover:bg-white/20"
                                  : "bg-slate-950 text-white hover:bg-blue-700"
                              }`}
                            >
                              Details <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredRows.length > PAGE_SIZE && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              totalItems={filteredRows.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              compact
            />
          )}
        </section>

        <aside className="space-y-4">
          <div className="sticky top-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
            <div className="relative bg-slate-950 px-6 py-6 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_40%)]" />

              <div className="relative">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                  Relation Detail
                </div>

                <h3 className="mt-3 text-2xl font-bold tracking-tight">
                  {selectedRow
                    ? selectedRow.relation.relation_code ||
                      `REL-${String(selectedRow.relation.id_relation).padStart(6, "0")}`
                    : "No relation selected"}
                </h3>

                <p className="mt-1 text-sm text-slate-300">
                  {selectedRow
                    ? selectedRow.site.site_name || "-"
                    : "Select a relation to inspect supplier intelligence."}
                </p>
              </div>
            </div>

            <div className="p-5">
              {selectedRow ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Grade
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {selectedRow.relation.final_grade || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Class
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">
                        {selectedRow.relation.class_value ?? "-"}
                      </p>
                    </div>
                  </div>

                  <SectionCard
                    title="Supplier Unit"
                    subtitle="Latest relation summary"
                  >
                    <Field
                      label="Unit"
                      value={
                        selectedRow.unit.unit_code ||
                        `UNT-${String(selectedRow.unit.id_supplier_unit).padStart(6, "0")}`
                      }
                    />
                    <Field label="Group" value={selectedRow.group.nom || "-"} />
                    <Field
                      label="Relation"
                      value={
                        selectedRow.relation.relation_code ||
                        `REL-${String(selectedRow.relation.id_relation).padStart(6, "0")}`
                      }
                    />
                    <Field
                      label="Site"
                      value={selectedRow.site.site_name || "-"}
                    />
                    <Field
                      label="Status"
                      value={selectedRow.relation.supplier_status || "-"}
                    />
                    <Field
                      label="Panel Decision"
                      value={getPanelDecisionLabel(
                        selectedRow.relation.panel_decision,
                      )}
                    />
                  </SectionCard>

                  <SectionCard title="Scores" subtitle="Latest evaluation">
                    <Field
                      label="Class Score"
                      value={
                        selectedRow.workspace?.class_score != null
                          ? Number(selectedRow.workspace.class_score).toFixed(1)
                          : "-"
                      }
                    />
                    <Field
                      label="Operational Score"
                      value={
                        selectedRow.workspace?.operational_score != null
                          ? Number(
                              selectedRow.workspace.operational_score,
                            ).toFixed(1)
                          : "-"
                      }
                    />
                    <Field
                      label="Final Grade"
                      value={selectedRow.relation.final_grade || "-"}
                    />
                    <Field
                      label="Last Evaluation"
                      value={formatDate(
                        selectedRow.relation.last_evaluation_date,
                      )}
                    />
                  </SectionCard>

                  <button
                    type="button"
                    onClick={() => setModalRow(selectedRow)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:bg-blue-700"
                  >
                    Open full detail <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-400">
                  Select a relation to see the unit details.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {modalRow && (
        <RelationDetailModal
          record={modalRow}
          onClose={() => setModalRow(null)}
        />
      )}
    </div>
  );
}
