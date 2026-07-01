import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  AlertTriangle, CalendarCheck, CheckCircle2, ChevronDown, Clock,
  FolderOpen, Paperclip, RefreshCw, Upload, User, XCircle,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; icon: React.ReactNode }> = {
  open:    { label: "Open",    bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400",   icon: <Clock size={10} /> },
  closed:  { label: "Closed",  bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400", icon: <CheckCircle2 size={10} /> },
  blocked: { label: "Blocked", bg: "bg-rose-50",    text: "text-rose-700",    dot: "bg-rose-400",    icon: <XCircle size={10} /> },
};

const PHASE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  "Phase 0": { bg: "bg-slate-100",   text: "text-slate-600",   ring: "ring-slate-200" },
  "Phase 1": { bg: "bg-indigo-100",  text: "text-indigo-700",  ring: "ring-indigo-200" },
  "Phase 2": { bg: "bg-violet-100",  text: "text-violet-700",  ring: "ring-violet-200" },
  "Phase 3": { bg: "bg-amber-100",   text: "text-amber-700",   ring: "ring-amber-200" },
  "Phase 4": { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200" },
  "Closed":  { bg: "bg-slate-200",   text: "text-slate-500",   ring: "ring-slate-300" },
};

function isOverdue(due: string | null, status: string) {
  if (!due || status === "closed") return false;
  return new Date(due) < new Date();
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateShort(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function personLabel(email: string | null, name: string | null) {
  if (name && name !== email) return name;
  if (!email) return "Unassigned";
  return email.split("@")[0].split(".").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

function initials(email: string | null, name: string | null) {
  const label = personLabel(email, name);
  return label.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

// ---------------------------------------------------------------------------
// Evidence button
// ---------------------------------------------------------------------------
function EvidenceButton({ item, onUploaded }: { item: ActionItem; onUploaded: (item: ActionItem, att: Attachment) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await supplierAPI.uploadActionEvidence(item.opportunity_id, item.plan_id, item.sujet_idx, item.action_idx, file);
      onUploaded(item, (res as { data: Attachment }).data);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <input ref={fileRef} type="file" className="hidden" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
      >
        {uploading ? <RefreshCw size={10} className="animate-spin" /> : <Upload size={10} />}
        {uploading ? "Uploading…" : "Add file"}
      </button>
      {error && <p className="mt-0.5 text-[9px] text-rose-500">{error}</p>}
      {item.attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {item.attachments.slice(0, 3).map((a, ai) => (
            <a key={ai} href={a.file_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
              <Paperclip size={8} />
              <span className="max-w-[90px] truncate">{a.filename}</span>
            </a>
          ))}
          {item.attachments.length > 3 && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
              +{item.attachments.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline status changer
// ---------------------------------------------------------------------------
function StatusCell({ item, onStatusChanged }: { item: ActionItem; onStatusChanged: (item: ActionItem, status: string, closedDate?: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [implDate, setImplDate] = useState(item.closed_date ?? todayIso());
  const [error, setError] = useState<string | null>(null);

  const changeStatus = async (newStatus: string) => {
    if (newStatus === "closed" && item.action_status !== "closed") {
      setPendingClose(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await supplierAPI.updateActionItemStatus(item.plan_id, item.sujet_idx, item.action_idx, newStatus);
      onStatusChanged(item, newStatus);
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmClose = async () => {
    setSaving(true);
    setError(null);
    try {
      await supplierAPI.updateActionItemStatus(item.plan_id, item.sujet_idx, item.action_idx, "closed", implDate);
      onStatusChanged(item, "closed", implDate);
      setPendingClose(false);
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const cfg = STATUS_CONFIG[item.action_status] ?? STATUS_CONFIG.open;

  return (
    <div className="space-y-1.5 min-w-[120px]">
      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
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
      {pendingClose && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 space-y-1.5">
          <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">Implementation date</p>
          <input
            type="date"
            value={implDate}
            onChange={(e) => setImplDate(e.target.value)}
            className="w-full rounded-lg border border-emerald-300 px-2 py-1 text-[10px] text-slate-700 outline-none focus:border-emerald-500"
          />
          <div className="flex gap-1">
            <button onClick={confirmClose} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-2 py-1 text-[9px] font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
              <CalendarCheck size={9} /> Confirm
            </button>
            <button onClick={() => setPendingClose(false)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-400 hover:text-rose-500 hover:border-rose-200">
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
  onUploaded,
  onStatusChanged,
  isViewer = false,
}: {
  item: ActionItem;
  onUploaded: (item: ActionItem, att: Attachment) => void;
  onStatusChanged: (item: ActionItem, status: string, closedDate?: string) => void;
  isViewer?: boolean;
}) {
  const overdue = isOverdue(item.due_date, item.action_status);
  const phase = PHASE_COLORS[item.opp_phase ?? ""] ?? PHASE_COLORS["Closed"];
  const dueFmt = fmtDate(item.due_date);

  return (
    <div className={`group relative flex gap-4 rounded-2xl border bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${overdue ? "border-rose-200" : "border-slate-200/70"}`}>
      {overdue && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black text-white">
          <AlertTriangle size={8} /> OVERDUE
        </div>
      )}

      {/* Left: opp + subject */}
      <div className="w-52 shrink-0 space-y-2 border-r border-slate-100 pr-4">
        <div>
          <p className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-2">{item.opportunity_name}</p>
          {item.opp_phase && (
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ${phase.bg} ${phase.text} ${phase.ring}`}>
              {item.opp_phase}
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Subject</p>
          <p className="text-[10px] text-slate-600 font-medium line-clamp-2">{item.sujet_titre ?? "—"}</p>
        </div>
        <div className="text-[9px] text-slate-400">
          Created {fmtDateShort(item.plan_created_at)}
        </div>
      </div>

      {/* Middle: action title + description */}
      <div className="flex-1 space-y-2 min-w-0">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Action</p>
          <p className="text-[12px] font-bold text-slate-800 leading-snug">{item.action_titre ?? "—"}</p>
        </div>
        {item.description && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
            <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-3">{item.description}</p>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {dueFmt && (
            <span className={`flex items-center gap-1 text-[10px] font-semibold ${overdue ? "text-rose-600" : "text-slate-500"}`}>
              <Clock size={10} />
              {dueFmt}
            </span>
          )}
          {!dueFmt && <span className="text-[10px] text-slate-300">No due date</span>}
        </div>
        {!isViewer && <EvidenceButton item={item} onUploaded={onUploaded} />}
        {isViewer && item.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.attachments.slice(0, 3).map((a, ai) => (
              <a key={ai} href={a.file_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors">
                <Paperclip size={8} />
                <span className="max-w-[90px] truncate">{a.filename}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Right: status */}
      <div className="w-36 shrink-0 border-l border-slate-100 pl-4">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Status</p>
        {isViewer ? (
          (() => {
            const cfg = STATUS_CONFIG[item.action_status] ?? STATUS_CONFIG.open;
            return (
              <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                {cfg.icon}
                {cfg.label}
              </div>
            );
          })()
        ) : (
          <StatusCell item={item} onStatusChanged={onStatusChanged} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Person group accordion
// ---------------------------------------------------------------------------
function PersonGroup({
  email,
  name,
  items,
  onUploaded,
  onStatusChanged,
  isViewer = false,
}: {
  email: string | null;
  name: string | null;
  items: ActionItem[];
  onUploaded: (item: ActionItem, att: Attachment) => void;
  onStatusChanged: (item: ActionItem, status: string, closedDate?: string) => void;
  isViewer?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const openCount = items.filter((i) => i.action_status === "open").length;
  const closedCount = items.filter((i) => i.action_status === "closed").length;
  const blockedCount = items.filter((i) => i.action_status === "blocked").length;
  const overdueCount = items.filter((i) => isOverdue(i.due_date, i.action_status)).length;
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
          {email && <p className="text-[10px] text-slate-400 truncate">{email}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-slate-400">{items.length} action{items.length !== 1 ? "s" : ""}</span>
          {openCount > 0 && <Chip color="amber">{openCount} open</Chip>}
          {blockedCount > 0 && <Chip color="rose">{blockedCount} blocked</Chip>}
          {closedCount > 0 && <Chip color="emerald">{closedCount} closed</Chip>}
          {overdueCount > 0 && <span className="rounded-full bg-rose-600 text-white text-[9px] font-black px-2 py-0.5">{overdueCount} overdue</span>}
          <ChevronDown size={15} className={`text-slate-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Cards */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 space-y-3">
          {items.map((item, i) => (
            <ActionCard key={i} item={item} onUploaded={onUploaded} onStatusChanged={onStatusChanged} isViewer={isViewer} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ color, children }: { color: "amber" | "rose" | "emerald" | "slate"; children: React.ReactNode }) {
  const cls = {
    amber:   "bg-amber-100 text-amber-700",
    rose:    "bg-rose-100 text-rose-700",
    emerald: "bg-emerald-100 text-emerald-700",
    slate:   "bg-slate-100 text-slate-500",
  }[color];
  return <span className={`rounded-full text-[9px] font-bold px-2 py-0.5 ${cls}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function PurchasingActionPlansPage() {
  const { user } = useAuth();
  const isViewer = user?.access_profile === "viewer";
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPerson, setFilterPerson] = useState<string>("");
  const [filterOpp, setFilterOpp] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.listAllActionItems();
      setItems((res as { data: ActionItem[] }).data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load action items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUploaded = (item: ActionItem, att: Attachment) => {
    setItems((prev) =>
      prev.map((i) =>
        i.plan_id === item.plan_id && i.sujet_idx === item.sujet_idx && i.action_idx === item.action_idx
          ? { ...i, attachments: [...i.attachments, att], attachment_count: i.attachment_count + 1 }
          : i,
      ),
    );
  };

  const handleStatusChanged = (item: ActionItem, status: string, closedDate?: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.plan_id === item.plan_id && i.sujet_idx === item.sujet_idx && i.action_idx === item.action_idx
          ? { ...i, action_status: status, closed_date: status === "closed" ? (closedDate ?? i.closed_date) : null }
          : i,
      ),
    );
  };

  const allPersons = Array.from(new Set(items.map((i) => i.responsible_email).filter(Boolean))) as string[];
  const allOpps = Array.from(new Set(items.map((i) => i.opportunity_name))).sort();

  const filtered = items.filter((i) => {
    if (filterStatus && i.action_status !== filterStatus) return false;
    if (filterPerson && i.responsible_email !== filterPerson) return false;
    if (filterOpp && i.opportunity_name !== filterOpp) return false;
    return true;
  });

  const groups = filtered.reduce<Record<string, { email: string | null; name: string | null; items: ActionItem[] }>>(
    (acc, item) => {
      const key = item.responsible_email ?? "__unassigned__";
      if (!acc[key]) acc[key] = { email: item.responsible_email, name: item.responsible_name, items: [] };
      acc[key].items.push(item);
      return acc;
    },
    {},
  );

  const totalOpen    = filtered.filter((i) => i.action_status === "open").length;
  const totalClosed  = filtered.filter((i) => i.action_status === "closed").length;
  const totalBlocked = filtered.filter((i) => i.action_status === "blocked").length;
  const totalOverdue = filtered.filter((i) => isOverdue(i.due_date, i.action_status)).length;

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw size={20} className="animate-spin text-indigo-500" />
        <p className="text-sm font-medium text-slate-400">Loading action items…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5 text-rose-700 text-sm max-w-sm text-center">
        <AlertTriangle size={20} className="mx-auto mb-2 text-rose-400" /> {error}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F1F4FA]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-lg shadow-indigo-200 hidden sm:flex">
              <FolderOpen size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">Purchasing · Action Plans</p>
              <h1 className="text-xl font-black text-slate-900 leading-tight">Action Management</h1>
            </div>
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-8 py-6 space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: filtered.length, color: "text-slate-900", subColor: "bg-slate-100" },
            { label: "Open", value: totalOpen, color: "text-amber-600", subColor: "bg-amber-50 border-amber-100" },
            { label: "Blocked", value: totalBlocked, color: "text-rose-600", subColor: "bg-rose-50 border-rose-100" },
            { label: "Overdue", value: totalOverdue, color: totalOverdue > 0 ? "text-rose-700" : "text-emerald-600", subColor: totalOverdue > 0 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border px-5 py-4 ${s.subColor}`}>
              <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400">{s.label}</p>
              <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
              {s.label === "Blocked" || s.label === "Open" ? (
                <p className="text-[9px] text-slate-400 mt-0.5">{totalClosed} closed</p>
              ) : null}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filter</span>
          {[
            {
              value: filterStatus, onChange: setFilterStatus, label: "Status",
              options: [["open", "Open"], ["closed", "Closed"], ["blocked", "Blocked"]],
            },
            {
              value: filterPerson, onChange: setFilterPerson, label: "Person",
              options: allPersons.map((p) => [p, personLabel(p, null)]),
            },
            {
              value: filterOpp, onChange: setFilterOpp, label: "Opportunity",
              options: allOpps.map((o) => [o, o]),
            },
          ].map((f) => (
            <select key={f.label} value={f.value} onChange={(e) => f.onChange(e.target.value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer transition-colors max-w-[220px] ${f.value ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}>
              <option value="">All {f.label}s</option>
              {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          {(filterStatus || filterPerson || filterOpp) && (
            <button onClick={() => { setFilterStatus(""); setFilterPerson(""); setFilterOpp(""); }}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-colors">
              <XCircle size={12} /> Clear
            </button>
          )}
        </div>

        {/* Groups */}
        {Object.keys(groups).length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white px-8 py-20 text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <User size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-400">No action items found</p>
            <p className="text-xs text-slate-300 mt-1">Create action plans inside opportunities to see them here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(groups).map((g) => (
              <PersonGroup
                key={g.email ?? "__unassigned__"}
                email={g.email}
                name={g.name}
                items={g.items}
                onUploaded={handleUploaded}
                onStatusChanged={handleStatusChanged}
                isViewer={isViewer}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
