import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  loadPersistedFilters,
  savePersistedFilters,
} from "../utils/persistedFilters";

const ACTION_PLANS_FILTERS_PAGE_KEY = "purchasing-action-plans";

interface ActionPlansFilters {
  filterStatus: string;
  filterPerson: string;
  filterOpp: string;
  viewMode: "cards" | "table";
}

const ACTION_PLANS_FILTERS_DEFAULT: ActionPlansFilters = {
  filterStatus: "",
  filterPerson: "",
  filterOpp: "",
  viewMode: "cards",
};
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FolderOpen,
  History as HistoryIcon,
  LayoutGrid,
  Megaphone,
  Paperclip,
  RefreshCw,
  Table2,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import supplierAPI from "../services/supplierOnboardingAPI";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ActionItem {
  plan_id: number;
  plan_code: string | null;
  plan_title: string | null;
  plan_created_at: string | null;
  plan_created_by: string | null;
  plan_updated_at: string | null;
  plan_updated_by: string | null;
  opportunity_id: number;
  opportunity_name: string;
  opp_phase: string | null;
  sujet_idx: number;
  action_idx: number;
  sujet_titre: string | null;
  action_titre: string | null;
  action_status: string;
  due_date: string | null;
  closed_date: string | null;
  responsible_name: string | null;
  responsible_email: string | null;
  attachments: Attachment[];
  attachment_count: number;
  description: string | null;
  history: HistoryEntry[];
  last_reminded_at: string | null;
  last_reminded_to: string | null;
  last_escalated_at: string | null;
  last_escalated_to: string | null;
  last_escalated_by: string | null;
}

interface Attachment {
  blob_name: string;
  file_url: string;
  filename: string;
  mimetype: string;
  size: number;
  uploaded_by?: string;
  uploaded_at?: string;
}

interface HistoryEntry {
  event: string;
  by: string;
  at: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    bg: string;
    text: string;
    dot: string;
    icon: React.ReactNode;
  }
> = {
  open: {
    label: "Open",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-400",
    icon: <Clock size={10} />,
  },
  closed: {
    label: "Closed",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-400",
    icon: <CheckCircle2 size={10} />,
  },
  blocked: {
    label: "Blocked",
    bg: "bg-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-400",
    icon: <XCircle size={10} />,
  },
};

const PHASE_COLORS: Record<string, { bg: string; text: string; ring: string }> =
  {
    "Phase 0": {
      bg: "bg-slate-100",
      text: "text-slate-600",
      ring: "ring-slate-200",
    },
    "Phase 1": {
      bg: "bg-indigo-100",
      text: "text-indigo-700",
      ring: "ring-indigo-200",
    },
    "Phase 2": {
      bg: "bg-violet-100",
      text: "text-violet-700",
      ring: "ring-violet-200",
    },
    "Phase 3": {
      bg: "bg-amber-100",
      text: "text-amber-700",
      ring: "ring-amber-200",
    },
    "Phase 4": {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      ring: "ring-emerald-200",
    },
    Closed: {
      bg: "bg-slate-200",
      text: "text-slate-500",
      ring: "ring-slate-300",
    },
  };

