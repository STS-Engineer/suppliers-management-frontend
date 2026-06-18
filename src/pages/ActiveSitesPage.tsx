import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Archive,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  Filter,
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

const PAGE_SIZE = 15;

const AVATAR_PALETTES = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-indigo-500 to-blue-600",
  "from-sky-500 to-blue-500",
  "from-fuchsia-500 to-violet-600",
];

function supplierInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function supplierPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

const GRADE_ACCENT: Record<string, string> = {
  green: "border-l-emerald-400",
  amber: "border-l-amber-400",
  red: "border-l-rose-400",
  slate: "border-l-slate-200",
  purple: "border-l-violet-400",
};

const GRADE_TILE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  slate: "bg-slate-100 text-slate-500 ring-slate-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};

type RelationRow = {
  site: AvocarbonSite;
  relation: SupplierSiteRelation;
  unit: SupplierUnitResponse;
  group: SupplierGroupSummary;
  workspace: RelationEvaluationWorkspace | null;
};

type WorkspaceTab = {
  key: string;
  label: string;
  icon: ReactNode;
  status?: string;
  panelDecision?: string;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
  panel_add_exec_committee: "Needs exec committee",
  panel_reject: "Cannot be added",
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

const STRATEGIC_CHIP: Record<string, { label: string; cls: string }> = {
  strategic:   { label: "Strategic",   cls: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" },
  directed:    { label: "Directed",    cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" },
  monopolistic:{ label: "Monopolistic",cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  none:        { label: "None",        cls: "bg-slate-100 text-slate-400 ring-1 ring-slate-200" },
};

function StrategicChips({ value }: { value?: string | null }) {
  if (!value) return <span className="text-slate-300">—</span>;
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p) => {
        const chip = STRATEGIC_CHIP[p] ?? { label: p, cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" };
        return (
          <span key={p} className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>
            {chip.label}
          </span>
        );
      })}
    </div>
  );
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </div>
  );
}

