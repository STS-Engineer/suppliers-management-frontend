/**
 * Criteria Validity Tracker
 *
 * 1. "Scan all" makes ONE backend request that returns all relations' criteria data in bulk.
 * 2. Results shown with a Group-by toggle (Supplier / Criterion).
 * 3. KPI cards for expired/expiring are clickable to filter directly.
 * 4. Document column shows clickable name — images open in a lightbox, others open in new tab.
 * 5. "Reset all expired" resets every expired criterion to null in the backend,
 *    one API call per relation, and shows a change log after.
 */

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { queryKeys } from "../lib/queryClient";
import { invalidateRelationWorkspace } from "../hooks/useRelationWorkspace";
import {
  loadPersistedFilters,
  savePersistedFilters,
} from "../utils/persistedFilters";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  RotateCcw,
  ScanLine,
  Search,
  Shield,
  X,
  ZoomIn,
} from "lucide-react";
import { Link } from "react-router-dom";
import { InlineAlert, PageIntro } from "../components/UI";
import { StatusDistributionBar } from "../components/documents-validity/StatusDistributionBar";
import supplierAPI from "../services/supplierOnboardingAPI";
import type { SitePanelRelation } from "../types/onboarding";

// ─── constants ────────────────────────────────────────────────────────────────

const CLASS_CRITERIA: { key: string; label: string }[] = [
  { key: "top", label: "Payment Terms (TOP)" },
  { key: "lta", label: "Long-Term Agreement" },
  { key: "sqma", label: "SQMA" },
  { key: "quality_certification", label: "Quality Certification" },
  { key: "productivity", label: "Productivity" },
  { key: "prod_lia_ins", label: "Product Liability Ins." },
  { key: "competitiveness", label: "Competitiveness" },
  { key: "family_coverage", label: "Family Coverage" },
  { key: "geo_coverage", label: "Geo Coverage" },
  { key: "cons_or_wd", label: "Consignment / WD" },
  { key: "financial_health", label: "Financial Health" },
];

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i;

const SELECT_CLS =
  "h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-600 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:focus:border-blue-500 dark:focus:ring-blue-500/20";

// ─── types ────────────────────────────────────────────────────────────────────

interface BulkCriteriaDetail {
  validity_start_date: string | null;
  validity_end_date: string | null;
  signature_date: string | null;
  evidence_file_name: string | null;
  document_url: string | null;
  document_name: string | null;
  not_applicable?: boolean;
}

interface BulkItem {
  rel_id: number;
  criteria_values: Record<string, string | null>;
  class_criteria_details: Record<string, BulkCriteriaDetail>;
}

type ValidityStatus = "expired" | "expiring" | "valid" | "missing";
type StatusFilter = "expired" | "expiring";

const CRITERIA_VALIDITY_FILTERS_PAGE_KEY = "criteria-validity";
const CRITERIA_VALIDITY_RESULTS_PAGE_KEY = "criteria-validity-results";

// This page has no server-side filters on the site panel fetch (it always
// pulls every relation and filters/scans client-side), so one fixed query
// key is enough -- still "sitePanel"-prefixed so a relation mutation
// elsewhere (this page's own reset, or another page/tab) invalidates it.
const SITE_PANEL_PARAMS_KEY = JSON.stringify({
  page: "DocumentsValidityPage",
  limit: 1000,
});

interface CriterionEntry {
  relId: number;
  supplierName: string;
  siteName: string;
  owner: string;
  criterionKey: string;
  criterionLabel: string;
  value: string | null;
  endDate: string | null;
  startDate: string | null;
  documentUrl: string | null;
  documentName: string | null;
  evidenceFile: string | null;
  status: ValidityStatus;
  days: number | null;
}

interface ResetLogEntry {
  supplierName: string;
  siteName: string;
  criterionLabel: string;
  previousValue: string | null;
  endDate: string | null;
  reason: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}

function validityStatus(endDate?: string | null): ValidityStatus {
  const d = daysUntil(endDate);
  if (d === null) return "missing";
  if (d < 0) return "expired";
  if (d <= 90) return "expiring";
  return "valid";
}

