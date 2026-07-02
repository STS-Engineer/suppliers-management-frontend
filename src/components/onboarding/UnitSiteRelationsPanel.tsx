/**
 * UnitSiteRelationsPanel — premium redesign
 * Shows all plant relations for the selected supplier unit.
 * Each relation is labelled "Unit Name → Plant Name".
 */

import React, { useEffect, useState } from "react";
import {
  AvocarbonSite,
  SupplierSiteRelation,
  SupplierUnitResponse,
  UnitEvaluationSummary,
} from "../../types/onboarding";
import { supplierAPI } from "../../services/supplierOnboardingAPI";

interface SpendEntry {
  fiscal_year: number;
  spend_value: number;
  spend_currency: string;
}

interface Props {
  selectedUnit: SupplierUnitResponse | null;
  siteRelations: SupplierSiteRelation[];
  summary: UnitEvaluationSummary | null;
  availableSites: AvocarbonSite[];
  isLoading: boolean;
  onEvaluate: (relation: SupplierSiteRelation) => void;
  onManageDevelopmentPlan: (relation: SupplierSiteRelation) => void;
  onViewRelationDetails: (relation: SupplierSiteRelation) => void;
  onOverrideStatus: (relation: SupplierSiteRelation) => void;
  onUnlink: (r: SupplierSiteRelation) => void;
  onRelinkSuccess: () => void;
  activeDevelopmentPlanRelationId?: number | null;
  activeDetailsRelationId?: number | null;
  /** Triggered when the user clicks "Assign to Plant" inside this panel */
  onAssignToPlant?: () => void;
  /** Whether the assign flow is currently active (to toggle button label) */
  assignActive?: boolean;
}

const SCOPE_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  global:    { bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500"    },
  local:     { bg: "bg-slate-100",  text: "text-slate-600",  dot: "bg-slate-400"   },
  strategic: { bg: "bg-fuchsia-50", text: "text-fuchsia-700",dot: "bg-fuchsia-500" },
};

const GRADE_STYLE: Record<string, { ring: string; text: string; bg: string }> = {
  A: { ring: "ring-emerald-300", text: "text-emerald-700", bg: "bg-emerald-50" },
  B: { ring: "ring-blue-300",    text: "text-blue-700",    bg: "bg-blue-50"    },
  C: { ring: "ring-amber-300",   text: "text-amber-700",   bg: "bg-amber-50"   },
  D: { ring: "ring-red-300",     text: "text-red-700",     bg: "bg-red-50"     },
};

// ---------------------------------------------------------------------------

