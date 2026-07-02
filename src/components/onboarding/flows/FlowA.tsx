/**
 * Flow A - Link an existing unit to an Avocarbon site
 */

import React, { useState } from "react";
import { supplierAPI } from "../../../services/supplierOnboardingAPI";
import { AvocarbonSite, SupplierUnitResponse } from "../../../types/onboarding";
import { StepIndicator } from "../Stepindicator";
import { FormField, ScopeSelect } from "../ScopeSelect";
import { PurchaserOwnerField } from "../PurchaserOwnerField";

interface FlowAProps {
  groupId: number;
  units: SupplierUnitResponse[];
  availableSites: AvocarbonSite[];
  selectedUnit: SupplierUnitResponse | null;
  onSelectUnit: (u: SupplierUnitResponse) => void;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FlowAState {
  unitId: number | null;
  siteId: number | null;
  supplierOwner: string;
  supplierScope: string;
  operationalGrade: string;
  classValue: string;
  launchEvaluation: boolean;
}

const STEPS = ["Select unit", "Select site", "Owner and scope", "Review"];
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-300";

export const FlowA: React.FC<FlowAProps> = ({
  units,
  availableSites,
  selectedUnit,
  onSelectUnit,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState(selectedUnit ? 1 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");

  const [form, setForm] = useState<FlowAState>({
    unitId: selectedUnit?.id_supplier_unit ?? null,
    siteId: null,
    supplierOwner: "",
    supplierScope: "local",
    operationalGrade: "",
    classValue: "",
    launchEvaluation: false,
  });

  const setField = <K extends keyof FlowAState>(k: K, v: FlowAState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const filteredUnits = unitSearch
    ? units.filter(
        (unit) =>
          unit.supplier_name?.toLowerCase().includes(unitSearch.toLowerCase()) ||
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

  const selectedSite = availableSites.find((site) => site.id_site === form.siteId);
  const resolvedUnit =
    units.find((unit) => unit.id_supplier_unit === form.unitId) ?? selectedUnit;

  const canNext = () => {
    if (step === 0) return form.unitId !== null;
    if (step === 1) return form.siteId !== null;
    if (step === 2) {
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
        operational_grade: form.operationalGrade || undefined,
        class_value: form.classValue ? Number(form.classValue) : undefined,
      });
      onSuccess();
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
            Flow A - Link Existing Unit
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Search for a unit that already exists, then assign it to one
            Avocarbon site.
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
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Search and select the unit you want to link.
            </p>
            <input
              type="text"
              placeholder="Search by code, city, or country..."
              value={unitSearch}
              onChange={(event) => setUnitSearch(event.target.value)}
              className={`${inputClass} mb-3`}
            />
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
              {filteredUnits.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  No units found.
                </div>
              ) : (
                filteredUnits.map((unit) => (
                  <button
                    key={unit.id_supplier_unit}
                    onClick={() => {
                      setField("unitId", unit.id_supplier_unit);
                      onSelectUnit(unit);
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
                      {unit.supplier_name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[unit.city, unit.country].filter(Boolean).join(", ")}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Linking unit <span className="font-semibold text-slate-900">{resolvedUnit?.supplier_name}</span>.
              Select the Avocarbon site next.
            </p>
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
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Supplier owner *" span={2}>
              {form.siteId !== null ? (
                <PurchaserOwnerField
                  siteId={form.siteId}
                  value={form.supplierOwner}
                  onChange={(email) => setField("supplierOwner", email)}
                  siteName={selectedSite?.site_name}
                />
              ) : (
                <input
                  type="text"
                  placeholder="name@avocarbon.com"
                  value={form.supplierOwner}
                  onChange={(event) => setField("supplierOwner", event.target.value)}
                  className={inputClass}
                />
              )}
            </FormField>

            <FormField label="Relation scope *">
              <ScopeSelect
                value={form.supplierScope}
                onChange={(value) => setField("supplierScope", value)}
              />
            </FormField>

            <div className="space-y-4">
              <FormField label="Initial operational grade">
                <select
                  value={form.operationalGrade}
                  onChange={(event) =>
                    setField("operationalGrade", event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Select</option>
                  {["A", "B", "C", "D"].map((grade) => (
                    <option key={grade}>{grade}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Initial class value">
                <select
                  value={form.classValue}
                  onChange={(event) => setField("classValue", event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </FormField>
            </div>

            <FormField label="Launch baseline evaluation?" span={2}>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.launchEvaluation}
                  onChange={(event) =>
                    setField("launchEvaluation", event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  Create an evaluation cycle after linking this unit to the
                  site.
                </span>
              </label>
            </FormField>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50">
            <ReviewRow label="Unit" value={resolvedUnit?.supplier_name || "-"} />
            <ReviewRow
              label="Location"
              value={
                [resolvedUnit?.city, resolvedUnit?.country]
                  .filter(Boolean)
                  .join(", ") || "-"
              }
            />
            <ReviewRow label="Site" value={selectedSite?.site_name || "-"} />
            <ReviewRow
              label="Site location"
              value={
                [selectedSite?.city, selectedSite?.country]
                  .filter(Boolean)
                  .join(", ") || "-"
              }
            />
            <ReviewRow label="Owner" value={form.supplierOwner || "-"} />
            <ReviewRow label="Scope" value={form.supplierScope || "-"} />
            <ReviewRow
              label="Operational grade"
              value={form.operationalGrade || "-"}
            />
            <ReviewRow label="Class value" value={form.classValue || "-"} />
            <ReviewRow
              label="Launch evaluation"
              value={form.launchEvaluation ? "Yes" : "No"}
              last
            />
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
