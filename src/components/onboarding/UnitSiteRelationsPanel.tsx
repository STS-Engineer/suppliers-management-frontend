/**
 * UnitSiteRelationsPanel
 * Displays all site relations for the currently selected unit.
 */

import React from "react";
import {
  AvocarbonSite,
  SupplierSiteRelation,
  SupplierUnitResponse,
  UnitEvaluationSummary,
} from "../../types/onboarding";

interface Props {
  selectedUnit: SupplierUnitResponse | null;
  siteRelations: SupplierSiteRelation[];
  summary: UnitEvaluationSummary | null;
  availableSites: AvocarbonSite[];
  isLoading: boolean;
  onEvaluate: (relation: SupplierSiteRelation) => void;
  onOverrideStatus: (relation: SupplierSiteRelation) => void;
  onUnlink: (r: SupplierSiteRelation) => void;
  onRelinkSuccess: () => void;
}

const SCOPE_CLASSES: Record<string, string> = {
  global: "bg-blue-50 text-blue-700",
  regional: "bg-green-50 text-green-700",
  local: "bg-amber-50 text-amber-700",
  strategic: "bg-fuchsia-50 text-fuchsia-700",
};

const GRADE_CLASSES: Record<string, string> = {
  A: "bg-green-50 text-green-700",
  B: "bg-blue-50 text-blue-700",
  C: "bg-amber-50 text-amber-700",
  D: "bg-red-50 text-red-700",
};

export const UnitSiteRelationsPanel: React.FC<Props> = ({
  selectedUnit,
  siteRelations,
  summary,
  availableSites,
  isLoading,
  onEvaluate,
  onOverrideStatus,
  onUnlink,
}) => {
  const getSiteName = (siteId: number) => {
    const site = availableSites.find((entry) => entry.id_site === siteId);
    return site ? site.site_name : `Site #${siteId}`;
  };

  const getSiteLocation = (siteId: number) => {
    const site = availableSites.find((entry) => entry.id_site === siteId);
    return site ? [site.city, site.country].filter(Boolean).join(", ") : "";
  };

  const formatDate = (value?: string | null) => {
    if (!value) return null;
    try {
      return new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return value;
    }
  };

  if (!selectedUnit) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 text-center text-slate-400">
          <svg
            width="40"
            height="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            className="mx-auto mb-3 opacity-40"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m0 0a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <p className="text-sm font-medium text-slate-600">Select a unit</p>
          <p className="mt-1 text-xs">
            Choose a unit on the left to view its site relations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Site Relations -{" "}
            {selectedUnit.unit_code ||
              `UNT-${String(selectedUnit.id_supplier_unit).padStart(6, "0")}`}
          </h2>
          <p className="mt-1 text-[11px] font-medium text-slate-400">
            Supplier code: {selectedUnit.supplier_code}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {[selectedUnit.city, selectedUnit.country]
              .filter(Boolean)
              .join(", ")}
            {selectedUnit.product_type ? ` · ${selectedUnit.product_type}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary?.final_grade ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                Latest relation grade {summary.final_grade}
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                Evaluate each site relation separately
              </span>
            )}
            {summary?.panel_decision && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {summary.panel_decision}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {siteRelations.length} relation
            {siteRelations.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Loading relations...
          </div>
        ) : siteRelations.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <svg
              width="36"
              height="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              className="mx-auto mb-3 opacity-40"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <p className="text-sm font-medium text-slate-600">
              No site relations yet
            </p>
            <p className="mt-1 text-xs">
              Assign this unit to a site first, then record its initial
              evaluation scorecard.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {siteRelations.map((relation) => {
              const scopeClass =
                SCOPE_CLASSES[relation.supplier_scope ?? "local"] ??
                SCOPE_CLASSES.local;
              const gradeClass = relation.operational_grade
                ? (GRADE_CLASSES[relation.operational_grade] ?? GRADE_CLASSES.B)
                : null;

              return (
                <div
                  key={relation.id_relation}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {getSiteName(relation.id_site)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          {relation.relation_code ||
                            `REL-${String(relation.id_relation).padStart(6, "0")}`}
                        </span>
                        {relation.supplier_scope && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${scopeClass}`}
                          >
                            {relation.supplier_scope}
                          </span>
                        )}
                        {relation.operational_grade && gradeClass && (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${gradeClass}`}
                          >
                            Grade {relation.operational_grade}
                            {relation.class_value
                              ? ` · Class ${relation.class_value}`
                              : ""}
                          </span>
                        )}
                        {relation.supplier_status && (
                          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {relation.supplier_status}
                          </span>
                        )}
                      </div>

                      <p className="mb-3 text-xs text-slate-500">
                        {getSiteLocation(relation.id_site)}
                      </p>

                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {relation.supplier_owner && (
                          <MetaItem
                            label="Owner"
                            value={relation.supplier_owner}
                          />
                        )}
                        {relation.evaluation_frequency && (
                          <MetaItem
                            label="Frequency"
                            value={relation.evaluation_frequency}
                          />
                        )}
                        {relation.strategic_mention &&
                          relation.strategic_mention !== "none" && (
                            <MetaItem
                              label="Strategic"
                              value={relation.strategic_mention}
                            />
                          )}
                        {relation.panel_decision && (
                          <MetaItem
                            label="Panel"
                            value={relation.panel_decision}
                          />
                        )}
                        {relation.created_at && (
                          <MetaItem
                            label="Created"
                            value={formatDate(relation.created_at) ?? ""}
                          />
                        )}
                        {relation.last_evaluation_date && (
                          <MetaItem
                            label="Last evaluation"
                            value={
                              formatDate(relation.last_evaluation_date) ?? ""
                            }
                          />
                        )}
                        {relation.next_evaluation_date && (
                          <MetaItem
                            label="Next evaluation"
                            value={
                              formatDate(relation.next_evaluation_date) ?? ""
                            }
                          />
                        )}
                      </div>

                      {relation.inactivated_at && (
                        <div className="mt-3 inline-flex rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                          Inactivated: {formatDate(relation.inactivated_at)}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <div className="mb-2 flex gap-2">
                        <button
                          onClick={() => onEvaluate(relation)}
                          className="block rounded-xl bg-[#0f2744] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#133155]"
                        >
                          {relation.last_evaluation_date
                            ? "Update evaluation"
                            : "Add evaluation"}
                        </button>
                        <button
                          onClick={() => onOverrideStatus(relation)}
                          className="block rounded-xl border border-[#0f2744] bg-white px-3 py-2 text-xs font-semibold text-[#0f2744] transition hover:bg-slate-50"
                        >
                          Override Supplier Status
                        </button>
                      </div>
                      {/* <button
                        onClick={() => onUnlink(relation)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        Unlink
                      </button> */}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const MetaItem: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="font-medium text-slate-400">{label}:</span>
    <span className="font-medium text-slate-700">{value}</span>
  </div>
);