const STRATEGIC_CHIP_MODAL: Record<string, { label: string; cls: string }> = {
  strategic:    { label: "Strategic",    cls: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" },
  directed:     { label: "Directed",     cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" },
  monopolistic: { label: "Monopolistic", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" },
  none:         { label: "None",         cls: "bg-slate-100 text-slate-400 ring-1 ring-slate-200" },
};

function ScoreBar({ score, max = 100 }: { score: number | null | undefined; max?: number }) {
  if (score == null) return <div className="h-1.5 w-full rounded-full bg-slate-100" />;
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
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
  const gradeTone = getGradeTone(record.relation.final_grade);
  const gradeTileCls = {
    green:  "bg-emerald-500 text-white",
    amber:  "bg-amber-400 text-white",
    red:    "bg-rose-500 text-white",
    slate:  "bg-slate-200 text-slate-600",
    purple: "bg-violet-500 text-white",
  }[gradeTone] ?? "bg-slate-200 text-slate-600";

  const strategicParts = (record.relation.strategic_mention || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const classScore = record.workspace?.class_score != null
    ? Number(record.workspace.class_score) : null;
  const opScore = record.workspace?.operational_score != null
    ? Number(record.workspace.operational_score) : null;

  const location = [record.site.site_name, record.site.city, record.site.country]
    .filter(Boolean).join(" · ");

  // Supplier initials avatar
  const name = record.group.nom || "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  const avatarInitials = words.length === 1
    ? words[0].slice(0, 2).toUpperCase()
    : (words[0][0] + words[words.length - 1][0]).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-md">
      <div
        className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_40px_120px_rgba(2,6,23,0.5)] dark:bg-[#0f1e30]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="relative overflow-hidden bg-[#0f2744] px-7 py-6 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.3),transparent_55%)]" />

          <div className="relative flex items-start justify-between gap-4">
            {/* Left: avatar + name + location */}
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold shadow-lg ${gradeTileCls}`}>
                {record.relation.final_grade || avatarInitials}
              </div>
              <div>
                <h3 className="text-lg font-bold leading-tight tracking-tight text-white">
                  {name}
                </h3>
                <p className="mt-0.5 text-xs text-blue-200/80">{location || "—"}</p>
                {/* Category chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(record.group.supplier_type || "").split(",").filter(Boolean).map((t) => (
                    <span key={t} className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                      {t.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status + panel badges */}
          <div className="relative mt-4 flex flex-wrap gap-2">
            <Badge text={record.relation.supplier_status || "Pending"} tone={getStatusTone(record.relation.supplier_status)} />
            <Badge text={getPanelDecisionLabel(record.relation.panel_decision)} tone={getPanelDecisionTone(record.relation.panel_decision)} />
            {strategicParts.filter((p) => p !== "none").map((p) => {
              const chip = STRATEGIC_CHIP_MODAL[p];
              return chip ? (
                <span key={p} className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">
                  {chip.label}
                </span>
              ) : null;
            })}
          </div>
        </div>

        {/* ── Score strip ── */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-white dark:divide-white/[0.07] dark:border-white/[0.07] dark:bg-[#111e30]">
          {[
            { label: "Final Grade",   value: record.relation.final_grade || "—",                           bar: null },
            { label: "Class Value",   value: record.relation.class_value ?? "—",                            bar: null },
            { label: "Class Score",   value: classScore != null ? classScore.toFixed(1) : "—",              bar: classScore },
            { label: "Ops Score",     value: opScore != null ? opScore.toFixed(1) : "—",                    bar: opScore },
          ].map((m, i) => (
            <div key={i} className="flex flex-col gap-1 px-5 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{m.label}</p>
              <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{m.value}</p>
              {m.bar != null && <ScoreBar score={m.bar} />}
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4 dark:bg-[#0a1929]">
          <div className="grid gap-3 sm:grid-cols-2">

            {/* Supplier Identity */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Supplier</p>
              <div className="space-y-0">
                <InfoRow label="Group" value={record.group.nom || "—"} />
                <InfoRow label="Unit" value={record.unit.unit_code || `UNT-${String(record.unit.id_supplier_unit).padStart(6, "0")}`} mono />
                <InfoRow label="Relation" value={record.relation.relation_code || `REL-${String(record.relation.id_relation).padStart(6, "0")}`} mono />
                <InfoRow label="Category" value={record.group.supplier_type || "—"} />
                {record.unit.continent && <InfoRow label="Continent" value={record.unit.continent} />}
                {record.unit.area && <InfoRow label="Area" value={record.unit.area} />}
                {record.unit.supplier_email && <InfoRow label="Email" value={record.unit.supplier_email} />}
                {record.unit.commodity_responsible && <InfoRow label="Commodity Resp." value={record.unit.commodity_responsible} />}
                {record.unit.main_plants && <InfoRow label="Main Plants" value={record.unit.main_plants} />}
                {(record.unit.scope1_ghg != null || record.unit.scope2_ghg != null) && (
                  <InfoRow
                    label="GHG (Sc1/Sc2)"
                    value={`${record.unit.scope1_ghg != null ? record.unit.scope1_ghg : "—"} / ${record.unit.scope2_ghg != null ? record.unit.scope2_ghg : "—"} tCO₂e`}
                  />
                )}
              </div>
            </div>

            {/* Site */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Site</p>
              <div className="space-y-0">
                <InfoRow label="Plant" value={record.site.site_name || "—"} />
                <InfoRow label="City" value={record.site.city || "—"} />
                <InfoRow label="Country" value={record.site.country || "—"} />
                <InfoRow label="Last eval" value={formatDate(record.relation.last_evaluation_date)} />
              </div>
            </div>

            {/* Evaluation */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Evaluation</p>
              <div className="space-y-0">
                <InfoRow label="Operational grade" value={record.relation.operational_grade || "—"} />
                <InfoRow label="Status" value={<Badge text={record.relation.supplier_status || "Pending"} tone={getStatusTone(record.relation.supplier_status)} />} />
                <InfoRow label="Panel" value={<Badge text={getPanelDecisionLabel(record.relation.panel_decision)} tone={getPanelDecisionTone(record.relation.panel_decision)} />} />
              </div>
            </div>

            {/* SB1 Logistics */}
            {(record.relation.transport_mode || record.relation.transit_days != null || record.relation.incoterm_place || record.relation.data_validity || record.relation.delivery_status) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">SB1 Logistics</p>
                <div className="space-y-0">
                  {record.relation.transport_mode && <InfoRow label="Transport" value={record.relation.transport_mode} />}
                  {record.relation.transit_days != null && <InfoRow label="Transit days" value={String(record.relation.transit_days)} />}
                  {record.relation.incoterm_place && <InfoRow label="Incoterm / Place" value={record.relation.incoterm_place} />}
                  {record.relation.real_ap_days != null && <InfoRow label="Real AP days" value={String(record.relation.real_ap_days)} />}
                  {record.relation.delivery_status && <InfoRow label="Delivery status" value={record.relation.delivery_status} />}
                  {record.relation.data_validity && <InfoRow label="Data validity" value={record.relation.data_validity} />}
                  {record.relation.quality_cert_required && <InfoRow label="Quality cert required" value={record.relation.quality_cert_required} />}
                  {record.relation.last_eval_score != null && <InfoRow label="Last eval score" value={String(record.relation.last_eval_score)} />}
                </div>
              </div>
            )}

            {/* Strategic */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Strategic</p>
              {strategicParts.length === 0 ? (
                <p className="text-sm text-slate-400">No strategic mention</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {strategicParts.map((p) => {
                    const chip = STRATEGIC_CHIP_MODAL[p] ?? { label: p, cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" };
                    return (
                      <span key={p} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${chip.cls}`}>
                        {chip.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
          <p className="font-mono text-[11px] text-slate-400">
            {record.relation.relation_code || `REL-${String(record.relation.id_relation).padStart(6, "0")}`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 py-2 last:border-b-0 dark:border-white/[0.05]">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-right text-xs font-semibold text-slate-800 dark:text-slate-200 ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

const panelTabs: WorkspaceTab[] = [
  {
    key: "all",
    label: "All Relations",
    icon: <Archive className="h-3.5 w-3.5" />,
    panelDecision: undefined,
  },
  {
    key: "panel_add",
    label: "On panel",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    panelDecision: "panel_add",
  },
  {
    key: "panel_add_exec_committee",
    label: "Needs committee",
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
    panelDecision: "panel_add_exec_committee",
  },
];

const gradeOptions = [
  "A1", "A2", "A3", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D",
];

export default function ActiveSitesPage() {
  const [siteBundles, setSiteBundles] = useState<SitePanelBundle[]>([]);
  const [modalRow, setModalRow] = useState<RelationRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterScope, setFilterScope] = useState("");
  const [filterFamily, setFilterFamily] = useState("");
  const [filterSubFamily, setFilterSubFamily] = useState("");
  const [filterProductLine, setFilterProductLine] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const selectedRowRequestRef = useRef(0);

  const activeTabDef =
    panelTabs.find((t) => t.key === activeTab) || panelTabs[0];

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await supplierAPI.listSitePanel({
          skip: 0,
          limit: 1000,
          site_name: search || undefined,
          class_grade: filterGrade || undefined,
          status: filterStatus || undefined,
          panel_decision: activeTabDef.panelDecision,
          category: filterCategory || undefined,
          scope: filterScope || undefined,
          family: filterFamily || undefined,
          sub_family: filterSubFamily || undefined,
          product_line: filterProductLine || undefined,
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
    filterScope,
    filterFamily,
    filterSubFamily,
    filterProductLine,
    activeTab,
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
      normalizeText(row.site.site_name).includes(keyword) ||
      normalizeText(row.group.nom).includes(keyword) ||
      normalizeText(row.group.supplier_type).includes(keyword) ||
      normalizeText(row.unit.supplier_code).includes(keyword) ||
      normalizeText(row.unit.family ?? "").includes(keyword) ||
      normalizeText(row.unit.product_line ?? "").includes(keyword),
    );
  }, [relationRows, search]);

  const counts = useMemo(() => {
    const base: Record<string, number> = {
      all: 0,
      panel_add: 0,
      panel_add_exec_committee: 0,
    };
    relationRows.forEach((row) => {
      base.all += 1;
      const d = row.relation.panel_decision;
      if (d && d in base) base[d] += 1;
    });
    return base;
  }, [relationRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (currentPage !== page) setPage(currentPage);
  }, [currentPage, page]);

  const hasActiveFilters =
    search || filterGrade || filterStatus || filterCategory || filterScope || filterFamily || filterSubFamily || filterProductLine;

  const clearFilters = () => {
    setSearch("");
    setFilterGrade("");
    setFilterStatus("");
    setFilterCategory("");
    setFilterScope("");
    setFilterFamily("");
    setFilterSubFamily("");
    setFilterProductLine("");
  };

  const openModal = async (row: RelationRow) => {
    const requestId = selectedRowRequestRef.current + 1;
    selectedRowRequestRef.current = requestId;
    setModalRow(row);

    try {
      const response = await supplierAPI.getRelationEvaluationWorkspace(
        row.relation.id_relation,
      );
      if (selectedRowRequestRef.current !== requestId) return;
      setModalRow({
        ...row,
        workspace: response.data as RelationEvaluationWorkspace,
      });
    } catch {
      // modal stays open with partial data
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col gap-6">
      <PageIntro
        eyebrow="Supplier Panel (SB1)"
        title="Supplier Panel"
        description="All active supplier–site delivery relationships from SB1 — covers all scopes and families across Avocarbon plants."
      />

      {/* ── Search & filters ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-[2]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Category
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                placeholder="e.g. Ferrites, Capacitors…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:bg-[#0d1929] dark:focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Supplier / Site
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or site"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:bg-[#0d1929] dark:focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div className="w-40">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Grade
            </label>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-9 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10"
              >
                <option value="">All grades</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="w-48">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Status
            </label>
            <div className="relative">
              <AlertCircle className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                placeholder="Filter status"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:bg-[#0d1929] dark:focus:ring-blue-500/10"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:border-white/[0.15] dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Second filter row */}
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
          <div className="w-40">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Scope
            </label>
            <div className="relative">
              <select
                value={filterScope}
                onChange={(e) => setFilterScope(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10"
              >
                <option value="">All scopes</option>
                <option value="global">Global</option>
                <option value="strategic">Strategic</option>
                <option value="local">Local</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Family
            </label>
            <input
              value={filterFamily}
              onChange={(e) => setFilterFamily(e.target.value)}
              placeholder="e.g. Electronics"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-3 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:bg-[#0d1929] dark:focus:ring-blue-500/10"
            />
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Sub Family
            </label>
            <input
              value={filterSubFamily}
              onChange={(e) => setFilterSubFamily(e.target.value)}
              placeholder="e.g. Ferrites"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-3 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:bg-[#0d1929] dark:focus:ring-blue-500/10"
            />
          </div>

          <div className="flex-1 min-w-[160px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Product Line
            </label>
            <input
              value={filterProductLine}
              onChange={(e) => setFilterProductLine(e.target.value)}
              placeholder="e.g. Power Electronics"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-3 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:bg-[#0d1929] dark:focus:ring-blue-500/10"
            />
          </div>
        </div>
      </div>

      {/* ── Panel toggle + count ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          {panelTabs.map((tab) => {
            const isActive = tab.key === activeTab;
            const count = counts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-slate-950 text-white shadow-sm dark:bg-white/[0.12] dark:text-white"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-slate-200"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
                  isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-slate-300"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-slate-400">
          <span className="font-bold text-slate-700 dark:text-slate-200">{filteredRows.length}</span>{" "}
          supplier{filteredRows.length !== 1 ? "s" : ""} on panel
          {hasActiveFilters ? " matching filters" : ""}
        </p>
      </div>

      {/* ── Error ── */}
      {error && (
        <InlineAlert
          title="We couldn't load the active site panel"
          message={error}
          action={
            <button
              type="button"
              onClick={() => setReloadTick((v) => v + 1)}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
            >
              Retry
            </button>
          }
        />
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-[#0b1f38]/5 dark:border-white/[0.08] dark:bg-[#111e30] dark:ring-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#0b1f38] text-left">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Supplier</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Category</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Scope</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Family / Product</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Unit</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Site</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Grade</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Status</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Strategic</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Last eval</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-white/[0.05]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.06]" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-36 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
                          <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-50 dark:bg-white/[0.04]" />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4"><div className="h-6 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" /></td>
                    <td className="px-5 py-4"><div className="h-6 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" /></td>
                    <td className="px-5 py-4">
                      <div className="space-y-1.5">
                        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
                        <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-50 dark:bg-white/[0.04]" />
                      </div>
                    </td>
                    <td className="px-5 py-4"><div className="h-3 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" /></td>
                    <td className="px-5 py-4">
                      <div className="space-y-1.5">
                        <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
                        <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-50 dark:bg-white/[0.04]" />
                      </div>
                    </td>
                    <td className="px-5 py-4"><div className="h-8 w-12 animate-pulse rounded-xl bg-slate-100" /></td>
                    <td className="px-5 py-4"><div className="h-6 w-28 animate-pulse rounded-full bg-slate-100" /></td>
                    <td className="px-5 py-4"><div className="h-6 w-32 animate-pulse rounded-full bg-slate-100" /></td>
                    <td className="px-5 py-4"><div className="h-3 w-16 animate-pulse rounded-full bg-slate-100" /></td>
                    <td className="px-5 py-4"><div className="h-7 w-16 animate-pulse rounded-lg bg-slate-100" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : pagedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center dark:border-white/[0.12] dark:bg-white/[0.02]">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No results found</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Try adjusting your filters or switching tabs.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-[#0b1f38]/5 dark:border-white/[0.08] dark:bg-[#111e30] dark:ring-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-[#0b1f38] text-left">
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Supplier</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Category</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Scope</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Family / Product</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Unit</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Site</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Grade</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Status</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Strategic</th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Last eval</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>

              <tbody>
                {pagedRows.map((row) => {
                  const gradeTone = getGradeTone(row.relation.final_grade);
                  const name = row.group.nom || "?";
                  const initials = supplierInitials(name);
                  const palette = supplierPalette(name);
                  const accentClass = GRADE_ACCENT[gradeTone] ?? GRADE_ACCENT.slate;
                  const gradeTileClass = GRADE_TILE[gradeTone] ?? GRADE_TILE.slate;

                  return (
                    <tr
                      key={row.relation.id_relation}
                      onClick={() => openModal(row)}
                      className={`group cursor-pointer border-b border-slate-50 border-l-4 transition-colors duration-150 last:border-b-0 hover:bg-slate-50/70 dark:border-b-white/[0.05] dark:hover:bg-white/[0.035] ${accentClass}`}
                    >
                      {/* Supplier */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white shadow-sm ${palette}`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-bold text-slate-900 leading-tight dark:text-slate-100">
                              {name}
                            </div>
                            <div className="mt-1.5">
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500 tracking-wide dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400">
                                {row.unit.unit_code ||
                                  `UNT-${String(row.unit.id_supplier_unit).padStart(6, "0")}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4">
                        {row.group.supplier_type ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300">
                            {row.group.supplier_type}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Scope */}
                      <td className="px-5 py-4">
                        {row.relation.supplier_scope ? (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                            normalizeText(row.relation.supplier_scope).includes("global")
                              ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                              : normalizeText(row.relation.supplier_scope).includes("strategic")
                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          }`}>
                            {row.relation.supplier_scope}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Family / Product */}
                      <td className="px-5 py-4">
                        <div className="min-w-0">
                          {row.unit.family ? (
                            <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {row.unit.family}
                            </div>
                          ) : null}
                          {row.unit.product_line ? (
                            <div className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                              {row.unit.product_line}
                            </div>
                          ) : null}
                          {!row.unit.family && !row.unit.product_line && (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </div>
                      </td>

                      {/* Unit supplier_code */}
                      <td className="px-5 py-4">
                        {row.unit.supplier_code ? (
                          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500 tracking-wide dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400">
                            {row.unit.supplier_code}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Site */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/40" />
                          <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {row.site.site_name || "—"}
                            </div>
                            {row.site.country && (
                              <div className="mt-0.5 text-xs text-slate-400">
                                {row.site.city
                                  ? `${row.site.city}, ${row.site.country}`
                                  : row.site.country}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Grade */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex h-9 w-12 items-center justify-center rounded-xl text-sm font-extrabold ring-1 ${gradeTileClass}`}
                        >
                          {row.relation.final_grade || "—"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <Badge
                          text={row.relation.supplier_status || "Pending"}
                          tone={getStatusTone(row.relation.supplier_status)}
                        />
                      </td>

                      {/* Strategic mention */}
                      <td className="px-5 py-4">
                        <StrategicChips value={row.relation.strategic_mention} />
                      </td>

                      {/* Last eval */}
                      <td className="px-5 py-4 text-xs text-slate-400">
                        {formatDate(row.relation.last_evaluation_date)}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(row);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 hover:bg-blue-600"
                        >
                          View <ExternalLink className="h-3 w-3" />
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

      {/* ── Pagination ── */}
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

      {/* ── Detail modal ── */}
      {modalRow && (
        <RelationDetailModal
          record={modalRow}
          onClose={() => setModalRow(null)}
        />
      )}
    </div>
  );
}
