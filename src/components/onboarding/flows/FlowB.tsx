/**
 * Flow B - Full guided assignment flow
 */

import React, { useEffect, useState } from "react";
import { AvocarbonSite, SupplierUnitResponse } from "../../../types/onboarding";
import { supplierAPI } from "../../../services/supplierOnboardingAPI";
import { StepIndicator } from "../Stepindicator";
import { FormField, ScopeSelect } from "../ScopeSelect";

interface FlowBProps {
  groupId: number;
  groupName: string;
  units: SupplierUnitResponse[];
  availableSites: AvocarbonSite[];
  selectedUnit?: SupplierUnitResponse | null;
  groupScope?: string | null;
  groupOwner?: string | null;
  onSuccess: (unitId: number) => void;
  onCancel: () => void;
}

interface FlowBForm {
  unitId: number | null;
  siteId: number | null;
  supplierOwner: string;
  supplierScope: string;
}

const STEPS = [
  "Confirm group",
  "Choose unit",
  "Choose site",
  "Ownership",
  "Review",
];
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-300";

export const FlowB: React.FC<FlowBProps> = ({
  groupId,
  groupName,
  units,
  availableSites,
  selectedUnit,
  groupScope,
  groupOwner,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState(selectedUnit ? 2 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");

  const [form, setForm] = useState<FlowBForm>({
    unitId: selectedUnit?.id_supplier_unit ?? null,
    siteId: null,
    supplierOwner: groupScope === "global" ? groupOwner || "" : "",
    supplierScope: groupScope || "local",
  });

  const setField = <K extends keyof FlowBForm>(k: K, v: FlowBForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (form.supplierScope === "global" && groupOwner) {
      setForm((prev) =>
        prev.supplierOwner === groupOwner
          ? prev
          : { ...prev, supplierOwner: groupOwner },
      );
    }
  }, [form.supplierScope, groupOwner]);

  const filteredUnits = unitSearch
    ? units.filter(
        (unit) =>
          unit.supplier_code
            ?.toLowerCase()
            .includes(unitSearch.toLowerCase()) ||
          unit.city?.toLowerCase().includes(unitSearch.toLowerCase()),
      )
    : units;

  const filteredSites = siteSearch
    ? availableSites.filter(
        (site) =>
          site.site_name?.toLowerCase().includes(siteSearch.toLowerCase()) ||
          site.city?.toLowerCase().includes(siteSearch.toLowerCase()),
      )
    : availableSites;

  const resolvedUnit =
    units.find((unit) => unit.id_supplier_unit === form.unitId) ?? selectedUnit;
  const resolvedSite = availableSites.find(
    (site) => site.id_site === form.siteId,
  );
  const usingGlobalDefaultOwner =
    form.supplierScope === "global" &&
    !!groupOwner &&
    form.supplierOwner === groupOwner;

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) return form.unitId !== null;
    if (step === 2) return form.siteId !== null;
    if (step === 3) {
      return (
        form.supplierOwner.trim().length > 0 && form.supplierScope.length > 0
      );
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!form.unitId || !form.siteId) return;
    setSubmitting(true);
    setError(null);
    try {
      await supplierAPI.linkUnitToSite(form.unitId, form.siteId, {
        supplier_owner: form.supplierOwner,
        supplier_scope: form.supplierScope,
      });
      onSuccess(form.unitId);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create relation",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Assign Unit to Site
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Create the local site assignment first. The unit evaluation
            scorecard is recorded afterward from the unit workspace.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      <div className="p-5">
        <StepIndicator steps={STEPS} current={step} />

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        )}

        {step === 0 && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Supplier Group
            </p>
            <h4 className="mt-2 text-xl font-semibold text-slate-900">
              {groupName}
            </h4>
            <p className="mt-2 text-sm text-blue-800">
              Group ID #{groupId} with {units.length} registered unit
              {units.length === 1 ? "" : "s"}.
            </p>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Choose the supplier unit you want to assign to a site.
            </p>
            <input
              type="text"
              placeholder="Search units..."
              value={unitSearch}
              onChange={(event) => setUnitSearch(event.target.value)}
              className={`${inputClass} mb-3`}
            />
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
              {filteredUnits.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  No units found. Use Flow C to create one first.
                </div>
              ) : (
                filteredUnits.map((unit) => (
                  <button
                    key={unit.id_supplier_unit}
                    onClick={() => {
                      setField("unitId", unit.id_supplier_unit);
                      if (form.siteId) {
                        setField("siteId", null);
                      }
                    }}
                    className={`w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${
                      form.unitId === unit.id_supplier_unit
                        ? "bg-blue-50"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold ${
                        form.unitId === unit.id_supplier_unit
                          ? "text-blue-700"
                          : "text-slate-900"
                      }`}
                    >
                      {unit.supplier_code}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[unit.city, unit.country].filter(Boolean).join(", ")}
                      {unit.product_type ? ` · ${unit.product_type}` : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Select the Avocarbon site for{" "}
              <span className="font-semibold text-slate-900">
                {resolvedUnit?.supplier_code}
              </span>
              .
            </p>
            {selectedUnit && form.unitId === selectedUnit.id_supplier_unit && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Starting from the selected unit. You can still go back if you
                want to choose a different unit.
              </div>
            )}
            <input
              type="text"
              placeholder="Search sites..."
              value={siteSearch}
              onChange={(event) => setSiteSearch(event.target.value)}
              className={`${inputClass} mb-3`}
            />
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
              {filteredSites.map((site) => (
                <button
                  key={site.id_site}
                  onClick={() => setField("siteId", site.id_site)}
                  className={`w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${
                    form.siteId === site.id_site
                      ? "bg-blue-50"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`text-sm font-semibold ${
                      form.siteId === site.id_site
                        ? "text-blue-700"
                        : "text-slate-900"
                    }`}
                  >
                    {site.site_name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {[site.city, site.country].filter(Boolean).join(", ")}
                    {!site.active ? " · Inactive" : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Supplier owner *" span={2}>
              <input
                type="email"
                placeholder={
                  form.supplierScope === "global"
                    ? "Global owner email"
                    : "name@avocarbon.com"
                }
                value={form.supplierOwner}
                onChange={(event) =>
                  setField("supplierOwner", event.target.value)
                }
                className={inputClass}
                disabled={form.supplierScope === "global" && !!groupOwner}
              />
            </FormField>

            {/* <FormField label="Relation scope *">
              <ScopeSelect
                value={form.supplierScope}
                onChange={(value) => setField("supplierScope", value)}
              />
            </FormField> */}

            {/* <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">
              {form.supplierScope === "global"
                ? "Global scope uses the supplier group's default owner for new site relations."
                : "Local and regional scopes require an owner email for each site relation."}
            </div> */}
            {usingGlobalDefaultOwner && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                Using the global owner configured on the supplier group.
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SummaryCard
                title="Supplier Unit"
                lines={[
                  resolvedUnit?.supplier_code || "-",
                  [resolvedUnit?.city, resolvedUnit?.country]
                    .filter(Boolean)
                    .join(", ") || "-",
                ]}
              />
              <SummaryCard
                title="Avocarbon Site"
                lines={[
                  resolvedSite?.site_name || "-",
                  [resolvedSite?.city, resolvedSite?.country]
                    .filter(Boolean)
                    .join(", ") || "-",
                ]}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50">
              <ReviewRow label="Owner" value={form.supplierOwner || "-"} />
              <ReviewRow label="Scope" value={form.supplierScope || "-"} />
              <ReviewRow
                label="Evaluation ownership"
                value="Unit-level qualification after assignment"
                last
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((current) => current - 1)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((current) => current + 1)}
              disabled={!canNext()}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                canNext()
                  ? "bg-blue-700 text-white hover:bg-blue-800"
                  : "cursor-not-allowed bg-slate-200 text-slate-400"
              }`}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${
                submitting ? "bg-blue-300" : "bg-blue-700 hover:bg-blue-800"
              }`}
            >
              {submitting ? "Creating..." : "Create relation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ title: string; lines: string[] }> = ({
  title,
  lines,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
      {title}
    </div>
    {lines.map((line, index) => (
      <div
        key={`${title}-${index}`}
        className={
          index === 0
            ? "mt-3 text-sm font-semibold text-slate-900"
            : "mt-1 text-xs text-slate-500"
        }
      >
        {line || "-"}
      </div>
    ))}
  </div>
);

const ReviewRow: React.FC<{ label: string; value: string; last?: boolean }> = ({
  label,
  value,
  last = false,
}) => (
  <div
    className={`flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center ${
      last ? "" : "border-b border-slate-200"
    }`}
  >
    <span className="w-full shrink-0 text-slate-500 sm:w-40">{label}</span>
    <span className="font-medium text-slate-900">{value}</span>
  </div>
);
