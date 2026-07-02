import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  MapPin,
  Power,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Pagination } from "../components/common/Pagination";
import CommitteeReviewPanel from "../components/committee/CommitteeReviewPanel";
import CommitteeSetupModal from "../components/committee/CommitteeSetupModal";
import CommitteeProgressModal from "../components/committee/CommitteeProgressModal";
import {
  InlineAlert,
  PageIntro,
  Pill,
} from "../components/UI";
import supplierAPI from "../services/supplierOnboardingAPI";
import { useAuth } from "../context/AuthContext";
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
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
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
  has_development_plan?: boolean;
  development_plan_status?: string | null;
  committee_review_status?: string | null;
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
  panel_add_committee_validated: "Added to panel — Committee validated",
  panel_reject: "Cannot be added",
};

const getPanelDecisionLabel = (value?: string | null) => {
  if (!value) return "Pending";
  return PANEL_DECISION_LABELS[value] || value;
};

const getPanelDecisionTone = (
  value?: string | null,
): "slate" | "blue" | "green" | "amber" | "red" | "purple" | "indigo" => {
  if (value === "panel_add") return "green";
  if (value === "panel_add_exec_committee") return "amber";
  if (value === "panel_add_committee_validated") return "indigo";
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
  tone?: "slate" | "blue" | "green" | "amber" | "red" | "purple" | "indigo";
}) {
  const toneMap = {
    slate: "neutral",
    blue: "brand",
    green: "success",
    amber: "warning",
    red: "danger",
    purple: "brand",
    indigo: "brand",
  } as const;

  return <Pill text={text} tone={toneMap[tone]} />;
}

const STRATEGIC_CHIP: Record<string, { label: string; cls: string }> = {
  strategic: {
    label: "Strategic",
    cls: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  },
  directed: {
    label: "Directed",
    cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  },
  monopolistic: {
    label: "Monopolistic",
    cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  none: {
    label: "None",
    cls: "bg-slate-100 text-slate-400 ring-1 ring-slate-200",
  },
};

function StrategicChips({ value }: { value?: string | null }) {
  if (!value) return <span className="text-slate-300">—</span>;
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((p) => {
        const chip = STRATEGIC_CHIP[p] ?? {
          label: p,
          cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
        };
        return (
          <span
            key={p}
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}
          >
            {chip.label}
          </span>
        );
      })}
    </div>
  );
}


// Deterministic color tag for commodity / family / sub-family
const TAG_PALETTES = [
  "bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25",
  "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25",
  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
  "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
  "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25",
  "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/25",
  "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/25",
  "bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/25",
  "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/25",
  "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:ring-fuchsia-500/25",
] as const;

function tagColor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++)
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return TAG_PALETTES[hash % TAG_PALETTES.length];
}

const selectCls =
  "w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-3 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/10";

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "All",
  active,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${selectCls} ${active ? "border-blue-400 ring-3 ring-blue-100 dark:border-blue-500/50" : ""}`}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        {active && (
          <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-blue-500" />
        )}
      </div>
    </div>
  );
}

function FilterSearch({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-3 focus:ring-blue-100 dark:border-white/[0.1] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/10"
        />
      </div>
    </div>
  );
}


function ScoreBar({
  score,
  max = 100,
}: {
  score: number | null | undefined;
  max?: number;
}) {
  if (score == null)
    return <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.06]" />;
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  const isEmpty = value == null || value === "" || value === "—" || value === "-";
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
      <span className="flex-shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span
        className={`text-right ${
          isEmpty || muted
            ? "text-[11px] text-slate-200 dark:text-slate-700"
            : mono
            ? "font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300"
            : "text-[12px] font-semibold text-slate-800 dark:text-slate-200"
        }`}
      >
        {isEmpty ? "—" : value}
      </span>
    </div>
  );
}

function DrawerSection({
  icon,
  title,
  accentCls = "bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-slate-400",
  children,
  // flush kept for backward compat
  flush: _flush = false,
}: {
  icon?: ReactNode;
  title: string;
  accentCls?: string;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-slate-100/80 bg-white shadow-sm dark:border-white/[0.06] dark:bg-[#0f1e30]">
      <div className="flex items-center gap-2.5 border-b border-slate-50/80 px-4 py-3 dark:border-white/[0.04]">
        {icon && (
          <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${accentCls}`}>
            {icon}
          </span>
        )}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {title}
        </p>
      </div>
      <div className="divide-y divide-slate-50/80 dark:divide-white/[0.03]">
        {children}
      </div>
    </div>
  );
}

