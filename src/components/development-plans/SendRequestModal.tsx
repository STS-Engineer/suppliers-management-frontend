import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  ThumbsDown,
  ThumbsUp,
  Upload,
  X,
} from "lucide-react";
import supplierAPI from "../../services/supplierOnboardingAPI";
import type {
  ContactResponse,
  DevelopmentPlanRegisterRow,
  PlanDocument,
} from "../../types/onboarding";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#062B49]/40 focus:bg-white focus:ring-4 focus:ring-[#062B49]/8 shadow-sm";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const parseEmails = (raw: string) =>
  raw
    .split(/[,;\s]+/)
    .map((email) => email.trim())
    .filter(Boolean);
const validateEmails = (list: string[]) =>
  list.every((email) => EMAIL_RE.test(email));
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

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const STATUS_CFG: Record<string, { bg: string; text: string; border: string }> =
  {
    "must be send": {
      bg: "bg-amber-500",
      text: "text-white",
      border: "border-transparent",
    },
    "request sent": {
      bg: "bg-sky-100",
      text: "text-sky-800",
      border: "border-sky-200",
    },
    received: {
      bg: "bg-violet-100",
      text: "text-violet-800",
      border: "border-violet-200",
    },
    "under review": {
      bg: "bg-indigo-100",
      text: "text-indigo-800",
      border: "border-indigo-200",
    },
    approved: {
      bg: "bg-emerald-500",
      text: "text-white",
      border: "border-transparent",
    },
    rejected: {
      bg: "bg-rose-500",
      text: "text-white",
      border: "border-transparent",
    },
    closed: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200",
    },
    cancelled: {
      bg: "bg-slate-100",
      text: "text-slate-500",
      border: "border-slate-200",
    },
  };

const GRADE_CFG: Record<
  string,
  { bg: string; text: string; ring: string; shadow: string }
> = {
  A: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    ring: "ring-emerald-300",
    shadow: "shadow-emerald-200",
  },
  B: {
    bg: "bg-sky-100",
    text: "text-sky-800",
    ring: "ring-sky-300",
    shadow: "shadow-sky-200",
  },
  C: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    ring: "ring-amber-300",
    shadow: "shadow-amber-200",
  },
  D: {
    bg: "bg-rose-100",
    text: "text-rose-800",
    ring: "ring-rose-300",
    shadow: "shadow-rose-200",
  },
};

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const scrollY = window.scrollY;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#062B49]/40 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_rgba(6,43,73,0.22)]">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-7 py-5">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs font-medium text-slate-400">
                {subtitle}
              </p>
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

function StatusPill({ status }: { status?: string | null }) {
  const cfg = STATUS_CFG[(status ?? "").toLowerCase()] ?? {
    bg: "bg-slate-100",
    text: "text-slate-500",
    border: "border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {status ?? "—"}
    </span>
  );
}

