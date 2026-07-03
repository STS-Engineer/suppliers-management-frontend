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
import { useAuth } from "../context/AuthContext";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  LayoutList,
  RotateCcw,
  ScanLine,
  Search,
  Shield,
  Users,
  X,
  ZoomIn,
} from "lucide-react";
import { Link } from "react-router-dom";
import { InlineAlert, PageIntro } from "../components/UI";
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

// ─── types ────────────────────────────────────────────────────────────────────

interface BulkCriteriaDetail {
  validity_start_date: string | null;
  validity_end_date: string | null;
  signature_date: string | null;
  evidence_file_name: string | null;
  document_url: string | null;
  document_name: string | null;
}

interface BulkItem {
  rel_id: number;
  criteria_values: Record<string, string | null>;
  class_criteria_details: Record<string, BulkCriteriaDetail>;
}

type ValidityStatus = "expired" | "expiring" | "valid" | "missing";
type StatusFilter = "all" | "expired" | "expiring";
type GroupBy = "supplier" | "criterion";

interface CriterionEntry {
  relId: number;
  supplierName: string;
  siteName: string;
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
    cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    dot: "bg-gray-400",
    label: "No date",
  },
};

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
    return <span className="text-[11px] text-gray-400">No document</span>;

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
        <span className="flex items-center gap-1 text-gray-500 max-w-[140px]">
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
              className="absolute -right-3 -top-3 grid h-7 w-7 place-items-center rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100 z-10"
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
                <td className="px-4 py-2 text-[12px] font-semibold text-gray-800 dark:text-gray-200">
                  {entry.supplierName}
                </td>
                <td className="px-4 py-2 text-[12px] text-gray-500 dark:text-gray-400">
                  {entry.siteName}
                </td>
                <td className="px-4 py-2 text-[12px] font-medium text-gray-700 dark:text-gray-300">
                  {entry.criterionLabel}
                </td>
                <td className="px-4 py-2">
                  {entry.previousValue ? (
                    <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 line-through dark:bg-red-900/20 dark:text-red-400">
                      {entry.previousValue}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-[12px] font-semibold text-red-600 dark:text-red-400">
                  {fmtDate(entry.endDate)}
                </td>
                <td className="px-4 py-2 text-[11px] italic text-gray-500 dark:text-gray-400">
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
  const [groupBy, setGroupBy] = useState<GroupBy>("supplier");
  const [search, setSearch] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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
    if (search.trim()) {
      const kw = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.supplierName.toLowerCase().includes(kw) ||
          e.siteName.toLowerCase().includes(kw) ||
          e.criterionLabel.toLowerCase().includes(kw) ||
          (e.value ?? "").toLowerCase().includes(kw),
      );
    }
    return list;
  }, [allEntries, statusFilter, search]);

  const groups = useMemo(() => {
    if (groupBy === "supplier") {
      const map = new Map<
        string,
        { label: string; sub: string; entries: CriterionEntry[] }
      >();
      for (const e of filtered) {
        const key = `${e.relId}`;
        if (!map.has(key))
          map.set(key, { label: e.supplierName, sub: e.siteName, entries: [] });
        map.get(key)!.entries.push(e);
      }
      return Array.from(map.entries());
    } else {
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
    }
  }, [filtered, groupBy]);

  const counts = {
    expired: allEntries.filter((e) => e.status === "expired").length,
    expiring: allEntries.filter((e) => e.status === "expiring").length,
    all: allEntries.length,
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3.5 dark:border-white/[0.06]">
        {/* Status chips */}
        <div className="flex items-center gap-1.5">
          {(["expired", "expiring", "all"] as const).map((s) => {
            const count = counts[s];
            const active = statusFilter === s;
            const color =
              s === "expired"
                ? active
                  ? "bg-red-600 text-white border-red-600"
                  : "border-red-200 text-red-600 hover:bg-red-50"
                : s === "expiring"
                  ? active
                    ? "bg-amber-500 text-white border-amber-500"
                    : "border-amber-200 text-amber-600 hover:bg-amber-50"
                  : active
                    ? "bg-gray-600 text-white border-gray-600"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50";
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold capitalize transition ${color} dark:border-white/10`}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                <span
                  className={`rounded-full px-1.5 text-[9px] font-bold ${active ? "bg-white/25" : "bg-gray-100 dark:bg-white/10"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Group by toggle */}
        <div className="flex items-center overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
          <button
            onClick={() => setGroupBy("supplier")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition ${groupBy === "supplier" ? "bg-[#062B49] text-white dark:bg-blue-600" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"}`}
          >
            <Users size={12} /> Supplier
          </button>
          <button
            onClick={() => setGroupBy("criterion")}
            className={`flex items-center gap-1.5 border-l border-gray-200 px-3 py-1.5 text-[11px] font-semibold transition dark:border-white/10 ${groupBy === "criterion" ? "bg-[#062B49] text-white dark:bg-blue-600" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"}`}
          >
            <LayoutList size={12} /> Criterion
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-8 w-44 rounded-xl border border-gray-200 bg-gray-50 pl-7 pr-3 text-xs dark:border-white/10 dark:bg-gray-800 dark:text-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <span className="text-[11px] text-gray-400">
          {filtered.length} entries
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh data"
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
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
                  className="text-xs text-gray-500 hover:text-gray-700"
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No {statusFilter === "all" ? "" : statusFilter} criteria found.
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
                  className="flex w-full items-center gap-3 border-t border-gray-100 bg-gray-50/80 px-5 py-2.5 text-left transition hover:bg-gray-100/80 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                >
                  {isCollapsed ? (
                    <ChevronRight
                      size={13}
                      className="shrink-0 text-gray-400"
                    />
                  ) : (
                    <ChevronDown size={13} className="shrink-0 text-gray-400" />
                  )}
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    {group.label}
                  </span>
                  {group.sub && (
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
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
                  <span className="ml-auto text-[11px] text-gray-400">
                    {group.entries.length} entries
                  </span>
                </button>

                {!isCollapsed && (
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-white/[0.04]">
                        {(groupBy === "supplier"
                          ? [
                              "Criterion",
                              "Value",
                              "Valid From",
                              "Valid Until",
                              "Days Left",
                              "Status",
                              "Document",
                              "",
                            ]
                          : [
                              "Supplier",
                              "Avocarbon Site",
                              "Value",
                              "Valid From",
                              "Valid Until",
                              "Days Left",
                              "Status",
                              "Document",
                              "",
                            ]
                        ).map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((entry, idx) => {
                        const rowBg =
                          entry.status === "expired"
                            ? "bg-red-50/60 dark:bg-red-900/10"
                            : entry.status === "expiring"
                              ? "bg-amber-50/50 dark:bg-amber-900/10"
                              : "";
                        return (
                          <tr
                            key={idx}
                            className={`border-t border-gray-100 dark:border-white/[0.04] ${rowBg}`}
                          >
                            {groupBy === "supplier" ? (
                              <td className="px-4 py-2.5 text-[12px] font-semibold text-gray-700 dark:text-gray-300">
                                {entry.criterionLabel}
                              </td>
                            ) : (
                              <>
                                <td className="px-4 py-2.5 text-[12px] font-semibold text-gray-800 dark:text-gray-100">
                                  {entry.supplierName}
                                </td>
                                <td className="px-4 py-2.5 text-[12px] text-gray-500 dark:text-gray-400">
                                  {entry.siteName}
                                </td>
                              </>
                            )}
                            <td className="px-4 py-2.5">
                              {entry.value ? (
                                <span className="inline-block max-w-[160px] truncate rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                  {entry.value}
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] text-gray-500">
                              {fmtDate(entry.startDate)}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] font-medium text-gray-700 dark:text-gray-300">
                              {fmtDate(entry.endDate)}
                            </td>
                            <td className="px-4 py-2.5 text-[12px] tabular-nums">
                              {entry.days === null ? (
                                <span className="text-gray-400">—</span>
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
  const { user } = useAuth();
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

  // Lifted up so KPI cards can set it directly
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("expired");

  // relId → { supplierName, siteName } built once from the panel response
  const relMeta = useMemo<
    Record<number, { supplierName: string; siteName: string }>
  >(() => {
    const map: Record<number, { supplierName: string; siteName: string }> = {};
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
      };
    }
    return map;
  }, [relations, sites]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Load panel metadata + bulk criteria data in parallel
    Promise.all([
      supplierAPI.listSitePanel({ limit: 1000 }),
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
  }, []);

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
      const details = item.class_criteria_details ?? {};

      for (const c of CLASS_CRITERIA) {
        const detail = details[c.key];
        entries.push({
          relId: item.rel_id,
          supplierName,
          siteName,
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

  // KPI card config — expired/expiring cards set the filter when clicked
  const kpiCards = [
    {
      label: "Active relations",
      value: total,
      cls: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      icon: <Shield size={16} />,
      filter: null as StatusFilter | null,
    },
    {
      label: "Relations scanned",
      value: scannedCount,
      cls: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-900/20",
      icon: <ScanLine size={16} />,
      filter: null as StatusFilter | null,
    },
    {
      label: "Expired criteria",
      value: scanDone ? totalExpired : "—",
      cls: "text-red-600",
      bg: "bg-red-50 dark:bg-red-900/20",
      icon: <AlertCircle size={16} />,
      filter: "expired" as StatusFilter,
    },
    {
      label: "Expiring ≤ 90 days",
      value: scanDone ? totalExpiring : "—",
      cls: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      icon: <AlertTriangle size={16} />,
      filter: "expiring" as StatusFilter,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="Validity Tracker"
        title="Criteria Validity Tracker"
        description="Scan all supplier relations at once, then pivot by supplier or criterion. Click an expired/expiring KPI card to filter instantly. Reset all expired criteria in one action — changes are applied to the backend and logged."
      />

      <div className="flex flex-col gap-5 mx-auto w-full max-w-[1600px]">
        {/* KPI cards */}
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
                  "flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition dark:bg-gray-900",
                  active
                    ? "border-blue-400 ring-2 ring-blue-200 dark:border-blue-500 dark:ring-blue-800"
                    : "border-gray-200 dark:border-white/10",
                  clickable ? "cursor-pointer hover:shadow-md" : "",
                ].join(" ")}
              >
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${c.bg} ${c.cls}`}
                >
                  {c.icon}
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {c.value}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {c.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

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

        {/* Results — always shown; spinner while initial load, table once data arrives */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin text-blue-500" /> Loading
            criteria data…
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