function RelationDetailModal({
  record,
  onClose,
  isAdmin = false,
  onToggleActive,
  togglingUnit,
}: {
  record: RelationRow;
  onClose: () => void;
  isAdmin?: boolean;
  onToggleActive?: () => void;
  togglingUnit?: number | null;
}) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setShow(false);
    setTimeout(onClose, 240);
  };

  const gradeTone = getGradeTone(record.relation.final_grade);

  const gradeColor: Record<string, string> = {
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-500 dark:text-amber-400",
    red: "text-rose-600 dark:text-rose-400",
    slate: "text-slate-500 dark:text-slate-400",
    purple: "text-violet-600 dark:text-violet-400",
  };

  const gradeBg: Record<string, string> = {
    green: "bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/20",
    amber: "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/20",
    red: "bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/20",
    slate: "bg-slate-100 ring-1 ring-slate-200 dark:bg-white/[0.06] dark:ring-white/[0.08]",
    purple: "bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:ring-violet-500/20",
  };

  const classScore =
    record.workspace?.class_score != null
      ? Number(record.workspace.class_score)
      : null;
  const opScore =
    record.workspace?.operational_score != null
      ? Number(record.workspace.operational_score)
      : null;

  const name = record.group.nom || "?";
  const palette = supplierPalette(name);
  const initials = supplierInitials(name);

  const strategicParts = (record.relation.strategic_mention || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "none");


  const committeeStatus = record.committee_review_status;
  const hasCommittee =
    record.relation.panel_decision === "panel_add_exec_committee" ||
    record.relation.panel_decision === "panel_add_committee_validated";

  const supplierOwner =
    record.relation.supplier_owner || record.group.supplier_owner;

  const committeeConfig: Record<
    string,
    { dot: string; bg: string; border: string; text: string; label: string }
  > = {
    final_approved: {
      dot: "bg-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/10",
      border: "border-emerald-100 dark:border-emerald-500/20",
      text: "text-emerald-800 dark:text-emerald-400",
      label: "Approved — Added to panel with committee validation",
    },
    final_rejected: {
      dot: "bg-rose-500",
      bg: "bg-rose-50 dark:bg-rose-900/10",
      border: "border-rose-100 dark:border-rose-500/20",
      text: "text-rose-800 dark:text-rose-400",
      label: "Rejected by committee",
    },
    pending_final: {
      dot: "bg-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/10",
      border: "border-amber-100 dark:border-amber-500/20",
      text: "text-amber-800 dark:text-amber-400",
      label: "All members responded — awaiting VP final decision",
    },
    in_progress: {
      dot: "bg-indigo-400 animate-pulse",
      bg: "bg-indigo-50 dark:bg-indigo-900/10",
      border: "border-indigo-100 dark:border-indigo-500/20",
      text: "text-indigo-800 dark:text-indigo-400",
      label: "Committee review in progress",
    },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={close}
    >
      {/* Scrim */}
      <div
        className={`absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Drawer */}
      <div
        className={`relative flex h-full w-full max-w-[520px] flex-col bg-white shadow-[−32px_0_80px_rgba(2,6,23,0.18)] transition-transform duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-[#0d1b2a] ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ HEADER ═══ */}
        <div className="relative flex-shrink-0 overflow-hidden bg-gradient-to-b from-[#0b1f38] to-[#0f2744] px-6 pb-5 pt-5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_90%_0%,rgba(59,130,246,0.15),transparent)]" />

          {/* Top bar: avatar · name · close */}
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              {/* Gradient avatar with initials */}
              <div
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-extrabold text-white shadow-lg ring-2 ring-white/10 ${palette}`}
              >
                {initials}
              </div>

              <div className="min-w-0 pt-0.5">
                <h3 className="truncate text-[15px] font-bold leading-snug tracking-tight text-white">
                  {name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {record.unit.supplier_code && (
                    <span className="font-mono text-[10px] font-semibold text-blue-300/90">
                      {record.unit.supplier_code}
                    </span>
                  )}
                  {record.site.site_name && (
                    <span className="flex items-center gap-1 text-[10px] text-blue-200/60">
                      <MapPin className="h-2.5 w-2.5" />
                      {record.site.site_name}
                    </span>
                  )}
                  {(record.site.city || record.site.country) && (
                    <span className="text-[10px] text-blue-300/40">
                      {[record.site.city, record.site.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.07] text-white/50 transition hover:bg-white/[0.14] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status tags */}
          <div className="relative mt-4 flex flex-wrap gap-1.5">
            <Badge
              text={record.relation.supplier_status || "Status pending"}
              tone={getStatusTone(record.relation.supplier_status)}
            />
            <Badge
              text={getPanelDecisionLabel(record.relation.panel_decision)}
              tone={getPanelDecisionTone(record.relation.panel_decision)}
            />
            {strategicParts.map((p) => {
              const chip = STRATEGIC_CHIP[p];
              return chip ? (
                <span
                  key={p}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.09] px-2 py-0.5 text-[10px] font-semibold text-white/75"
                >
                  {chip.label}
                </span>
              ) : null;
            })}
          </div>
        </div>

        {/* ═══ SCORE CARDS ═══ */}
        <div className="flex-shrink-0 grid grid-cols-4 border-b border-slate-100 bg-white dark:border-white/[0.06] dark:bg-[#0e1c2e]">
          {[
            {
              label: "Grade",
              value: record.relation.final_grade || "—",
              bar: null as number | null,
              tone: gradeTone,
            },
            {
              label: "Class",
              value: record.relation.class_value ?? "—",
              bar: null as number | null,
              tone: "slate" as const,
            },
            {
              label: "C-Score",
              value: classScore != null ? `${classScore.toFixed(1)}` : "—",
              bar: classScore,
              tone: "slate" as const,
            },
            {
              label: "Op-Score",
              value: opScore != null ? `${opScore.toFixed(1)}` : "—",
              bar: opScore,
              tone: "slate" as const,
            },
          ].map((m, i) => (
            <div
              key={i}
              className={`flex flex-col gap-2 border-r border-slate-100 px-4 py-3.5 last:border-r-0 dark:border-white/[0.05] ${
                i === 0 ? gradeBg[gradeTone] ?? "" : ""
              }`}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                {m.label}
              </p>
              <p
                className={`text-[22px] font-extrabold leading-none tracking-tight ${
                  i === 0
                    ? (gradeColor[gradeTone] ?? "text-slate-900")
                    : "text-slate-900 dark:text-white"
                }`}
              >
                {m.value}
              </p>
              {m.bar != null && (
                <div>
                  <ScoreBar score={m.bar} />
                  <p className="mt-1 text-[9px] font-semibold text-slate-400">
                    {Math.round(m.bar)}%
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ═══ SCROLLABLE BODY ═══ */}
        <div className="flex-1 overflow-y-auto bg-[#f2f4f8] dark:bg-[#0a1520] py-4">

          {/* ── Supplier ── */}
          <DrawerSection
            icon={<Building2 className="h-3.5 w-3.5" />}
            title="Supplier"
            accentCls="bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400"
          >
            {/* Identity mini-card */}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[11px] font-extrabold text-white shadow-sm ${palette}`}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-bold text-slate-800 dark:text-slate-100">
                    {name}
                  </p>
                  <p className="font-mono text-[10px] text-slate-400">
                    {record.unit.supplier_code ||
                      `UNT-${String(record.unit.id_supplier_unit).padStart(6, "0")}`}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${
                  record.relation.is_active ?? true
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
                    : "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    record.relation.is_active ?? true
                      ? "bg-emerald-500"
                      : "bg-rose-500"
                  }`}
                />
                {record.relation.is_active ?? true ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Taxonomy chips */}
            {(record.group.supplier_type ||
              record.unit.family ||
              record.unit.sub_family ||
              record.unit.product_line) && (
              <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
                {record.group.supplier_type && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tagColor(record.group.supplier_type)}`}
                  >
                    {record.group.supplier_type}
                  </span>
                )}
                {record.unit.family && (
                  <span
                    className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${tagColor(record.unit.family)}`}
                  >
                    {record.unit.family}
                  </span>
                )}
                {record.unit.sub_family && (
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-medium ${tagColor(record.unit.sub_family)}`}
                    style={{ opacity: 0.85 }}
                  >
                    {record.unit.sub_family}
                  </span>
                )}
                {record.unit.product_line && (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-white/[0.06] dark:text-slate-400 dark:ring-white/[0.08]">
                    {record.unit.product_line}
                  </span>
                )}
              </div>
            )}

            {/* Owner chip */}
            {supplierOwner && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex-shrink-0 text-[11px] text-slate-400">
                  Owner
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-[8px] font-bold text-white">
                    {supplierOwner.split(".")[0]?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="truncate max-w-[170px] text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                    {supplierOwner}
                  </span>
                </span>
              </div>
            )}

            <InfoRow
              label="Relation ref"
              value={
                record.relation.relation_code ||
                `REL-${String(record.relation.id_relation).padStart(6, "0")}`
              }
              mono
            />
            {record.relation.alias_1 && (
              <InfoRow label="Plant alias" value={record.relation.alias_1} />
            )}
            <InfoRow label="Scope" value={record.relation.supplier_scope} />
          </DrawerSection>

          {/* ── Location ── */}
          <DrawerSection
            icon={<MapPin className="h-3.5 w-3.5" />}
            title="Location"
            accentCls="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
          >
            <div className="px-4 py-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {([
                  { label: "Plant", value: record.site.site_name },
                  { label: "Global scope", value: record.relation.global_status },
                  { label: "Site city", value: record.site.city },
                  { label: "Site country", value: record.site.country },
                  { label: "Continent", value: record.unit.continent },
                  { label: "Area", value: record.unit.area },
                ] as { label: string; value: string | null | undefined }[])
                  .filter((f) => f.value)
                  .map((f) => (
                    <div key={f.label}>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {f.label}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                        {f.value}
                      </p>
                    </div>
                  ))}
              </div>
              {![
                record.site.site_name,
                record.site.city,
                record.site.country,
                record.unit.continent,
                record.unit.area,
                record.relation.global_status,
              ].some(Boolean) && (
                <p className="text-[11px] text-slate-300 dark:text-slate-600">
                  No location data
                </p>
              )}
            </div>
          </DrawerSection>

          {/* ── Evaluation ── */}
          <DrawerSection
            icon={<ClipboardList className="h-3.5 w-3.5" />}
            title="Evaluation"
            accentCls="bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-400"
          >
            {record.relation.operational_grade ? (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                <span className="flex-shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                  Operational grade
                </span>
                <span
                  className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-bold ring-1 ${
                    GRADE_TILE[getGradeTone(record.relation.operational_grade)] ??
                    "bg-slate-100 text-slate-500 ring-slate-200"
                  }`}
                >
                  {record.relation.operational_grade}
                </span>
              </div>
            ) : null}
            <InfoRow
              label="Last evaluation"
              value={formatDate(record.relation.last_evaluation_date)}
            />
            {record.relation.last_eval_score != null && (
              <div className="px-4 py-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Eval score
                  </span>
                  <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200">
                    {Number(record.relation.last_eval_score).toFixed(1)}
                  </span>
                </div>
                <ScoreBar score={Number(record.relation.last_eval_score)} />
              </div>
            )}
          </DrawerSection>

          {/* ── Development Plan ── */}
          <DrawerSection
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            title="Development Plan"
            accentCls="bg-teal-50 text-teal-500 dark:bg-teal-500/10 dark:text-teal-400"
          >
            <div className="px-4 py-3">
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  record.has_development_plan
                    ? "border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-900/10"
                    : "border-slate-100 bg-slate-50/50 dark:border-white/[0.06] dark:bg-white/[0.02]"
                }`}
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    record.has_development_plan
                      ? "bg-emerald-100 dark:bg-emerald-500/20"
                      : "bg-slate-100 dark:bg-white/[0.06]"
                  }`}
                >
                  <TrendingUp
                    className={`h-4 w-4 ${
                      record.has_development_plan
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-400"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[11px] font-semibold ${
                      record.has_development_plan
                        ? "text-emerald-800 dark:text-emerald-300"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {record.has_development_plan
                      ? "Active development plan"
                      : "No development plan"}
                  </p>
                  {record.development_plan_status && (
                    <p className="mt-0.5 text-[10px] text-emerald-600/70 dark:text-emerald-500/60">
                      {record.development_plan_status}
                    </p>
                  )}
                </div>
                {record.has_development_plan && (
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
                )}
              </div>
            </div>
          </DrawerSection>


          {/* ── Committee ── */}
          {hasCommittee && committeeStatus && (
            <DrawerSection
              icon={<Users className="h-3.5 w-3.5" />}
              title="Committee Review"
              accentCls="bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400"
            >
              <div className="px-4 py-3">
                {(() => {
                  const cfg =
                    committeeConfig[committeeStatus] ??
                    committeeConfig.in_progress;
                  return (
                    <div
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${cfg.bg} ${cfg.border}`}
                    >
                      <span
                        className={`h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`}
                      />
                      <p className={`text-[11px] font-semibold ${cfg.text}`}>
                        {cfg.label}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </DrawerSection>
          )}

          <div className="h-2" />
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4 dark:border-white/[0.06] dark:bg-[#0d1b2a]">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 font-mono text-[10px] font-semibold text-slate-400 dark:border-white/[0.06] dark:bg-white/[0.03]">
            {record.relation.relation_code ||
              `REL-${String(record.relation.id_relation).padStart(6, "0")}`}
          </span>
          <div className="flex items-center gap-2">
            {isAdmin && onToggleActive && (
              <button
                type="button"
                disabled={togglingUnit === record.relation.id_relation}
                onClick={onToggleActive}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  record.relation.is_active ?? true
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                }`}
              >
                <Power className="h-3.5 w-3.5" />
                {togglingUnit === record.relation.id_relation
                  ? "Saving…"
                  : (record.relation.is_active ?? true)
                    ? "Deactivate"
                    : "Activate"}
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.07]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                navigate(
                  `/supplier-relations/${record.relation.id_relation}/evaluation`,
                );
                close();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#062B49] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0C5381] active:scale-[0.98]"
            >
              Open Evaluation
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </button>
          </div>
        </div>
      </div>
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

export default function ActiveSitesPage() {
  const { user } = useAuth();
  const userEmail = user?.email ?? "";
  const isVpConversion = user?.access_profile === "vp_conversion";
  const isPurchasingDirector = user?.access_profile === "purchasing_director";
  const isAdmin = isVpConversion || isPurchasingDirector;

  const [siteBundles, setSiteBundles] = useState<SitePanelBundle[]>([]);
  const [modalRow, setModalRow] = useState<RelationRow | null>(null);
  const [overrideRow, setOverrideRow] = useState<RelationRow | null>(null);
  const [committeeRow, setCommitteeRow] = useState<RelationRow | null>(null);
  const [committeeProgressRow, setCommitteeProgressRow] = useState<RelationRow | null>(null);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterScope, setFilterScope] = useState("");
  const [filterPlant, setFilterPlant] = useState("");
  const [filterFamily, setFilterFamily] = useState("");
  const [filterSubFamily, setFilterSubFamily] = useState("");
  const [filterProductLine, setFilterProductLine] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [togglingUnit, setTogglingUnit] = useState<number | null>(null);
  const [confirmToggleRow, setConfirmToggleRow] = useState<RelationRow | null>(null);
  const selectedRowRequestRef = useRef(0);

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
        has_development_plan: entry.has_development_plan ?? false,
        development_plan_status: entry.development_plan_status ?? null,
        committee_review_status: entry.committee_review_status ?? null,
      })),
    );
  }, [siteBundles]);

  const filterOptions = useMemo(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      [...new Set(arr.filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b),
      );
    return {
      categories: uniq(relationRows.map((r) => r.group.supplier_type)),
      statuses: uniq(relationRows.map((r) => r.relation.supplier_status)),
      families: uniq(relationRows.map((r) => r.unit.family)),
      subFamilies: uniq(relationRows.map((r) => r.unit.sub_family)),
      productLines: uniq(relationRows.map((r) => r.unit.product_line)),
      scopes: uniq(relationRows.map((r) => r.relation.supplier_scope)),
      plants: uniq(relationRows.map((r) => r.site.site_name)),
      globalStatuses: uniq(relationRows.map((r) => r.relation.global_status)),
    };
  }, [relationRows]);

  const PANEL_ACTIVE = ["panel_add", "panel_add_committee_validated"];

  const filteredRows = useMemo(() => {
    let rows = relationRows;

    // Tab filter (client-side — always load all from API)
    if (activeTab === "panel_add") {
      rows = rows.filter((row) =>
        PANEL_ACTIVE.includes(row.relation.panel_decision ?? ""),
      );
    } else if (activeTab === "panel_add_exec_committee") {
      rows = rows.filter(
        (row) => row.relation.panel_decision === "panel_add_exec_committee",
      );
    }

    if (search) {
      const keyword = normalizeText(search);
      rows = rows.filter(
        (row) =>
          normalizeText(row.site.site_name).includes(keyword) ||
          normalizeText(row.group.nom).includes(keyword) ||
          normalizeText(row.group.supplier_type).includes(keyword) ||
          normalizeText(row.unit.supplier_code).includes(keyword) ||
          normalizeText(row.unit.family ?? "").includes(keyword) ||
          normalizeText(row.unit.product_line ?? "").includes(keyword),
      );
    }
    if (filterPlant) {
      const kw = normalizeText(filterPlant);
      rows = rows.filter((row) => normalizeText(row.site.site_name).includes(kw));
    }
    return rows;
  }, [relationRows, activeTab, search, filterPlant]);

  const counts = useMemo(() => {
    let onPanel = 0;
    let needsCommittee = 0;
    relationRows.forEach((row) => {
      const d = row.relation.panel_decision;
      if (d && PANEL_ACTIVE.includes(d)) onPanel += 1;
      if (d === "panel_add_exec_committee") needsCommittee += 1;
    });
    return {
      all: relationRows.length,
      panel_add: onPanel,
      panel_add_exec_committee: needsCommittee,
    };
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
    search ||
    filterGrade ||
    filterStatus ||
    filterCategory ||
    filterScope ||
    filterPlant ||
    filterFamily ||
    filterSubFamily ||
    filterProductLine;

  const clearFilters = () => {
    setSearch("");
    setFilterGrade("");
    setFilterStatus("");
    setFilterCategory("");
    setFilterScope("");
    setFilterPlant("");
    setFilterFamily("");
    setFilterSubFamily("");
    setFilterProductLine("");
  };

  const toggleRelationActive = async (relationId: number, currentActive: boolean) => {
    setTogglingUnit(relationId);
    try {
      await supplierAPI.patchRelation(relationId, { is_active: !currentActive });
      setReloadTick((v) => v + 1);
    } finally {
      setTogglingUnit(null);
    }
  };

  const openOverrideModal = (row: RelationRow) => {
    setOverrideRow(row);
    setOverrideStatus("");
    setOverrideReason("");
    setOverrideError(null);
  };

  const submitOverride = async () => {
    if (!overrideRow || !overrideStatus || !overrideReason.trim()) return;
    setOverrideLoading(true);
    setOverrideError(null);
    try {
      await supplierAPI.overrideRelationSupplierStatus(
        overrideRow.relation.id_relation,
        {
          supplier_status: overrideStatus,
          reason: overrideReason.trim(),
          changed_by: userEmail,
        },
      );
      setOverrideRow(null);
      setReloadTick((v) => v + 1);
    } catch (e) {
      setOverrideError(
        e instanceof Error ? e.message : "Failed to override status",
      );
    } finally {
      setOverrideLoading(false);
    }
  };

  const sendToCommittee = (row: RelationRow) => {
    setCommitteeRow(row);
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

      {/* ── Filters ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-slate-400">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Filters
            </span>
            {hasActiveFilters && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                {
                  [
                    search,
                    filterGrade,
                    filterStatus,
                    filterCategory,
                    filterScope,
                    filterPlant,
                    filterFamily,
                    filterSubFamily,
                    filterProductLine,
                  ].filter(Boolean).length
                }
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
            >
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>

        {/* Row 1 — search + primary selects */}
        <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <FilterSearch
              label="Supplier / Site"
              value={search}
              onChange={setSearch}
              placeholder="Name, code or site…"
            />
          </div>
          <FilterSelect
            label="Commodity"
            value={filterCategory}
            onChange={setFilterCategory}
            options={filterOptions.categories}
            placeholder="All commodities"
            active={!!filterCategory}
          />
          <FilterSelect
            label="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={filterOptions.statuses}
            placeholder="All statuses"
            active={!!filterStatus}
          />
          <FilterSelect
            label="Grade"
            value={filterGrade}
            onChange={setFilterGrade}
            options={gradeOptions}
            placeholder="All grades"
            active={!!filterGrade}
          />
        </div>

        {/* Row 2 — secondary selects */}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-3 lg:grid-cols-5 dark:border-white/[0.06]">
          <FilterSelect
            label="Plant"
            value={filterPlant}
            onChange={setFilterPlant}
            options={filterOptions.plants}
            placeholder="All plants"
            active={!!filterPlant}
          />
          <FilterSelect
            label="Scope"
            value={filterScope}
            onChange={setFilterScope}
            options={filterOptions.scopes}
            placeholder="All scopes"
            active={!!filterScope}
          />
          <FilterSelect
            label="Family"
            value={filterFamily}
            onChange={setFilterFamily}
            options={filterOptions.families}
            placeholder="All families"
            active={!!filterFamily}
          />
          <FilterSelect
            label="Sub-family"
            value={filterSubFamily}
            onChange={setFilterSubFamily}
            options={filterOptions.subFamilies}
            placeholder="All sub-families"
            active={!!filterSubFamily}
          />
          <FilterSelect
            label="Product Line"
            value={filterProductLine}
            onChange={setFilterProductLine}
            options={filterOptions.productLines}
            placeholder="All product lines"
            active={!!filterProductLine}
          />
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/[0.06]">
            {[
              { label: "Search", value: search, clear: () => setSearch("") },
              {
                label: "Commodity",
                value: filterCategory,
                clear: () => setFilterCategory(""),
              },
              {
                label: "Status",
                value: filterStatus,
                clear: () => setFilterStatus(""),
              },
              {
                label: "Grade",
                value: filterGrade,
                clear: () => setFilterGrade(""),
              },
              {
                label: "Plant",
                value: filterPlant,
                clear: () => setFilterPlant(""),
              },
              {
                label: "Scope",
                value: filterScope,
                clear: () => setFilterScope(""),
              },
              {
                label: "Family",
                value: filterFamily,
                clear: () => setFilterFamily(""),
              },
              {
                label: "Sub-family",
                value: filterSubFamily,
                clear: () => setFilterSubFamily(""),
              },
              {
                label: "Product Line",
                value: filterProductLine,
                clear: () => setFilterProductLine(""),
              },
            ]
              .filter((f) => f.value)
              .map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1.5 text-[11px] font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                >
                  <span className="text-blue-400 dark:text-blue-500">
                    {f.label}:
                  </span>
                  {f.value}
                  <button
                    type="button"
                    onClick={f.clear}
                    className="grid h-4 w-4 place-items-center rounded-full hover:bg-blue-200 dark:hover:bg-blue-500/30"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* ── Panel toggle + count ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          {panelTabs.filter((tab) => tab.key !== "panel_add_exec_committee" || isAdmin).map((tab) => {
            const isActive = tab.key === activeTab;
            const count = counts[tab.key as keyof typeof counts] ?? 0;
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
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-slate-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-slate-400">
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {filteredRows.length}
          </span>{" "}
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
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Supplier Unit
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Site
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Scope
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Commodity
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Family
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Sub-family
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Grade
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Strategic
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Last Eval
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Dev Plan
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-50 dark:border-white/[0.05]"
                  >
                    {/* Supplier Unit */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.06]" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
                          <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-50 dark:bg-white/[0.04]" />
                        </div>
                      </div>
                    </td>
                    {/* Site */}
                    <td className="px-5 py-3.5">
                      <div className="space-y-1.5">
                        <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
                        <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-50 dark:bg-white/[0.04]" />
                      </div>
                    </td>
                    {/* Scope */}
                    <td className="px-5 py-3.5">
                      <div className="h-6 w-14 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
                    </td>
                    {/* Commodity */}
                    <td className="px-5 py-3.5">
                      <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
                    </td>
                    {/* Family */}
                    <td className="px-5 py-3.5">
                      <div className="h-6 w-20 animate-pulse rounded-lg bg-slate-100 dark:bg-white/[0.06]" />
                    </td>
                    {/* Sub-family */}
                    <td className="px-5 py-3.5">
                      <div className="h-5 w-20 animate-pulse rounded-md bg-slate-100 dark:bg-white/[0.06]" />
                    </td>
                    {/* Grade */}
                    <td className="px-5 py-3.5">
                      <div className="h-9 w-11 animate-pulse rounded-xl bg-slate-100" />
                    </td>
                    {/* Strategic */}
                    <td className="px-5 py-3.5">
                      <div className="h-6 w-28 animate-pulse rounded-full bg-slate-100" />
                    </td>
                    {/* Last Eval */}
                    <td className="px-5 py-3.5">
                      <div className="h-3 w-16 animate-pulse rounded-full bg-slate-100" />
                    </td>
                    {/* Dev Plan */}
                    <td className="px-5 py-3.5">
                      <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        <div className="h-7 w-14 animate-pulse rounded-lg bg-slate-100" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : pagedRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center dark:border-white/[0.12] dark:bg-white/[0.02]">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            No results found
          </p>
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
                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Supplier Unit
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Site
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Scope
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Commodity
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Family
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Sub-family
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Grade
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Strategic
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Last Eval
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Dev Plan
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>

              <tbody>
                {pagedRows.map((row) => {
                  const gradeTone = getGradeTone(row.relation.final_grade);
                  const name = row.group.nom || "?";
                  const accentClass =
                    GRADE_ACCENT[gradeTone] ?? GRADE_ACCENT.slate;
                  const gradeTileClass =
                    GRADE_TILE[gradeTone] ?? GRADE_TILE.slate;

                  return (
                    <tr
                      key={row.relation.id_relation}
                      onClick={() => openModal(row)}
                      className={`group cursor-pointer border-b border-slate-100/80 border-l-[3px] transition-colors duration-150 last:border-b-0 hover:bg-blue-50/30 dark:border-b-white/[0.05] dark:hover:bg-white/[0.025] ${accentClass}`}
                    >
                      {/* Supplier Unit */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[10px] font-extrabold text-white shadow-sm ${supplierPalette(name)}`}
                          >
                            {supplierInitials(name)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
                              {name}
                            </div>
                            <div className="font-mono text-[10.5px] text-slate-400 dark:text-slate-500">
                              {row.unit.supplier_code ||
                                `UNT-${String(row.unit.id_supplier_unit).padStart(6, "0")}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Site */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-[3px] h-2 w-2 flex-shrink-0 rounded-full bg-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/40" />
                          <div>
                            <div className="text-[12.5px] font-medium text-slate-800 dark:text-slate-200">
                              {row.site.site_name || "—"}
                            </div>
                            {row.site.country && (
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                {row.site.city
                                  ? `${row.site.city}, ${row.site.country}`
                                  : row.site.country}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Scope — global_status */}
                      <td className="px-5 py-3.5">
                        {row.relation.global_status ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              normalizeText(row.relation.global_status) === "global"
                                ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                                : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-white/[0.07] dark:text-slate-400 dark:ring-white/[0.08]"
                            }`}
                          >
                            {row.relation.global_status}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Commodity — supplier_type */}
                      <td className="px-5 py-3.5">
                        {row.group.supplier_type ? (
                          <span
                            className={`inline-flex max-w-[120px] items-center truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${tagColor(row.group.supplier_type)}`}
                          >
                            {row.group.supplier_type}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Family */}
                      <td className="px-5 py-3.5">
                        {row.unit.family ? (
                          <span
                            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${tagColor(row.unit.family)}`}
                          >
                            {row.unit.family}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Sub-family */}
                      <td className="px-5 py-3.5">
                        {row.unit.sub_family ? (
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-medium ${tagColor(row.unit.sub_family)}`}
                            style={{ opacity: 0.85 }}
                          >
                            {row.unit.sub_family}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Grade */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex h-9 w-11 items-center justify-center rounded-xl text-sm font-extrabold shadow-sm ring-1 ${gradeTileClass}`}
                        >
                          {row.relation.final_grade || "—"}
                        </span>
                      </td>

                      {/* Strategic mention */}
                      <td className="px-5 py-3.5">
                        <StrategicChips value={row.relation.strategic_mention} />
                      </td>

                      {/* Last Eval */}
                      <td className="px-5 py-3.5">
                        <span className="text-[11.5px] text-slate-400 dark:text-slate-500">
                          {formatDate(row.relation.last_evaluation_date)}
                        </span>
                      </td>

                      {/* Dev Plan */}
                      <td className="px-5 py-3.5">
                        {row.has_development_plan ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {row.development_plan_status || "Active"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-400 ring-1 ring-slate-200 dark:bg-white/[0.05] dark:text-slate-500 dark:ring-white/[0.08]">
                            None
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal(row);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-600"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </button>
                          {isVpConversion && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOverrideModal(row);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-100"
                            >
                              Override Status
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              disabled={togglingUnit === row.relation.id_relation}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmToggleRow(row);
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                row.relation.is_active ?? true
                                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              <Power className="h-3 w-3" />
                              {togglingUnit === row.relation.id_relation
                                ? "…"
                                : (row.relation.is_active ?? true)
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                          )}
                          {isVpConversion && row.relation.panel_decision === "panel_add_exec_committee" && (
                            (row.committee_review_status === "in_progress" || row.committee_review_status === "pending_final") ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCommitteeProgressRow(row);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-200"
                              >
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                                {row.committee_review_status === "pending_final" ? "Awaiting Final Decision" : "Under Committee Revision"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendToCommittee(row);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100"
                              >
                                Send to Committee
                              </button>
                            )
                          )}
                        </div>
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

      {/* ── Override Status modal ── */}
      {overrideRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-md">
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-[0_20px_80px_rgba(2,6,23,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0f2744] px-6 py-5 rounded-t-2xl text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">
                  Override Supplier Status
                </h3>
                <button
                  type="button"
                  onClick={() => setOverrideRow(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1 text-xs text-blue-200/70">
                {overrideRow.group.nom} — {overrideRow.site.site_name}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {overrideError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {overrideError}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  New Status
                </label>
                <div className="relative">
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select a status…</option>
                    <option value="Can Quote and be awarded">
                      Can Quote and be awarded
                    </option>
                    <option value="Should not be awarded">
                      Should not be awarded
                    </option>
                    <option value="On Hold">On Hold</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  placeholder="Explain the reason for this override…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setOverrideRow(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !overrideStatus || !overrideReason.trim() || overrideLoading
                }
                onClick={submitOverride}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {overrideLoading ? "Saving…" : "Confirm Override"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail drawer ── */}
      {modalRow && (
        <RelationDetailModal
          record={modalRow}
          onClose={() => setModalRow(null)}
          isAdmin={isAdmin}
          onToggleActive={() => setConfirmToggleRow(modalRow)}
          togglingUnit={togglingUnit}
        />
      )}

      {/* ── Committee progress modal ── */}
      {committeeProgressRow && (
        <CommitteeProgressModal
          relationId={committeeProgressRow.relation.id_relation}
          supplierName={committeeProgressRow.group.nom ?? ""}
          supplierCode={committeeProgressRow.unit.supplier_code ?? ""}
          siteName={committeeProgressRow.site.site_name ?? ""}
          isVpConversion={isVpConversion}
          onClose={() => setCommitteeProgressRow(null)}
          onReviewChange={() => setReloadTick((v) => v + 1)}
        />
      )}

      {/* ── Committee setup modal ── */}
      {committeeRow && (
        <CommitteeSetupModal
          supplierInfo={{
            relationId: committeeRow.relation.id_relation,
            supplierName: committeeRow.group.nom ?? "",
            supplierCode: committeeRow.unit.supplier_code ?? "",
            siteName: committeeRow.site.site_name ?? "",
          }}
          onClose={() => setCommitteeRow(null)}
          onSent={() => {
            setCommitteeRow(null);
            setReloadTick((v) => v + 1);
          }}
        />
      )}

      {/* ── Activate / Deactivate confirmation ── */}
      {confirmToggleRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-md"
          onClick={() => setConfirmToggleRow(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white shadow-[0_20px_80px_rgba(2,6,23,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className={`flex items-center gap-3 rounded-t-2xl px-6 py-5 ${
                confirmToggleRow.relation.is_active ?? true
                  ? "bg-rose-600"
                  : "bg-emerald-600"
              }`}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Power className="h-4 w-4 text-white" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {confirmToggleRow.relation.is_active ?? true
                    ? "Deactivate supplier relation"
                    : "Activate supplier relation"}
                </h3>
                <p className="mt-0.5 text-xs text-white/70">
                  {confirmToggleRow.group.nom} — {confirmToggleRow.site.site_name}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                {confirmToggleRow.relation.is_active ?? true ? (
                  <>
                    This relation will be marked <strong>inactive</strong> and will
                    no longer appear in the supplier panel, public directory, or
                    opportunity tracking for this site.
                  </>
                ) : (
                  <>
                    This relation will be marked <strong>active</strong> again and
                    will resume appearing in the supplier panel and opportunity
                    tracking for this site.
                  </>
                )}
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setConfirmToggleRow(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={togglingUnit === confirmToggleRow.relation.id_relation}
                onClick={async () => {
                  const row = confirmToggleRow;
                  setConfirmToggleRow(null);
                  await toggleRelationActive(
                    row.relation.id_relation,
                    row.relation.is_active ?? true,
                  );
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                  confirmToggleRow.relation.is_active ?? true
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {confirmToggleRow.relation.is_active ?? true
                  ? "Yes, deactivate"
                  : "Yes, activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

