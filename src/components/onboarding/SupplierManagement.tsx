/**
 * SupplierManagement - Phase 2 workspace for unit and site assignment
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AvocarbonSite,
  RelationEvaluationWorkspace,
  SupplierSiteRelation,
  SupplierStatusOverride,
  UnitEvaluationSummary,
  SupplierUnitResponse,
} from "../../types/onboarding";
import { supplierAPI } from "../../services/supplierOnboardingAPI";
import { FlowB } from "./flows/FlowB";
import { FlowC } from "./flows/FlowC";
import { UnitSiteRelationsPanel } from "./UnitSiteRelationsPanel";
import { MetricCard, PageIntro, SectionCard } from "../UI";

export type ActiveFlow = "assign" | "createUnit" | null;

export interface SupplierManagementProps {
  groupId: number;
  groupName: string;
  initialGroupScope?: string | null;
  initialGroupOwner?: string | null;
  onClose?: () => void;
}

interface SharedState {
  groupScope: string | null;
  groupOwner: string | null;
  units: SupplierUnitResponse[];
  evaluationSummaryByUnit: Record<number, UnitEvaluationSummary>;
  availableSites: AvocarbonSite[];
  selectedUnit: SupplierUnitResponse | null;
  siteRelations: SupplierSiteRelation[];
  isLoadingUnits: boolean;
  isLoadingSites: boolean;
  isLoadingRelations: boolean;
  error: string | null;
}

export const SupplierManagement: React.FC<SupplierManagementProps> = ({
  groupId,
  groupName,
  initialGroupScope,
  initialGroupOwner,
  onClose,
}) => {
  const navigate = useNavigate();
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [overrideModalRelation, setOverrideModalRelation] =
    useState<SupplierSiteRelation | null>(null);
  const [overrideWorkspace, setOverrideWorkspace] =
    useState<RelationEvaluationWorkspace | null>(null);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDate, setOverrideDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [isLoadingOverride, setIsLoadingOverride] = useState(false);
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [shared, setShared] = useState<SharedState>({
    groupScope: initialGroupScope ?? null,
    groupOwner: initialGroupOwner ?? null,
    units: [],
    evaluationSummaryByUnit: {},
    availableSites: [],
    selectedUnit: null,
    siteRelations: [],
    isLoadingUnits: false,
    isLoadingSites: false,
    isLoadingRelations: false,
    error: null,
  });

  const setError = (error: string | null) =>
    setShared((prev) => ({ ...prev, error }));

  const loadUnits = useCallback(async () => {
    setShared((prev) => ({ ...prev, isLoadingUnits: true, error: null }));
    try {
      const response = await supplierAPI.listUnitsForGroup(groupId);
      setShared((prev) => ({
        ...prev,
        units: response.data?.units || [],
        isLoadingUnits: false,
      }));
      const loadedUnits: SupplierUnitResponse[] = response.data?.units || [];
      const summaries = await Promise.all(
        loadedUnits.map(async (unit) => {
          try {
            const summaryResponse = await supplierAPI.getUnitEvaluationSummary(
              unit.id_supplier_unit
            );
            return [unit.id_supplier_unit, summaryResponse.data] as const;
          } catch {
            return [
              unit.id_supplier_unit,
              {
                unit_id: unit.id_supplier_unit,
                site_relations_count: 0,
              } as UnitEvaluationSummary,
            ] as const;
          }
        })
      );
      setShared((prev) => ({
        ...prev,
        evaluationSummaryByUnit: Object.fromEntries(summaries),
      }));
    } catch (error) {
      setShared((prev) => ({
        ...prev,
        isLoadingUnits: false,
        error: error instanceof Error ? error.message : "Failed to load units",
      }));
    }
  }, [groupId]);

  const loadGroupContext = useCallback(async () => {
    try {
      const response = await supplierAPI.getSupplierGroup(groupId);
      setShared((prev) => ({
        ...prev,
        groupScope: response.data?.supplier_scope || prev.groupScope || null,
        groupOwner: response.data?.supplier_owner || prev.groupOwner || null,
      }));
    } catch {
      setShared((prev) => ({
        ...prev,
        groupScope: prev.groupScope || null,
        groupOwner: prev.groupOwner || null,
      }));
    }
  }, [groupId]);

  const loadSites = useCallback(async () => {
    setShared((prev) => ({ ...prev, isLoadingSites: true }));
    try {
      const response = await supplierAPI.listSites();
      const availableSites = Array.isArray(response.data) ? response.data : [];
      setShared((prev) => ({
        ...prev,
        availableSites,
        isLoadingSites: false,
      }));
    } catch {
      setShared((prev) => ({
        ...prev,
        availableSites: [],
        isLoadingSites: false,
      }));
    }
  }, []);

  const loadRelationsForUnit = useCallback(async (unitId: number) => {
    setShared((prev) => ({ ...prev, isLoadingRelations: true }));
    try {
      const response = await supplierAPI.listSitesForUnit(unitId);
      setShared((prev) => ({
        ...prev,
        siteRelations: response.data?.relations || [],
        isLoadingRelations: false,
      }));
    } catch {
      setShared((prev) => ({
        ...prev,
        siteRelations: [],
        isLoadingRelations: false,
      }));
    }
  }, []);

  const selectUnit = useCallback(
    (unit: SupplierUnitResponse) => {
      setShared((prev) => ({ ...prev, selectedUnit: unit }));
      loadRelationsForUnit(unit.id_supplier_unit);
    },
    [loadRelationsForUnit],
  );

  const handleRelationUnlink = async (relation: SupplierSiteRelation) => {
    if (!window.confirm("Remove this site relation?")) {
      return;
    }

    try {
      await supplierAPI.unlinkUnitFromSite(
        relation.id_supplier_unit,
        relation.id_site,
      );
      if (shared.selectedUnit) {
        await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to unlink");
    }
  };

  const openOverrideModal = useCallback(async (relation: SupplierSiteRelation) => {
    setOverrideModalRelation(relation);
    setIsLoadingOverride(true);
    setOverrideWorkspace(null);
    setOverrideReason("");
    setOverrideDate(new Date().toISOString().slice(0, 10));
    try {
      const response = await supplierAPI.getRelationEvaluationWorkspace(
        relation.id_relation,
      );
      const workspace = response.data as RelationEvaluationWorkspace;
      setOverrideWorkspace(workspace);
      setOverrideStatus(
        workspace.effective_supplier_status ||
          relation.supplier_status ||
          workspace.computed_supplier_status ||
          "",
      );
      setOverrideReason(workspace.status_override?.reason || "");
      setOverrideDate(
        workspace.status_override?.changed_at
          ? new Date(workspace.status_override.changed_at)
              .toISOString()
              .slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load supplier status override data",
      );
    } finally {
      setIsLoadingOverride(false);
    }
  }, []);

  const closeOverrideModal = () => {
    setOverrideModalRelation(null);
    setOverrideWorkspace(null);
    setOverrideReason("");
  };

  const saveOverride = async () => {
    if (!overrideModalRelation) return;
    if (!overrideStatus.trim() || !overrideReason.trim()) {
      setError("Override status and reason are required.");
      return;
    }

    setIsSavingOverride(true);
    try {
      await supplierAPI.overrideRelationSupplierStatus(
        overrideModalRelation.id_relation,
        {
          supplier_status: overrideStatus,
          reason: overrideReason,
          override_date: overrideDate ? `${overrideDate}T00:00:00` : undefined,
        },
      );
      if (shared.selectedUnit) {
        await loadRelationsForUnit(shared.selectedUnit.id_supplier_unit);
        await loadUnits();
      }
      closeOverrideModal();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to override supplier status",
      );
    } finally {
      setIsSavingOverride(false);
    }
  };

  useEffect(() => {
    loadGroupContext();
    loadUnits();
    loadSites();
  }, [loadGroupContext, loadSites, loadUnits]);

  const flowConfig = [
    {
      id: "assign" as ActiveFlow,
      label: shared.selectedUnit ? "Assign Selected Unit" : "Assign Unit to Site",
      description: shared.selectedUnit
        ? "Continue with the selected unit and assign it to an Avocarbon site."
        : "Use the primary assignment flow to choose a unit, choose a site, and set owner and scope.",
    },
    {
      id: "createUnit" as ActiveFlow,
      label: "Add Another Unit",
      description: "Create an additional unit under this supplier group first.",
    },
  ];

  const infoCards = [
    { label: "Units", value: shared.units.length },
    {
      label: "Selected Unit",
      value:
        shared.selectedUnit?.unit_code ||
        (shared.selectedUnit
          ? `UNT-${String(shared.selectedUnit.id_supplier_unit).padStart(6, "0")}`
          : "-"),
    },
    { label: "Site Relations", value: shared.siteRelations.length },
    {
      label: "Latest Unit Grade",
      value:
        (shared.selectedUnit &&
          shared.evaluationSummaryByUnit[shared.selectedUnit.id_supplier_unit]
            ?.final_grade) ||
        "-",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-6 px-2">
      <PageIntro
        eyebrow="Lifecycle Phase 2"
        title={groupName}
        description="Manage units, assign them to Avocarbon sites, and define owner and scope before relation-level evaluation starts."
        actions={
          onClose ? (
            <button
              onClick={onClose}
              className="inline-flex items-center rounded-2xl border border-white/20 bg-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/18"
            >
              Back to Master
            </button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {infoCards.map((item) => (
            <MetricCard key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </PageIntro>

      <div className="pb-1">
        {shared.error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <span>{shared.error}</span>
            <button
              onClick={() => setError(null)}
              className="rounded-md px-2 py-1 font-semibold text-red-900 transition hover:bg-red-100"
            >
              Close
            </button>
          </div>
        )}

        <SectionCard
          title="Site Assignment Workspace"
          subtitle="Continue with one primary assignment flow or create another unit for this supplier group."
        >

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {flowConfig.map((flow) => {
              const active = activeFlow === flow.id;
              return (
                <button
                  key={flow.id}
                  onClick={() => setActiveFlow(active ? null : flow.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    active
                      ? "border-blue-700 bg-blue-700 shadow-md"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div
                    className={`text-sm font-semibold ${
                      active ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {flow.label}
                  </div>
                  <p
                    className={`mt-2 text-xs leading-5 ${
                      active ? "text-blue-100" : "text-slate-500"
                    }`}
                  >
                    {flow.description}
                  </p>
                </button>
              );
            })}
          </div>

          {!shared.selectedUnit && (
            <p className="mt-4 text-xs text-slate-500">
              Tip: select a unit from the list below first if you want the
              assignment flow to start from that unit.
            </p>
          )}
        </SectionCard>

        {activeFlow === "assign" && (
          <FlowB
            groupId={groupId}
            groupName={groupName}
            units={shared.units}
            availableSites={shared.availableSites}
            selectedUnit={shared.selectedUnit}
            groupScope={shared.groupScope}
            groupOwner={shared.groupOwner}
            onSuccess={async (unitId) => {
              await loadUnits();
              await loadRelationsForUnit(unitId);
              setActiveFlow(null);
            }}
            onCancel={() => setActiveFlow(null)}
          />
        )}

        {activeFlow === "createUnit" && (
          <FlowC
            groupId={groupId}
            onSuccess={async () => {
              await loadUnits();
              setActiveFlow(null);
            }}
            onCancel={() => setActiveFlow(null)}
          />
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Supplier Units
                </h2>
                <p className="text-xs text-slate-500">
                  Select a unit to inspect or update its site relations.
                </p>
              </div>
              {shared.isLoadingUnits && (
                <span className="text-xs text-slate-400">Loading...</span>
              )}
            </div>

            <div className="border-b border-slate-100 px-4 py-4">
              <UnitSearchBox
                units={shared.units}
                onSelect={selectUnit}
                selectedUnitId={shared.selectedUnit?.id_supplier_unit ?? null}
              />
            </div>

            <div className="max-h-[520px] overflow-y-auto">
              {shared.units.length === 0 && !shared.isLoadingUnits ? (
                <div className="px-6 py-10 text-center text-sm text-slate-400">
                  No units yet. Create a unit first, then assign it to a site.
                </div>
              ) : (
                shared.units.map((unit) => (
                  <UnitCard
                    key={unit.id_supplier_unit}
                    unit={unit}
                    summary={shared.evaluationSummaryByUnit[unit.id_supplier_unit]}
                    isSelected={
                      shared.selectedUnit?.id_supplier_unit ===
                      unit.id_supplier_unit
                    }
                    onClick={() => selectUnit(unit)}
                  />
                ))
              )}
            </div>
          </div>

          <UnitSiteRelationsPanel
            selectedUnit={shared.selectedUnit}
            siteRelations={shared.siteRelations}
            summary={
              shared.selectedUnit
                ? shared.evaluationSummaryByUnit[
                    shared.selectedUnit.id_supplier_unit
                  ] || null
                : null
            }
            availableSites={shared.availableSites}
            isLoading={shared.isLoadingRelations}
            onEvaluate={(relation) => {
              navigate(`/supplier-relations/${relation.id_relation}/evaluation`);
            }}
            onOverrideStatus={openOverrideModal}
            onUnlink={handleRelationUnlink}
            onRelinkSuccess={() =>
              shared.selectedUnit &&
              loadRelationsForUnit(shared.selectedUnit.id_supplier_unit)
            }
          />
        </div>
      </div>

      {overrideModalRelation && (
        <StatusOverrideModal
          relation={overrideModalRelation}
          workspace={overrideWorkspace}
          status={overrideStatus}
          reason={overrideReason}
          overrideDate={overrideDate}
          isLoading={isLoadingOverride}
          isSaving={isSavingOverride}
          onClose={closeOverrideModal}
          onStatusChange={setOverrideStatus}
          onReasonChange={setOverrideReason}
          onDateChange={setOverrideDate}
          onSubmit={saveOverride}
        />
      )}
    </div>
  );
};

const StatusOverrideModal: React.FC<{
  relation: SupplierSiteRelation;
  workspace: RelationEvaluationWorkspace | null;
  status: string;
  reason: string;
  overrideDate: string;
  isLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onStatusChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onSubmit: () => void;
}> = ({
  relation,
  workspace,
  status,
  reason,
  overrideDate,
  isLoading,
  isSaving,
  onClose,
  onStatusChange,
  onReasonChange,
  onDateChange,
  onSubmit,
}) => {
  const activeOverride = workspace?.status_override as SupplierStatusOverride | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Supplier Status Override
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {relation.relation_code ||
                `REL-${String(relation.id_relation).padStart(6, "0")}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading override data...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <StatusInfoCard
                  label="Computed Status"
                  value={workspace?.computed_supplier_status || "Pending"}
                />
                <StatusInfoCard
                  label="Current Status"
                  value={workspace?.effective_supplier_status || relation.supplier_status || "Pending"}
                />
              </div>

              {activeOverride?.active && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Active override: {activeOverride.status || "N/A"} on{" "}
                  {formatDateTime(activeOverride.changed_at)}.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Override Status
                  </label>
                  <select
                    value={status}
                    onChange={(event) => onStatusChange(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0f2744]"
                  >
                    <option value="">Select status</option>
                    <option value="Can Quote and Be Awarded">
                      Can Quote and Be Awarded
                    </option>
                    <option value="Can Quote but Not be Awarded">
                      Can Quote but Not be Awarded
                    </option>
                    <option value="New business on Hold">
                      New business on Hold
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Override Date
                  </label>
                  <input
                    type="date"
                    value={overrideDate}
                    onChange={(event) => onDateChange(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0f2744]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Override Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(event) => onReasonChange(event.target.value)}
                  rows={4}
                  placeholder="Explain why the supplier status must be overridden."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0f2744]"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoading || isSaving}
            onClick={onSubmit}
            className="rounded-xl bg-[#0f2744] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#133155] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Override Supplier Status"}
          </button>
        </div>
      </div>
    </div>
  );
};

const StatusInfoCard: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      {label}
    </div>
    <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
  </div>
);

const formatDateTime = (value?: string | null) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const UnitSearchBox: React.FC<{
  units: SupplierUnitResponse[];
  onSelect: (unit: SupplierUnitResponse) => void;
  selectedUnitId: number | null;
}> = ({ units, onSelect, selectedUnitId }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered =
    query.length > 0
      ? units.filter(
          (unit) =>
            unit.supplier_code?.toLowerCase().includes(query.toLowerCase()) ||
            unit.city?.toLowerCase().includes(query.toLowerCase()) ||
            unit.country?.toLowerCase().includes(query.toLowerCase()),
        )
      : [];

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search by code, city, or country..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
      />

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {filtered.map((unit) => (
            <button
              key={unit.id_supplier_unit}
              onMouseDown={() => {
                onSelect(unit);
                setQuery("");
                setOpen(false);
              }}
              className={`w-full border-b border-slate-100 px-3 py-3 text-left text-sm last:border-b-0 ${
                selectedUnitId === unit.id_supplier_unit
                  ? "bg-blue-50"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold text-slate-900">
                {unit.unit_code ||
                  `UNT-${String(unit.id_supplier_unit).padStart(6, "0")}`}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {[unit.city, unit.country].filter(Boolean).join(", ")}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const UnitCard: React.FC<{
  unit: SupplierUnitResponse;
  summary?: UnitEvaluationSummary;
  isSelected: boolean;
  onClick: () => void;
}> = ({ unit, summary, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full border-b border-slate-100 px-4 py-4 text-left transition ${
      isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <div
          className={`text-sm font-semibold ${
            isSelected ? "text-blue-700" : "text-slate-900"
          }`}
        >
          {unit.unit_code || `UNT-${String(unit.id_supplier_unit).padStart(6, "0")}`}
        </div>
        <div className="mt-1 text-[11px] text-slate-400">{unit.supplier_code}</div>
        {(unit.city || unit.country) && (
          <div className="mt-1 text-xs text-slate-500">
            {[unit.city, unit.country].filter(Boolean).join(", ")}
          </div>
        )}
        {unit.product_type && (
          <div className="mt-1 text-[11px] text-slate-400">
            {unit.product_type}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {summary?.final_grade ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              Grade {summary.final_grade}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
              Evaluation pending
            </span>
          )}
          {summary?.panel_decision && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
              {summary.panel_decision}
            </span>
          )}
        </div>
      </div>

      {isSelected && (
        <span className="rounded-md bg-blue-700 px-2 py-1 text-[10px] font-semibold text-white">
          Selected
        </span>
      )}
    </div>
  </button>
);
