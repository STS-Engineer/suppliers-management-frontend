/**
 * Batch Evaluation Page
 * - Evaluation Dashboard: who needs evaluation, with pagination
 * - Batch Upload: drag-and-drop Excel ingestion
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supplierAPI } from "../services/supplierOnboardingAPI";
import { PageIntro } from "../components/UI";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DueItem {
  relation_id: number;
  unit_name: string;
  unit_id: number;
  plant_name: string;
  plant_city?: string;
  plant_country?: string;
  current_grade?: string;
  current_class?: number;
  final_grade?: string;
  current_status?: string;
  evaluation_frequency: string;
  last_evaluation_date?: string;
  next_evaluation_date?: string;
  days_overdue?: number;
  days_until_due?: number;
  eval_status: "NEVER_EVALUATED" | "OVERDUE" | "DUE_SOON" | "UP_TO_DATE";
}

interface DueSummary {
  NEVER_EVALUATED: number;
  OVERDUE: number;
  DUE_SOON: number;
  UP_TO_DATE: number;
  total: number;
}

interface ProcessedRow {
  supplier_code: string;
  plant_name: string;
  evaluation_date: string;
  grade: string;
  class_value?: number;
  final_grade: string;
  new_status: string;
  status_changed: boolean;
  previous_grade?: string;
  next_evaluation_date: string;
  evaluation_frequency: string;
  dev_plan_created?: boolean;
}

interface SkippedRow {
  supplier_code: string;
  plant_name: string;
  reason: string;
}

interface UploadResult {
  status: "success" | "partial" | "error";
  message: string;
  dry_run?: boolean;
  parse_errors: string[];
  total_rows: number;
  processed: number;
  skipped: number;
  processed_rows: ProcessedRow[];
  skipped_rows: SkippedRow[];
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const STATUS_CFG = {
  NEVER_EVALUATED: { label: "Never evaluated", dot: "bg-slate-400",  badge: "bg-slate-100 text-slate-600 ring-slate-200"  },
  OVERDUE:         { label: "Overdue",          dot: "bg-red-500",    badge: "bg-red-50 text-red-700 ring-red-200"         },
  DUE_SOON:        { label: "Due soon",          dot: "bg-amber-500",  badge: "bg-amber-50 text-amber-700 ring-amber-200"   },
  UP_TO_DATE:      { label: "Up to date",        dot: "bg-emerald-500",badge: "bg-emerald-50 text-emerald-700 ring-emerald-200"},
} as const;

const SUPPLY_STATUS_CFG: Record<string, string> = {
  "Can Quote and Be Awarded":      "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Can Quote but Not be Awarded":  "bg-amber-50 text-amber-700 ring-amber-200",
  "New Business on Hold":          "bg-red-50 text-red-700 ring-red-200",
};

const GRADE_CLR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-red-100 text-red-800",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------

type Tab = "dashboard" | "upload";

export default function BatchEvaluationPage() {
  const [tab, setTab] = useState<Tab>("dashboard");

  const tabSwitcher = (
    <div className="flex w-fit rounded-xl border border-white/20 bg-white/10 p-1 backdrop-blur-sm">
      {(
        [
          { id: "dashboard", label: "Dashboard" },
          { id: "upload",    label: "Batch Upload" },
        ] as { id: Tab; label: string }[]
      ).map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
            tab === t.id
              ? "bg-white/20 text-white shadow-sm"
              : "text-blue-200/70 hover:text-white"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="Evaluations"
        title="Supplier Evaluations"
        description="Track evaluation deadlines and upload batch scorecard results."
        actions={tabSwitcher}
      />
      <div>
        {tab === "dashboard" && <EvaluationDashboard />}
        {tab === "upload"    && <BatchUploadPanel />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard tab
// ---------------------------------------------------------------------------

function EvaluationDashboard() {
  const [items, setItems] = useState<DueItem[]>([]);
  const [summary, setSummary] = useState<DueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supplierAPI.getEvaluationsDue();
      setItems(res.data?.items ?? []);
      setSummary(res.data?.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filter/search changes
  useEffect(() => { setPage(1); }, [activeFilter, search]);

  const filtered = items.filter((item) => {
    const matchFilter = activeFilter === "ALL" || item.eval_status === activeFilter;
    const q = search.toLowerCase();
    return matchFilter && (
      !q ||
      item.unit_name.toLowerCase().includes(q) ||
      item.plant_name.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const fmt = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      });
    } catch { return d; }
  };

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4">
          {(["OVERDUE", "NEVER_EVALUATED", "DUE_SOON", "UP_TO_DATE"] as const).map((key) => {
            const cfg = STATUS_CFG[key];
            const count = summary[key];
            const active = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(active ? "ALL" : key)}
                className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all ${
                  active
                    ? "border-[#062B49] bg-[#062B49] shadow-lg shadow-[#062B49]/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md dark:border-white/[0.08] dark:bg-[#111e30] dark:hover:border-white/[0.15]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${active ? "bg-white/60" : cfg.dot}`} />
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${active ? "text-white/70" : "text-slate-400"}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className={`mt-3 text-3xl font-bold ${active ? "text-white" : "text-[#062B49] dark:text-white"}`}>
                  {count}
                </div>
                {active && (
                  <div className="absolute right-3 top-3 rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Filtered
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by unit name or plant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#062B49]/40 focus:ring-4 focus:ring-[#062B49]/8 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10"
          />
        </div>

        {/* Page size */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-[#062B49]/40 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200 dark:focus:border-blue-500/40"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>per page</span>
        </div>

        {/* Refresh */}
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#111e30] dark:text-slate-300 dark:hover:bg-white/[0.05]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState message={search || activeFilter !== "ALL" ? "No suppliers match your filter." : "No active relations found."} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-[#0d1929]">
                  {["Urgency", "Unit", "Plant", "Current Grade", "Status", "Frequency", "Last Evaluated", "Next Due"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/[0.05]">
                {paginated.map((item) => {
                  const scfg = STATUS_CFG[item.eval_status];
                  const gradeClr = item.current_grade ? GRADE_CLR[item.current_grade] : null;
                  const statusClr = item.current_status ? SUPPLY_STATUS_CFG[item.current_status] : null;
                  return (
                    <tr key={item.relation_id} className="group hover:bg-slate-50/70 transition-colors dark:hover:bg-white/[0.03]">
                      {/* Urgency */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${scfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${scfg.dot}`} />
                          {scfg.label}
                          {item.days_overdue != null && (
                            <span className="ml-0.5 opacity-60">· {item.days_overdue}d</span>
                          )}
                          {item.eval_status === "DUE_SOON" && item.days_until_due != null && (
                            <span className="ml-0.5 opacity-60">· {item.days_until_due}d</span>
                          )}
                        </span>
                      </td>

                      {/* Unit */}
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.unit_name}</div>
                      </td>

                      {/* Plant */}
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.plant_name}</div>
                        {(item.plant_city || item.plant_country) && (
                          <div className="mt-0.5 text-xs text-slate-400">
                            {[item.plant_city, item.plant_country].filter(Boolean).join(", ")}
                          </div>
                        )}
                      </td>

                      {/* Grade */}
                      <td className="px-5 py-4">
                        {item.final_grade ? (
                          <div className="flex items-center gap-2">
                            {item.current_grade && gradeClr && (
                              <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${gradeClr}`}>
                                {item.current_grade}
                              </span>
                            )}
                            {item.current_class && (
                              <span className="text-xs text-slate-400">Cls {item.current_class}</span>
                            )}
                            <span className="text-xs font-bold text-slate-600">→ {item.final_grade}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Supply status */}
                      <td className="px-5 py-4">
                        {statusClr ? (
                          <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${statusClr}`}>
                            {item.current_status}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">{item.evaluation_frequency}</td>
                      <td className="px-5 py-4 text-sm text-slate-500">{fmt(item.last_evaluation_date)}</td>
                      <td className="px-5 py-4">
                        <span className={`text-sm font-medium ${
                          item.eval_status === "OVERDUE" ? "text-red-600" :
                          item.eval_status === "DUE_SOON" ? "text-amber-600" : "text-slate-600"
                        }`}>
                          {fmt(item.next_evaluation_date)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-white/[0.06] dark:bg-[#0d1929]">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}</span> of{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span> relations
              {activeFilter !== "ALL" && (
                <> · filtered from <span className="font-semibold text-slate-700 dark:text-slate-200">{items.length}</span> total</>
              )}
            </p>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination component
// ---------------------------------------------------------------------------

function Pagination({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  const btn = "flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-medium transition";

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className={`${btn} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-300 dark:hover:bg-white/[0.05]`}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-slate-400">…</span>
        ) : (
          <button key={p} onClick={() => onChange(p as number)}
            className={`${btn} ${
              page === p
                ? "bg-[#062B49] text-white shadow-sm shadow-[#062B49]/20"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-300 dark:hover:bg-white/[0.05]"
            }`}>
            {p}
          </button>
        )
      )}

      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
        className={`${btn} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-300 dark:hover:bg-white/[0.05]`}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch Upload tab
// ---------------------------------------------------------------------------

function BatchUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPrefilled, setDownloadingPrefilled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const xlsxTemplateBase = supplierAPI.getEvaluationTemplateXlsxUrl();

  const handleFile = (f: File) => {
    const ok = /\.(xlsx|xls)$/i.test(f.name);
    if (!ok) { setError("Only Excel files (.xlsx or .xls) are accepted."); return; }
    setFile(f); setResult(null); setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  };

  const handleUpload = async (dryRun = false) => {
    if (!file) return;
    setUploading(true); setError(null); setResult(null);
    try {
      const res = await supplierAPI.batchUploadEvaluations(file, dryRun);
      setResult(res as UploadResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadPrefilled = async () => {
    setDownloadingPrefilled(true);
    try { await supplierAPI.downloadPrefilledTemplate(); }
    catch (err) { setError(err instanceof Error ? err.message : "Download failed"); }
    finally { setDownloadingPrefilled(false); }
  };

  const reset = () => {
    setFile(null); setResult(null); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">

      {/* Format + template card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
        <div className="border-b border-slate-100 px-6 py-4 dark:border-white/[0.06]">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">File format</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Your file must contain these columns. Download the pre-filled template to get started — supplier codes and plant names are already filled in.
          </p>
        </div>

        {/* Columns table */}
        <div className="overflow-x-auto px-6 pt-4 pb-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-8 text-left">Column</th>
                <th className="pb-2 pr-8 text-left">Description</th>
                <th className="pb-2 text-left">Values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                ["supplier_code",     "Unit identifier (pre-filled)",        "Text"],
                ["plant_name",        "Avocarbon plant (pre-filled)",         "Text"],
                ["evaluation_date",   "Date of evaluation",                  "YYYY-MM-DD"],
                ["operational_grade", "Operational scorecard result",         "A / B / C / D"],
                ["comments",          "Notes (optional)",                    "Text"],
              ].map(([col, desc, vals]) => (
                <tr key={col}>
                  <td className="py-2.5 pr-8 font-mono font-semibold text-[#062B49]">{col}</td>
                  <td className="py-2.5 pr-8 text-slate-500">{desc}</td>
                  <td className="py-2.5 text-slate-400">{vals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Matrix */}
        <div className="mx-6 mb-4 mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "Green — Can Quote & Be Awarded",    combos: "A1, A2, B1, B2",             cls: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" },
            { label: "Orange — Can Quote / Not Be Awarded",combos:"A3, B3, C1, C2, C3",          cls: "bg-amber-50 text-amber-800 ring-1 ring-amber-200"       },
            { label: "Red — New Business on Hold",         combos:"A4, B4, C4, D1–D4",           cls: "bg-red-50 text-red-800 ring-1 ring-red-200"             },
          ].map((row) => (
            <div key={row.label} className={`rounded-xl px-4 py-3 ${row.cls}`}>
              <div className="text-[11px] font-bold">{row.label}</div>
              <div className="mt-0.5 font-mono text-[11px] opacity-60">{row.combos}</div>
            </div>
          ))}
        </div>

        {/* Downloads */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-6 py-4 dark:border-white/[0.06]">
          <button onClick={handleDownloadPrefilled} disabled={downloadingPrefilled}
            className="flex items-center gap-2 rounded-xl bg-[#062B49] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0C5381] disabled:opacity-60">
            {downloadingPrefilled
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              : <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            }
            {downloadingPrefilled ? "Preparing…" : "Pre-filled template (all active relations)"}
          </button>
          <span className="text-xs text-slate-400">or blank Excel template:</span>
          <a href={xlsxTemplateBase} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-300 dark:hover:bg-[#0d1929]/80">.xlsx</a>
        </div>
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-12 text-center transition ${
            dragging ? "border-[#062B49] bg-[#062B49]/5 cursor-copy"
            : file   ? "border-emerald-400 bg-emerald-50 cursor-default dark:border-emerald-500/50 dark:bg-emerald-500/10"
                     : "border-slate-300 bg-white cursor-pointer hover:border-slate-400 hover:bg-slate-50 dark:border-white/[0.15] dark:bg-[#0d1929] dark:hover:border-white/[0.25] dark:hover:bg-[#0d1929]"
          }`}
        >
          {file ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                <p className="mt-0.5 text-xs text-emerald-600">{(file.size / 1024).toFixed(1)} KB · Ready</p>
              </div>
              <button type="button" onClick={(e) => { e.stopPropagation(); reset(); }}
                className="text-xs text-slate-400 underline hover:text-red-500">Remove</button>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Drop your file here, or <span className="text-[#062B49] underline">browse</span></p>
                <p className="mt-1 text-xs text-slate-400">Accepts .xlsx, .xls</p>
              </div>
            </>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Action bar */}
      {file && !result && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">{file.name}</span>
            <span className="ml-2 text-slate-400">· {(file.size / 1024).toFixed(1)} KB</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.05]">
              Remove
            </button>
            <button onClick={() => handleUpload(true)} disabled={uploading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]">
              {uploading ? "Checking…" : "Validate only"}
            </button>
            <button onClick={() => handleUpload(false)} disabled={uploading}
              className="rounded-lg bg-[#062B49] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0C5381] disabled:opacity-50">
              {uploading ? "Processing…" : "Upload & Save"}
            </button>
          </div>
        </div>
      )}

      {result && <UploadResultPanel result={result} onReset={reset} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload result panel
// ---------------------------------------------------------------------------

function UploadResultPanel({ result, onReset }: { result: UploadResult; onReset: () => void }) {
  const isOk = result.status === "success";
  const isPartial = result.status === "partial";

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className={`flex items-start justify-between gap-4 rounded-2xl border px-5 py-4 ${
        isOk ? "border-emerald-200 bg-emerald-50" : isPartial ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold ${isOk ? "text-emerald-800" : isPartial ? "text-amber-800" : "text-red-800"}`}>
              {result.message}
            </p>
            {result.dry_run && (
              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                Validation only — nothing saved
              </span>
            )}
          </div>
          <div className="mt-1.5 flex gap-4 text-xs">
            <span className="text-slate-600">Rows: <strong>{result.total_rows}</strong></span>
            <span className="text-emerald-700">Processed: <strong>{result.processed}</strong></span>
            {result.skipped > 0 && <span className="text-red-600">Skipped: <strong>{result.skipped}</strong></span>}
          </div>
        </div>
        <button onClick={onReset}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
          Upload another
        </button>
      </div>

      {/* Parse errors */}
      {result.parse_errors?.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">Parse errors ({result.parse_errors.length})</p>
          <ul className="space-y-1 text-xs text-red-700">
            {result.parse_errors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </div>
      )}

      {/* Processed rows table */}
      {result.processed_rows?.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
          <div className="border-b border-slate-100 px-5 py-3.5 dark:border-white/[0.06]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Processed <span className="ml-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{result.processed}</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {["Unit", "Plant", "Date", "Grade", "New Status", "Status changed?", "Dev Plan", "Next Due"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                {result.processed_rows.map((row, i) => {
                  const gc = GRADE_CLR[row.grade] ?? "";
                  const sc = SUPPLY_STATUS_CFG[row.new_status] ?? "";
                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{row.supplier_code}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{row.plant_name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.evaluation_date}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded px-2 py-0.5 font-bold ${gc}`}>{row.grade}</span>
                        {row.class_value && <span className="ml-1.5 text-slate-400">Cls {row.class_value} → <strong className="text-slate-700">{row.final_grade}</strong></span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {sc && <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${sc}`}>{row.new_status}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.status_changed
                          ? <span className="font-semibold text-amber-600">Changed</span>
                          : <span className="text-slate-400">No change</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.dev_plan_created ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700 ring-1 ring-red-200">
                            Auto-created
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{row.next_evaluation_date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skipped rows */}
      {result.skipped_rows?.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="border-b border-amber-100 px-5 py-3.5">
            <h3 className="text-sm font-bold text-amber-800">
              Skipped <span className="ml-1.5 rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{result.skipped}</span>
            </h3>
          </div>
          <ul className="divide-y divide-amber-100">
            {result.skipped_rows.map((row, i) => (
              <li key={i} className="flex items-start justify-between gap-6 px-5 py-3 text-xs">
                <span className="font-semibold text-amber-900">{row.supplier_code} → {row.plant_name}</span>
                <span className="shrink-0 text-amber-700">{row.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Micro helpers
// ---------------------------------------------------------------------------

const LoadingState = () => (
  <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-20 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#062B49] dark:border-white/[0.15] dark:border-t-blue-400" />
    <span className="text-sm text-slate-400">Loading evaluation data…</span>
  </div>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
    <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
    <button onClick={onRetry} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.05]">
      Retry
    </button>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-sm text-slate-400 shadow-sm dark:border-white/[0.08] dark:bg-[#111e30]">
    {message}
  </div>
);
