import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  ExternalLink,
  FileCheck,
  FileText,
  Layers,
  Mail,
  MailCheck,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Upload,
  User,
  X,
  Zap,
} from "lucide-react";
import { InlineAlert, PageIntro, Pill } from "../components/UI";
import { SharedSendRequestModal } from "../components/development-plans/SendRequestModal";
import supplierAPI from "../services/supplierOnboardingAPI";
import type {
  DevelopmentPlanRegisterRow,
  PlanDocument,
  SupplierDevelopmentPlan,
} from "../types/onboarding";

// ─── constants ────────────────────────────────────────────────────────────────

const PLAN_STATUSES = [
  "Must be send",
  "Request sent",
  "Received",
  "Under Review",
  "Approved",
  "Rejected",
  "Closed",
  "Cancelled",
] as const;

type StatusGroup = "action" | "progress" | "closed";
type StatusTab = "all" | StatusGroup;
type ModalKey = "send" | "received" | "review" | "decision" | "revision" | "details";

const STATUS_GROUP: Record<string, StatusGroup> = {
  "must be send": "action",
  "request sent": "progress",
  received: "progress",
  "under review": "progress",
  approved: "closed",
  rejected: "closed",
  closed: "closed",
  cancelled: "closed",
};

const getStatusGroup = (s?: string | null): StatusGroup =>
  STATUS_GROUP[(s ?? "").toLowerCase()] ?? "progress";

// ─── helpers ──────────────────────────────────────────────────────────────────

const formatDate = (v?: string | null): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime())
    ? v
    : d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const daysDiff = (ds?: string | null): number | null => {
  if (!ds) return null;
  const due = new Date(ds);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
};

const normalize = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const parseEmails = (raw: string) =>
  raw
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
const validateEmails = (list: string[]) => list.every((e) => EMAIL_RE.test(e));

// ─── design tokens ────────────────────────────────────────────────────────────

type PillTone = "neutral" | "brand" | "success" | "warning" | "danger";

// Richer status pill config — solid fills for active/terminal, soft for neutral
const STATUS_CFG: Record<string, {
  tone: PillTone;
  label: string;
  bg: string;
  text: string;
  border: string;
  Icon: React.FC<{ className?: string }>;
}> = {
  "must be send": {
    tone: "warning", label: "Must Send",
    bg: "bg-amber-500", text: "text-white", border: "border-transparent",
    Icon: (p) => <Zap {...p} />,
  },
  "request sent": {
    tone: "brand", label: "Request Sent",
    bg: "bg-sky-100", text: "text-sky-800", border: "border-sky-200",
    Icon: (p) => <Send {...p} />,
  },
  received: {
    tone: "neutral", label: "Received",
    bg: "bg-violet-100", text: "text-violet-800", border: "border-violet-200",
    Icon: (p) => <MailCheck {...p} />,
  },
  "under review": {
    tone: "brand", label: "Under Review",
    bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-200",
    Icon: (p) => <Eye {...p} />,
  },
  approved: {
    tone: "success", label: "Approved",
    bg: "bg-emerald-500", text: "text-white", border: "border-transparent",
    Icon: (p) => <CheckCircle2 {...p} />,
  },
  rejected: {
    tone: "danger", label: "Rejected",
    bg: "bg-rose-500", text: "text-white", border: "border-transparent",
    Icon: (p) => <Ban {...p} />,
  },
  closed: {
    tone: "neutral", label: "Closed",
    bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200",
    Icon: (p) => <CheckCircle2 {...p} />,
  },
  cancelled: {
    tone: "neutral", label: "Cancelled",
    bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200",
    Icon: (p) => <X {...p} />,
  },
};

const getStatusCfg = (s?: string | null) =>
  STATUS_CFG[(s ?? "").toLowerCase()] ?? {
    tone: "neutral" as PillTone, label: s ?? "—",
    bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200",
    Icon: (p: { className?: string }) => <X {...p} />,
  };

// Inline status pill with icon
function StatusPill({ status }: { status?: string | null }) {
  const cfg = getStatusCfg(status);
  const { Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
    </span>
  );
}

// Grade badge — richer shadow + saturation
const GRADE_CFG: Record<string, { bg: string; text: string; ring: string; shadow: string }> = {
  A: { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-300", shadow: "shadow-emerald-200" },
  B: { bg: "bg-sky-100",     text: "text-sky-800",     ring: "ring-sky-300",     shadow: "shadow-sky-200" },
  C: { bg: "bg-amber-100",   text: "text-amber-800",   ring: "ring-amber-300",   shadow: "shadow-amber-200" },
  D: { bg: "bg-rose-100",    text: "text-rose-800",    ring: "ring-rose-300",    shadow: "shadow-rose-200" },
};

const getGradeBadge = (g?: string | null) => {
  if (!g) return null;
  const u = g.toUpperCase();
  const firstChar = u.charAt(0);
  return {
    letter: firstChar,
    fullGrade: u,
    ...(GRADE_CFG[firstChar] ?? { bg: "bg-slate-100", text: "text-slate-600", ring: "ring-slate-300", shadow: "shadow-slate-100" }),
  };
};

// Action button config
const ACTION_CFG: Record<string, { label: string; modal: ModalKey; bg: string; text: string; Icon: React.FC<{ className?: string }> }> = {
  "must be send": {
    label: "Send Request", modal: "send",
    bg: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700",
    text: "text-white",
    Icon: (p) => <Mail {...p} />,
  },
  "request sent": {
    label: "Mark Received", modal: "received",
    bg: "bg-sky-600 hover:bg-sky-700 active:bg-sky-800",
    text: "text-white",
    Icon: (p) => <MailCheck {...p} />,
  },
  received: {
    label: "Submit for Review", modal: "review",
    bg: "bg-violet-600 hover:bg-violet-700 active:bg-violet-800",
    text: "text-white",
    Icon: (p) => <ArrowRight {...p} />,
  },
  "under review": {
    label: "Record Decision", modal: "decision",
    bg: "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800",
    text: "text-white",
    Icon: (p) => <CheckCircle2 {...p} />,
  },
  rejected: {
    label: "Request Revision", modal: "revision",
    bg: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700",
    text: "text-white",
    Icon: (p) => <RotateCcw {...p} />,
  },
};

const getAction = (s?: string | null) =>
  ACTION_CFG[(s ?? "").toLowerCase()] ?? {
    label: "View Details", modal: "details" as ModalKey,
    bg: "border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100",
    text: "text-slate-700",
    Icon: (p: { className?: string }) => <FileText {...p} />,
  };

// Shared input
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#062B49]/40 focus:bg-white focus:ring-4 focus:ring-[#062B49]/8 shadow-sm";

// Plan title with CSS tooltip shown on hover when text is truncated
function PlanTitleTooltip({ title }: { title: string }) {
  return (
    <div className="group relative mt-1.5 inline-block max-w-full">
      <p className="max-w-[220px] cursor-default truncate text-[12px] font-medium text-slate-500">
        {title}
      </p>
      {/* tooltip — appears above, only if content overflows */}
      <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 hidden w-max max-w-xs group-hover:block">
        <div className="rounded-xl bg-[#062B49] px-3 py-2 text-[11px] font-semibold leading-snug text-white shadow-xl shadow-[#062B49]/20">
          {title}
          <div className="absolute left-3 top-full h-0 w-0 border-x-4 border-x-transparent border-t-4 border-t-[#062B49]" />
        </div>
      </div>
    </div>
  );
}

// Supplier status → coloured dot
const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  "can quote and be awarded":    { dot: "bg-emerald-500", label: "Green" },
  "can quote but not be awarded": { dot: "bg-amber-400",  label: "Orange" },
  "new business on hold":        { dot: "bg-rose-500",    label: "On Hold" },
};

