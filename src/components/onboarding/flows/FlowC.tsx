/**
 * Flow C - Add another unit to an existing supplier group
 */

import React, { useEffect, useState } from "react";
import { supplierAPI } from "../../../services/supplierOnboardingAPI";
import { OnboardingSelectionOptions } from "../../../types/onboarding";
import { getCertificationTypeOptions } from "../../../utils/onboarding";
import { FormField } from "../ScopeSelect";

interface FlowCProps {
  groupId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

interface UnitForm {
  supplier_code: string;
  address_line: string;
  city: string;
  country: string;
  product_type: string;
  product_category: string;
  amount_value: string;
  amount_currency: string;
}

interface UnitCertificationForm {
  certification_type: string;
  certificate_name: string;
  start_date: string;
  end_date: string;
  comments: string;
}

type UnitCertificationErrors = Partial<
  Record<keyof UnitCertificationForm, string>
>;

const EMPTY: UnitForm = {
  supplier_code: "",
  address_line: "",
  city: "",
  country: "",
  product_type: "",
  product_category: "",
  amount_value: "",
  amount_currency: "USD",
};

const EMPTY_CERTIFICATION: UnitCertificationForm = {
  certification_type: "",
  certificate_name: "",
  start_date: "",
  end_date: "",
  comments: "",
};

const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "CNY", "MAD", "TND"];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-300";

type CertificationOptionList = ReadonlyArray<
  OnboardingSelectionOptions["certification_types"][number]
>;

