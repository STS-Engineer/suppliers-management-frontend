/**
 * Documents & Validity Tracker (SB1 + SB6)
 *
 * Combines:
 *  - SB1 (Supplier Panel): relation-level data validity, delivery status,
 *    quality cert required, transport info, AP days, incoterm, etc.
 *  - SB6 (Quality): class criteria details with validity_start_date /
 *    validity_end_date per criterion, document links.
 *
 * Shows a table of all active supplier-site relations.
 * Expanding a row loads the full SB6 criteria workspace for that relation.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Truck,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { InlineAlert, PageIntro } from "../components/UI";
import supplierAPI from "../services/supplierOnboardingAPI";
import type {
  ClassCriterionDetailFormData,
  RelationEvaluationWorkspace,
  SitePanelRelation,
  SupplierSiteRelation,
} from "../types/onboarding";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? v
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

type ValidityStatus = "expired" | "expiring" | "valid" | "missing";

function validityStatus(endDate?: string | null): ValidityStatus {
  if (!endDate) return "missing";
  const d = daysUntil(endDate);
  if (d == null) return "missing";
  if (d < 0) return "expired";
  if (d <= 90) return "expiring";
  return "valid";
}

const STATUS_BADGE: Record<
  ValidityStatus,
  { cls: string; label: string; icon: React.ReactNode }
> = {
  expired: {
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    label: "Expired",
    icon: <AlertCircle size={11} />,
  },
  expiring: {
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    label: "Expiring",
    icon: <AlertTriangle size={11} />,
  },
  valid: {
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    label: "Valid",
    icon: <CheckCircle2 size={11} />,
  },
  missing: {
    cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    label: "No date",
    icon: <Clock size={11} />,
  },
};

function StatusBadge({ status }: { status: ValidityStatus }) {
  const cfg = STATUS_BADGE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// Friendly criterion labels (SB6 keys → display names)
const CRITERION_LABELS: Record<string, string> = {
  top: "Payment Terms (TOP)",
  lta: "Long-Term Agreement (LTA)",
  sqma: "SQMA",
  quality_certification: "Quality Certification",
  family_coverage: "Family Coverage",
  competitiveness: "Competitiveness",
  geo_coverage: "Geo Coverage",
  cons_or_wd: "Consignment / WD",
  financial_health: "Financial Health",
  prod_lia_ins: "Product Liability Insurance",
  prod: "Production Cert (IATF/ISO)",
};

// Data validity colour
const DATA_VALIDITY_CLS: Record<string, string> = {
  "up to date": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "to update": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "outdated": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

// ─── CriteriaRow ──────────────────────────────────────────────────────────────

function CriteriaRow({
  criterionKey,
  detail,
}: {
  criterionKey: string;
  detail: ClassCriterionDetailFormData;
}) {
  const status = validityStatus(detail.validity_end_date);
  const days = daysUntil(detail.validity_end_date);
  const label = CRITERION_LABELS[criterionKey] ?? criterionKey;

  return (
    <tr className="border-t border-gray-50 dark:border-white/[0.03]">
      <td className="pl-14 pr-4 py-2.5 text-[12px] font-medium text-gray-700 dark:text-gray-300">
        {label}
      </td>
      <td className="px-4 py-2.5 text-[12px] text-gray-500 dark:text-gray-400">
        {fmtDate(detail.validity_start_date)}
      </td>
      <td className="px-4 py-2.5 text-[12px] font-medium text-gray-700 dark:text-gray-300">
        {fmtDate(detail.validity_end_date)}
      </td>
      <td className="px-4 py-2.5 text-[12px] tabular-nums">
        {days == null ? (
          <span className="text-gray-400">—</span>
        ) : days < 0 ? (
          <span className="font-semibold text-red-600 dark:text-red-400">
            {Math.abs(days)}d ago
          </span>
        ) : (
          <span
            className={
              days <= 30
                ? "font-semibold text-red-600 dark:text-red-400"
                : days <= 90
                ? "font-semibold text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
            }
          >
            {days}d
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-2.5 text-[12px]">
        {detail.document_url ? (
          <a
            href={detail.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
          >
            <ExternalLink size={11} />
            {detail.document_name ?? "View"}
          </a>
        ) : (
          <span className="text-gray-400 dark:text-gray-600">No document</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-[12px] text-gray-500 dark:text-gray-400">
        {detail.comments ?? "—"}
      </td>
    </tr>
  );
}

// ─── RelationRow ──────────────────────────────────────────────────────────────

function RelationRow({ item }: { item: SitePanelRelation }) {
  const [expanded, setExpanded] = useState(false);
  const [workspace, setWorkspace] = useState<RelationEvaluationWorkspace | null>(
    null,
  );
  const [loadingWs, setLoadingWs] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  const rel: SupplierSiteRelation = item.relation;

  async function loadWorkspace() {
    if (workspace || loadingWs) return;
    setLoadingWs(true);
    setWsError(null);
    try {
      const res = await supplierAPI.getRelationEvaluationWorkspace(
        rel.id_relation,
      );
      setWorkspace((res as { data: RelationEvaluationWorkspace }).data ?? res);
    } catch (e) {
      setWsError(e instanceof Error ? e.message : "Failed to load criteria");
    } finally {
      setLoadingWs(false);
    }
  }

  function toggle() {
    setExpanded((v) => !v);
    if (!expanded && !workspace) loadWorkspace();
  }

  // Compute criteria summary for the row badge
  const criteriaEntries = workspace?.class_criteria_details
    ? Object.entries(workspace.class_criteria_details)
    : [];
  const expiredCount = criteriaEntries.filter(
    ([, d]) => validityStatus(d.validity_end_date) === "expired",
  ).length;
  const expiringCount = criteriaEntries.filter(
    ([, d]) => validityStatus(d.validity_end_date) === "expiring",
  ).length;

  const dataValidityLower = (rel.data_validity ?? "").toLowerCase();
  const dataValidityCls =
    DATA_VALIDITY_CLS[dataValidityLower] ??
    "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";

  return (
    <>
      <tr
        className={[
          "cursor-pointer transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-900/5",
          expanded ? "bg-blue-50/30 dark:bg-blue-900/10" : "",
        ].join(" ")}
        onClick={toggle}
      >
        {/* Expand toggle */}
        <td className="w-10 pl-4 py-3">
          {expanded ? (
            <ChevronDown size={14} className="text-blue-500" />
          ) : (
            <ChevronRight size={14} className="text-gray-400" />
          )}
        </td>

        {/* Supplier */}
        <td className="px-4 py-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {item.group?.nom ?? "—"}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {item.unit?.supplier_code ?? "—"}
          </p>
        </td>

        {/* Plant */}
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {item.unit?.city ?? "—"}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {item.unit?.country}
          </p>
        </td>

        {/* Final grade */}
        <td className="px-4 py-3">
          {rel.final_grade ? (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
              {rel.final_grade}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>

        {/* Last eval */}
        <td className="px-4 py-3 text-[12px] text-gray-600 dark:text-gray-400">
          {fmtDate(rel.last_evaluation_date)}
        </td>

        {/* SB1 data validity */}
        <td className="px-4 py-3">
          {rel.data_validity ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${dataValidityCls}`}
            >
              {rel.data_validity}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>

        {/* Delivery status */}
        <td className="px-4 py-3">
          {rel.delivery_status ? (
            <span className="flex items-center gap-1 text-[12px] text-gray-600 dark:text-gray-400">
              <Truck size={11} />
              {rel.delivery_status}
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </td>

        {/* Quality cert required */}
        <td className="px-4 py-3 text-[12px] text-gray-600 dark:text-gray-400 max-w-[140px] truncate">
          {rel.quality_cert_required ?? "—"}
        </td>

        {/* Criteria summary */}
        <td className="px-4 py-3">
          {workspace ? (
            <div className="flex items-center gap-1.5">
              {expiredCount > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <AlertCircle size={9} />
                  {expiredCount}
                </span>
              )}
              {expiringCount > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  <AlertTriangle size={9} />
                  {expiringCount}
                </span>
              )}
              {expiredCount === 0 && expiringCount === 0 && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={12} />
                </span>
              )}
            </div>
          ) : loadingWs ? (
            <Loader2 size={12} className="animate-spin text-blue-400" />
          ) : (
            <span className="text-[11px] text-blue-500 hover:underline">
              Load
            </span>
          )}
        </td>

        {/* Link to evaluation */}
        <td className="px-4 py-3">
          <Link
            to={`/supplier-relations/${rel.id_relation}/evaluation`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
          >
            <Shield size={11} />
            Evaluate
          </Link>
        </td>
      </tr>

      {/* Expanded criteria */}
      {expanded && (
        <tr>
          <td colSpan={10} className="pb-0 pt-0">
            <div className="border-t border-blue-100 bg-blue-50/40 dark:border-blue-900/20 dark:bg-blue-950/10">
              {/* SB1 details row */}
              <div className="flex flex-wrap gap-5 px-14 py-3 text-[12px] border-b border-blue-100 dark:border-blue-900/20">
                <div>
                  <span className="text-gray-400">Transport: </span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {rel.transport_mode ?? "—"}
                  </span>
                  {rel.transit_days != null && (
                    <span className="ml-1 text-gray-500">({rel.transit_days}d)</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">Incoterm: </span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {rel.incoterm_place ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">AP days: </span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {rel.real_ap_days ?? "—"}
                    {rel.real_ap_days_validated != null && (
                      <span className="ml-1 text-gray-500">
                        (validated: {rel.real_ap_days_validated})
                      </span>
                    )}
                  </span>
                </div>
                {rel.consignment && (
                  <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                    <CheckCircle2 size={11} />
                    Consignment
                  </div>
                )}
                {rel.preferred_dev_supplier && (
                  <div className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                    <CheckCircle2 size={11} />
                    Preferred dev supplier
                  </div>
                )}
              </div>

              {/* SB6 criteria table */}
              {wsError ? (
                <p className="px-14 py-4 text-sm text-red-600 dark:text-red-400">
                  {wsError}
                </p>
              ) : loadingWs ? (
                <div className="flex items-center gap-2 px-14 py-4 text-sm text-gray-500">
                  <Loader2 size={14} className="animate-spin" />
                  Loading SB6 criteria…
                </div>
              ) : criteriaEntries.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-100 dark:border-blue-900/20">
                      <th className="pl-14 pr-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Criterion (SB6)
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Valid From
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Valid Until
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Days Left
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Document
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteriaEntries.map(([key, detail]) => (
                      <CriteriaRow key={key} criterionKey={key} detail={detail} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-14 py-4 text-[12px] text-gray-500 dark:text-gray-400">
                  No class criteria details recorded for this relation yet.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DocumentsValidityPage() {
  const [relations, setRelations] = useState<SitePanelRelation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [validityFilter, setValidityFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    supplierAPI
      .listSitePanel({ limit: 500 })
      .then((res) => {
        if (cancelled) return;
        // Flatten bundles → individual relations
        const all: SitePanelRelation[] = [];
        for (const bundle of res.data.items ?? []) {
          for (const rel of bundle.relations ?? []) {
            all.push(rel);
          }
        }
        setRelations(all);
        setTotal(all.length);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Failed to load relations",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = relations;
    if (scopeFilter) {
      list = list.filter(
        (r) =>
          (r.relation.supplier_scope ?? "").toLowerCase() === scopeFilter,
      );
    }
    if (validityFilter) {
      list = list.filter(
        (r) =>
          (r.relation.data_validity ?? "")
            .toLowerCase()
            .includes(validityFilter.toLowerCase()),
      );
    }
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.group?.nom?.toLowerCase().includes(kw) ||
          r.unit?.supplier_code?.toLowerCase().includes(kw) ||
          r.unit?.city?.toLowerCase().includes(kw) ||
          r.unit?.country?.toLowerCase().includes(kw) ||
          r.relation.relation_code?.toLowerCase().includes(kw),
      );
    }
    return list;
  }, [relations, search, scopeFilter, validityFilter]);

  const hasFilters = !!(search || scopeFilter || validityFilter);

  // Summary counts
  const upToDateCount = relations.filter(
    (r) => (r.relation.data_validity ?? "").toLowerCase() === "up to date",
  ).length;
  const toUpdateCount = relations.filter(
    (r) => (r.relation.data_validity ?? "").toLowerCase() === "to update",
  ).length;
  const outdatedCount = relations.filter(
    (r) => (r.relation.data_validity ?? "").toLowerCase() === "outdated",
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Documents & Validity (SB1 + SB6)"
          title="Documents & Validity Tracker"
          description="Active supplier-site relations with SB1 data validity, delivery status, and SB6 quality criteria document validity"
        />

        {/* Summary */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Active relations", value: total, cls: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", icon: <Shield size={16} /> },
            { label: "Up to date", value: upToDateCount, cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: <CheckCircle2 size={16} /> },
            { label: "To update", value: toUpdateCount, cls: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", icon: <AlertTriangle size={16} /> },
            { label: "Outdated", value: outdatedCount, cls: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", icon: <AlertCircle size={16} /> },
          ].map((card) => (
            <div key={card.label} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${card.bg} ${card.cls}`}>
                {card.icon}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-800 dark:text-white">{card.value}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search supplier, unit, plant…"
                className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-gray-800 dark:text-white"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="h-9 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm dark:border-white/10 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All scopes</option>
              <option value="global">Global</option>
              <option value="strategic">Strategic</option>
              <option value="local">Local</option>
            </select>
            <select
              value={validityFilter}
              onChange={(e) => setValidityFilter(e.target.value)}
              className="h-9 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm dark:border-white/10 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All data validity</option>
              <option value="up to date">Up to date</option>
              <option value="to update">To update</option>
              <option value="outdated">Outdated</option>
            </select>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setScopeFilter(""); setValidityFilter(""); }}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                <X size={13} /> Clear
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {loading && <RefreshCw size={13} className="animate-spin text-blue-500" />}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filtered.length} of {total} relations
              </span>
            </div>
          </div>
        </div>

        {error && (
          <InlineAlert title="Failed to load relations" message={error} tone="danger" />
        )}

        {/* Table */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10">
                  <th className="w-10" />
                  {[
                    "Supplier / Unit",
                    "Plant / City",
                    "Grade",
                    "Last Eval",
                    "Data Validity (SB1)",
                    "Delivery Status",
                    "Quality Cert Req.",
                    "Criteria (SB6)",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && relations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-gray-400">
                      <RefreshCw size={20} className="mx-auto mb-2 animate-spin" />
                      Loading relations…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <Filter size={28} className="mx-auto mb-3 text-gray-300 dark:text-gray-700" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {hasFilters ? "No relations match the current filters" : "No active relations found"}
                      </p>
                      {hasFilters && (
                        <button
                          onClick={() => { setSearch(""); setScopeFilter(""); setValidityFilter(""); }}
                          className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <RelationRow key={item.relation.id_relation} item={item} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-400 dark:text-gray-600">
          Click any row to expand SB6 quality criteria details. SB1 fields (data validity, delivery status, transport) are shown inline.
          Criteria documents and validity dates are loaded on demand from the evaluation workspace.
        </p>
      </div>
    </div>
  );
}