export const UnitSiteRelationsPanel: React.FC<Props> = ({
  selectedUnit,
  siteRelations,
  summary,
  availableSites,
  isLoading,
  onEvaluate,
  onManageDevelopmentPlan,
  onViewRelationDetails,
  onOverrideStatus,
  activeDevelopmentPlanRelationId,
  activeDetailsRelationId,
  onAssignToPlant,
  assignActive,
}) => {
  // Most-recent spend per relation: relationId → latest SpendEntry
  const [latestSpend, setLatestSpend] = useState<Record<number, SpendEntry | null>>({});

  useEffect(() => {
    if (!siteRelations.length) { setLatestSpend({}); return; }
    let cancelled = false;
    Promise.all(
      siteRelations.map(async (rel) => {
        try {
          const result = await supplierAPI.listRelationSpend(rel.id_relation);
          const entries: SpendEntry[] = result.data ?? result ?? [];
          // API returns newest-first; take the first entry
          return [rel.id_relation, entries[0] ?? null] as const;
        } catch {
          return [rel.id_relation, null] as const;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setLatestSpend(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [siteRelations]);

  const getSite = (siteId: number) =>
    availableSites.find((s) => s.id_site === siteId);

  const fmt = (v?: string | null) => {
    if (!v) return null;
    try {
      return new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return v; }
  };

  if (!selectedUnit) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">No unit selected</p>
          <p className="mt-1 text-xs text-slate-400">Pick a unit from the list to view its plant relations.</p>
        </div>
      </div>
    );
  }

  const gradeStyle = summary?.final_grade ? GRADE_STYLE[summary.final_grade] : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Panel header */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Plant Assignments
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {selectedUnit.supplier_code}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {[selectedUnit.city, selectedUnit.country].filter(Boolean).join(", ")}
              {selectedUnit.product_type ? ` · ${selectedUnit.product_type}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${
              gradeStyle
                ? `${gradeStyle.bg} ${gradeStyle.text} ${gradeStyle.ring}`
                : "bg-slate-100 text-slate-500 ring-slate-200"
            }`}>
              {gradeStyle ? `Grade ${summary!.final_grade}` : "No grade yet"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              {siteRelations.length} plant{siteRelations.length !== 1 ? "s" : ""}
            </span>
            {onAssignToPlant && !assignActive && siteRelations.length > 0 && (
              <button
                onClick={onAssignToPlant}
                title="Assign to another plant"
                className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-500 active:scale-95"
              >
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m0 0a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Assign to Plant
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Loading plant relations…
          </div>
        ) : siteRelations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400 ring-1 ring-amber-200">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m0 0a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">No plant relations yet</p>
              <p className="mt-0.5 text-xs text-slate-400">Link this unit to an Avocarbon plant to start the evaluation.</p>
            </div>
            {onAssignToPlant && !assignActive && (
              <button
                onClick={onAssignToPlant}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-amber-500 active:scale-95"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m0 0a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Assign to Plant
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {siteRelations.map((rel) => {
              const site = getSite(rel.id_site);
              const scope = SCOPE_STYLE[rel.supplier_scope ?? "local"] ?? SCOPE_STYLE.local;
              const grade = rel.operational_grade ? GRADE_STYLE[rel.operational_grade] : null;

              return (
                <RelationCard
                  key={rel.id_relation}
                  relation={rel}
                  unitName={selectedUnit.supplier_code}
                  siteName={site?.site_name ?? `Plant #${rel.id_site}`}
                  siteLocation={[site?.city, site?.country].filter(Boolean).join(", ")}
                  scope={scope}
                  grade={grade}
                  fmt={fmt}
                  latestSpend={latestSpend[rel.id_relation] ?? null}
                  onEvaluate={() => onEvaluate(rel)}
                  onDevelopmentPlan={() => onManageDevelopmentPlan(rel)}
                  onViewDetails={() => onViewRelationDetails(rel)}
                  onOverride={() => onOverrideStatus(rel)}
                  isSendingDevelopmentPlan={
                    activeDevelopmentPlanRelationId === rel.id_relation
                  }
                  isLoadingDetails={activeDetailsRelationId === rel.id_relation}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Relation card
// ---------------------------------------------------------------------------

interface RelCardProps {
  relation: SupplierSiteRelation;
  unitName: string;
  siteName: string;
  siteLocation: string;
  scope: { bg: string; text: string; dot: string };
  grade: { ring: string; text: string; bg: string } | null;
  fmt: (v?: string | null) => string | null;
  latestSpend: SpendEntry | null;
  onEvaluate: () => void;
  onDevelopmentPlan: () => void;
  onViewDetails: () => void;
  onOverride: () => void;
  isSendingDevelopmentPlan?: boolean;
  isLoadingDetails?: boolean;
}

const RelationCard: React.FC<RelCardProps> = ({
  relation, unitName, siteName, siteLocation, scope, grade, fmt, latestSpend,
  onEvaluate, onDevelopmentPlan, onViewDetails, onOverride, isSendingDevelopmentPlan = false, isLoadingDetails = false,
}) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
    {/* Card header: Unit → Plant */}
    <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#062B49]/5 to-transparent px-5 py-4">
      <div className="flex min-w-0 items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-700">{unitName}</span>
        {relation.alias_1 && (
          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
            {relation.alias_1}
          </span>
        )}
        <span className="text-slate-300">→</span>
        <span className="text-sm font-bold text-[#062B49]">{siteName}</span>
        {siteLocation && (
          <span className="text-[11px] text-slate-400">({siteLocation})</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 ml-3">
        {relation.supplier_scope && (
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${scope.bg} ${scope.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${scope.dot}`} />
            {relation.supplier_scope}
          </span>
        )}
        {relation.operational_grade && grade && (
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${grade.bg} ${grade.text} ${grade.ring}`}>
            Grade {relation.operational_grade}
            {relation.class_value ? ` · Class ${relation.class_value}` : ""}
          </span>
        )}
        {relation.supplier_status && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
            {relation.supplier_status}
          </span>
        )}
      </div>
    </div>

    {/* Card body: meta */}
    <div className="px-5 py-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
        {relation.alias_1 && <Meta label="Plant alias" value={relation.alias_1} />}
        {relation.supplier_owner && <Meta label="Owner" value={relation.supplier_owner} />}
        {latestSpend ? (
          <Meta
            label={`Annual Spend (FY ${latestSpend.fiscal_year})`}
            value={`${Number(latestSpend.spend_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${latestSpend.spend_currency}`}
          />
        ) : relation.annual_spend_value != null ? (
          <Meta label="Annual Spend" value={`${Number(relation.annual_spend_value).toLocaleString()} ${relation.annual_spend_currency ?? ""}`} />
        ) : null}
        {relation.evaluation_frequency && <Meta label="Frequency" value={relation.evaluation_frequency} />}
        {relation.strategic_mention && relation.strategic_mention !== "none" && (
          <Meta label="Strategic" value={relation.strategic_mention} />
        )}
        {relation.panel_decision && <Meta label="Panel" value={relation.panel_decision} />}
        {relation.last_evaluation_date && (
          <Meta label="Last evaluation" value={fmt(relation.last_evaluation_date) ?? ""} />
        )}
        {relation.next_evaluation_date && (
          <Meta label="Next evaluation" value={fmt(relation.next_evaluation_date) ?? ""} />
        )}
        {relation.created_at && (
          <Meta label="Linked" value={fmt(relation.created_at) ?? ""} />
        )}
      </div>

      {relation.inactivated_at && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
          <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          Inactivated {fmt(relation.inactivated_at)}
        </div>
      )}
    </div>

    {/* Card footer: actions */}
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
      <button onClick={onEvaluate}
        className="rounded-lg bg-[#062B49] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0C5381]">
        {relation.last_evaluation_date ? "Update Evaluation" : "Add Evaluation"}
      </button>
      <button onClick={onDevelopmentPlan} disabled={isSendingDevelopmentPlan}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
        {isSendingDevelopmentPlan ? "Opening Plan..." : "Development Plan"}
      </button>
      <button onClick={onViewDetails} disabled={isLoadingDetails}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
        {isLoadingDetails ? "Loading Details..." : "Relation Details"}
      </button>
      <button onClick={onOverride}
        className="rounded-lg border border-[#062B49]/30 bg-white px-4 py-2 text-xs font-semibold text-[#062B49] transition hover:bg-[#062B49]/5">
        Override Status
      </button>
    </div>
  </div>
);

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    <div className="mt-0.5 font-semibold text-slate-700 truncate">{value}</div>
  </div>
);