export const FlowC: React.FC<FlowCProps> = ({
  groupId,
  onSuccess,
  onCancel,
}) => {
  const [form, setForm] = useState<UnitForm>(EMPTY);

  const [certifications, setCertifications] = useState<UnitCertificationForm[]>(
    [{ ...EMPTY_CERTIFICATION }],
  );

  const [errors, setErrors] = useState<Partial<UnitForm>>({});

  const [certificationErrors, setCertificationErrors] = useState<
    Record<number, UnitCertificationErrors>
  >({});

  const [submitting, setSubmitting] = useState(false);
  const [certSubmitting, setCertSubmitting] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);

  const [createdUnitId, setCreatedUnitId] = useState<number | null>(null);

  const [unitCreatedMessage, setUnitCreatedMessage] = useState<string | null>(
    null,
  );

  const [certificationOptions, setCertificationOptions] =
    useState<CertificationOptionList>(getCertificationTypeOptions());

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      try {
        const response = await supplierAPI.getOnboardingOptions();

        if (!active || !response?.data?.certification_types) {
          return;
        }

        setCertificationOptions(response.data.certification_types);
      } catch {
        // fallback to local defaults
      }
    };

    loadOptions();

    return () => {
      active = false;
    };
  }, []);

  const setField = <K extends keyof UnitForm>(key: K, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));

    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const setCertificationField = (
    index: number,
    key: keyof UnitCertificationForm,
    value: string,
  ) => {
    setCertifications((prev) =>
      prev.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    );

    if (
      certificationErrors[index]?.[key] ||
      certificationErrors[index]?.end_date
    ) {
      setCertificationErrors((prev) => {
        const next = { ...prev };
        const nextRow = { ...(next[index] || {}) };

        delete nextRow[key];

        if (key === "start_date" || key === "end_date") {
          delete nextRow.end_date;
        }

        if (Object.keys(nextRow).length === 0) {
          delete next[index];
        } else {
          next[index] = nextRow;
        }

        return next;
      });
    }
  };

  const addCertification = () => {
    setCertifications((prev) => [...prev, { ...EMPTY_CERTIFICATION }]);
  };

  const removeCertification = (index: number) => {
    setCertifications((prev) =>
      prev.filter((_, entryIndex) => entryIndex !== index),
    );

    setCertificationErrors((prev) => {
      const next: Record<number, UnitCertificationErrors> = {};

      Object.entries(prev).forEach(([key, value]) => {
        const entryIndex = Number(key);

        if (entryIndex < index) {
          next[entryIndex] = value;
        } else if (entryIndex > index) {
          next[entryIndex - 1] = value;
        }
      });

      return next;
    });
  };

  const validateUnit = () => {
    const nextErrors: Partial<UnitForm> = {};

    if (!form.supplier_code.trim()) {
      nextErrors.supplier_code = "Supplier name is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateCertifications = () => {
    const nextCertificationErrors: Record<number, UnitCertificationErrors> = {};

    certifications.forEach((entry, index) => {
      const rowErrors: UnitCertificationErrors = {};
      const hasAnyValue =
        entry.certification_type.trim() ||
        entry.certificate_name.trim() ||
        entry.start_date ||
        entry.end_date ||
        entry.comments.trim();

      if (!hasAnyValue) return;

      if (!entry.certification_type.trim()) {
        rowErrors.certification_type =
          "Certification type is required when adding a certification";
      }

      if (
        entry.start_date &&
        entry.end_date &&
        entry.end_date < entry.start_date
      ) {
        rowErrors.end_date = "Expiry date must be on or after start date";
      }

      if (Object.keys(rowErrors).length > 0) {
        nextCertificationErrors[index] = rowErrors;
      }
    });

    setCertificationErrors(nextCertificationErrors);
    return Object.keys(nextCertificationErrors).length === 0;
  };

  const handleCreateUnit = async () => {
    if (!validateUnit()) return;

    setSubmitting(true);
    setApiError(null);
    setUnitCreatedMessage(null);

    try {
      const payload = {
        ...form,
        amount_value: form.amount_value ? parseFloat(form.amount_value) : null,
      };

      const createUnitResponse = await supplierAPI.createSupplierUnit(
        groupId,
        payload,
      );
      const unitId = createUnitResponse?.data?.id_supplier_unit;

      if (!unitId) {
        throw new Error("Unit created but no unit id was returned");
      }

      setCreatedUnitId(unitId);
      setUnitCreatedMessage(
        "Unit created successfully. You can now add certifications.",
      );
    } catch (submitError) {
      setApiError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create unit",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCertifications = async () => {
    if (!createdUnitId) return;
    if (!validateCertifications()) return;

    setCertSubmitting(true);
    setApiError(null);

    try {
      const certificationsToCreate = certifications.filter(
        (entry) =>
          entry.certification_type.trim() ||
          entry.certificate_name.trim() ||
          entry.start_date ||
          entry.end_date ||
          entry.comments.trim(),
      );

      for (const certification of certificationsToCreate) {
        await supplierAPI.addCertificationToUnit(createdUnitId, {
          certification_type: certification.certification_type,
          certificate_name: certification.certificate_name || null,
          start_date: certification.start_date || null,
          end_date: certification.end_date || null,
          comments: certification.comments || null,
        });
      }

      onSuccess();
    } catch (submitError) {
      setApiError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to add certifications",
      );
    } finally {
      setCertSubmitting(false);
    }
  };

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Flow C - Add Another Unit
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Create a new operating or manufacturing unit inside this supplier
            group.
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
        {apiError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {apiError}
          </div>
        )}

        {unitCreatedMessage && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            {unitCreatedMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Supplier code *"
            error={errors.supplier_code}
            span={2}
          >
            <input
              type="text"
              disabled={createdUnitId !== null}
              placeholder="e.g. ACME-DE-002"
              value={form.supplier_code}
              onChange={(event) =>
                setField("supplier_code", event.target.value)
              }
              className={inputClass}
            />
          </FormField>

          <FormField label="Address" span={2}>
            <input
              type="text"
              disabled={createdUnitId !== null}
              placeholder="Street address"
              value={form.address_line}
              onChange={(event) => setField("address_line", event.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="City">
            <input
              type="text"
              disabled={createdUnitId !== null}
              placeholder="City"
              value={form.city}
              onChange={(event) => setField("city", event.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="Country">
            <input
              type="text"
              disabled={createdUnitId !== null}
              placeholder="Country"
              value={form.country}
              onChange={(event) => setField("country", event.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        {createdUnitId && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Unit Certifications
                </h4>

                <p className="mt-1 text-xs text-slate-500">
                  Each additional unit needs its own certifications.
                </p>
              </div>

              <button
                type="button"
                onClick={addCertification}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Add certification
              </button>
            </div>

            <div className="space-y-4">
              {certifications.map((certification, index) => (
                <div
                  key={`unit-cert-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">
                      Certification #{index + 1}
                    </div>

                    {certifications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCertification(index)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      label="Certification type"
                      span={2}
                      error={certificationErrors[index]?.certification_type}
                    >
                      <select
                        value={certification.certification_type}
                        onChange={(event) =>
                          setCertificationField(
                            index,
                            "certification_type",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">Select certification type</option>

                        {certificationOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Certificate name" span={2}>
                      <input
                        type="text"
                        placeholder="e.g. Quality Management System"
                        value={certification.certificate_name}
                        onChange={(event) =>
                          setCertificationField(
                            index,
                            "certificate_name",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </FormField>

                    <FormField label="Start date">
                      <input
                        type="date"
                        value={certification.start_date}
                        onChange={(event) =>
                          setCertificationField(
                            index,
                            "start_date",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </FormField>

                    <FormField
                      label="Expiry date"
                      error={certificationErrors[index]?.end_date}
                    >
                      <input
                        type="date"
                        value={certification.end_date}
                        onChange={(event) =>
                          setCertificationField(
                            index,
                            "end_date",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </FormField>

                    <FormField label="Comments" span={2}>
                      <textarea
                        value={certification.comments}
                        onChange={(event) =>
                          setCertificationField(
                            index,
                            "comments",
                            event.target.value,
                          )
                        }
                        rows={3}
                        className={`${inputClass} min-h-[96px]`}
                        placeholder="Additional notes for this unit certification"
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleAddCertifications}
                disabled={certSubmitting}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${
                  certSubmitting
                    ? "bg-blue-300"
                    : "bg-blue-700 hover:bg-blue-800"
                }`}
              >
                {certSubmitting
                  ? "Saving certifications..."
                  : "Save certifications"}
              </button>
            </div>
          </div>
        )}

        {!createdUnitId && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleCreateUnit}
              disabled={submitting}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${
                submitting ? "bg-blue-300" : "bg-blue-700 hover:bg-blue-800"
              }`}
            >
              {submitting ? "Creating unit..." : "Create unit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