function SupplierBanner({ item }: { item: DevelopmentPlanRegisterRow }) {
  const grade = item.relation.operational_grade?.toUpperCase().charAt(0) ?? "";
  const badge = grade ? GRADE_CFG[grade] : null;
  const plan = item.development_plan;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 pl-0 pr-4 py-0">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="h-full w-1 self-stretch rounded-l-2xl bg-amber-400"
          style={{ minHeight: 52 }}
        />
        <div className="py-3 min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            {item.group_name || "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {item.site_name || "—"} · {item.unit_supplier_name || "—"}
          </p>
          {plan.plan_title && (
            <p className="mt-0.5 max-w-xs truncate text-[11px] font-medium italic text-slate-500">
              {plan.plan_title}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && (
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm font-extrabold ring-2 shadow-sm ${badge.bg} ${badge.text} ${badge.ring} ${badge.shadow}`}
          >
            {grade}
          </span>
        )}
        <StatusPill status={plan.plan_status} />
      </div>
    </div>
  );
}

function WorkflowStepper({
  currentStep,
  isRejected = false,
}: {
  currentStep: number;
  isRejected?: boolean;
}) {
  const steps = ["Request Sent", "Plan Received", "Under Review", "Decision"];
  return (
    <div className="flex items-start rounded-2xl bg-slate-50/80 px-4 py-3">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = currentStep > step;
        const active = currentStep === step;
        const isLast = index === steps.length - 1;
        const activeColor =
          step === 4 && isRejected
            ? "bg-rose-500 text-white shadow-rose-200"
            : "bg-[#062B49] text-white shadow-[#062B49]/20";
        return (
          <div key={label} className="flex flex-1 items-start">
            <div className="flex flex-1 flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shadow-md transition ${
                  done
                    ? "bg-emerald-500 text-white shadow-emerald-200"
                    : active
                      ? activeColor
                      : "bg-white text-slate-400 shadow-none ring-1 ring-slate-200"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
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
              <div
                className={`mt-3.5 h-px flex-1 transition-colors ${
                  done ? "bg-emerald-300" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {msg}
    </div>
  );
}

function ContactCard({
  contact,
  selected,
  onToggle,
}: {
  contact: ContactResponse;
  selected: boolean;
  onToggle: () => void;
}) {
  const hasEmail = !!contact.email;
  const initials = (contact.full_name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <button
      type="button"
      disabled={!hasEmail}
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
        !hasEmail
          ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-50"
          : selected
            ? "border-sky-400 bg-sky-50 shadow-sm shadow-sky-100"
            : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40"
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
          selected
            ? "bg-sky-500 text-white shadow-md shadow-sky-200"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {initials || "?"}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-slate-900">
            {contact.full_name || "—"}
          </p>
          {contact.is_primary_contact && (
            <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700">
              Primary
            </span>
          )}
        </div>
        {contact.role_label && (
          <p className="text-[11px] font-medium text-slate-500">
            {contact.role_label}
          </p>
        )}
        <p
          className={`mt-0.5 truncate text-[11px] ${hasEmail ? "text-slate-600" : "italic text-slate-400"}`}
        >
          {contact.email ?? "No email address"}
        </p>
      </div>

      {/* Checkbox */}
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
          selected ? "border-sky-500 bg-sky-500" : "border-slate-300 bg-white"
        }`}
      >
        {selected && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </button>
  );
}

interface QueuedFile {
  id: string;
  file: File;
  notes: string;
}

export function SharedSendRequestModal({
  item,
  onClose,
  onSuccess,
  onEnsurePlan,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  onEnsurePlan?: (draft: {
    planTitle: string;
    dueDate: string;
  }) => Promise<DevelopmentPlanRegisterRow>;
}) {
  const plan = item.development_plan;
  const supplierOwner = item.relation.supplier_owner || "";

  const [dueDate, setDueDate] = useState(plan.due_date?.slice(0, 10) ?? "");
  const [planTitle, setPlanTitle] = useState(plan.plan_title ?? "");
  const [customMessage, setCustomMessage] = useState("");
  const [ccRaw, setCcRaw] = useState(supplierOwner);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contacts
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [extraEmailsRaw, setExtraEmailsRaw] = useState("");

  useEffect(() => {
    let cancelled = false;
    supplierAPI
      .listContactsForUnit(item.relation.id_supplier_unit)
      .then((res) => {
        if (cancelled) return;
        const loaded = (res.data?.items ?? []) as ContactResponse[];
        setContacts(loaded);
        const primaries = loaded
          .filter((c) => c.is_primary_contact && c.email)
          .map((c) => c.email!);
        const all = loaded.filter((c) => c.email).map((c) => c.email!);
        setSelectedEmails(new Set(primaries.length ? primaries : all));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.relation.id_supplier_unit]);

  const toggleContact = (email: string) =>
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const extraParsed = extraEmailsRaw.trim() ? parseEmails(extraEmailsRaw) : [];
  const totalRecipients = selectedEmails.size + extraParsed.length;

  const handleSubmit = async () => {
    if (!dueDate) {
      setError("A due date is required before sending the request.");
      return;
    }
    if (extraParsed.length && !validateEmails(extraParsed)) {
      setError("One or more extra email addresses are invalid.");
      return;
    }
    const allTo = [...new Set([...selectedEmails, ...extraParsed])];
    const ccParsed = parseEmails(ccRaw);
    if (ccParsed.length && !validateEmails(ccParsed)) {
      setError("One or more CC email addresses are invalid.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const resolvedItem =
        !plan.id_development_plan && onEnsurePlan
          ? await onEnsurePlan({
              planTitle: planTitle.trim(),
              dueDate,
            })
          : item;

      await supplierAPI.updateRelationDevelopmentPlan(
        resolvedItem.relation.id_relation,
        resolvedItem.development_plan.id_development_plan,
        {
          plan_status: "Request sent",
          due_date: dueDate,
          plan_title: planTitle.trim() || undefined,
          sync_relation_hold_status: false,
        },
      );
      await supplierAPI.sendRelationDevelopmentPlanRequest(
        resolvedItem.relation.id_relation,
        resolvedItem.development_plan.id_development_plan,
        {
          custom_message: customMessage.trim() || undefined,
          to_emails: allTo.length ? allTo : undefined,
          extra_cc_emails: ccParsed.length ? ccParsed : undefined,
        },
      );
      await onSuccess();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to send the request.",
      );
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
        <SupplierBanner item={item} />
        {error && <ErrorMsg msg={error} />}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Plan Title
          </label>
          <input
            value={planTitle}
            onChange={(event) => setPlanTitle(event.target.value)}
            className={inputCls}
            placeholder="Development plan title..."
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
              onChange={(event) => setDueDate(event.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              Deadline included in the email.
            </p>
          </div>
        </div>

        {/* ── Contact selection ─────────────────────────────────────── */}
        <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Supplier Contacts
              </p>
              <p className="text-xs text-slate-500">
                Select who will receive the request email
              </p>
            </div>
            {contacts.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const emailsWithAddr = contacts
                    .filter((c) => c.email)
                    .map((c) => c.email!);
                  setSelectedEmails(
                    selectedEmails.size === emailsWithAddr.length
                      ? new Set()
                      : new Set(emailsWithAddr),
                  );
                }}
                className="text-xs font-semibold text-sky-600 hover:text-sky-800"
              >
                {selectedEmails.size === contacts.filter((c) => c.email).length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            )}
          </div>

          {contactsLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading contacts…
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              No contacts found for this supplier unit. Enter email addresses
              below.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {contacts.map((c) => (
                <ContactCard
                  key={c.id_contact}
                  contact={c}
                  selected={!!c.email && selectedEmails.has(c.email)}
                  onToggle={() => c.email && toggleContact(c.email)}
                />
              ))}
            </div>
          )}

          {/* Extra manual emails */}
          <div className="pt-1">
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Add extra recipients{" "}
              <span className="font-normal text-slate-400">
                (not listed above)
              </span>
            </label>
            <input
              value={extraEmailsRaw}
              onChange={(e) => setExtraEmailsRaw(e.target.value)}
              className={inputCls}
              placeholder="extra@avocarbon.com, another@avocarbon.com"
            />
          </div>

          {/* Recipient summary */}
          {totalRecipients > 0 && (
            <div className="flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-xs font-semibold text-sky-700">
                {totalRecipients} recipient{totalRecipients !== 1 ? "s" : ""}{" "}
                selected
              </span>
            </div>
          )}
        </div>

        {/* CC */}
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              CC — Supplier Owner / Additional
            </label>
            <input
              value={ccRaw}
              onChange={(event) => setCcRaw(event.target.value)}
              className={inputCls}
              placeholder="owner@avocarbon.com"
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
            onChange={(event) => setCustomMessage(event.target.value)}
            rows={3}
            className={`${inputCls} resize-none`}
            placeholder="Additional context to include in the email..."
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
            disabled={isSaving || !dueDate || totalRecipients === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {isSaving
              ? "Sending..."
              : totalRecipients > 0
                ? `Send to ${totalRecipients} Recipient${totalRecipients !== 1 ? "s" : ""}`
                : "Send Request Email"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SharedMarkReceivedModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const plan = item.development_plan;
  const supplierOwner = item.relation.supplier_owner || "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submissionDate, setSubmissionDate] = useState(todayStr());
  const [supplierComments, setSupplierComments] = useState(
    plan.supplier_comments ?? "",
  );
  const [internalComments, setInternalComments] = useState("");
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [sendEmail, setSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState(supplierOwner);
  const [emailMessage, setEmailMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      notes: "",
    }));
    setQueue((prev) => [...prev, ...next]);
  };

  const updateNotes = (id: string, notes: string) =>
    setQueue((prev) =>
      prev.map((file) => (file.id === id ? { ...file, notes } : file)),
    );
  const removeFile = (id: string) =>
    setQueue((prev) => prev.filter((file) => file.id !== id));

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
      if (queue.length > 0) {
        setUploadProgress({ done: 0, total: queue.length });
        for (let index = 0; index < queue.length; index += 1) {
          const queued = queue[index];
          setSaveStep(
            `Uploading ${queued.file.name} (${index + 1}/${queue.length})...`,
          );
          await supplierAPI.uploadRelationDevelopmentPlanDocument(
            item.relation.id_relation,
            plan.id_development_plan,
            queued.file,
            queued.notes.trim() || undefined,
          );
          setUploadProgress({ done: index + 1, total: queue.length });
        }
      }

      setSaveStep("Updating plan...");
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
        const cc = parseEmails(emailCc).filter((email) =>
          validateEmails([email]),
        );
        setSaveStep("Sending notification email...");
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

      await onSuccess();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update the plan.",
      );
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
    >
      <div className="space-y-5">
        <WorkflowStepper currentStep={2} />
        <SupplierBanner item={item} />
        {error && <ErrorMsg msg={error} />}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Submission Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={submissionDate}
            onChange={(event) => setSubmissionDate(event.target.value)}
            className={inputCls}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Action Plan Documents
            </p>
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
            onChange={(event) => addFiles(event.target.files)}
          />
          {queue.length > 0 ? (
            <div className="space-y-2">
              {queue.map((queued) => (
                <div
                  key={queued.id}
                  className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2.5"
                >
                  <FileCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {queued.file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(queued.file.size / 1024).toFixed(0)} KB
                    </p>
                    <input
                      value={queued.notes}
                      onChange={(event) =>
                        updateNotes(queued.id, event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                      placeholder="Optional note for this file..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(queued.id)}
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
              <p className="mt-1 text-sm text-slate-500">
                Click to add files, or drag and drop
              </p>
              <p className="text-xs text-slate-400">
                PDF, Word, Excel, Images — multiple files allowed
              </p>
            </div>
          )}
          {uploadProgress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Uploading...</span>
                <span>
                  {uploadProgress.done}/{uploadProgress.total}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{
                    width: `${(uploadProgress.done / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Supplier's Action Description{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={supplierComments}
              onChange={(event) => setSupplierComments(event.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Summarise the supplier's proposed actions..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Internal Notes{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={internalComments}
              onChange={(event) => setInternalComments(event.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Internal observations..."
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setSendEmail((value) => !value)}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">
                Also send notification email with documents
              </span>
            </div>
            <div
              className={`h-5 w-9 rounded-full transition-colors ${
                sendEmail ? "bg-sky-500" : "bg-slate-300"
              }`}
            >
              <div
                className={`m-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  sendEmail ? "translate-x-4" : "translate-x-0"
                }`}
              />
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
                  onChange={(event) => setEmailTo(event.target.value)}
                  className={inputCls}
                  placeholder="manager@avocarbon.com, quality@avocarbon.com"
                />
                <p className="mt-1 text-xs text-slate-400">
                  The uploaded files will be attached to this email.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  CC
                </label>
                <input
                  value={emailCc}
                  onChange={(event) => setEmailCc(event.target.value)}
                  className={inputCls}
                  placeholder="owner@avocarbon.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Message
                </label>
                <textarea
                  value={emailMessage}
                  onChange={(event) => setEmailMessage(event.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="Optional context to include in the email..."
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
              ? (saveStep ?? "Saving...")
              : sendEmail
                ? "Save & Send Notification"
                : "Mark as Received"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PlanTimeline({ item }: { item: DevelopmentPlanRegisterRow }) {
  const plan = item.development_plan;
  const events = [
    plan.created_at
      ? {
          date: plan.created_at,
          label: "Plan created",
          by: null,
          dot: "bg-amber-400",
        }
      : null,
    plan.issue_date
      ? {
          date: plan.issue_date,
          label: "Request issued",
          by: null,
          dot: "bg-slate-400",
        }
      : null,
    plan.submission_date
      ? {
          date: plan.submission_date,
          label: "Action plan received",
          by: null,
          dot: "bg-violet-400",
        }
      : null,
    plan.review_date
      ? {
          date: plan.review_date,
          label: "Submitted for committee review",
          by: plan.reviewed_by,
          dot: "bg-indigo-400",
        }
      : null,
    plan.decision_date && plan.approved_by
      ? {
          date: plan.decision_date,
          label: "Approved by committee",
          by: plan.approved_by,
          dot: "bg-emerald-500",
        }
      : null,
    plan.decision_date && plan.rejected_by
      ? {
          date: plan.decision_date,
          label: "Rejected by committee",
          by: plan.rejected_by,
          dot: "bg-rose-500",
        }
      : null,
  ].filter(Boolean) as {
    date: string;
    label: string;
    by?: string | null;
    dot: string;
  }[];

  if (!events.length) return null;
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Timeline
      </p>
      <div className="relative space-y-0 pl-5">
        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />
        {events.map((event, index) => (
          <div
            key={`${event.label}-${index}`}
            className="relative flex items-start gap-3 py-2.5"
          >
            <div
              className={`absolute left-[-11px] mt-[5px] h-3 w-3 rounded-full border-2 border-white ${event.dot}`}
            />
            <div>
              <p className="text-xs font-semibold text-slate-800">
                {event.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDate(event.date) ?? "—"}
                {event.by ? ` · ${event.by}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SharedSubmitForReviewModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const plan = item.development_plan;
  const supplierOwner = item.relation.supplier_owner || "";
  const [reviewDate, setReviewDate] = useState(todayStr());
  const [reviewedBy, setReviewedBy] = useState("");
  const [reviewDeadline, setReviewDeadline] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 8);
    return date.toISOString().slice(0, 10);
  });
  const [reviewersRaw, setReviewersRaw] = useState("");
  const [ccRaw, setCcRaw] = useState(supplierOwner);
  const [internalComments, setInternalComments] = useState(
    plan.internal_comments ?? "",
  );
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
      setError(
        "Enter at least one reviewer email (Plant Manager, Quality or Logistics).",
      );
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
      setSaveStep("Updating plan status...");
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
      setSaveStep("Sending review notification...");
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
      await onSuccess();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to submit for review.",
      );
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
        <SupplierBanner item={item} />
        {error && <ErrorMsg msg={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Submitted By <span className="text-rose-500">*</span>
            </label>
            <input
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              className={inputCls}
              placeholder="Your name..."
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
        {plan.file_url ? (
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
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            No document attached yet. Consider uploading the plan before
            submitting for review.
          </div>
        )}
        <div className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50 p-4">
          <p className="text-sm font-semibold text-purple-900">
            Committee — Review Email Recipients{" "}
            <span className="text-rose-500">*</span>
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
              placeholder="plantmanager@avocarbon.com, quality@avocarbon.com, logistics@avocarbon.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              CC — Supplier Owner / Additional
            </label>
            <input
              value={ccRaw}
              onChange={(e) => setCcRaw(e.target.value)}
              className={inputCls}
              placeholder="owner@avocarbon.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Review Deadline
            </label>
            <input
              type="date"
              value={reviewDeadline}
              onChange={(e) => setReviewDeadline(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
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
              placeholder="Any specific context or guidance for the reviewers..."
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
              placeholder="Internal notes saved to the plan record..."
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
            {isSaving
              ? (saveStep ?? "Submitting...")
              : "Submit & Notify Committee"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SharedReviewDecisionModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: (result: "approved" | "rejected") => void | Promise<void>;
}) {
  const plan = item.development_plan;
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    null,
  );
  const [decisionDate, setDecisionDate] = useState(todayStr());
  const [decisionBy, setDecisionBy] = useState("");
  const [internalComments, setInternalComments] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async () => {
    if (!decision) return setError("Please select a decision.");
    if (!decisionBy.trim()) {
      return setError(
        `Please enter the name of the person ${decision === "approved" ? "approving" : "rejecting"} this plan.`,
      );
    }
    if (decision === "rejected" && !internalComments.trim()) {
      return setError("A rejection reason is required.");
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
          sync_relation_hold_status: false,
        },
      );
      await onSuccess(decision);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to record the decision.",
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
        <SupplierBanner item={item} />
        {error && <ErrorMsg msg={error} />}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Decision <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["approved", "rejected"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDecision(value)}
                className={`flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4 text-sm font-semibold transition ${decision === value ? (value === "approved" ? "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-100" : "border-rose-400 bg-rose-50 text-rose-800 shadow-sm shadow-rose-100") : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
              >
                {value === "approved" ? (
                  <ThumbsUp className="h-4 w-4" />
                ) : (
                  <ThumbsDown className="h-4 w-4" />
                )}
                {value === "approved" ? "Approve Plan" : "Reject Plan"}
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
                  placeholder="Committee member name..."
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
                className={`${inputCls} resize-none ${decision === "rejected" ? "border-rose-200 bg-rose-50/40 focus:border-rose-300 focus:ring-rose-100" : ""}`}
                placeholder={
                  decision === "rejected"
                    ? "Required — explain why the plan was rejected..."
                    : "Optional committee notes..."
                }
              />
            </div>
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
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${decision === "rejected" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
          >
            {decision === "approved" ? (
              <ThumbsUp className="h-4 w-4" />
            ) : (
              <ThumbsDown className="h-4 w-4" />
            )}
            {isSaving
              ? "Saving..."
              : decision === "approved"
                ? "Approve Plan"
                : "Reject Plan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SharedRequestRevisionModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const plan = item.development_plan;
  const supplierOwner = item.relation.supplier_owner || "";
  const [newDueDate, setNewDueDate] = useState("");
  const [ccRaw, setCcRaw] = useState(supplierOwner);
  const [customMessage, setCustomMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async () => {
    if (!newDueDate)
      return setError("Please set a new due date for the revision.");
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
      await onSuccess();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to request revision.",
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
    >
      <div className="space-y-5">
        <SupplierBanner item={item} />
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
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            CC <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            value={ccRaw}
            onChange={(e) => setCcRaw(e.target.value)}
            className={inputCls}
            placeholder="owner@avocarbon.com"
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
            placeholder="Explain what needs to be revised in the action plan..."
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
            {isSaving ? "Sending..." : "Request Revision"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SharedViewDetailsModal({
  item,
  onClose,
  onSuccess,
}: {
  item: DevelopmentPlanRegisterRow;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
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
  const setField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));
  const isClosed = ["approved", "closed", "cancelled"].includes(
    (plan.plan_status ?? "").toLowerCase(),
  );
  useEffect(() => {
    let cancelled = false;
    supplierAPI
      .listPlanDocuments(item.relation.id_relation, plan.id_development_plan)
      .then((res) => {
        if (!cancelled)
          setExistingDocs((res.data?.items ?? []) as PlanDocument[]);
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.relation.id_relation, plan.id_development_plan]);
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setQueue((prev) => [
      ...prev,
      ...Array.from(files).map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
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
      setExistingDocs((prev) =>
        prev.filter((doc) => doc.id_document !== docId),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete document.",
      );
    } finally {
      setDeletingId(null);
    }
  };
  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    try {
      for (let index = 0; index < queue.length; index += 1) {
        const queued = queue[index];
        setSaveStep(
          `Uploading ${queued.file.name} (${index + 1}/${queue.length})...`,
        );
        await supplierAPI.uploadRelationDevelopmentPlanDocument(
          item.relation.id_relation,
          plan.id_development_plan,
          queued.file,
          queued.notes.trim() || undefined,
        );
      }
      setSaveStep("Saving...");
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
      await onSuccess();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to save.",
      );
    } finally {
      setIsSaving(false);
      setSaveStep(null);
    }
  };
  const workflowStep =
    (
      {
        "must be send": 0,
        "request sent": 1,
        received: 2,
        "under review": 3,
        approved: 4,
        rejected: 4,
        closed: 4,
        cancelled: 4,
      } as Record<string, number>
    )[(plan.plan_status ?? "").toLowerCase()] ?? 0;
  return (
    <Modal title="Plan Details" onClose={onClose}>
      <div className="space-y-5">
        <SupplierBanner item={item} />
        {workflowStep > 0 && (
          <WorkflowStepper
            currentStep={workflowStep}
            isRejected={(plan.plan_status ?? "").toLowerCase() === "rejected"}
          />
        )}
        {error && <ErrorMsg msg={error} />}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Plan Title
              </label>
              <input
                value={form.plan_title}
                onChange={(e) => setField("plan_title", e.target.value)}
                className={inputCls}
                disabled={isClosed}
              />
            </div>
            {!isClosed && (
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Status
                </label>
                <select
                  value={form.plan_status}
                  onChange={(e) => setField("plan_status", e.target.value)}
                  className={inputCls}
                >
                  {PLAN_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Internal Notes
              </label>
              <textarea
                value={form.internal_comments}
                onChange={(e) => setField("internal_comments", e.target.value)}
                rows={4}
                className={`${inputCls} resize-none`}
                disabled={isClosed}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Supplier Comments
              </label>
              <textarea
                value={form.supplier_comments}
                onChange={(e) => setField("supplier_comments", e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
                disabled={isClosed}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  Documents
                </p>
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
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
                onChange={(e) => addFiles(e.target.files)}
              />
              {docsLoading ? (
                <p className="text-xs text-slate-400">Loading...</p>
              ) : existingDocs.length === 0 && queue.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No documents attached yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {existingDocs.map((doc) => (
                    <div
                      key={doc.id_document}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <FileCheck className="h-4 w-4 shrink-0 text-sky-500" />
                      <div className="min-w-0 flex-1">
                        {doc.file_url ? (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-xs font-semibold text-[#062B49] hover:underline"
                          >
                            {doc.file_name || `Document #${doc.id_document}`}
                          </a>
                        ) : (
                          <p className="truncate text-xs font-semibold text-slate-700">
                            {doc.file_name || `Document #${doc.id_document}`}
                          </p>
                        )}
                      </div>
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-slate-400 hover:text-slate-700"
                        >
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
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <PlanTimeline item={item} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {isClosed ? "Close" : "Cancel"}
          </button>
          {!isClosed && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="rounded-xl bg-[#062B49] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0C5381] disabled:opacity-50"
            >
              {isSaving ? (saveStep ?? "Saving...") : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
