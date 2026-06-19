import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  Filter,
  RefreshCw,
  Shield,
  X,
} from "lucide-react";
import { InlineAlert, PageIntro } from "../components/UI";
import supplierAPI from "../services/supplierOnboardingAPI";
import type { SupplierCertificationResponse } from "../types/onboarding";

const PAGE_SIZE = 50;

type ValidityStatus = "valid" | "expiring" | "expired" | "no-date";

const STANDARD_TYPES = [
  { value: "", label: "All standards" },
  { value: "quality", label: "Quality" },
  { value: "environmental", label: "Environmental" },
  { value: "safety", label: "Safety" },
  { value: "energy", label: "Energy" },
  { value: "other", label: "Other" },
];

const STATUS_CONFIG: Record<
  ValidityStatus,
  {
    label: string;
    icon: React.ReactNode;
    rowClass: string;
    badgeClass: string;
  }
> = {
  expired: {
    label: "Expired",
    icon: <AlertCircle size={13} />,
    rowClass: "bg-red-50/40 dark:bg-red-900/5",
    badgeClass:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  expiring: {
    label: "Expiring soon",
    icon: <AlertTriangle size={13} />,
    rowClass: "bg-amber-50/40 dark:bg-amber-900/5",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  valid: {
    label: "Valid",
    icon: <CheckCircle2 size={13} />,
    rowClass: "",
    badgeClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  "no-date": {
    label: "No expiry date",
    icon: <Clock size={13} />,
    rowClass: "",
    badgeClass:
      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
};

function getValidityStatus(cert: SupplierCertificationResponse): ValidityStatus {
  if (!cert.end_date) return "no-date";
  const end = new Date(cert.end_date);
  const now = new Date();
  if (end < now) return "expired";
  const diffDays = Math.floor(
    (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 90) return "expiring";
  return "valid";
}

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? v
    : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntilExpiry(endDate?: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  return Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const STANDARD_ICON: Record<string, string> = {
  quality: "🏭",
  environmental: "🌿",
  safety: "⛑️",
  energy: "⚡",
  other: "📋",
};

export default function CertificationsTrackingPage() {
  const [certs, setCerts] = useState<SupplierCertificationResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [standardType, setStandardType] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "expired" | "expiring">(
    "",
  );
  const [appliedFilters, setAppliedFilters] = useState<{
    standard_type?: string;
    expired_only?: boolean;
    expiring_days?: number;
  }>({});

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Summary counts (computed from current page — approximation)
  const expiredCount = certs.filter((c) => getValidityStatus(c) === "expired").length;
  const expiringCount = certs.filter((c) => getValidityStatus(c) === "expiring").length;
  const validCount = certs.filter((c) => getValidityStatus(c) === "valid").length;

  async function fetchData(
    p: number,
    filters: typeof appliedFilters,
  ) {
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
  }, [page, appliedFilters]);

  function applyFilters() {
    setPage(0);
    const f: typeof appliedFilters = {};
    if (standardType) f.standard_type = standardType;
    if (statusFilter === "expired") f.expired_only = true;
    if (statusFilter === "expiring") f.expiring_days = 90;
    setAppliedFilters(f);
  }

  function clearFilters() {
    setStandardType("");
    setStatusFilter("");
    setPage(0);
    setAppliedFilters({});
  }

  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8">
        <PageIntro
          eyebrow="Certifications Tracker"
          title="Certifications Tracker"
          description="Centralized view of all supplier certifications — validity, expiry and compliance status"
        />

        {/* Summary cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total (this page)",
              value: certs.length,
              icon: <Shield size={16} />,
              cls: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-50 dark:bg-blue-900/20",
            },
            {
              label: "Valid",
              value: validCount,
              icon: <CheckCircle2 size={16} />,
              cls: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-50 dark:bg-emerald-900/20",
            },
            {
              label: "Expiring ≤ 90 days",
              value: expiringCount,
              icon: <AlertTriangle size={16} />,
              cls: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-50 dark:bg-amber-900/20",
            },
            {
              label: "Expired",
              value: expiredCount,
              icon: <AlertCircle size={16} />,
              cls: "text-red-600 dark:text-red-400",
              bg: "bg-red-50 dark:bg-red-900/20",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900"
            >
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${card.bg} ${card.cls}`}
              >
                {card.icon}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-800 dark:text-white">
                  {card.value}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {card.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Standard type
              </label>
              <select
                value={standardType}
                onChange={(e) => setStandardType(e.target.value)}
                className="h-9 w-44 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm dark:border-white/10 dark:bg-gray-800 dark:text-white"
              >
                {STANDARD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Validity status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "" | "expired" | "expiring",
                  )
                }
                className="h-9 w-44 rounded-xl border border-gray-200 bg-gray-50 px-2 text-sm dark:border-white/10 dark:bg-gray-800 dark:text-white"
              >
                <option value="">All statuses</option>
                <option value="expired">Expired</option>
                <option value="expiring">Expiring soon (≤ 90 days)</option>
              </select>
            </div>
            <button
              onClick={applyFilters}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Filter size={13} />
              Apply
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                <X size={13} />
                Clear
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {loading && (
                <RefreshCw size={14} className="animate-spin text-blue-500" />
              )}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {total.toLocaleString()} total
              </span>
            </div>
          </div>
        </div>

        {error && (
          <InlineAlert title="Failed to load certifications" message={error} tone="danger" />
        )}

        {/* Table */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10">
                  {[
                    "Supplier Unit",
                    "Standard",
                    "Certification",
                    "Name / Reference",
                    "Valid From",
                    "Valid Until",
                    "Days Left",
                    "Status",
                    "Document",
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
              <tbody className="divide-y divide-gray-50 dark:divide-white/[0.04]">
                {loading && certs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      <RefreshCw size={20} className="mx-auto mb-2 animate-spin" />
                      Loading…
                    </td>
                  </tr>
                ) : certs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <FileCheck
                        size={32}
                        className="mx-auto mb-3 text-gray-300 dark:text-gray-700"
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No certifications found
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  certs.map((cert) => {
                    const status = getValidityStatus(cert);
                    const cfg = STATUS_CONFIG[status];
                    const days = daysUntilExpiry(cert.end_date);
                    const stdIcon =
                      STANDARD_ICON[cert.standard_type ?? "other"] ?? "📋";
                    return (
                      <tr
                        key={cert.id_certification}
                        className={`transition-colors hover:bg-gray-50/80 dark:hover:bg-white/[0.02] ${cfg.rowClass}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                          Unit #{cert.id_supplier_unit ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 capitalize text-gray-600 dark:text-gray-400">
                            <span>{stdIcon}</span>
                            {cert.standard_type ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {cert.certification_type ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {cert.certificate_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {fmtDate(cert.start_date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                          {fmtDate(cert.end_date)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
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
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.badgeClass}`}
                          >
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {cert.file_url ? (
                            <a
                              href={cert.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                            >
                              <ExternalLink size={12} />
                              {cert.file_name ?? "View"}
                            </a>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-white/10">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Page {page + 1} of {totalPages} — {total.toLocaleString()} certifications
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <ChevronLeft size={14} />
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
                        "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition",
                        pg === page
                          ? "bg-blue-600 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5",
                      ].join(" ")}
                    >
                      {pg + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400 dark:text-gray-600">
          Certifications data sourced from SB9 (General Supplier Data) quality &amp; compliance fields.
          Expiry thresholds: 🔴 expired · 🟠 ≤ 90 days · 🟢 valid.
        </p>
      </div>
    </div>
  );
}