function getCriterionValue(item: BulkItem, key: string): string | null {
  return item.criteria_values?.[key] ?? null;
}

// Exports exactly what's currently on screen (the active status filter +
// search already applied by the caller) — one row per criterion entry, so
// the file matches what the user was looking at, not a separate "everything"
// dump.
function exportEntriesToExcel(entries: CriterionEntry[], statusFilter: string) {
  const rows = entries.map((e) => ({
    Supplier: e.supplierName,
    "Avocarbon Site": e.siteName,
    Owner: e.owner,
    Criterion: e.criterionLabel,
    Value: e.value ?? "",
    "Valid From": fmtDate(e.startDate),
    "Valid Until": fmtDate(e.endDate),
    "Days Left":
      e.days === null ? "" : e.days < 0 ? `${Math.abs(e.days)}d ago` : `${e.days}d`,
    Status: STATUS_CFG[e.status].label,
    Document: e.documentName ?? e.evidenceFile ?? "",
  }));
  const ws =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([
          [
            "Supplier",
            "Avocarbon Site",
            "Owner",
            "Criterion",
            "Value",
            "Valid From",
            "Valid Until",
            "Days Left",
            "Status",
            "Document",
          ],
        ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Criteria Validity");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `criteria-validity-${statusFilter}-${stamp}.xlsx`);
}

const STATUS_CFG: Record<
  ValidityStatus,
  { cls: string; dot: string; label: string }
> = {
  expired: {
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    dot: "bg-red-500",
    label: "Expired",
  },
  expiring: {
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "Expiring",
  },
  valid: {
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "Valid",
  },
  missing: {
    cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    dot: "bg-slate-400",
    label: "No date",
  },
};

// ─── Skeleton loader ──────────────────────────────────────────────────────────
// Shown in place of the KPI row + results table on first load, so the page
// never flashes empty before data arrives.

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/[0.06] ${className}`}
    />
  );
}

function DocumentsValiditySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[22px] border border-slate-200/80 bg-white/60 px-5 py-4 dark:border-white/10 dark:bg-slate-950/30"
          >
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mt-3 h-7 w-14" />
          </div>
        ))}
      </div>
      <SkeletonBlock className="h-24 rounded-2xl" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-4 dark:border-white/[0.06]">
          <SkeletonBlock className="h-8 w-full max-w-md" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ValidityStatus }) {
  const c = STATUS_CFG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ─── Image lightbox ───────────────────────────────────────────────────────────

function DocCell({
  url,
  name,
  evidenceFile,
}: {
  url: string | null;
  name: string | null;
  evidenceFile: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!url && !evidenceFile)
    return <span className="text-[11px] text-slate-400">No document</span>;

  const label = name ?? evidenceFile ?? "View";
  const isImage = url ? IMAGE_EXTS.test(url) : false;

  return (
    <>
      {url ? (
        isImage ? (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline dark:text-blue-400 max-w-[160px] text-left"
          >
            <ZoomIn size={11} className="shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline dark:text-blue-400 max-w-[160px]"
          >
            <ExternalLink size={11} className="shrink-0" />
            <span className="truncate">{label}</span>
          </a>
        )
      ) : (
        <span className="flex items-center gap-1 text-slate-500 max-w-[140px]">
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
              className="absolute -right-3 -top-3 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-700 shadow-lg hover:bg-slate-100 z-10"
            >
              <X size={14} />
            </button>
            <img
              src={url}
              alt={label}
              className="max-h-[88vh] max-w-[88vw] rounded-xl shadow-2xl object-contain"
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

// ─── ResetLog ─────────────────────────────────────────────────────────────────

function ResetLog({
  log,
  onClose,
}: {
  log: ResetLogEntry[];
  onClose: () => void;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-900/10">
      <div className="flex items-center justify-between border-b border-emerald-200 px-5 py-3 dark:border-emerald-500/20">
        <div className="flex items-center gap-2">
          <CheckCircle2
            size={16}
            className="text-emerald-600 dark:text-emerald-400"
          />
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
            {log.length} criteria reset — values cleared, status recomputed
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-emerald-500 hover:text-emerald-700"
        >
          <X size={14} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald-200 dark:border-emerald-500/20">
              {[
                "Supplier",
                "Site",
                "Criterion",
                "Previous value",
                "Expired on",
                "Reason",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {log.map((entry, i) => (
              <tr
                key={i}
                className="border-t border-emerald-100 dark:border-emerald-500/10"
              >
                <td className="px-4 py-2 text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                  {entry.supplierName}
                </td>
                <td className="px-4 py-2 text-[12px] text-slate-500 dark:text-slate-400">
                  {entry.siteName}
                </td>
                <td className="px-4 py-2 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  {entry.criterionLabel}
                </td>
                <td className="px-4 py-2">
                  {entry.previousValue ? (
                    <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 line-through dark:bg-red-900/20 dark:text-red-400">
                      {entry.previousValue}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-[12px] font-semibold text-red-600 dark:text-red-400">
                  {fmtDate(entry.endDate)}
                </td>
                <td className="px-4 py-2 text-[11px] italic text-slate-500 dark:text-slate-400">
                  {entry.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ResultsPanel ─────────────────────────────────────────────────────────────

function ResultsPanel({
  allEntries,
  statusFilter,
  setStatusFilter,
  onReset,
  resetting,
  onRefresh,
  canReset,
  refreshing,
}: {
  allEntries: CriterionEntry[];
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  onReset: (expired: CriterionEntry[]) => void;
  resetting: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  canReset: boolean;
}) {
  const { user } = useAuth();
  const userEmail = (user as { email?: string })?.email ?? "";
  const initialResultsFilters = loadPersistedFilters(
    CRITERIA_VALIDITY_RESULTS_PAGE_KEY,
    userEmail,
    { search: "", plant: "", owner: "", criterion: "" },
  );
  const [search, setSearch] = useState(initialResultsFilters.search);
  const [plantFilter, setPlantFilter] = useState(initialResultsFilters.plant);
  const [ownerFilter, setOwnerFilter] = useState(initialResultsFilters.owner);
  const [criterionFilter, setCriterionFilter] = useState(
    initialResultsFilters.criterion,
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    savePersistedFilters(CRITERIA_VALIDITY_RESULTS_PAGE_KEY, userEmail, {
      search,
      plant: plantFilter,
      owner: ownerFilter,
      criterion: criterionFilter,
    });
  }, [userEmail, search, plantFilter, ownerFilter, criterionFilter]);

  // Distinct option lists, derived from the data itself so they never drift
  // from what's actually on the page.
  const plantOptions = useMemo(
    () => Array.from(new Set(allEntries.map((e) => e.siteName))).sort(),
    [allEntries],
  );
  const ownerOptions = useMemo(
    () => Array.from(new Set(allEntries.map((e) => e.owner))).sort(),
    [allEntries],
  );

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const expiredEntries = allEntries.filter((e) => e.status === "expired");

  const filtered = useMemo(() => {
    let list = allEntries;
    if (statusFilter === "expired")
      list = list.filter((e) => e.status === "expired");
    if (statusFilter === "expiring")
      list = list.filter((e) => e.status === "expiring");
    if (plantFilter) list = list.filter((e) => e.siteName === plantFilter);
    if (ownerFilter) list = list.filter((e) => e.owner === ownerFilter);
    if (criterionFilter)
      list = list.filter((e) => e.criterionKey === criterionFilter);
    if (search.trim()) {
      const kw = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.supplierName.toLowerCase().includes(kw) ||
          e.siteName.toLowerCase().includes(kw) ||
          e.owner.toLowerCase().includes(kw) ||
          e.criterionLabel.toLowerCase().includes(kw) ||
          (e.value ?? "").toLowerCase().includes(kw),
      );
    }
    return list;
  }, [
    allEntries,
    statusFilter,
    plantFilter,
    ownerFilter,
    criterionFilter,
    search,
  ]);

  // Always grouped by criterion (max 11 groups) rather than by supplier
  // (up to 534 groups, most holding a single row once a status filter is
  // active) -- criterion grouping is what lets you act on every instance of
  // one expiring criterion type in one visual chunk, which is the actual
  // workflow this page supports ("Reset all expired").
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; sub: string; entries: CriterionEntry[] }
    >();
    for (const c of CLASS_CRITERIA)
      map.set(c.key, { label: c.label, sub: "", entries: [] });
    for (const e of filtered) {
      if (map.has(e.criterionKey)) map.get(e.criterionKey)!.entries.push(e);
    }
    return Array.from(map.entries()).filter(([, g]) => g.entries.length > 0);
  }, [filtered]);

  const counts = {
    expired: allEntries.filter((e) => e.status === "expired").length,
    expiring: allEntries.filter((e) => e.status === "expiring").length,
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
      {/* Toolbar — filters row, then a results/actions row */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-5 py-3.5 dark:border-white/[0.06]">
        {/* Status chips */}
        <div className="flex items-center gap-1.5">
          {(["expired", "expiring"] as const).map((s) => {
            const count = counts[s];
            const active = statusFilter === s;
            const color =
              s === "expired"
                ? active
                  ? "bg-red-600 text-white border-red-600"
                  : "border-red-200 text-red-600 hover:bg-red-50"
                : active
                  ? "bg-amber-500 text-white border-amber-500"
                  : "border-amber-200 text-amber-600 hover:bg-amber-50";
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold capitalize transition ${color} dark:border-white/10`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <span
                  className={`rounded-full px-1.5 text-[9px] font-bold ${active ? "bg-white/25" : "bg-slate-100 dark:bg-white/10"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-white/10" />

        {/* Plant / Owner / Criterion filters */}
        <select
          value={plantFilter}
          onChange={(e) => setPlantFilter(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">All plants</option>
          {plantOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">All owners</option>
          {ownerOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={criterionFilter}
          onChange={(e) => setCriterionFilter(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">All criteria</option>
          {CLASS_CRITERIA.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier, owner, criterion…"
            className="h-8 w-56 rounded-xl border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {(plantFilter || ownerFilter || criterionFilter || search) && (
          <button
            onClick={() => {
              setPlantFilter("");
              setOwnerFilter("");
              setCriterionFilter("");
              setSearch("");
            }}
            className="text-[11px] font-medium text-slate-400 underline hover:text-slate-600 dark:hover:text-slate-300"
          >
            Clear filters
          </button>
        )}

        <span className="text-[11px] text-slate-400">
          {filtered.length} entries
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Export — exactly what's on screen: the active status filter +
              search already applied. */}
          <button
            onClick={() => exportEntriesToExcel(filtered, statusFilter)}
            disabled={filtered.length === 0}
            title="Export the current view to Excel"
            className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
          >
            <Download size={12} />
            Export
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh data"
            className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm transition hover:bg-violet-100 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
          >
            {refreshing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ScanLine size={12} />
            )}
            Refresh
          </button>

          {/* Reset all expired */}
          {canReset && expiredEntries.length > 0 &&
            (confirmReset ? (
              <>
                <span className="text-xs text-red-600 dark:text-red-400">
                  Reset {expiredEntries.length} expired criteria to None?
                </span>
                <button
                  onClick={() => {
                    onReset(expiredEntries);
                    setConfirmReset(false);
                  }}
                  disabled={resetting}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {resetting ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <RotateCcw size={11} />
                  )}
                  Confirm reset
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                disabled={resetting}
                className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:bg-white/5 dark:text-red-400"
              >
                <RotateCcw size={12} />
                Reset all expired ({expiredEntries.length})
              </button>
            ))}
        </div>
      </div>

      {/* Grouped table */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <CheckCircle2 size={32} className="mb-3 text-emerald-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No {statusFilter} criteria found.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {groups.map(([groupKey, group]) => {
            const isCollapsed = collapsed.has(groupKey);
            const expiredInGroup = group.entries.filter(
              (e) => e.status === "expired",
            ).length;
            const expiringInGroup = group.entries.filter(
              (e) => e.status === "expiring",
            ).length;

            return (
              <div key={groupKey}>
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="flex w-full items-center gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-2.5 text-left transition hover:bg-slate-100/80 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                >
                  {isCollapsed ? (
                    <ChevronRight
                      size={13}
                      className="shrink-0 text-slate-400"
                    />
                  ) : (
                    <ChevronDown size={13} className="shrink-0 text-slate-400" />
                  )}
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {group.label}
                  </span>
                  {group.sub && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      · {group.sub}
                    </span>
                  )}
                  <div className="ml-2 flex items-center gap-1.5">
                    {expiredInGroup > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        <AlertCircle size={9} /> {expiredInGroup} expired
                      </span>
                    )}
                    {expiringInGroup > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <AlertTriangle size={9} /> {expiringInGroup} expiring
                      </span>
                    )}
                  </div>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {group.entries.length} entries
                  </span>
                </button>

                {!isCollapsed && (
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="sticky top-0 z-10 border-b border-slate-100 bg-white dark:border-white/[0.04] dark:bg-slate-900">
                        {[
                          "Supplier",
                          "Avocarbon Site",
                          "Value",
                          "Valid From",
                          "Valid Until",
                          "Days Left",
                          "Status",
                          "Document",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((entry, idx) => {
                        // Status tinting takes priority; otherwise a faint
                        // zebra stripe keeps long groups scannable.
                        const rowBg =
                          entry.status === "expired"
                            ? "bg-red-50/60 dark:bg-red-900/10"
                            : entry.status === "expiring"
                              ? "bg-amber-50/50 dark:bg-amber-900/10"
                              : idx % 2 === 1
                                ? "bg-slate-50/60 dark:bg-white/[0.02]"
                                : "";
                        return (
                          <tr
                            key={idx}
                            className={`border-t border-slate-100 transition-colors hover:bg-blue-50/40 dark:border-white/[0.04] dark:hover:bg-white/[0.04] ${rowBg}`}
                          >
                            <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                              {entry.supplierName}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] text-slate-500 dark:text-slate-400">
                              {entry.siteName}
                            </td>
                            <td className="px-4 py-2.5">
                              {entry.value ? (
                                <span className="inline-block max-w-[160px] truncate rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                  {entry.value}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] text-slate-500">
                              {fmtDate(entry.startDate)}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                              {fmtDate(entry.endDate)}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] tabular-nums">
                              {entry.days === null ? (
                                <span className="text-slate-400">—</span>
                              ) : entry.days < 0 ? (
                                <span className="font-bold text-red-600 dark:text-red-400">
                                  {Math.abs(entry.days)}d ago
                                </span>
                              ) : (
                                <span
                                  className={
                                    entry.days <= 30
                                      ? "font-bold text-red-600"
                                      : entry.days <= 90
                                        ? "font-bold text-amber-600"
                                        : "text-emerald-600"
                                  }
                                >
                                  {entry.days}d
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge status={entry.status} />
                            </td>
                            <td className="px-4 py-2.5">
                              <DocCell
                                url={entry.documentUrl}
                                name={entry.documentName}
                                evidenceFile={entry.evidenceFile}
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <Link
                                to={`/supplier-relations/${entry.relId}/evaluation`}
                                className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
                              >
                                <Shield size={10} /> Open
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DocumentsValidityPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userEmail = (user as { email?: string })?.email ?? "";
  const isPrivileged = ["vp_conversion", "purchasing_director"].includes(user?.access_profile ?? "");
  const [relations, setRelations] = useState<SitePanelRelation[]>([]);
  const [sites, setSites] = useState<Record<number, string>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk scan result — one item per relation
  const [bulkData, setBulkData] = useState<BulkItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);

  const [resetting, setResetting] = useState(false);
  const [resetLog, setResetLog] = useState<ResetLogEntry[] | null>(null);

  // Lifted up so KPI cards can set it directly. Restores whatever this user
  // last had filtered — otherwise leaving this page and coming back (or a
  // reload) silently resets it.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    () =>
      loadPersistedFilters(CRITERIA_VALIDITY_FILTERS_PAGE_KEY, userEmail, {
        statusFilter: "expired" as StatusFilter,
      }).statusFilter,
  );

  useEffect(() => {
    savePersistedFilters(CRITERIA_VALIDITY_FILTERS_PAGE_KEY, userEmail, {
      statusFilter,
    });
  }, [userEmail, statusFilter]);

  // relId → { supplierName, siteName } built once from the panel response
  const relMeta = useMemo<
    Record<
      number,
      { supplierName: string; siteName: string; owner: string }
    >
  >(() => {
    const map: Record<
      number,
      { supplierName: string; siteName: string; owner: string }
    > = {};
    for (const item of relations) {
      const relId = item.relation.id_relation;
      map[relId] = {
        supplierName:
          item.relation?.alias_1 ||
          item.unit?.supplier_name ||
          item.group?.nom ||
          `Supplier #${relId}`,
        siteName:
          sites[item.relation.id_site!] ?? `Site #${item.relation.id_site}`,
        owner: item.relation?.supplier_owner || "Unassigned",
      };
    }
    return map;
  }, [relations, sites]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Load panel metadata + bulk criteria data in parallel. The site panel
    // fetch is routed through the shared TanStack Query cache
    // (queryClient.fetchQuery) so this page shares its data -- and
    // invalidation -- with the other site-panel consumers
    // (ActiveSuppliersPage, RelationEvaluationPage, SupplierDirectoryAdminPage).
    Promise.all([
      queryClient.fetchQuery({
        queryKey: queryKeys.sitePanel(SITE_PANEL_PARAMS_KEY),
        queryFn: () => supplierAPI.listSitePanel({ limit: 1000 }),
      }),
      supplierAPI.listSites(),
      supplierAPI.getCriteriaValidityBulk(),
    ])
      .then(([panelRes, sitesRes, bulkRes]) => {
        if (cancelled) return;
        const siteList: any[] = Array.isArray(sitesRes?.data)
          ? sitesRes.data
          : Array.isArray(sitesRes)
            ? sitesRes
            : [];
        const siteMap: Record<number, string> = {};
        for (const s of siteList)
          if (s.id_site)
            siteMap[s.id_site] = s.site_name ?? `Site #${s.id_site}`;
        setSites(siteMap);

        const all: SitePanelRelation[] = [];
        for (const bundle of panelRes.data?.items ?? [])
          for (const rel of bundle.relations ?? []) all.push(rel);
        setRelations(all);
        setTotal(all.length);

        setBulkData((bulkRes as any)?.data?.items ?? []);
        setScanDone(true);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  // ── Scan — single bulk request ─────────────────────────────────────────────

  async function runScan(keepLog = false) {
    setScanning(true);
    setScanDone(false);
    if (!keepLog) setResetLog(null);
    try {
      const res = await supplierAPI.getCriteriaValidityBulk();
      setBulkData((res as any)?.data?.items ?? []);
      setScanDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  // ── Reset all expired ──────────────────────────────────────────────────────

  async function handleResetAllExpired(expiredEntries: CriterionEntry[]) {
    setResetting(true);
    const log: ResetLogEntry[] = [];

    const byRelation = new Map<number, CriterionEntry[]>();
    for (const e of expiredEntries) {
      if (!byRelation.has(e.relId)) byRelation.set(e.relId, []);
      byRelation.get(e.relId)!.push(e);
    }

    const relIds = Array.from(byRelation.keys());
    const BATCH = 10;

    for (let i = 0; i < relIds.length; i += BATCH) {
      const batch = relIds.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (relId) => {
          const entries = byRelation.get(relId)!;
          const payload: Record<string, unknown> = {
            cycle_type: "Expired Criteria Reset",
            comments: "Auto-cleared by the Criteria Validity Tracker's bulk reset — validity expired.",
          };
          for (const e of entries) payload[e.criterionKey] = null;
          try {
            await supplierAPI.updateRelationClassEvaluation(relId, payload);
            // Refreshes this relation's workspace cache (Evaluation
            // page/detail modal) plus every sitePanel entry, and syncs other
            // open tabs.
            invalidateRelationWorkspace(queryClient, relId);
            for (const e of entries) {
              log.push({
                supplierName: e.supplierName,
                siteName: e.siteName,
                criterionLabel: e.criterionLabel,
                previousValue: e.value,
                endDate: e.endDate,
                reason: `Validity expired ${e.days !== null ? Math.abs(e.days) + "d ago" : ""} (end date: ${fmtDate(e.endDate)})`,
              });
            }
          } catch {
            // failed resets remain visible on next scan
          }
        }),
      );
    }

    log.sort(
      (a, b) =>
        a.supplierName.localeCompare(b.supplierName) ||
        a.criterionLabel.localeCompare(b.criterionLabel),
    );
    setResetLog(log);
    setResetting(false);
    // Each relation whose class evaluation just changed -- refresh its
    // workspace cache (Evaluation page/detail modal) plus every sitePanel
    // entry, and sync other open tabs. Done once per relation after the
    // whole batch settles rather than mid-loop, to avoid redundant refetches.
    for (const relId of relIds) {
      invalidateRelationWorkspace(queryClient, relId);
    }
    // Refresh bulk data to reflect the resets (keep log visible)
    await runScan(true);
  }

  // ── Build flat entry list from bulk response ───────────────────────────────

  const allEntries = useMemo<CriterionEntry[]>(() => {
    const entries: CriterionEntry[] = [];
    for (const item of bulkData) {
      const meta = relMeta[item.rel_id];
      const supplierName = meta?.supplierName ?? `Supplier #${item.rel_id}`;
      const siteName = meta?.siteName ?? `Relation #${item.rel_id}`;
      const owner = meta?.owner ?? "Unassigned";
      const details = item.class_criteria_details ?? {};

      for (const c of CLASS_CRITERIA) {
        const detail = details[c.key];
        // A criterion an evaluator explicitly marked Not Applicable isn't
        // "missing" -- it just doesn't apply to this relation. Excluding it
        // entirely (rather than counting it as missing) keeps the
        // documentation-coverage figure honest instead of inflating "No
        // data" with criteria nobody was ever supposed to fill in.
        if (detail?.not_applicable) continue;
        entries.push({
          relId: item.rel_id,
          supplierName,
          siteName,
          owner,
          criterionKey: c.key,
          criterionLabel: c.label,
          value: getCriterionValue(item, c.key),
          endDate: detail?.validity_end_date ?? null,
          startDate: detail?.validity_start_date ?? null,
          documentUrl: detail?.document_url ?? null,
          documentName: detail?.document_name ?? null,
          evidenceFile: detail?.evidence_file_name ?? null,
          status: validityStatus(detail?.validity_end_date),
          days: daysUntil(detail?.validity_end_date),
        });
      }
    }
    entries.sort((a, b) => {
      const order: Record<ValidityStatus, number> = {
        expired: 0,
        expiring: 1,
        missing: 2,
        valid: 3,
      };
      const d = order[a.status] - order[b.status];
      return d !== 0 ? d : (a.days ?? 9999) - (b.days ?? 9999);
    });
    return entries;
  }, [bulkData, relMeta]);

  const scannedCount = bulkData.length;
  const totalExpired = allEntries.filter((e) => e.status === "expired").length;
  const totalExpiring = allEntries.filter(
    (e) => e.status === "expiring",
  ).length;
  const totalMissing = allEntries.filter((e) => e.status === "missing").length;
  const totalValid = allEntries.filter((e) => e.status === "valid").length;

  // KPI card config — expired/expiring cards set the filter when clicked
  const kpiCards = [
    {
      label: "Active relations",
      value: total,
      accent: "text-blue-600 dark:text-blue-400",
      icon: <Shield size={16} />,
      filter: null as StatusFilter | null,
    },
    {
      label: "Relations scanned",
      value: scannedCount,
      accent: "text-violet-600 dark:text-violet-400",
      icon: <ScanLine size={16} />,
      filter: null as StatusFilter | null,
    },
    {
      label: "Expired criteria",
      value: scanDone ? totalExpired : "—",
      accent: "text-rose-600 dark:text-rose-400",
      icon: <AlertCircle size={16} />,
      filter: "expired" as StatusFilter,
    },
    {
      label: "Expiring ≤ 90 days",
      value: scanDone ? totalExpiring : "—",
      accent: "text-amber-600 dark:text-amber-400",
      icon: <AlertTriangle size={16} />,
      filter: "expiring" as StatusFilter,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="Validity Tracker"
        title="Criteria Validity Tracker"
        description="Scan all supplier relations at once, grouped by criterion. Click an expired/expiring KPI card to filter instantly. Reset all expired criteria in one action — changes are applied to the backend and logged."
      />

      <div className="flex flex-col gap-5 mx-auto w-full max-w-[1600px]">
        {loading ? (
          <DocumentsValiditySkeleton />
        ) : (
          <>
            {/* KPI cards — glass style, matching MetricCard's visual language
                elsewhere in the app, extended with click-to-filter + an active
                ring since these ones double as filter toggles. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kpiCards.map((c) => {
                const clickable = !!c.filter && scanDone;
                const active =
                  c.filter !== null && statusFilter === c.filter && scanDone;
                return (
                  <div
                    key={c.label}
                    onClick={() => {
                      if (clickable) setStatusFilter(c.filter!);
                    }}
                    className={[
                      "rounded-[22px] border border-slate-200/80 bg-white/88 px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur transition dark:border-white/10 dark:bg-slate-950/40",
                      active ? "ring-2 ring-blue-300 dark:ring-blue-500/60" : "",
                      clickable
                        ? "cursor-pointer hover:shadow-[0_16px_36px_rgba(15,23,42,0.09)]"
                        : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={c.accent}>{c.icon}</span>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {c.label}
                      </p>
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#10233f] dark:text-white">
                      {c.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status distribution — visual overview of every scanned entry
                (missing/expired/expiring/valid), clicking expired/expiring
                applies the same filter as the KPI cards above. */}
            {scanDone && (
              <StatusDistributionBar
                counts={{
                  missing: totalMissing,
                  expired: totalExpired,
                  expiring: totalExpiring,
                  valid: totalValid,
                }}
                onSegmentClick={setStatusFilter}
              />
            )}

            {/* Explains the gap between "Active relations" and "Relations
                scanned" -- the scan only covers relations that are on the active
                panel AND already have at least one class evaluation on record;
                without this note the two KPI numbers just above look like a
                discrepancy/bug rather than an intentional scope. */}
            {scanDone && total > scannedCount && (
              <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-800 dark:border-blue-500/20 dark:bg-blue-900/10 dark:text-blue-300">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>
                  {total - scannedCount} active relation
                  {total - scannedCount !== 1 ? "s" : ""} not shown here — not yet
                  on the active panel and/or never evaluated (no class evaluation
                  on record yet), so there's nothing to scan for validity.
                </span>
              </div>
            )}

            {error && (
              <InlineAlert
                title="Failed to load relations"
                message={error}
                tone="danger"
              />
            )}

            {/* Reset log */}
            {resetLog && (
              <ResetLog log={resetLog} onClose={() => setResetLog(null)} />
            )}

            <ResultsPanel
              allEntries={allEntries}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onReset={handleResetAllExpired}
              resetting={resetting}
              onRefresh={() => runScan()}
              refreshing={scanning}
              canReset={isPrivileged}
            />
          </>
        )}
      </div>
    </div>
  );
}
