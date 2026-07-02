import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  Paperclip,
  Pencil,
  RefreshCw,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { Link } from "react-router-dom";
import supplierAPI from "../services/supplierOnboardingAPI";
import type { SupplierCertificationResponse } from "../types/onboarding";
import {
  CERTIFICATION_STANDARD_TYPE_OPTIONS,
  CERT_TYPES_BY_STANDARD,
} from "../utils/onboarding";
import { PageIntro } from "../components/UI";

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i;

const PAGE_SIZE = 100;

type ValidityStatus = "valid" | "expiring" | "expired" | "no-date";

const STANDARD_TYPES = [
  { value: "", label: "All standards" },
  { value: "quality", label: "Quality" },
  { value: "environmental", label: "Environmental" },
  { value: "safety", label: "Safety" },
  { value: "energy", label: "Energy" },
  { value: "other", label: "Other" },
];

function getValidityStatus(
  cert: SupplierCertificationResponse,
): ValidityStatus {
  if (!cert.end_date) return "no-date";
  const end = new Date(cert.end_date);
  if (end < new Date()) return "expired";
  const diffDays = Math.floor((end.getTime() - Date.now()) / 86400000);
  if (diffDays <= 90) return "expiring";
  return "valid";
}

const STATUS_STYLES: Record<ValidityStatus, { badge: string; text: string }> = {
  expired: {
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    text: "Expired",
  },
  expiring: {
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    text: "Expiring soon",
  },
  valid: {
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    text: "Valid",
  },
  "no-date": {
    badge: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    text: "No date",
  },
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function daysLeft(end?: string | null): number | null {
  if (!end) return null;
  return Math.floor((new Date(end).getTime() - Date.now()) / 86400000);
}

// ---------------------------------------------------------------------------
// Group certs by supplier unit
// ---------------------------------------------------------------------------
interface UnitGroup {
  unitId: number | null;
  supplierCode: string;
  certs: SupplierCertificationResponse[];
}

function groupByUnit(certs: SupplierCertificationResponse[]): UnitGroup[] {
  const map = new Map<string, UnitGroup>();
  for (const c of certs) {
    const key = String(c.id_supplier_unit ?? "unknown");
    if (!map.has(key)) {
      const label =
        c.supplier_name || c.group_nom || `Unit #${c.id_supplier_unit ?? "?"}`;
      map.set(key, {
        unitId: c.id_supplier_unit ?? null,
        supplierCode: label,
        certs: [],
      });
    }
    map.get(key)!.certs.push(c);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.supplierCode.localeCompare(b.supplierCode),
  );
}

// ---------------------------------------------------------------------------
// Edit draft
// ---------------------------------------------------------------------------
// Document preview cell — image lightbox or external link
// ---------------------------------------------------------------------------
function DocCell({ url, name }: { url?: string | null; name?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!url && !name)
    return <span className="text-[11px] text-slate-400">—</span>;
  const label = name ?? "View";
  const isImage = url ? IMAGE_EXTS.test(url) : false;
  return (
    <>
      {url ? (
        isImage ? (
          <button
            onClick={() => setOpen(true)}
            className="flex max-w-[160px] items-center gap-1 text-left text-[12px] text-blue-600 hover:underline dark:text-blue-400"
          >
            <ZoomIn size={11} className="shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex max-w-[160px] items-center gap-1 text-[12px] text-blue-600 hover:underline dark:text-blue-400"
          >
            <ExternalLink size={11} className="shrink-0" />
            <span className="truncate">{label}</span>
          </a>
        )
      ) : (
        <span className="flex items-center gap-1 text-slate-500">
          <FileText size={11} />
          <span className="truncate text-[12px]">{label}</span>
        </span>
      )}
      {open && url && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute -right-3 -top-3 z-10 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-700 shadow-lg hover:bg-slate-100"
            >
              <X size={14} />
            </button>
            <img
              src={url}
              alt={label}
              className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
            />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 text-xs text-white/70 hover:text-white"
            >
              <ExternalLink size={11} /> Open original
            </a>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
interface EditDraft {
  standard_type: string;
  certification_type: string;
  certificate_name: string;
  start_date: string;
  end_date: string;
  comments: string;
}

function certToDraft(c: SupplierCertificationResponse): EditDraft {
  return {
    standard_type: c.standard_type ?? "",
    certification_type: c.certification_type ?? "",
    certificate_name: c.certificate_name ?? "",
    start_date: c.start_date ?? "",
    end_date: c.end_date ?? "",
    comments: c.comments ?? "",
  };
}

interface AffectedEval {
  relation_id: number;
  previous_quality_cert: string | null;
  new_quality_cert: string | null;
  new_class_score: number | null;
  new_class_value: number | null;
}

// ---------------------------------------------------------------------------
// Inline edit panel (renders below the cert row)
// ---------------------------------------------------------------------------
function EditPanel({
  cert,
  onSave,
  onCancel,
  onFileUploaded,
}: {
  cert: SupplierCertificationResponse;
  onSave: (d: EditDraft) => Promise<void>;
  onCancel: () => void;
  onFileUploaded: (updated: SupplierCertificationResponse) => void;
}) {
  const [draft, setDraft] = useState<EditDraft>(certToDraft(cert));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const certOptions = CERT_TYPES_BY_STANDARD[draft.standard_type] ?? [];
  const inp =
    "h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white";

  function handleStandardTypeChange(value: string) {
    setDraft((d) => ({ ...d, standard_type: value, certification_type: "" }));
  }

  async function save() {
    if (
      draft.start_date &&
      draft.end_date &&
      draft.end_date < draft.start_date
    ) {
      setErr("End date must be after start date.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave(draft);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile() {
    if (!pendingFile || !cert.id_supplier_unit) return;
    setUploading(true);
    setUploadMsg(null);
    setErr(null);
    try {
      const res = await supplierAPI.uploadCertificationFile(
        cert.id_supplier_unit,
        cert.id_certification,
        pendingFile,
      );
      setPendingFile(null);
      setUploadMsg(`"${res.data.file_name}" uploaded.`);
      onFileUploaded(res.data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const currentFileName = cert.file_name;

  return (
    <tr className="bg-blue-50/60 dark:bg-blue-950/20">
      <td colSpan={8} className="px-6 py-3">
        {/* Metadata fields */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[170px] flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Standard Type
            </label>
            <select
              value={draft.standard_type}
              onChange={(e) => handleStandardTypeChange(e.target.value)}
              className={inp}
            >
              <option value="">— Select —</option>
              {CERTIFICATION_STANDARD_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[190px] flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Certification
            </label>
            <select
              value={draft.certification_type}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  certification_type: e.target.value,
                }))
              }
              disabled={!draft.standard_type}
              className={inp}
            >
              <option value="">
                {draft.standard_type ? "— Select —" : "Select standard type first"}
              </option>
              {certOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[150px] flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Name / Reference
            </label>
            <input
              value={draft.certificate_name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, certificate_name: e.target.value }))
              }
              className={inp}
              placeholder="Reference"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Valid from
            </label>
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) =>
                setDraft((d) => ({ ...d, start_date: e.target.value }))
              }
              className={inp + " w-36"}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Valid until
            </label>
            <input
              type="date"
              value={draft.end_date}
              onChange={(e) =>
                setDraft((d) => ({ ...d, end_date: e.target.value }))
              }
              className={inp + " w-36"}
            />
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Comments
            </label>
            <textarea
              value={draft.comments}
              onChange={(e) =>
                setDraft((d) => ({ ...d, comments: e.target.value }))
              }
              rows={1}
              className={inp + " h-8 resize-y py-1"}
              placeholder="Optional note"
            />
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <button
              onClick={save}
              disabled={saving}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving && <RefreshCw size={11} className="animate-spin" />}
              Save
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="h-8 rounded-lg border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* File section */}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-white/10">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Document
          </span>
          {currentFileName && (
            <DocCell url={cert.file_url} name={currentFileName} />
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
          />
          {pendingFile ? (
            <div className="flex items-center gap-2">
              <span className="max-w-[200px] truncate text-xs text-slate-600 dark:text-slate-300">
                {pendingFile.name}
              </span>
              <button
                onClick={uploadFile}
                disabled={uploading}
                className="flex h-7 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {uploading ? (
                  <RefreshCw size={10} className="animate-spin" />
                ) : (
                  <Paperclip size={10} />
                )}
                Upload
              </button>
              <button
                onClick={() => setPendingFile(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
            >
              <Paperclip size={11} />
              {currentFileName ? "Replace file" : "Attach file"}
            </button>
          )}
          {uploadMsg && (
            <span className="text-xs text-emerald-600">{uploadMsg}</span>
          )}
        </div>

        {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Unit group section
// ---------------------------------------------------------------------------
function UnitGroupSection({
  group,
  editingId,
  onEdit,
  onSave,
  onCancel,
  onFileUploaded,
  canEdit,
}: {
  group: UnitGroup;
  editingId: number | null;
  onEdit: (id: number) => void;
  canEdit: boolean;
  onSave: (
    cert: SupplierCertificationResponse,
    draft: EditDraft,
  ) => Promise<void>;
  onCancel: () => void;
  onFileUploaded: (updated: SupplierCertificationResponse) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const expired = group.certs.filter(
    (c) => getValidityStatus(c) === "expired",
  ).length;
  const expiring = group.certs.filter(
    (c) => getValidityStatus(c) === "expiring",
  ).length;
  const total = group.certs.length;

  return (
    <>
      {/* Unit header row */}
      <tr
        className="cursor-pointer select-none bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
        onClick={() => setCollapsed((c) => !c)}
      >
        <td colSpan={8} className="px-4 py-2.5">
          <div className="flex items-center gap-3">
            <ChevronDown
              size={14}
              className={`shrink-0 text-slate-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}
            />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {group.supplierCode}
            </span>
            <span className="text-xs text-slate-400">
              {total} certification{total !== 1 ? "s" : ""}
            </span>
            {expired > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <AlertCircle size={10} />
                {expired} expired
              </span>
            )}
            {expiring > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle size={10} />
                {expiring} expiring
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Cert rows */}
      {!collapsed &&
        group.certs.map((cert) => {
          const status = getValidityStatus(cert);
          const st = STATUS_STYLES[status];
          const days = daysLeft(cert.end_date);
          const isEditing = editingId === cert.id_certification;

          return (
            <>
              <tr
                key={cert.id_certification}
                className={`border-t border-slate-50 transition-colors hover:bg-slate-50/60 dark:border-white/[0.03] dark:hover:bg-white/[0.02] ${
                  status === "expired"
                    ? "bg-red-50/30 dark:bg-red-950/10"
                    : status === "expiring"
                      ? "bg-amber-50/30 dark:bg-amber-950/10"
                      : ""
                }`}
              >
                {/* indent */}
                <td className="w-8 pl-8" />
                <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 capitalize">
                  {cert.standard_type ?? "—"}
                </td>
                <td className="px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {cert.certification_type ?? "—"}
                </td>
                <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {cert.certificate_name ?? "—"}
                </td>
                <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {fmtDate(cert.start_date)}
                </td>
                <td className="px-3 py-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {fmtDate(cert.end_date)}
                </td>
                <td className="px-3 py-3 text-xs tabular-nums">
                  {days == null ? (
                    <span className="text-slate-400">—</span>
                  ) : days < 0 ? (
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {Math.abs(days)}d ago
                    </span>
                  ) : (
                    <span
                      className={
                        days <= 30
                          ? "font-semibold text-red-600"
                          : days <= 90
                            ? "font-semibold text-amber-600"
                            : "text-emerald-600"
                      }
                    >
                      {days}d
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.badge}`}
                    >
                      {status === "expired" && <AlertCircle size={10} />}
                      {status === "expiring" && <AlertTriangle size={10} />}
                      {status === "valid" && <CheckCircle2 size={10} />}
                      {status === "no-date" && <Clock size={10} />}
                      {st.text}
                    </span>
                    <DocCell url={cert.file_url} name={cert.file_name} />
                    {canEdit && <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(isEditing ? -1 : cert.id_certification);
                      }}
                      className={`ml-auto flex h-6 w-6 items-center justify-center rounded-md border transition ${
                        isEditing
                          ? "border-blue-300 bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                          : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:border-white/10"
                      }`}
                      title="Edit"
                    >
                      <Pencil size={11} />
                    </button>}
                  </div>
                </td>
              </tr>
              {isEditing && (
                <EditPanel
                  key={`edit-${cert.id_certification}`}
                  cert={cert}
                  onSave={(draft) => onSave(cert, draft)}
                  onCancel={onCancel}
                  onFileUploaded={onFileUploaded}
                />
              )}
            </>
          );
        })}
    </>
  );
}

type StatusFilter = "" | "expired" | "expiring" | "valid";

interface AppliedFilters {
  standard_type?: string;
  expired_only?: boolean;
  expiring_days?: number;
  valid_only?: boolean;
  q?: string;
}

interface KpiCounts {
  total: number;
  unfiltered_total: number;
  expired: number;
  expiring: number;
  valid: number;
  no_date: number;
  quality_expired: number;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CertificationsTrackingPage() {
  const { user } = useAuth();
  const isPrivileged = ["vp_conversion", "purchasing_director"].includes(user?.access_profile ?? "");
  const [certs, setCerts] = useState<SupplierCertificationResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saveNotice, setSaveNotice] = useState<{
    message: string;
    affected: AffectedEval[];
  } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [standardType, setStandardType] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [nameSearch, setNameSearch] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({});
  const [kpiCounts, setKpiCounts] = useState<KpiCounts | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const groups = groupByUnit(certs);

  async function fetchSummary(baseFilters: { standard_type?: string; q?: string }) {
    try {
      const summary = await supplierAPI.getCertificationsSummary(baseFilters);
      setKpiCounts(summary);
    } catch {
      // non-critical — KPI strip degrades gracefully
    }
  }

  async function fetchData(p: number, filters: AppliedFilters) {
    setLoading(true);
    setError(null);
    try {
      const result = await supplierAPI.listAllCertifications({
        skip: p * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...filters,
      });
      setCerts(result.items);
      setTotal(result.total);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to load certifications",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(page, appliedFilters);
    // Only refresh summary counts when non-status filters change (standard_type / q)
    const baseFilters: { standard_type?: string; q?: string } = {};
    if (appliedFilters.standard_type) baseFilters.standard_type = appliedFilters.standard_type;
    if (appliedFilters.q) baseFilters.q = appliedFilters.q;
    fetchSummary(baseFilters);
  }, [page, appliedFilters]);

  function buildFilters(
    std: string,
    status: StatusFilter,
    search: string,
  ): AppliedFilters {
    const f: AppliedFilters = {};
    if (std) f.standard_type = std;
    if (status === "expired") f.expired_only = true;
    if (status === "expiring") f.expiring_days = 90;
    if (status === "valid") f.valid_only = true;
    if (search.trim()) f.q = search.trim();
    return f;
  }

  function applyFilters() {
    setPage(0);
    setEditingId(null);
    setAppliedFilters(buildFilters(standardType, statusFilter, nameSearch));
  }

  function applyStatusFilter(status: StatusFilter) {
    // Clicking the active card (or "Total") clears the status filter
    const next: StatusFilter = status === statusFilter || status === "" ? "" : status;
    setStatusFilter(next);
    setPage(0);
    setEditingId(null);
    setAppliedFilters(buildFilters(standardType, next, nameSearch));
  }

  function clearFilters() {
    setStandardType("");
    setStatusFilter("");
    setNameSearch("");
    setPage(0);
    setEditingId(null);
    setAppliedFilters({});
  }

  async function handleSave(
    cert: SupplierCertificationResponse,
    draft: EditDraft,
  ) {
    const res = await supplierAPI.patchCertification(
      cert.id_supplier_unit!,
      cert.id_certification,
      {
        standard_type: draft.standard_type || undefined,
        certification_type: draft.certification_type || undefined,
        certificate_name: draft.certificate_name || undefined,
        start_date: draft.start_date || undefined,
        end_date: draft.end_date || undefined,
        comments: draft.comments || undefined,
      },
    );
    setCerts((prev) =>
      prev.map((c) =>
        c.id_certification === cert.id_certification
          ? { ...res.data, supplier_name: cert.supplier_name }
          : c,
      ),
    );
    setEditingId(null);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setSaveNotice({ message: res.message, affected: res.affected_evaluations });
    noticeTimer.current = setTimeout(() => setSaveNotice(null), 8000);
  }

  function handleFileUploaded(updated: SupplierCertificationResponse) {
    setCerts((prev) =>
      prev.map((c) =>
        c.id_certification === updated.id_certification
          ? {
              ...c,
              file_name: updated.file_name,
              file_url: updated.file_url,
              file_size: updated.file_size,
            }
          : c,
      ),
    );
  }

  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}

      <PageIntro
        eyebrow="Compliance"
        title="Certifications Tracker"
        description="All supplier unit certifications — validity, expiry and compliance status."
      />

      {/* Notice */}
      {saveNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">
            {saveNotice.message}
          </p>
          {saveNotice.affected.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-emerald-700 dark:text-emerald-400">
              {saveNotice.affected.map((a) => (
                <li key={a.relation_id}>
                  Relation #{a.relation_id}: {a.previous_quality_cert ?? "—"} →{" "}
                  <strong>{a.new_quality_cert ?? "—"}</strong> (class{" "}
                  {a.new_class_value}, score {a.new_class_score?.toFixed(1)})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Expired quality certs banner */}
      {kpiCounts && kpiCounts.quality_expired > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-900/20">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {kpiCounts.quality_expired} expired quality certification{kpiCounts.quality_expired > 1 ? "s" : ""}
            </span>
            <span className="text-amber-700 dark:text-amber-400">
              {" "}— the <strong>quality_certification</strong> criterion on affected relations may need to be reset to None.
            </span>
          </div>
          <Link
            to="/suppliers/documents-validity"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            Review in Criteria Validity Tracker →
          </Link>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            {
              // Always the global count, so it never silently shrinks when a
              // standard/search filter scopes the status cards below.
              label:
                kpiCounts && kpiCounts.total !== kpiCounts.unfiltered_total
                  ? `Total · ${kpiCounts.total} in filter`
                  : "Total",
              status: "" as StatusFilter,
              value: kpiCounts?.unfiltered_total ?? total,
              color: "text-blue-600 dark:text-blue-400",
              activeClass: "border-blue-500 ring-1 ring-blue-500",
              icon: <FileCheck size={16} className="text-blue-500" />,
            },
            {
              label: "Valid",
              status: "valid" as StatusFilter,
              value: kpiCounts?.valid ?? "—",
              color: "text-emerald-600 dark:text-emerald-400",
              activeClass: "border-emerald-500 ring-1 ring-emerald-500",
              icon: <CheckCircle2 size={16} className="text-emerald-500" />,
            },
            {
              label: "Expiring ≤ 90 d",
              status: "expiring" as StatusFilter,
              value: kpiCounts?.expiring ?? "—",
              color: "text-amber-600 dark:text-amber-400",
              activeClass: "border-amber-500 ring-1 ring-amber-500",
              icon: <AlertTriangle size={16} className="text-amber-500" />,
            },
            {
              label: "Expired",
              status: "expired" as StatusFilter,
              value: kpiCounts?.expired ?? "—",
              color: "text-red-600 dark:text-red-400",
              activeClass: "border-red-500 ring-1 ring-red-500",
              icon: <AlertCircle size={16} className="text-red-500" />,
            },
          ] as Array<{
            label: string;
            status: StatusFilter;
            value: number | string;
            color: string;
            activeClass: string;
            icon: React.ReactNode;
          }>
        ).map((c) => {
          const isActive = statusFilter === c.status;
          return (
            <button
              key={c.label}
              onClick={() => applyStatusFilter(c.status)}
              title={isActive ? "Click to clear this filter" : `Filter by ${c.label}`}
              className={[
                "flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm text-left transition-all",
                "hover:shadow-md dark:bg-slate-900 cursor-pointer",
                isActive
                  ? `border-2 ${c.activeClass}`
                  : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20",
              ].join(" ")}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800">
                {c.icon}
              </div>
              <div>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {c.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Search
          </label>
          <input
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Supplier, cert type or name…"
            className="h-8 w-56 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Standard
          </label>
          <select
            value={standardType}
            onChange={(e) => {
              const val = e.target.value;
              setStandardType(val);
              setPage(0);
              setEditingId(null);
              setAppliedFilters(buildFilters(val, statusFilter, nameSearch));
            }}
            className="h-8 w-40 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs dark:border-white/10 dark:bg-slate-800 dark:text-white"
          >
            {STANDARD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => applyStatusFilter(e.target.value as StatusFilter)}
            className="h-8 w-44 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs dark:border-white/10 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All statuses</option>
            <option value="expired">Expired</option>
            <option value="expiring">Expiring soon (≤ 90 d)</option>
            <option value="valid">Valid</option>
          </select>
        </div>
        <button
          onClick={applyFilters}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Filter size={12} /> Apply
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
          >
            <X size={12} /> Clear
          </button>
        )}
        {loading && (
          <RefreshCw size={13} className="ml-auto animate-spin text-blue-500" />
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Grouped table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/10">
                <th className="w-8" />
                {[
                  "Standard",
                  "Certification",
                  "Name / Reference",
                  "Valid From",
                  "Valid Until",
                  "Days Left",
                  "Status & Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
              {loading && certs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw
                      size={20}
                      className="mx-auto mb-2 animate-spin"
                    />
                    Loading…
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <FileCheck
                      size={32}
                      className="mx-auto mb-3 text-slate-300 dark:text-slate-700"
                    />
                    <p className="text-sm text-slate-500">
                      No certifications found
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="mt-2 text-sm text-blue-600 hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <UnitGroupSection
                    key={group.unitId ?? "unknown"}
                    group={group}
                    editingId={editingId}
                    onEdit={(id) => setEditingId(id === editingId ? null : id)}
                    onSave={handleSave}
                    onCancel={() => setEditingId(null)}
                    onFileUploaded={handleFileUploaded}
                    canEdit={isPrivileged}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-white/10">
            <span className="text-xs text-slate-400">
              Page {page + 1} of {totalPages} — {total.toLocaleString()}{" "}
              certifications
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:border-white/10"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const pg =
                  totalPages <= 7
                    ? i
                    : page < 4
                      ? i
                      : page > totalPages - 5
                        ? totalPages - 7 + i
                        : page - 3 + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold",
                      pg === page
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300",
                    ].join(" ")}
                  >
                    {pg + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:border-white/10"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Quality cert updates automatically recompute class evaluations for all
        relations of that unit. Expiry thresholds: expired · expiring ≤ 90 days
        · valid.
      </p>
    </div>
  );
}