function isOverdue(due: string | null, status: string) {
  if (!due || status === "closed") return false;
  // Compare calendar dates only — a task due today is not overdue until tomorrow.
  return due.slice(0, 10) < todayIso();
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateShort(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function personLabel(email: string | null, name: string | null) {
  if (name && name !== email) return name;
  if (!email) return "Unassigned";
  return email
    .split("@")[0]
    .split(".")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function initials(email: string | null, name: string | null) {
  const label = personLabel(email, name);
  return label
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Evidence button
// ---------------------------------------------------------------------------
function EvidenceButton({
  item,
  onChanged,
}: {
  item: ActionItem;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await supplierAPI.uploadActionEvidence(
        item.opportunity_id,
        item.plan_id,
        item.sujet_idx,
        item.action_idx,
        file,
      );
      onChanged();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={handleFile}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <RefreshCw size={10} className="animate-spin" />
        ) : (
          <Upload size={10} />
        )}
        {uploading ? "Uploading…" : "Add file"}
      </button>
      {error && <p className="mt-0.5 text-[9px] text-rose-500">{error}</p>}
      {item.attachments.length > 0 && (
        <div className="mt-1 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
          {item.attachments.map((a, ai) => (
            <a
              key={ai}
              href={a.file_url}
              target="_blank"
              rel="noreferrer"
              title={a.filename}
              className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              <Paperclip size={8} />
              <span className="max-w-[110px] truncate">{a.filename}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Escalate button
// ---------------------------------------------------------------------------
function EscalateButton({
  item,
  onChanged,
}: {
  item: ActionItem;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState(
    `[Escalation] Action Plan — ${item.action_titre ?? "Action"} (${item.opportunity_name})`,
  );
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!recipientEmail.trim()) {
      setError("Recipient email is required.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await supplierAPI.escalateActionItem(
        item.plan_id,
        item.sujet_idx,
        item.action_idx,
        {
          recipient_email: recipientEmail.trim(),
          subject: subject.trim(),
          message: message.trim() || undefined,
        },
      );
      setSent(true);
      onChanged();
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setRecipientEmail("");
        setMessage("");
      }, 1200);
    } catch (e: any) {
      setError(e?.message ?? "Failed to escalate.");
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    setOpen(false);
    setError(null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[9px] font-bold text-rose-700 hover:bg-rose-100 transition-colors"
      >
        <Megaphone size={9} /> Escalate
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-lg space-y-4 rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100">
                <Megaphone size={16} className="text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Escalate this action
                </p>
                <p className="text-xs text-slate-400">
                  {item.action_titre} — {item.opportunity_name}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500">
                To (email)
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="manager@company.com"
                autoFocus
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">
                Message (optional)
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add context for the recipient…"
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100"
              />
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={close}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-500 hover:text-rose-500 hover:border-rose-200"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || !recipientEmail.trim()}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                {sending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : sent ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Megaphone size={14} />
                )}
                {sent ? "Sent" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline status changer
// ---------------------------------------------------------------------------
function StatusCell({
  item,
  onChanged,
}: {
  item: ActionItem;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [implDate, setImplDate] = useState(item.closed_date ?? todayIso());
  const [error, setError] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reminded, setReminded] = useState(false);

  const hasAttachment = item.attachments.length > 0;

  const changeStatus = async (newStatus: string) => {
    if (newStatus === "closed" && item.action_status !== "closed") {
      setError(null);
      setPendingClose(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await supplierAPI.updateActionItemStatus(
        item.plan_id,
        item.sujet_idx,
        item.action_idx,
        newStatus,
      );
      onChanged();
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmClose = async () => {
    if (!implDate) {
      setError("Implementation date is required.");
      return;
    }
    if (!hasAttachment) {
      setError("Attach at least one file before closing (see \"Add file\" above).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await supplierAPI.updateActionItemStatus(
        item.plan_id,
        item.sujet_idx,
        item.action_idx,
        "closed",
        implDate,
      );
      onChanged();
      setPendingClose(false);
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remind = async () => {
    setReminding(true);
    setError(null);
    try {
      await supplierAPI.remindActionItem(
        item.plan_id,
        item.sujet_idx,
        item.action_idx,
      );
      setReminded(true);
      onChanged();
      setTimeout(() => setReminded(false), 4000);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send reminder.");
    } finally {
      setReminding(false);
    }
  };

  const cfg = STATUS_CONFIG[item.action_status] ?? STATUS_CONFIG.open;
  const canConfirmClose = !!implDate && hasAttachment;

  return (
    <div className="space-y-1.5 w-full min-w-[160px]">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}
      >
        {cfg.icon}
        {cfg.label}
        {saving && <RefreshCw size={9} className="animate-spin ml-0.5" />}
      </div>
      <select
        value={item.action_status}
        onChange={(e) => changeStatus(e.target.value)}
        disabled={saving}
        className="block w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 outline-none cursor-pointer hover:border-indigo-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
      >
        <option value="open">→ Open</option>
        <option value="closed">→ Closed</option>
        <option value="blocked">→ Blocked</option>
      </select>
      {item.action_status !== "closed" && item.responsible_email && (
        <button
          onClick={remind}
          disabled={reminding}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
        >
          {reminding ? (
            <RefreshCw size={9} className="animate-spin" />
          ) : reminded ? (
            <CheckCircle2 size={9} />
          ) : (
            <AlertTriangle size={9} />
          )}
          {reminded ? "Reminder sent" : "Remind"}
        </button>
      )}
      {item.last_reminded_at && (
        <p className="flex items-start gap-1 text-[9px] leading-snug text-amber-600">
          <Clock size={9} className="mt-0.5 shrink-0" />
          Reminded {fmtDateShort(item.last_reminded_at)}
          {item.last_reminded_to ? ` · ${item.last_reminded_to}` : ""}
        </p>
      )}
      {item.action_status !== "closed" && (
        <EscalateButton item={item} onChanged={onChanged} />
      )}
      {item.last_escalated_at && (
        <p className="flex items-start gap-1 text-[9px] leading-snug text-rose-600">
          <Megaphone size={9} className="mt-0.5 shrink-0" />
          Escalated {fmtDateShort(item.last_escalated_at)} to{" "}
          {item.last_escalated_to}
        </p>
      )}
      {pendingClose && (
        <div className="w-full space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
          <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">
            Implementation date
          </p>
          <input
            type="date"
            value={implDate}
            onChange={(e) => setImplDate(e.target.value)}
            className="w-full rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-emerald-500"
          />
          <p
            className={`flex items-start gap-1 text-[9px] font-semibold leading-snug ${hasAttachment ? "text-emerald-600" : "text-rose-500"}`}
          >
            <Paperclip size={9} className="mt-0.5 shrink-0" />
            {hasAttachment
              ? `${item.attachments.length} file${item.attachments.length !== 1 ? "s" : ""} attached`
              : "File attachment required (see Add file)"}
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={confirmClose}
              disabled={saving || !canConfirmClose}
              title={
                !canConfirmClose
                  ? "Requires an implementation date and at least one attachment"
                  : undefined
              }
              className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-2 py-1.5 text-[9px] font-bold text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CalendarCheck size={9} /> Confirm
            </button>
            <button
              onClick={() => {
                setPendingClose(false);
                setError(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-semibold text-slate-400 hover:text-rose-500 hover:border-rose-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-[9px] text-rose-500">{error}</p>}
      {item.action_status === "closed" && item.closed_date && (
        <p className="flex items-center gap-1 text-[9px] text-emerald-600 font-semibold">
          <CalendarCheck size={8} /> {fmtDate(item.closed_date)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action card row
// ---------------------------------------------------------------------------
function ActionCard({
  item,
  onChanged,
  isViewer = false,
}: {
  item: ActionItem;
  onChanged: () => void;
  isViewer?: boolean;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const overdue = isOverdue(item.due_date, item.action_status);
  const phase = PHASE_COLORS[item.opp_phase ?? ""] ?? PHASE_COLORS["Closed"];
  const dueFmt = fmtDate(item.due_date);

  return (
    <div
      className={`group relative rounded-2xl border bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${overdue ? "border-rose-200" : "border-slate-200/70"}`}
    >
      {overdue && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black text-white">
          <AlertTriangle size={8} /> OVERDUE
        </div>
      )}

      <div className="flex gap-4 p-4">
      {/* Left: opp + subject */}
      <div className="w-52 shrink-0 space-y-2 border-r border-slate-100 pr-4">
        <div>
          <p className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-2">
            {item.opportunity_name}
          </p>
          {item.opp_phase && (
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${phase.bg} ${phase.text} ${phase.ring}`}
            >
              {item.opp_phase}
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
            Subject
          </p>
          <p className="text-[10px] text-slate-600 font-medium line-clamp-2">
            {item.sujet_titre ?? "—"}
          </p>
        </div>
        <div className="text-[9px] text-slate-400 space-y-0.5">
          <div>Created {fmtDateShort(item.plan_created_at)}</div>
          {(item.plan_created_by || item.plan_updated_at) && (
            <div>
              {item.plan_created_by ? `By ${item.plan_created_by}` : "Plan audit metadata available"}
              {item.plan_updated_at ? ` ? Updated ${fmtDateShort(item.plan_updated_at)}` : ""}
              {item.plan_updated_by ? ` by ${item.plan_updated_by}` : ""}
            </div>
          )}
        </div>
      </div>

      {/* Middle: action title + description */}
      <div className="flex-1 space-y-2 min-w-0">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
            Action
          </p>
          <p className="text-[12px] font-bold text-slate-800 leading-snug">
            {item.action_titre ?? "—"}
          </p>
        </div>
        {item.description && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
            <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-3">
              {item.description}
            </p>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {dueFmt && (
            <span
              className={`flex items-center gap-1 text-[10px] font-semibold ${overdue ? "text-rose-600" : "text-slate-500"}`}
            >
              <Clock size={10} />
              {dueFmt}
            </span>
          )}
          {!dueFmt && (
            <span className="text-[10px] text-slate-300">No due date</span>
          )}
        </div>
        {!isViewer && <EvidenceButton item={item} onChanged={onChanged} />}
        {isViewer && item.attachments.length > 0 && (
          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            {item.attachments.map((a, ai) => (
              <a
                key={ai}
                href={a.file_url}
                target="_blank"
                rel="noreferrer"
                title={a.filename}
                className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                <Paperclip size={8} />
                <span className="max-w-[110px] truncate">{a.filename}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Right: status */}
      <div className="w-60 shrink-0 border-l border-slate-100 pl-4">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
          Status
        </p>
        {isViewer ? (
          (() => {
            const cfg = STATUS_CONFIG[item.action_status] ?? STATUS_CONFIG.open;
            return (
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}
              >
                {cfg.icon}
                {cfg.label}
              </div>
            );
          })()
        ) : (
          <StatusCell item={item} onChanged={onChanged} />
        )}
      </div>
      </div>

      {/* Audit trail */}
      {item.history.length > 0 && (
        <div className="relative border-t border-slate-100 px-4 py-1.5">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex items-center gap-1 text-[9px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <HistoryIcon size={10} />
            History ({item.history.length})
            <ChevronDown
              size={10}
              className={`transition-transform ${historyOpen ? "rotate-180" : ""}`}
            />
          </button>
          {historyOpen && (
            <div className="absolute bottom-full right-3 z-20 mb-2 max-h-[420px] w-[26rem] max-w-[90vw] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                Audit trail
              </p>
              <ul className="space-y-3">
                {[...item.history]
                  .sort((a, b) => (a.at < b.at ? 1 : -1))
                  .map((h, hi) => (
                    <li
                      key={hi}
                      className="border-b border-slate-100 pb-2 text-sm leading-snug text-slate-600 last:border-0 last:pb-0"
                    >
                      <p className="font-semibold text-slate-800">
                        {historyLabel(h)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {h.by} · {fmtDate(h.at)}
                      </p>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function historyLabel(h: HistoryEntry): string {
  switch (h.event) {
    case "status_changed":
      return `Status changed: ${h.from_status} → ${h.to_status}`;
    case "reminder_sent":
      return `Reminder sent to ${h.to}`;
    case "escalation_sent":
      return `Escalated to ${h.to}${h.subject ? ` — "${h.subject}"` : ""}`;
    case "attachment_added":
      return `File attached: ${h.filename ?? "unnamed"}`;
    default:
      return h.event;
  }
}

// ---------------------------------------------------------------------------
// Person group accordion
// ---------------------------------------------------------------------------
function PersonGroup({
  email,
  name,
  items,
  onChanged,
  isViewer = false,
}: {
  email: string | null;
  name: string | null;
  items: ActionItem[];
  onChanged: () => void;
  isViewer?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const openCount = items.filter((i) => i.action_status === "open").length;
  const closedCount = items.filter((i) => i.action_status === "closed").length;
  const blockedCount = items.filter(
    (i) => i.action_status === "blocked",
  ).length;
  const overdueCount = items.filter((i) =>
    isOverdue(i.due_date, i.action_status),
  ).length;
  const label = personLabel(email, name);
  const ini = initials(email, name);

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/60 shadow-[0_1px_8px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors text-left"
      >
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shrink-0 shadow-md shadow-indigo-200">
          <span className="text-[11px] font-black text-white">{ini}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{label}</p>
          {email && (
            <p className="text-[10px] text-slate-400 truncate">{email}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-slate-400">
            {items.length} action{items.length !== 1 ? "s" : ""}
          </span>
          {openCount > 0 && <Chip color="amber">{openCount} open</Chip>}
          {blockedCount > 0 && <Chip color="rose">{blockedCount} blocked</Chip>}
          {closedCount > 0 && <Chip color="emerald">{closedCount} closed</Chip>}
          {overdueCount > 0 && (
            <span className="rounded-full bg-rose-600 text-white text-[9px] font-black px-2 py-0.5">
              {overdueCount} overdue
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-slate-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Cards */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 space-y-3">
          {items.map((item, i) => (
            <ActionCard
              key={i}
              item={item}
              onChanged={onChanged}
              isViewer={isViewer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  color,
  children,
}: {
  color: "amber" | "rose" | "emerald" | "slate";
  children: React.ReactNode;
}) {
  const cls = {
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    emerald: "bg-emerald-100 text-emerald-700",
    slate: "bg-slate-100 text-slate-500",
  }[color];
  return (
    <span className={`rounded-full text-[9px] font-bold px-2 py-0.5 ${cls}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tabular view — flat, sortable list for quick cross-item analysis
// ---------------------------------------------------------------------------
type SortKey =
  | "opportunity_name"
  | "responsible"
  | "due_date"
  | "action_status";

function ActionItemsTable({
  items,
  onChanged,
  isViewer,
}: {
  items: ActionItem[];
  onChanged: () => void;
  isViewer: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const sortValue = (item: ActionItem, key: SortKey): string => {
    switch (key) {
      case "opportunity_name":
        return item.opportunity_name;
      case "responsible":
        return personLabel(item.responsible_email, item.responsible_name);
      case "due_date":
        return item.due_date ?? "9999-99-99";
      case "action_status":
        return item.action_status;
    }
  };

  const sorted = [...items].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const Th = ({ label, sortk }: { label: string; sortk?: SortKey }) => (
    <th
      onClick={sortk ? () => toggleSort(sortk) : undefined}
      className={`whitespace-nowrap px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 ${sortk ? "cursor-pointer select-none hover:text-indigo-600" : ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortk &&
          sortKey === sortk &&
          (sortDir === "asc" ? (
            <ChevronUp size={10} />
          ) : (
            <ChevronDown size={10} />
          ))}
      </span>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <table className="w-full min-w-[1200px] border-collapse text-xs">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <Th label="Opportunity" sortk="opportunity_name" />
            <th className="whitespace-nowrap px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
              Action
            </th>
            <Th label="Responsible" sortk="responsible" />
            <Th label="Due date" sortk="due_date" />
            <Th label="Status" sortk="action_status" />
            <th className="whitespace-nowrap px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
              Last reminded
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
              Last escalated
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
              Files
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-slate-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => {
            const overdue = isOverdue(item.due_date, item.action_status);
            const cfg = STATUS_CONFIG[item.action_status] ?? STATUS_CONFIG.open;
            const rowKey = `${item.plan_id}-${item.sujet_idx}-${item.action_idx}`;
            const isExpanded = expandedRow === i;
            return (
              <Fragment key={rowKey}>
                <tr
                  className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${overdue ? "bg-rose-50/40" : ""}`}
                >
                  <td className="max-w-[160px] px-3 py-2 align-top">
                    <p className="truncate font-semibold text-slate-800">
                      {item.opportunity_name}
                    </p>
                    {item.opp_phase && (
                      <span className="text-[9px] text-slate-400">
                        {item.opp_phase}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[260px] px-3 py-2 align-top">
                    <button
                      onClick={() => setExpandedRow(isExpanded ? null : i)}
                      className="flex items-start gap-1 text-left font-medium text-slate-700 hover:text-indigo-600"
                    >
                      <ChevronDown
                        size={11}
                        className={`mt-0.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                      <span className="line-clamp-2">
                        {item.action_titre ?? "—"}
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-slate-600">
                    {personLabel(item.responsible_email, item.responsible_name)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 align-top font-semibold ${overdue ? "text-rose-600" : "text-slate-600"}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {fmtDateShort(item.due_date)}
                      {overdue && (
                        <span className="rounded bg-rose-600 px-1 py-0.5 text-[8px] font-black text-white">
                          OVERDUE
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${cfg.bg} ${cfg.text}`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-[10px] text-slate-500">
                    {item.last_reminded_at ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Clock size={9} /> {fmtDateShort(item.last_reminded_at)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-[10px] text-slate-500">
                    {item.last_escalated_at ? (
                      <span
                        className="flex items-center gap-1 text-rose-600"
                        title={item.last_escalated_to ?? ""}
                      >
                        <Megaphone size={9} />{" "}
                        {fmtDateShort(item.last_escalated_at)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-[10px] text-slate-500">
                    {item.attachment_count > 0 ? (
                      <span className="flex items-center gap-1">
                        <Paperclip size={9} /> {item.attachment_count}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {isViewer ? (
                      <span className="text-[9px] text-slate-300">
                        Read-only
                      </span>
                    ) : (
                      <div className="w-40">
                        <StatusCell item={item} onChanged={onChanged} />
                      </div>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <td colSpan={9} className="px-3 py-3">
                      <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-600 md:grid-cols-3">
                        <div>
                          <p className="mb-0.5 font-semibold uppercase tracking-widest text-slate-400">
                            Subject
                          </p>
                          {item.sujet_titre ?? "—"}
                        </div>
                        <div>
                          <p className="mb-0.5 font-semibold uppercase tracking-widest text-slate-400">
                            Description
                          </p>
                          {item.description ?? "—"}
                        </div>
                        <div>
                          <p className="mb-0.5 font-semibold uppercase tracking-widest text-slate-400">
                            Files
                          </p>
                          {item.attachments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.attachments.map((a, ai) => (
                                <a
                                  key={ai}
                                  href={a.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={a.filename}
                                  className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 hover:bg-indigo-100"
                                >
                                  <Paperclip size={8} />
                                  <span className="max-w-[110px] truncate">
                                    {a.filename}
                                  </span>
                                </a>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </div>
                        {item.history.length > 0 && (
                          <div className="col-span-2 md:col-span-3">
                            <p className="mb-1 font-semibold uppercase tracking-widest text-slate-400">
                              History ({item.history.length})
                            </p>
                            <ul className="space-y-1">
                              {[...item.history]
                                .sort((a, b) => (a.at < b.at ? 1 : -1))
                                .map((h, hi) => (
                                  <li key={hi}>
                                    <span className="font-semibold text-slate-800">
                                      {historyLabel(h)}
                                    </span>{" "}
                                    <span className="text-slate-400">
                                      — {h.by} · {fmtDate(h.at)}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function PurchasingActionPlansPage() {
  const { user } = useAuth();
  const isViewer = user?.access_profile === "viewer";
  const userEmail = (user as { email?: string })?.email ?? "";
  // Restores whatever this user last had filtered — otherwise leaving this
  // page and coming back (or a reload) silently resets every filter.
  const initialFilters = loadPersistedFilters(
    ACTION_PLANS_FILTERS_PAGE_KEY,
    userEmail,
    ACTION_PLANS_FILTERS_DEFAULT,
  );
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>(initialFilters.filterStatus);
  const [filterPerson, setFilterPerson] = useState<string>(initialFilters.filterPerson);
  const [filterOpp, setFilterOpp] = useState<string>(initialFilters.filterOpp);
  const [viewMode, setViewMode] = useState<"cards" | "table">(initialFilters.viewMode);

  useEffect(() => {
    savePersistedFilters(ACTION_PLANS_FILTERS_PAGE_KEY, userEmail, {
      filterStatus,
      filterPerson,
      filterOpp,
      viewMode,
    });
  }, [userEmail, filterStatus, filterPerson, filterOpp, viewMode]);

  // silent=true skips the full-page spinner — used to re-sync after a mutation
  // (status change, upload, reminder, escalation) so audit-trail fields
  // (history, last_reminded_at, last_escalated_at) always reflect server truth.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listAllActionItems();
      setItems((res as { data: ActionItem[] }).data ?? []);
    } catch (e: unknown) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Failed to load action items");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  const allPersons = Array.from(
    new Set(items.map((i) => i.responsible_email).filter(Boolean)),
  ) as string[];
  const allOpps = Array.from(
    new Set(items.map((i) => i.opportunity_name)),
  ).sort();

  const filtered = items.filter((i) => {
    if (filterStatus === "overdue") {
      if (!isOverdue(i.due_date, i.action_status)) return false;
    } else if (filterStatus && i.action_status !== filterStatus) {
      return false;
    }
    if (filterPerson && i.responsible_email !== filterPerson) return false;
    if (filterOpp && i.opportunity_name !== filterOpp) return false;
    return true;
  });

  const groups = filtered.reduce<
    Record<
      string,
      { email: string | null; name: string | null; items: ActionItem[] }
    >
  >((acc, item) => {
    const key = item.responsible_email ?? "__unassigned__";
    if (!acc[key])
      acc[key] = {
        email: item.responsible_email,
        name: item.responsible_name,
        items: [],
      };
    acc[key].items.push(item);
    return acc;
  }, {});

  const totalOpen = filtered.filter((i) => i.action_status === "open").length;
  const totalClosed = filtered.filter(
    (i) => i.action_status === "closed",
  ).length;
  const totalBlocked = filtered.filter(
    (i) => i.action_status === "blocked",
  ).length;
  const totalOverdue = filtered.filter((i) =>
    isOverdue(i.due_date, i.action_status),
  ).length;

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={20} className="animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-slate-400">
            Loading action items…
          </p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5 text-rose-700 text-sm max-w-sm text-center">
          <AlertTriangle size={20} className="mx-auto mb-2 text-rose-400" />{" "}
          {error}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#F1F4FA]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <div className="max-w-[2200px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-lg shadow-indigo-200 hidden sm:flex">
              <FolderOpen size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">
                Purchasing · Action Plans
              </p>
              <h1 className="text-xl font-black text-slate-900 leading-tight">
                Action Management
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${viewMode === "cards" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <LayoutGrid size={12} /> Cards
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${viewMode === "table" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <Table2 size={12} /> Table
              </button>
            </div>
            <button
              onClick={() => load()}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition-colors"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[2200px] mx-auto px-8 py-6 space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Total",
              value: filtered.length,
              color: "text-slate-900",
              subColor: "bg-slate-100",
            },
            {
              label: "Open",
              value: totalOpen,
              color: "text-amber-600",
              subColor: "bg-amber-50 border-amber-100",
            },
            {
              label: "Blocked",
              value: totalBlocked,
              color: "text-rose-600",
              subColor: "bg-rose-50 border-rose-100",
            },
            {
              label: "Overdue",
              value: totalOverdue,
              color: totalOverdue > 0 ? "text-rose-700" : "text-emerald-600",
              subColor:
                totalOverdue > 0
                  ? "bg-rose-50 border-rose-100"
                  : "bg-emerald-50 border-emerald-100",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-2xl border px-5 py-4 ${s.subColor}`}
            >
              <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400">
                {s.label}
              </p>
              <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
              {s.label === "Blocked" || s.label === "Open" ? (
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {totalClosed} closed
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Filter
          </span>
          {[
            {
              value: filterStatus,
              onChange: setFilterStatus,
              label: "Status",
              allLabel: "All Statuses",
              options: [
                ["open", "Open"],
                ["closed", "Closed"],
                ["blocked", "Blocked"],
                ["overdue", "Overdue"],
              ],
            },
            {
              value: filterPerson,
              onChange: setFilterPerson,
              label: "Person",
              allLabel: "All Persons",
              options: allPersons.map((p) => [p, personLabel(p, null)]),
            },
            {
              value: filterOpp,
              onChange: setFilterOpp,
              label: "Opportunity",
              allLabel: "All Opportunities",
              options: allOpps.map((o) => [o, o]),
            },
          ].map((f) => (
            <select
              key={f.label}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer transition-colors max-w-[220px] ${f.value ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}
            >
              <option value="">{f.allLabel}</option>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ))}
          {(filterStatus || filterPerson || filterOpp) && (
            <button
              onClick={() => {
                setFilterStatus("");
                setFilterPerson("");
                setFilterOpp("");
              }}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
            >
              <XCircle size={12} /> Clear
            </button>
          )}
        </div>

        {/* Groups / Table */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white px-8 py-20 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <User size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">
              No action items found
            </p>
            <p className="text-xs text-slate-300 mt-1">
              Create action plans inside opportunities to see them here.
            </p>
          </div>
        ) : viewMode === "table" ? (
          <ActionItemsTable
            items={filtered}
            onChanged={refresh}
            isViewer={isViewer}
          />
        ) : (
          <div className="space-y-4">
            {Object.values(groups).map((g) => (
              <PersonGroup
                key={g.email ?? "__unassigned__"}
                email={g.email}
                name={g.name}
                items={g.items}
                onChanged={refresh}
                isViewer={isViewer}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