function SupplierStatusDot({ status }: { status?: string | null }) {
  if (!status) return null;
  const cfg = STATUS_DOT[status.toLowerCase()] ?? { dot: "bg-slate-400", label: status };
  return (
    <span className="group relative inline-flex items-center gap-1 cursor-default">
      <span className={`h-2 w-2 rounded-full ${cfg.dot} shadow-sm`} />
      {/* tooltip */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden -translate-x-1/2 group-hover:block">
        <span className="whitespace-nowrap rounded-lg bg-[#062B49] px-2 py-1 text-[10px] font-bold text-white shadow-lg">
          {cfg.label}
        </span>
      </span>
    </span>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({
  title,
  subtitle,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  // Reset the modal's internal scroll to the top after the browser's own
  // autofocus-scroll fires (rAF runs after that browser paint, plain useEffect does not).
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const maxW =
    size === "sm" ? "max-w-xl" : size === "lg" ? "max-w-5xl" : "max-w-3xl";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#062B49]/40 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[92vh] w-full flex-col ${maxW} overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_rgba(6,43,73,0.22)]`}
      >
        {/* Modal header */}
        <div className="flex shrink-0 items-start justify-between bg-gradient-to-r from-slate-50 to-white px-7 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs font-medium text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Supplier context banner ──────────────────────────────────────────────────

const BANNER_TONE: Record<string, { border: string; bg: string; accent: string }> = {
  slate:  { border: "border-slate-200",  bg: "bg-slate-50",   accent: "bg-slate-200" },
  amber:  { border: "border-amber-200",  bg: "bg-amber-50",   accent: "bg-amber-400" },
  blue:   { border: "border-sky-200",    bg: "bg-sky-50",     accent: "bg-sky-400" },
  purple: { border: "border-violet-200", bg: "bg-violet-50",  accent: "bg-violet-400" },
  indigo: { border: "border-indigo-200", bg: "bg-indigo-50",  accent: "bg-indigo-400" },
};

function SupplierBanner({
  item,
  tone = "slate",
}: {
  item: DevelopmentPlanRegisterRow;
  tone?: keyof typeof BANNER_TONE;
}) {
  const dp = item.development_plan;
  const badge = getGradeBadge(item.relation.operational_grade);
  const t = BANNER_TONE[tone];
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border ${t.border} ${t.bg} pl-0 pr-4 py-0`}>
      {/* color accent bar */}
      <div className="flex min-w-0 items-center gap-3">
        <div className={`h-full w-1 self-stretch rounded-l-2xl ${t.accent}`} style={{ minHeight: 52 }} />
        <div className="py-3 min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{item.group_name || "—"}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {item.site_name || "—"} · {item.unit_supplier_code || "—"}
          </p>
          {dp.plan_title && (
            <p className="mt-0.5 max-w-xs truncate text-[11px] font-medium text-slate-500 italic">
              {dp.plan_title}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && (
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold ring-2 shadow-sm ${badge.bg} ${badge.text} ${badge.ring} ${badge.shadow}`}>
            {badge.letter}
          </span>
        )}
        <StatusPill status={dp.plan_status} />
      </div>
    </div>
  );
}

// ─── Workflow stepper ─────────────────────────────────────────────────────────

const STEPS = ["Request Sent", "Plan Received", "Under Review", "Decision"] as const;

function WorkflowStepper({
  currentStep,
  isRejected = false,
}: {
  currentStep: number;
  isRejected?: boolean;
}) {
  return (
    <div className="flex items-start rounded-2xl bg-slate-50/80 px-4 py-3">
      {STEPS.map((label, idx) => {
        const stepNum = idx + 1;
        const done = currentStep > stepNum;
        const active = currentStep === stepNum;
        const isDecision = stepNum === 4;
        const isLast = idx === STEPS.length - 1;
        const activeColor = isDecision && isRejected ? "bg-rose-500 shadow-rose-200" : "bg-[#062B49] shadow-[#062B49]/20";

        return (
          <div key={label} className="flex flex-1 items-start">
            <div className="flex flex-1 flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shadow-md transition ${
                  done
                    ? "bg-emerald-500 text-white shadow-emerald-200"
                    : active
                    ? `${activeColor} text-white`
                    : "bg-white text-slate-400 shadow-none ring-1 ring-slate-200"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNum}
              </div>
              <span
                className={`mt-1.5 text-center text-[10px] leading-tight ${
                  active
                    ? "font-bold text-slate-800"
                    : done
                    ? "font-semibold text-emerald-600"
                    : "font-medium text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div className={`mt-3.5 h-px flex-1 transition-colors ${done ? "bg-emerald-300" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Due date chip ────────────────────────────────────────────────────────────

function DueDateChip({
  dueDate,
  isOverdue,
  daysPastDue,
}: {
  dueDate?: string | null;
  isOverdue?: boolean;
  daysPastDue?: number | null;
}) {
  const diff = daysDiff(dueDate);
  if (diff === null) return null;
  if (isOverdue || diff < 0) {
    const days = daysPastDue ?? Math.abs(diff);
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm shadow-rose-200">
        <AlertCircle className="h-3 w-3" />
        {days}d overdue
      </span>
    );
  }
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm shadow-amber-200">
        <Clock className="h-3 w-3" />
        Due today
      </span>
    );
  if (diff <= 7)
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
        <Clock className="h-3 w-3" />
        {diff}d left
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      <Calendar className="h-3 w-3" />
      {diff}d left
    </span>
  );
}

// ─── Plan timeline ────────────────────────────────────────────────────────────

function PlanTimeline({ plan }: { plan: SupplierDevelopmentPlan }) {
  type Ev = {
    date?: string | null;
    label: string;
    by?: string | null;
    dot: string;
  };
  const events: Ev[] = [
    {
      date: plan.created_at,
      label: "Plan auto-created — grade C/D evaluation",
      dot: "bg-amber-400",
    },
    { date: plan.issue_date, label: "Request issued", dot: "bg-slate-400" },
    ...(plan.plan_status !== "Must be send" && plan.issue_date
      ? [
          {
            date: plan.issue_date,
            label: "Request email sent to supplier",
            dot: "bg-sky-400",
          },
        ]
      : []),
    ...(plan.submission_date
      ? [
          {
            date: plan.submission_date,
            label: "Action plan received from supplier",
            dot: "bg-purple-400",
          },
        ]
      : []),
    ...(plan.review_date
      ? [
          {
            date: plan.review_date,
            label: "Submitted for committee review",
            by: plan.reviewed_by,
            dot: "bg-indigo-400",
          },
        ]
      : []),
    ...(plan.decision_date && plan.approved_by
      ? [
          {
            date: plan.decision_date,
            label: "Approved by committee",
            by: plan.approved_by,
            dot: "bg-emerald-500",
          },
        ]
      : []),
    ...(plan.decision_date && plan.rejected_by
      ? [
          {
            date: plan.decision_date,
            label: "Rejected by committee",
            by: plan.rejected_by,
            dot: "bg-rose-500",
          },
        ]
      : []),
    ...(plan.updated_at && !plan.approved_by && !plan.rejected_by
      ? [
          {
            date: plan.updated_at,
            label: "Last updated",
            dot: "bg-slate-300",
          },
        ]
      : []),
  ].filter((e) => e.date);

  if (!events.length) return null;

  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Timeline
      </p>
      <div className="relative space-y-0 pl-5">
        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />
        {events.map((ev, i) => (
          <div key={i} className="relative flex items-start gap-3 py-2.5">
            <div
              className={`absolute left-[-11px] mt-[5px] h-3 w-3 rounded-full border-2 border-white ${ev.dot}`}
            />
            <div>
              <p className="text-xs font-semibold text-slate-800">{ev.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDate(ev.date) ?? "—"}
                {ev.by ? ` · ${ev.by}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {msg}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 — Send Request
// ═══════════════════════════════════════════════════════════════════════════════

function SendRequestModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const plan = item.development_plan;
  const supplierOwner = (item.relation as any).supplier_owner as
    | string
    | undefined;

  const [dueDate, setDueDate] = useState(plan.due_date?.slice(0, 10) ?? "");
  const [planTitle, setPlanTitle] = useState(plan.plan_title ?? "");
  const [customMessage, setCustomMessage] = useState("");
  const [overrideMode, setOverrideMode] = useState(false);
  const [toRaw, setToRaw] = useState("");
  const [ccRaw, setCcRaw] = useState(supplierOwner ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!dueDate) {
      setError("A due date is required before sending the request.");
      return;
    }
    let toEmails: string[] | undefined;
    if (overrideMode) {
      const parsed = parseEmails(toRaw);
      if (!parsed.length) {
        setError("Enter at least one recipient email.");
        return;
      }
      if (!validateEmails(parsed)) {
        setError("One or more recipient email addresses are invalid.");
        return;
      }
      toEmails = parsed;
    }
    const ccParsed = parseEmails(ccRaw);
    if (ccParsed.length && !validateEmails(ccParsed)) {
      setError("One or more CC email addresses are invalid.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await supplierAPI.updateRelationDevelopmentPlan(
        item.relation.id_relation,
        plan.id_development_plan,
        {
          due_date: dueDate,
          plan_title: planTitle.trim() || undefined,
          sync_relation_hold_status: false,
        },
      );
      await supplierAPI.sendRelationDevelopmentPlanRequest(
        item.relation.id_relation,
        plan.id_development_plan,
        {
          custom_message: customMessage.trim() || undefined,
          to_emails: toEmails,
          extra_cc_emails: ccParsed.length ? ccParsed : undefined,
        },
      );
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send the request.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title="Send Development Plan Request"
      subtitle="Step 1 of 4 — Notify the supplier"
      onClose={onClose}
    >
      <div className="space-y-5">
        <WorkflowStepper currentStep={1} />
        <SupplierBanner item={item} tone="amber" />
        {error && <ErrorMsg msg={error} />}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Plan Title
          </label>
          <input
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            className={inputCls}
            placeholder="Development plan title…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Score Update Date
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
              {formatDate(plan.issue_date) ?? "—"}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Date the scorecard was updated (Red status triggered this plan).
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Due Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              Deadline included in the email.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Email Recipients
            </p>
            <button
              type="button"
              onClick={() => {
                setOverrideMode((v) => !v);
                if (!overrideMode) setToRaw("");
              }}
              className="text-xs font-semibold text-sky-600 hover:text-sky-800"
            >
              {overrideMode ? "Use default contacts" : "Override recipients"}
            </button>
          </div>
          {!overrideMode ? (
            <p className="text-xs text-slate-500">
              Email will be sent to the registered contacts for this supplier
              unit.
            </p>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Send To <span className="text-rose-500">*</span>
              </label>
              <input
                value={toRaw}
                onChange={(e) => setToRaw(e.target.value)}
                className={inputCls}
                placeholder="email1@example.com, email2@example.com"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              CC — Supplier Owner / Additional
            </label>
            <input
              value={ccRaw}
              onChange={(e) => setCcRaw(e.target.value)}
              className={inputCls}
              placeholder="owner@company.com"
            />
            {supplierOwner && (
              <p className="mt-1 text-xs text-slate-400">
                Pre-filled with supplier owner:{" "}
                <span className="font-medium text-slate-600">
                  {supplierOwner}
                </span>
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Custom Message{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={3}
            className={`${inputCls} resize-none`}
            placeholder="Additional context to include in the email…"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !dueDate}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {isSaving ? "Sending…" : "Send Request Email"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — Mark Received (multi-file)
// ═══════════════════════════════════════════════════════════════════════════════

interface QueuedFile {
  id: string;
  file: File;
  notes: string;
}

function MarkReceivedModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const plan = item.development_plan;
  const supplierOwner = (item.relation as any).supplier_owner as string | undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submissionDate, setSubmissionDate] = useState(todayStr());
  const [supplierComments, setSupplierComments] = useState(plan.supplier_comments ?? "");
  const [internalComments, setInternalComments] = useState("");

  // Multi-file queue
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: QueuedFile[] = Array.from(files).map((f) => ({
      id: `${f.name}-${f.lastModified}-${Math.random()}`,
      file: f,
      notes: "",
    }));
    setQueue((q) => [...q, ...next]);
  };
  const removeFile = (id: string) => setQueue((q) => q.filter((f) => f.id !== id));
  const updateNotes = (id: string, notes: string) =>
    setQueue((q) => q.map((f) => (f.id === id ? { ...f, notes } : f)));

  // Optional email after upload
  const [sendEmail, setSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState(supplierOwner ?? "");
  const [emailMessage, setEmailMessage] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (sendEmail) {
      const to = parseEmails(emailTo);
      if (!to.length || !validateEmails(to)) {
        setError("Enter at least one valid recipient email address.");
        return;
      }
    }
    setIsSaving(true);
    setError(null);
    try {
      // Upload each file in sequence
      if (queue.length > 0) {
        setUploadProgress({ done: 0, total: queue.length });
        for (let i = 0; i < queue.length; i++) {
          const q = queue[i];
          setSaveStep(`Uploading ${q.file.name} (${i + 1}/${queue.length})…`);
          await supplierAPI.uploadRelationDevelopmentPlanDocument(
            item.relation.id_relation,
            plan.id_development_plan,
            q.file,
            q.notes.trim() || undefined,
          );
          setUploadProgress({ done: i + 1, total: queue.length });
        }
      }

      setSaveStep("Updating plan…");
      await supplierAPI.updateRelationDevelopmentPlan(
        item.relation.id_relation,
        plan.id_development_plan,
        {
          plan_status: "Received",
          submission_date: submissionDate || undefined,
          supplier_comments: supplierComments.trim() || undefined,
          internal_comments: internalComments.trim() || undefined,
          sync_relation_hold_status: false,
        },
      );

      if (sendEmail) {
        const to = parseEmails(emailTo);
        const cc = parseEmails(emailCc).filter((e) => validateEmails([e]));
        setSaveStep("Sending notification email…");
        await supplierAPI.sendPlanReceivedNotification(
          item.relation.id_relation,
          plan.id_development_plan,
          {
            to_emails: to,
            extra_cc_emails: cc.length ? cc : undefined,
            custom_message: emailMessage.trim() || undefined,
          },
        );
      }

      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update the plan.");
    } finally {
      setIsSaving(false);
      setSaveStep(null);
      setUploadProgress(null);
    }
  };

  return (
    <Modal
      title="Mark Plan as Received"
      subtitle="Step 2 of 4 — Supplier submitted their action plan"
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-5">
        <WorkflowStepper currentStep={2} />
        <SupplierBanner item={item} tone="blue" />
        {error && <ErrorMsg msg={error} />}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Submission Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={submissionDate}
            onChange={(e) => setSubmissionDate(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* ── Multi-file upload area ── */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Action Plan Documents</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
            >
              <Upload className="h-3.5 w-3.5" />
              Add files
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={(e) => addFiles(e.target.files)}
          />

          {/* Queued files */}
          {queue.length > 0 ? (
            <div className="space-y-2">
              {queue.map((qf) => (
                <div
                  key={qf.id}
                  className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2.5"
                >
                  <FileCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{qf.file.name}</p>
                    <p className="text-xs text-slate-400">
                      {(qf.file.size / 1024).toFixed(0)} KB
                    </p>
                    <input
                      value={qf.notes}
                      onChange={(e) => updateNotes(qf.id, e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                      placeholder="Optional note for this file…"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(qf.id)}
                    className="mt-0.5 shrink-0 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center hover:border-sky-300 hover:bg-sky-50"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-1 text-sm text-slate-500">Click to add files, or drag and drop</p>
              <p className="text-xs text-slate-400">PDF, Word, Excel, Images — multiple files allowed</p>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Uploading…</span>
                <span>{uploadProgress.done}/{uploadProgress.total}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Supplier's Action Description{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={supplierComments}
              onChange={(e) => setSupplierComments(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Summarise the supplier's proposed actions…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Internal Notes{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={internalComments}
              onChange={(e) => setInternalComments(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Internal observations…"
            />
          </div>
        </div>

        {/* ── Optional email notification ── */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setSendEmail((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">
                Also send notification email with documents
              </span>
            </div>
            <div className={`h-5 w-9 rounded-full transition-colors ${sendEmail ? "bg-sky-500" : "bg-slate-300"}`}>
              <div className={`m-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${sendEmail ? "translate-x-4" : "translate-x-0"}`} />
            </div>
          </button>

          {sendEmail && (
            <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Send To <span className="text-rose-500">*</span>
                </label>
                <input
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className={inputCls}
                  placeholder="manager@company.com, quality@company.com"
                />
                <p className="mt-1 text-xs text-slate-400">
                  The uploaded files will be attached to this email.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">CC</label>
                <input
                  value={emailCc}
                  onChange={(e) => setEmailCc(e.target.value)}
                  className={inputCls}
                  placeholder="owner@company.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Message</label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="Optional context to include in the email…"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileCheck className="h-4 w-4" />
            {isSaving
              ? (saveStep ?? "Saving…")
              : sendEmail
              ? "Save & Send Notification"
              : "Mark as Received"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — Submit for Review
// ═══════════════════════════════════════════════════════════════════════════════

function SubmitForReviewModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const plan = item.development_plan;
  const supplierOwner = (item.relation as any).supplier_owner as string | undefined;

  const [reviewDate, setReviewDate] = useState(todayStr());
  const [reviewedBy, setReviewedBy] = useState("");
  // Due in 8 days by default — standard review window from the process diagram note
  const defaultReviewDeadline = () => {
    const d = new Date();
    d.setDate(d.getDate() + 8);
    return d.toISOString().slice(0, 10);
  };
  const [reviewDeadline, setReviewDeadline] = useState(defaultReviewDeadline);
  const [reviewersRaw, setReviewersRaw] = useState("");
  const [ccRaw, setCcRaw] = useState(supplierOwner ?? "");
  const [internalComments, setInternalComments] = useState(plan.internal_comments ?? "");
  const [customMessage, setCustomMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reviewedBy.trim()) {
      setError("Please enter the name of the person submitting for review.");
      return;
    }
    const toEmails = parseEmails(reviewersRaw);
    if (!toEmails.length) {
      setError("Enter at least one reviewer email (Plant Manager, Quality or Logistics).");
      return;
    }
    if (!validateEmails(toEmails)) {
      setError("One or more reviewer email addresses are invalid.");
      return;
    }
    const ccEmails = parseEmails(ccRaw);
    if (ccEmails.length && !validateEmails(ccEmails)) {
      setError("One or more CC email addresses are invalid.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      setSaveStep("Updating plan status…");
      await supplierAPI.updateRelationDevelopmentPlan(
        item.relation.id_relation,
        plan.id_development_plan,
        {
          plan_status: "Under Review",
          review_date: reviewDate || undefined,
          reviewed_by: reviewedBy.trim(),
          internal_comments: internalComments.trim() || undefined,
          sync_relation_hold_status: false,
        },
      );
      setSaveStep("Sending review notification…");
      await supplierAPI.sendRelationDevelopmentPlanReviewNotification(
        item.relation.id_relation,
        plan.id_development_plan,
        {
          to_emails: toEmails,
          extra_cc_emails: ccEmails.length ? ccEmails : undefined,
          custom_message: customMessage.trim() || undefined,
          review_deadline: reviewDeadline || undefined,
        },
      );
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit for review.");
    } finally {
      setIsSaving(false);
      setSaveStep(null);
    }
  };

  return (
    <Modal
      title="Submit for Committee Review"
      subtitle="Step 3 of 4 — Notify Plant Manager · Quality · Logistics"
      onClose={onClose}
    >
      <div className="space-y-5">
        <WorkflowStepper currentStep={3} />
        <SupplierBanner item={item} tone="purple" />
        {error && <ErrorMsg msg={error} />}

        {/* Submitted by + Review date */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Submitted By <span className="text-rose-500">*</span>
            </label>
            <input
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              className={inputCls}
              placeholder="Your name…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Submission Date
            </label>
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Attached plan */}
        {plan.file_url && (
          <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm">
            <FileCheck className="h-4 w-4 shrink-0 text-purple-500" />
            <span className="text-purple-700">Attached:</span>
            <a
              href={plan.file_url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#062B49] hover:underline"
            >
              {plan.file_name || "View plan document"}
            </a>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </div>
        )}
        {!plan.file_url && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            No document attached yet. Consider uploading the plan before submitting for review.
          </div>
        )}

        {/* Reviewer emails — the committee */}
        <div className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-sm font-semibold text-purple-900">
            Committee — Review Email Recipients <span className="text-rose-500">*</span>
          </p>
          <p className="text-xs text-purple-700">
            Enter the emails of the Plant Manager, Quality, and Logistics people who need to review this plan.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Send To (Plant Manager / Quality / Logistics)
            </label>
            <textarea
              value={reviewersRaw}
              onChange={(e) => setReviewersRaw(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="plantmanager@company.com, quality@company.com, logistics@company.com"
            />
            <p className="mt-1 text-xs text-slate-400">Separate multiple addresses with commas.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              CC — Supplier Owner / Additional
            </label>
            <input
              value={ccRaw}
              onChange={(e) => setCcRaw(e.target.value)}
              className={inputCls}
              placeholder="owner@company.com"
            />
            {supplierOwner && (
              <p className="mt-1 text-xs text-slate-400">
                Pre-filled: <span className="font-medium text-slate-600">{supplierOwner}</span>
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Review Deadline (shown in the email)
            </label>
            <input
              type="date"
              value={reviewDeadline}
              onChange={(e) => setReviewDeadline(e.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">Default: 8 days from today per process standard.</p>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Message to Committee{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Any specific context or guidance for the reviewers…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Internal Notes{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={internalComments}
              onChange={(e) => setInternalComments(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Internal notes saved to the plan record…"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !reviewersRaw.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {isSaving ? (saveStep ?? "Submitting…") : "Submit & Notify Committee"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4 — Committee Decision
// ═══════════════════════════════════════════════════════════════════════════════

function ReviewDecisionModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: (result: "approved" | "rejected") => void;
}) {
  const plan = item.development_plan;
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [decisionDate, setDecisionDate] = useState(todayStr());
  const [decisionBy, setDecisionBy] = useState("");
  const [internalComments, setInternalComments] = useState("");
  // Development plan approval/rejection does NOT automatically change supplier status.
  // Status is driven by the final grade (A1/B2/C4/D3…) via the evaluation cycle.
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!decision) {
      setError("Please select a decision.");
      return;
    }
    if (!decisionBy.trim()) {
      setError(
        `Please enter the name of the person ${
          decision === "approved" ? "approving" : "rejecting"
        } this plan.`,
      );
      return;
    }
    if (decision === "rejected" && !internalComments.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await supplierAPI.updateRelationDevelopmentPlan(
        item.relation.id_relation,
        plan.id_development_plan,
        {
          plan_status: decision === "approved" ? "Approved" : "Rejected",
          decision_date: decisionDate || undefined,
          approved_by: decision === "approved" ? decisionBy.trim() : undefined,
          rejected_by: decision === "rejected" ? decisionBy.trim() : undefined,
          internal_comments: internalComments.trim() || undefined,
          // Supplier status is driven by the evaluation final grade (A1/C4/D2…),
          // not by plan approval. Never auto-sync here.
          sync_relation_hold_status: false,
        },
      );
      onSuccess(decision);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to record the decision.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title="Committee Review Decision"
      subtitle="Step 4 of 4 — Record the committee's decision"
      onClose={onClose}
    >
      <div className="space-y-5">
        <WorkflowStepper currentStep={4} isRejected={decision === "rejected"} />
        <SupplierBanner item={item} tone="indigo" />
        {error && <ErrorMsg msg={error} />}

        {/* Decision toggle */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Decision <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["approved", "rejected"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDecision(d)}
                className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4 text-sm font-semibold transition ${
                  decision === d
                    ? d === "approved"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-100"
                      : "border-rose-400 bg-rose-50 text-rose-800 shadow-sm shadow-rose-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {d === "approved" ? (
                  <ThumbsUp className="h-4 w-4" />
                ) : (
                  <ThumbsDown className="h-4 w-4" />
                )}
                {d === "approved" ? "Approve Plan" : "Reject Plan"}
              </button>
            ))}
          </div>
        </div>

        {decision && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Decision Date
                </label>
                <input
                  type="date"
                  value={decisionDate}
                  onChange={(e) => setDecisionDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  {decision === "approved" ? "Approved By" : "Rejected By"}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  value={decisionBy}
                  onChange={(e) => setDecisionBy(e.target.value)}
                  className={inputCls}
                  placeholder="Committee member name…"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                {decision === "rejected" ? (
                  <>
                    Rejection Reason <span className="text-rose-500">*</span>
                  </>
                ) : (
                  "Decision Notes (optional)"
                )}
              </label>
              <textarea
                value={internalComments}
                onChange={(e) => setInternalComments(e.target.value)}
                rows={3}
                className={`${inputCls} resize-none ${
                  decision === "rejected"
                    ? "border-rose-200 bg-rose-50/40 focus:border-rose-300 focus:ring-rose-100"
                    : ""
                }`}
                placeholder={
                  decision === "rejected"
                    ? "Required — explain why the plan was rejected…"
                    : "Optional committee notes…"
                }
              />
            </div>

            {decision === "approved" && (
              <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
                The supplier's business status is controlled by their evaluation grade (A1, C4, D2…).
                Plan approval does not change it — run a new evaluation to update the status.
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !decision}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
              decision === "rejected"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {decision === "approved" ? (
              <ThumbsUp className="h-4 w-4" />
            ) : (
              <ThumbsDown className="h-4 w-4" />
            )}
            {isSaving
              ? "Saving…"
              : decision === "approved"
              ? "Approve Plan"
              : "Reject Plan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request Revision (after rejection)
// ═══════════════════════════════════════════════════════════════════════════════

function RequestRevisionModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const plan = item.development_plan;
  const supplierOwner = (item.relation as any).supplier_owner as
    | string
    | undefined;

  const [newDueDate, setNewDueDate] = useState("");
  const [ccRaw, setCcRaw] = useState(supplierOwner ?? "");
  const [customMessage, setCustomMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!newDueDate) {
      setError("Please set a new due date for the revision.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await supplierAPI.updateRelationDevelopmentPlan(
        item.relation.id_relation,
        plan.id_development_plan,
        {
          plan_status: "Request sent",
          due_date: newDueDate,
          internal_comments:
            customMessage.trim() ||
            `Revision requested after rejection. New due date: ${newDueDate}.`,
          sync_relation_hold_status: false,
        },
      );
      const ccParsed = parseEmails(ccRaw);
      await supplierAPI.sendRelationDevelopmentPlanRequest(
        item.relation.id_relation,
        plan.id_development_plan,
        {
          custom_message: customMessage.trim() || undefined,
          extra_cc_emails:
            ccParsed.length && validateEmails(ccParsed) ? ccParsed : undefined,
        },
      );
      onSuccess();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to request revision.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title="Request Plan Revision"
      subtitle="Return the plan to the supplier for revision"
      onClose={onClose}
      size="sm"
    >
      <div className="space-y-5">
        <SupplierBanner item={item} tone="amber" />

        {/* Rejection context */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            <div>
              <p className="text-sm font-semibold text-rose-800">
                Plan was rejected
              </p>
              {plan.rejected_by && (
                <p className="mt-0.5 text-xs text-rose-600">
                  Rejected by: {plan.rejected_by}
                </p>
              )}
              {plan.internal_comments && (
                <p className="mt-1 text-xs italic text-rose-600">
                  {plan.internal_comments}
                </p>
              )}
            </div>
          </div>
        </div>

        {error && <ErrorMsg msg={error} />}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            New Due Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-slate-400">
            Deadline for the supplier to submit the revised plan.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            CC{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            value={ccRaw}
            onChange={(e) => setCcRaw(e.target.value)}
            className={inputCls}
            placeholder="owner@company.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Message to Supplier{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={3}
            className={`${inputCls} resize-none`}
            placeholder="Explain what needs to be revised in the action plan…"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !newDueDate}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {isSaving ? "Sending…" : "Request Revision"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// View / Edit Details modal
// ═══════════════════════════════════════════════════════════════════════════════

function ViewDetailsModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const plan = item.development_plan;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    plan_title: plan.plan_title ?? "",
    plan_status: plan.plan_status ?? "",
    internal_comments: plan.internal_comments ?? "",
    supplier_comments: plan.supplier_comments ?? "",
  });
  const [existingDocs, setExistingDocs] = useState<PlanDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const isClosed = ["approved", "closed", "cancelled"].includes(
    (plan.plan_status ?? "").toLowerCase(),
  );

  // Load all documents for this plan
  useEffect(() => {
    let cancelled = false;
    supplierAPI
      .listPlanDocuments(item.relation.id_relation, plan.id_development_plan)
      .then((res) => {
        if (!cancelled)
          setExistingDocs((res.data?.items ?? []) as PlanDocument[]);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDocsLoading(false); });
    return () => { cancelled = true; };
  }, [item.relation.id_relation, plan.id_development_plan]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setQueue((q) => [
      ...q,
      ...Array.from(files).map((f) => ({
        id: `${f.name}-${f.lastModified}-${Math.random()}`,
        file: f,
        notes: "",
      })),
    ]);
  };

  const handleDeleteDoc = async (docId: number) => {
    setDeletingId(docId);
    try {
      await supplierAPI.deletePlanDocument(
        item.relation.id_relation,
        plan.id_development_plan,
        docId,
      );
      setExistingDocs((d) => d.filter((doc) => doc.id_document !== docId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    try {
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        setSaveStep(`Uploading ${q.file.name} (${i + 1}/${queue.length})…`);
        await supplierAPI.uploadRelationDevelopmentPlanDocument(
          item.relation.id_relation,
          plan.id_development_plan,
          q.file,
          q.notes.trim() || undefined,
        );
      }
      setSaveStep("Saving…");
      await supplierAPI.updateRelationDevelopmentPlan(
        item.relation.id_relation,
        plan.id_development_plan,
        {
          plan_title: form.plan_title.trim() || undefined,
          plan_status: form.plan_status || undefined,
          internal_comments: form.internal_comments.trim() || undefined,
          supplier_comments: form.supplier_comments.trim() || undefined,
          sync_relation_hold_status: false,
        },
      );
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setIsSaving(false);
      setSaveStep(null);
    }
  };

  const workflowStep =
    ({
      "must be send": 0,
      "request sent": 1,
      received: 2,
      "under review": 3,
      approved: 4,
      rejected: 4,
      closed: 4,
      cancelled: 4,
    } as Record<string, number>)[(plan.plan_status ?? "").toLowerCase()] ?? 0;

  return (
    <Modal title="Plan Details" onClose={onClose} size="lg">
      <div className="space-y-5">
        <SupplierBanner item={item} tone="slate" />
        {workflowStep > 0 && (
          <WorkflowStepper
            currentStep={workflowStep}
            isRejected={(plan.plan_status ?? "").toLowerCase() === "rejected"}
          />
        )}
        {error && <ErrorMsg msg={error} />}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left — editable fields */}
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Plan Title</label>
              <input value={form.plan_title} onChange={(e) => setField("plan_title", e.target.value)} className={inputCls} disabled={isClosed} />
            </div>
            {!isClosed && (
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Status</label>
                <select value={form.plan_status} onChange={(e) => setField("plan_status", e.target.value)} className={inputCls}>
                  {PLAN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Internal Notes</label>
              <textarea value={form.internal_comments} onChange={(e) => setField("internal_comments", e.target.value)} rows={4} className={`${inputCls} resize-none`} disabled={isClosed} placeholder="Internal team notes…" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Supplier Comments</label>
              <textarea value={form.supplier_comments} onChange={(e) => setField("supplier_comments", e.target.value)} rows={3} className={`${inputCls} resize-none`} disabled={isClosed} placeholder="Supplier's notes…" />
            </div>
          </div>

          {/* Right — documents + timeline */}
          <div className="space-y-4">
            {/* All documents */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Documents</p>
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                  >
                    <Upload className="h-3 w-3" /> Add
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg" onChange={(e) => addFiles(e.target.files)} />

              {/* Existing uploaded docs */}
              {docsLoading ? (
                <p className="text-xs text-slate-400">Loading…</p>
              ) : existingDocs.length === 0 && queue.length === 0 ? (
                <p className="text-sm text-slate-400">No documents attached yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {existingDocs.map((doc) => (
                    <div key={doc.id_document} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <FileCheck className="h-4 w-4 shrink-0 text-sky-500" />
                      <div className="min-w-0 flex-1">
                        {doc.file_url ? (
                          <a href={doc.file_url} target="_blank" rel="noreferrer" className="block truncate text-xs font-semibold text-[#062B49] hover:underline">
                            {doc.file_name || `Document #${doc.id_document}`}
                          </a>
                        ) : (
                          <p className="truncate text-xs font-semibold text-slate-700">{doc.file_name || `Document #${doc.id_document}`}</p>
                        )}
                        {doc.comments && doc.comments !== "Development plan document uploaded." && (
                          <p className="truncate text-xs text-slate-400">{doc.comments}</p>
                        )}
                      </div>
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noreferrer" className="shrink-0 text-slate-400 hover:text-slate-700">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!isClosed && (
                        <button
                          type="button"
                          disabled={deletingId === doc.id_document}
                          onClick={() => handleDeleteDoc(doc.id_document)}
                          className="shrink-0 rounded-full p-0.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Queued (not yet uploaded) */}
                  {queue.map((qf) => (
                    <div key={qf.id} className="flex items-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2">
                      <Upload className="h-4 w-4 shrink-0 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-700">{qf.file.name}</p>
                        <input
                          value={qf.notes}
                          onChange={(e) =>
                            setQueue((q) => q.map((f) => f.id === qf.id ? { ...f, notes: e.target.value } : f))
                          }
                          className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs outline-none focus:border-sky-300"
                          placeholder="Note for this file…"
                        />
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        pending
                      </span>
                      <button type="button" onClick={() => setQueue((q) => q.filter((f) => f.id !== qf.id))} className="shrink-0 text-slate-400 hover:text-rose-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <PlanTimeline plan={plan} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {isClosed ? "Close" : "Cancel"}
          </button>
          {!isClosed && (
            <button type="button" onClick={handleSubmit} disabled={isSaving} className="rounded-xl bg-[#062B49] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0C5381] disabled:opacity-50">
              {isSaving ? (saveStep ?? "Saving…") : queue.length > 0 ? `Save & Upload ${queue.length} file${queue.length > 1 ? "s" : ""}` : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════════

export default function DevelopmentPlansPage() {
  const [items, setItems] = useState<DevelopmentPlanRegisterRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterPlant, setFilterPlant] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterHold, setFilterHold] = useState<"" | "hold" | "nohold">("");
  const [filterEscalated, setFilterEscalated] = useState<"" | "yes" | "no">("");

  const clearFilters = () => {
    setFilterPlant("");
    setFilterGroup("");
    setFilterOwner("");
    setFilterGrade("");
    setFilterHold("");
    setFilterEscalated("");
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);

  const [sendModal, setSendModal] = useState<DevelopmentPlanRegisterRow | null>(null);
  const [receivedModal, setReceivedModal] = useState<DevelopmentPlanRegisterRow | null>(null);
  const [reviewModal, setReviewModal] = useState<DevelopmentPlanRegisterRow | null>(null);
  const [decisionModal, setDecisionModal] = useState<DevelopmentPlanRegisterRow | null>(null);
  const [revisionModal, setRevisionModal] = useState<DevelopmentPlanRegisterRow | null>(null);
  const [detailsModal, setDetailsModal] = useState<DevelopmentPlanRegisterRow | null>(null);

  const openModal = (item: DevelopmentPlanRegisterRow, modal: ModalKey) => {
    if (modal === "send") setSendModal(item);
    else if (modal === "received") setReceivedModal(item);
    else if (modal === "review") setReviewModal(item);
    else if (modal === "decision") setDecisionModal(item);
    else if (modal === "revision") setRevisionModal(item);
    else setDetailsModal(item);
  };

  const closeAll = () => {
    setSendModal(null);
    setReceivedModal(null);
    setReviewModal(null);
    setDecisionModal(null);
    setRevisionModal(null);
    setDetailsModal(null);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await supplierAPI.listDevelopmentPlanRegister();
        if (!cancelled)
          setItems((res.data?.items ?? []) as DevelopmentPlanRegisterRow[]);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "Failed to load development plans.",
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const counts = useMemo(
    () => ({
      action: items.filter(
        (i) => getStatusGroup(i.development_plan.plan_status) === "action",
      ).length,
      progress: items.filter(
        (i) => getStatusGroup(i.development_plan.plan_status) === "progress",
      ).length,
      closed: items.filter(
        (i) => getStatusGroup(i.development_plan.plan_status) === "closed",
      ).length,
      overdue: items.filter((i) => i.development_plan.is_overdue).length,
      escalated: items.filter((i) => i.development_plan.escalated).length,
    }),
    [items],
  );

  // unique option lists for dropdowns
  const filterOptions = useMemo(() => {
    const plants = [...new Set(items.map((i) => i.site_name).filter(Boolean))].sort() as string[];
    const groups = [...new Set(items.map((i) => i.group_name).filter(Boolean))].sort() as string[];
    const owners = [
      ...new Set(
        items.map((i) => (i.relation as any).supplier_owner as string | undefined).filter(Boolean)
      ),
    ].sort() as string[];
    const grades = [...new Set(
      items.map((i) => {
        const fg = (i.relation as any).final_grade as string | undefined;
        return (fg || i.relation.operational_grade || "").charAt(0).toUpperCase();
      }).filter((g) => ["A","B","C","D"].includes(g))
    )].sort();
    return { plants, groups, owners, grades };
  }, [items]);

  const hasActiveFilters =
    filterPlant || filterGroup || filterOwner || filterGrade || filterHold || filterEscalated;

  const filtered = useMemo(() => {
    const kw = normalize(search);
    return items.filter((item) => {
      const dp = item.development_plan;
      const owner = (item.relation as any).supplier_owner as string | undefined;
      const rawGrade = ((item.relation as any).final_grade as string | undefined) || item.relation.operational_grade || "";
      const gradeChar = rawGrade.charAt(0).toUpperCase();

      if (filterPlant && item.site_name !== filterPlant) return false;
      if (filterGroup && item.group_name !== filterGroup) return false;
      if (filterOwner && owner !== filterOwner) return false;
      if (filterGrade && gradeChar !== filterGrade) return false;
      if (filterHold === "hold"   && !dp.business_hold_active) return false;
      if (filterHold === "nohold" &&  dp.business_hold_active) return false;
      if (filterEscalated === "yes" && !dp.escalated) return false;
      if (filterEscalated === "no"  &&  dp.escalated) return false;

      if (statusTab !== "all" && getStatusGroup(dp.plan_status) !== statusTab) return false;

      if (kw) {
        const hit = [
          item.group_name, item.unit_supplier_code, item.unit_code,
          item.site_name, item.site_city, item.site_country,
          dp.plan_title, dp.plan_status, rawGrade,
          owner, dp.approved_by, dp.rejected_by,
        ].some((v) => normalize(v).includes(kw));
        if (!hit) return false;
      }
      return true;
    });
  }, [items, search, statusTab, filterPlant, filterGroup, filterOwner, filterGrade, filterHold, filterEscalated]);

  // reset to page 1 whenever filters / search / tab change
  useEffect(() => { setPage(1); }, [search, statusTab, filterPlant, filterGroup, filterOwner, filterGrade, filterHold, filterEscalated]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 6000);
  };

  const onSuccess = (msg: string) => {
    closeAll();
    showSuccess(msg);
    setReloadTick((v) => v + 1);
  };

  const tabs: { id: StatusTab; label: string; count: number }[] = [
    { id: "all", label: "All Plans", count: items.length },
    { id: "action", label: "Needs Action", count: counts.action },
    { id: "progress", label: "In Progress", count: counts.progress },
    { id: "closed", label: "Closed", count: counts.closed },
  ];

  const KPI = [
    {
      label: "Total Plans",
      value: items.length,
      cardCls: "border-slate-200 bg-white",
      valueCls: "text-slate-950",
    },
    {
      label: "Needs Action",
      value: counts.action,
      cardCls:
        counts.action > 0
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white",
      valueCls:
        counts.action > 0 ? "text-amber-700" : "text-slate-950",
    },
    {
      label: "In Progress",
      value: counts.progress,
      cardCls: "border-slate-200 bg-white",
      valueCls: "text-sky-700",
    },
    {
      label: "Overdue",
      value: counts.overdue,
      cardCls:
        counts.overdue > 0
          ? "border-rose-200 bg-rose-50"
          : "border-slate-200 bg-white",
      valueCls:
        counts.overdue > 0 ? "text-rose-700" : "text-slate-950",
    },
    {
      label: "Escalated",
      value: counts.escalated,
      cardCls:
        counts.escalated > 0
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white",
      valueCls:
        counts.escalated > 0 ? "text-amber-700" : "text-slate-950",
    },
  ];

  const kpiDefs = [
    {
      label: "Total Plans",
      value: items.length,
      icon: Layers,
      bg: "bg-white",
      border: "border-slate-200",
      valueCls: "text-slate-900",
      iconCls: "text-slate-400 bg-slate-100",
    },
    {
      label: "Needs Action",
      value: counts.action,
      icon: Zap,
      bg: counts.action > 0 ? "bg-amber-50" : "bg-white",
      border: counts.action > 0 ? "border-amber-200" : "border-slate-200",
      valueCls: counts.action > 0 ? "text-amber-700" : "text-slate-900",
      iconCls: counts.action > 0 ? "text-amber-600 bg-amber-100" : "text-slate-400 bg-slate-100",
    },
    {
      label: "In Progress",
      value: counts.progress,
      icon: Clock,
      bg: "bg-white",
      border: "border-slate-200",
      valueCls: "text-sky-700",
      iconCls: "text-sky-500 bg-sky-100",
    },
    {
      label: "Overdue",
      value: counts.overdue,
      icon: AlertTriangle,
      bg: counts.overdue > 0 ? "bg-rose-50" : "bg-white",
      border: counts.overdue > 0 ? "border-rose-200" : "border-slate-200",
      valueCls: counts.overdue > 0 ? "text-rose-700" : "text-slate-900",
      iconCls: counts.overdue > 0 ? "text-rose-600 bg-rose-100" : "text-slate-400 bg-slate-100",
    },
    {
      label: "Escalated",
      value: counts.escalated,
      icon: TrendingUp,
      bg: counts.escalated > 0 ? "bg-amber-50" : "bg-white",
      border: counts.escalated > 0 ? "border-amber-200" : "border-slate-200",
      valueCls: counts.escalated > 0 ? "text-amber-700" : "text-slate-900",
      iconCls: counts.escalated > 0 ? "text-amber-600 bg-amber-100" : "text-slate-400 bg-slate-100",
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-8">

      <PageIntro
        eyebrow="Lifecycle Workspace"
        title="Supplier Development Plans"
        description="Improvement plans triggered when a supplier's evaluation reaches Red status — track from initial request to committee decision."
      />

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {kpiDefs.map(({ label, value, icon: Icon, bg, border, valueCls, iconCls }) => (
            <div
              key={label}
              className={`flex items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-sm ${bg} ${border}`}
            >
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconCls} shadow-sm`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-[28px] font-black tracking-tight leading-none ${valueCls}`}>{value}</p>
                <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 leading-tight">
                  {label}
                </p>
              </div>
            </div>
          ))}
      </div>

      {/* ── Alert banners + toast ─────────────────────────────────────────── */}
      <div className="space-y-3 px-2 pt-5">

        {counts.action > 0 && (
          <div className="flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-3.5 shadow-md shadow-amber-200">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">
                {counts.action} plan{counts.action > 1 ? "s" : ""} require a request email
              </p>
              <p className="text-xs text-amber-100/80">
                Review the highlighted rows and send the request to each supplier.
              </p>
            </div>
            <button type="button" onClick={() => setStatusTab("action")}
              className="shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 transition">
              View →
            </button>
          </div>
        )}

        {counts.overdue > 0 && (
          <div className="flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500 to-rose-400 px-5 py-3.5 shadow-md shadow-rose-200">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">
                {counts.overdue} plan{counts.overdue > 1 ? "s" : ""} past the supplier due date
              </p>
              <p className="text-xs text-rose-100/80">
                Follow up with the supplier or escalate if no response is received.
              </p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-500 px-5 py-3 shadow-md shadow-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
            <span className="text-sm font-semibold text-white">{successMessage}</span>
          </div>
        )}

        {error && (
          <InlineAlert
            title="Could not load development plans"
            message={error}
            tone="danger"
            action={
              <button
                type="button"
                onClick={() => setReloadTick((v) => v + 1)}
                className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100"
              >
                Retry
              </button>
            }
          />
        )}
      </div>

      {/* ── Plans register card ───────────────────────────────────────────── */}
      <div className="px-2 pt-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* Card header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Plans Register</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {filtered.length} of {items.length} plan{items.length !== 1 ? "s" : ""} shown
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-2 font-semibold text-sky-600 hover:text-sky-800"
                  >
                    Clear filters
                  </button>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReloadTick((v) => v + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search supplier, plant, grade…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none shadow-sm transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-[260px]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-6 py-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  statusTab === tab.id
                    ? "bg-[#0b1f38] text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    statusTab === tab.id ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── Filter bar ── */}
          <div className="flex flex-wrap items-end gap-2.5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-3.5">
            {(
              [
                { label: "Plant",          value: filterPlant,     onChange: (v: string) => setFilterPlant(v),     placeholder: "All Plants",    options: filterOptions.plants },
                { label: "Supplier",       value: filterGroup,     onChange: (v: string) => setFilterGroup(v),     placeholder: "All Suppliers", options: filterOptions.groups },
                { label: "Supplier Owner", value: filterOwner,     onChange: (v: string) => setFilterOwner(v),     placeholder: "All Owners",    options: filterOptions.owners },
                { label: "Grade",          value: filterGrade,     onChange: (v: string) => setFilterGrade(v),     placeholder: "All Grades",    options: filterOptions.grades },
                { label: "Hold",           value: filterHold,      onChange: (v: string) => setFilterHold(v as "" | "hold" | "nohold"),    placeholder: "Any Hold",      options: [{ value: "hold", label: "On Hold" }, { value: "nohold", label: "No Hold" }] },
                { label: "Escalated",      value: filterEscalated, onChange: (v: string) => setFilterEscalated(v as "" | "yes" | "no"), placeholder: "Any",           options: [{ value: "yes", label: "Escalated" }, { value: "no", label: "Not Escalated" }] },
              ] as const
            ).map(({ label, value, onChange, placeholder, options }) => {
              const active = Boolean(value);
              return (
                <div key={label} className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</label>
                  <div className="relative">
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className={`h-8 appearance-none rounded-xl border pl-3 pr-7 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-[#062B49]/10 ${
                        active
                          ? "border-[#062B49]/30 bg-[#062B49]/5 text-[#062B49]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <option value="">{placeholder}</option>
                      {options.map((o) =>
                        typeof o === "string"
                          ? <option key={o} value={o}>{o}</option>
                          : <option key={o.value} value={o.value}>{o.label}</option>
                      )}
                    </select>
                    <ChevronDown className={`pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${active ? "text-[#062B49]" : "text-slate-400"}`} />
                  </div>
                </div>
              );
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="self-end inline-flex h-8 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-white px-6 py-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mr-1">Active:</span>
              {[
                filterPlant     && { label: `Plant: ${filterPlant}`,      clear: () => setFilterPlant("") },
                filterGroup     && { label: `Supplier: ${filterGroup}`,   clear: () => setFilterGroup("") },
                filterOwner     && { label: `Owner: ${filterOwner}`,      clear: () => setFilterOwner("") },
                filterGrade     && { label: `Grade: ${filterGrade}`,      clear: () => setFilterGrade("") },
                filterHold      && { label: filterHold === "hold" ? "On Hold" : "No Hold", clear: () => setFilterHold("") },
                filterEscalated && { label: filterEscalated === "yes" ? "Escalated" : "Not Escalated", clear: () => setFilterEscalated("") },
              ].filter(Boolean).map((chip: any, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-[#062B49]/20 bg-[#062B49]/5 px-2.5 py-1 text-[10px] font-bold text-[#062B49]">
                  {chip.label}
                  <button type="button" onClick={chip.clear} className="ml-0.5 rounded p-0.5 hover:bg-[#062B49]/10 transition">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#062B49]" />
              <p className="text-sm text-slate-400">Loading development plans…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <Layers className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No plans found</p>
              <p className="text-xs text-slate-400">
                {statusTab !== "all"
                  ? "Try switching to the 'All Plans' tab or adjust your search."
                  : "Development plans will appear here when a supplier evaluation reaches Red status."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-[#0b1f38] text-left">
                    {["Supplier · Plant", "Grade", "Plan & Status", "Score Date → Due", "Documents", ""].map((h, i) => (
                      <th
                        key={i}
                        className={`px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 ${i === 5 ? "text-right" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((item) => {
                    const dp = item.development_plan;
                    const docs = item.documents ?? [];
                    const finalGrade = (item.relation as any).final_grade as string | undefined;
                    const badge = getGradeBadge(finalGrade || item.relation.operational_grade);
                    const statusCfg = getStatusCfg(dp.plan_status);
                    const action = getAction(dp.plan_status);
                    const sl = (dp.plan_status ?? "").toLowerCase();
                    const isClosedRow = ["approved", "closed", "cancelled"].includes(sl);

                    // Left-border accent class
                    const accentBorder =
                      sl === "must be send" ? "border-l-2 border-l-amber-400" :
                      dp.is_overdue       ? "border-l-2 border-l-rose-400" :
                      sl === "rejected"   ? "border-l-2 border-l-rose-300" :
                      sl === "approved"   ? "border-l-2 border-l-emerald-400" :
                      "border-l-2 border-l-transparent";

                    const rowHover = "transition-colors hover:bg-slate-50/80";

                    return (
                      <tr key={dp.id_development_plan} className={`${accentBorder} ${rowHover}`}>

                        {/* Supplier · Plant */}
                        <td className="px-5 py-4 align-middle">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 leading-tight">
                              {item.group_name || "—"}
                            </p>
                            <SupplierStatusDot status={item.relation.supplier_status} />
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.site_name || "—"}
                            {(item.site_city || item.site_country) && (
                              <span className="text-slate-400">
                                {" · "}{[item.site_city, item.site_country].filter(Boolean).join(", ")}
                              </span>
                            )}
                          </p>
                          {(item.unit_code || item.unit_supplier_code) && (
                            <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                              {[item.unit_code, item.unit_supplier_code].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {(item.relation as any).supplier_owner && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                              <User className="h-3 w-3 shrink-0 text-slate-400" />
                              {(item.relation as any).supplier_owner}
                            </p>
                          )}
                        </td>

                        {/* Grade */}
                        <td className="px-4 py-4 align-middle">
                          {badge ? (
                            <div className="flex flex-col items-center gap-1 w-fit">
                              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-extrabold ring-2 shadow-md ${badge.bg} ${badge.text} ${badge.ring} ${badge.shadow}`}>
                                {badge.letter}
                              </span>
                              {badge.fullGrade.length > 1 && (
                                <span className={`rounded-md px-1 text-[9px] font-black ${badge.text} opacity-70`}>
                                  {badge.fullGrade}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>

                        {/* Plan + status + hold/escalation */}
                        <td className="px-5 py-4 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusPill status={dp.plan_status} />
                            {dp.business_hold_active && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-rose-200">
                                On Hold
                              </span>
                            )}
                            {dp.escalated && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-amber-200">
                                <TrendingUp className="h-2.5 w-2.5" />
                                Escalated
                              </span>
                            )}
                          </div>
                          {dp.plan_title && <PlanTitleTooltip title={dp.plan_title} />}
                          {dp.approved_by && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> {dp.approved_by}
                            </p>
                          )}
                          {dp.rejected_by && (
                            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                              <Ban className="h-3 w-3" /> {dp.rejected_by}
                            </p>
                          )}
                        </td>

                        {/* Dates */}
                        <td className="px-5 py-4 align-middle">
                          <div className="space-y-1.5">
                            {dp.issue_date && (
                              <div className="flex items-baseline gap-1.5">
                                <span className="w-16 shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-400">Score</span>
                                <span className="text-xs font-medium text-slate-700">{formatDate(dp.issue_date)}</span>
                              </div>
                            )}
                            {dp.due_date && (
                              <div className="flex items-baseline gap-1.5">
                                <span className="w-16 shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-400">Due</span>
                                <span className="text-xs font-medium text-slate-700">{formatDate(dp.due_date)}</span>
                              </div>
                            )}
                            {dp.submission_date && (
                              <div className="flex items-baseline gap-1.5">
                                <span className="w-16 shrink-0 text-[9px] font-bold uppercase tracking-wider text-slate-400">Received</span>
                                <span className="text-xs font-medium text-slate-700">{formatDate(dp.submission_date)}</span>
                              </div>
                            )}
                          </div>
                          {dp.due_date && !isClosedRow && (
                            <div className="mt-2">
                              <DueDateChip
                                dueDate={dp.due_date}
                                isOverdue={dp.is_overdue}
                                daysPastDue={dp.days_past_due}
                              />
                            </div>
                          )}
                        </td>

                        {/* Documents */}
                        <td className="px-5 py-4 align-middle">
                          {docs.length === 0 ? (
                            <span className="text-[11px] text-slate-300">No files</span>
                          ) : (
                            <div className="space-y-2">
                              {docs.map((doc) => (
                                <div key={doc.id_document} className="flex items-start gap-1.5 group">
                                  <FileCheck className="mt-px h-3.5 w-3.5 shrink-0 text-sky-500" />
                                  <div className="min-w-0">
                                    {doc.file_url ? (
                                      <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block max-w-[160px] truncate text-xs font-semibold text-[#062B49] underline-offset-2 hover:underline"
                                        title={doc.file_name ?? undefined}
                                      >
                                        {doc.file_name || `Doc #${doc.id_document}`}
                                      </a>
                                    ) : (
                                      <p className="max-w-[160px] truncate text-xs font-medium text-slate-600">
                                        {doc.file_name || `Doc #${doc.id_document}`}
                                      </p>
                                    )}
                                    {doc.file_notes && (
                                      <p
                                        className="max-w-[160px] truncate text-[10px] italic text-slate-400"
                                        title={doc.file_notes}
                                      >
                                        {doc.file_notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 align-middle">
                          <div className="flex flex-col items-end gap-1.5">
                            {(() => {
                              const { Icon } = action;
                              return (
                                <button
                                  type="button"
                                  onClick={() => openModal(item, action.modal)}
                                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[11px] font-bold tracking-wide shadow-sm transition active:scale-[0.97] ${action.bg} ${action.text}`}
                                >
                                  <Icon className="h-3 w-3" />
                                  {action.label}
                                </button>
                              );
                            })()}
                            {action.modal !== "details" && (
                              <button
                                type="button"
                                onClick={() => openModal(item, "details")}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                              >
                                <FileText className="h-3 w-3" />
                                Details
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {!isLoading && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-gradient-to-b from-slate-50/60 to-white px-6 py-3.5">
              <p className="text-[11px] font-semibold text-slate-400">
                Showing{" "}
                <span className="font-black text-slate-700">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
                </span>{" "}
                of{" "}
                <span className="font-black text-slate-700">{filtered.length}</span>{" "}
                plan{filtered.length !== 1 ? "s" : ""}
              </p>

              <div className="flex items-center gap-1">
                {(["«", "‹"] as const).map((ch, i) => (
                  <button
                    key={ch}
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setPage(i === 0 ? 1 : (p) => Math.max(1, p - 1))}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {ch}
                  </button>
                ))}

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "…" ? (
                      <span key={`e-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p as number)}
                        className={`h-8 min-w-[32px] rounded-lg border text-[11px] font-bold transition ${
                          safePage === p
                            ? "border-[#062B49] bg-[#062B49] text-white shadow-md shadow-[#062B49]/20"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                {(["›", "»"] as const).map((ch, i) => (
                  <button
                    key={ch}
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(i === 0 ? (p) => Math.min(totalPages, p + 1) : totalPages)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {sendModal && (
        <SharedSendRequestModal
          item={sendModal}
          onClose={closeAll}
          onSuccess={() => onSuccess("Development plan request email sent.")}
        />
      )}
      {receivedModal && (
        <MarkReceivedModal
          item={receivedModal}
          onClose={closeAll}
          onSuccess={() => onSuccess("Plan marked as received.")}
        />
      )}
      {reviewModal && (
        <SubmitForReviewModal
          item={reviewModal}
          onClose={closeAll}
          onSuccess={() => onSuccess("Plan submitted for review. Notification email sent to committee.")}
        />
      )}
      {decisionModal && (
        <ReviewDecisionModal
          item={decisionModal}
          onClose={closeAll}
          onSuccess={(r) =>
            onSuccess(
              r === "approved"
                ? "Plan approved."
                : "Plan rejected. You can request a revision from the supplier.",
            )
          }
        />
      )}
      {revisionModal && (
        <RequestRevisionModal
          item={revisionModal}
          onClose={closeAll}
          onSuccess={() => onSuccess("Revision requested. Email sent to supplier.")}
        />
      )}
      {detailsModal && (
        <ViewDetailsModal
          item={detailsModal}
          onClose={closeAll}
          onSuccess={() => onSuccess("Plan updated.")}
        />
      )}
    </div>
  );
}
