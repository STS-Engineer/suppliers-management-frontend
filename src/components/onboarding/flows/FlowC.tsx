/**
 * Flow C — Add another unit to an existing supplier group
 *
 * Sections: Unit details (via SupplierUnitForm) → Existing contact picker → Certifications
 * Submitted in one call: POST /suppliers/groups/{groupId}/units/complete
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supplierAPI } from "../../../services/supplierOnboardingAPI";
import {
  CERTIFICATION_STANDARD_TYPE_OPTIONS,
  CERT_TYPES_BY_STANDARD,
} from "../../../utils/onboarding";
import { ContactResponse, UnitFormData, FormErrors } from "../../../types/onboarding";
import { SupplierUnitForm } from "../SupplierUnitForm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FlowCProps {
  groupId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

interface ContactOption {
  id_contact: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role_label: string | null;
  is_primary_contact: boolean | null;
  source: "group" | "unit";
  source_label?: string;
}

interface CertRow {
  standard_type: string;
  certification_type: string;
  certificate_name: string;
  start_date: string;
  end_date: string;
  comments: string;
  file: File | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_UNIT: UnitFormData = {
  supplier_code: "",
  address_line: "",
  city: "",
  country: "",
  continent: "",
  area: "",
  commodity: [],
  family: [],
  sub_family: [],
  product_line: [],
  website: "",
  carbon_footprint: "",
  green_electricity_pct: "",
  unit_contacts: [],
};

const EMPTY_CERT: CertRow = {
  standard_type: "", certification_type: "", certificate_name: "",
  start_date: "", end_date: "", comments: "", file: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const serializeMultiSelect = (values: string[]) =>
  values.length ? values.join(",") : undefined;

const toContactOption = (
  contact: ContactResponse,
  source: "group" | "unit",
  sourceLabel?: string,
): ContactOption => ({
  id_contact: contact.id_contact,
  full_name: contact.full_name ?? null,
  email: contact.email ?? null,
  phone: contact.phone ?? null,
  role_label: contact.role_label ?? null,
  is_primary_contact: contact.is_primary_contact ?? null,
  source,
  source_label: sourceLabel,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FlowC: React.FC<FlowCProps> = ({ groupId, onSuccess, onCancel }) => {
  // ── Unit form state ───────────────────────────────────────────────────────
  const [unitData, setUnitData] = useState<UnitFormData>(INITIAL_UNIT);
  const [unitErrors, setUnitErrors] = useState<FormErrors>({});
  const [unitContactErrors, setUnitContactErrors] = useState<{ [k: number]: FormErrors }>({});

  const handleUnitChange = useCallback((field: keyof UnitFormData, value: any) => {
    setUnitData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Existing contact picker ───────────────────────────────────────────────
  const [allContacts, setAllContacts] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

  // ── Certifications ────────────────────────────────────────────────────────
  const [certs, setCerts] = useState<CertRow[]>([]);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ── Load existing group + unit contacts for the picker ───────────────────
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [groupRes, unitsRes] = await Promise.all([
          supplierAPI.listContactsForGroup(groupId),
          supplierAPI.listUnitsForGroup(groupId),
        ]);
        if (!active) return;

        const groupContacts: ContactOption[] = (groupRes.data?.items ?? []).map(
          (c: ContactResponse) => toContactOption(c, "group"),
        );

        const units: Array<{ id_supplier_unit: number; supplier_code: string }> =
          unitsRes.data?.units ?? [];

        const chunks = await Promise.all(
          units.map(async (u) => {
            try {
              const r = await supplierAPI.listContactsForUnit(u.id_supplier_unit);
              return (r.data?.items ?? []).map((c: ContactResponse) =>
                toContactOption(c, "unit", u.supplier_code || `Unit ${u.id_supplier_unit}`),
              );
            } catch { return []; }
          }),
        );

        if (!active) return;
        const seen = new Set<number>();
        const merged: ContactOption[] = [];
        for (const c of [...groupContacts, ...chunks.flat()]) {
          if (!seen.has(c.id_contact)) { seen.add(c.id_contact); merged.push(c); }
        }
        setAllContacts(merged);
      } catch { /* keep empty */ }
    };
    load();
    return () => { active = false; };
  }, [groupId]);

  // ── Cert helpers ──────────────────────────────────────────────────────────
  const addCert = () => setCerts((p) => [...p, { ...EMPTY_CERT }]);
  const removeCert = (i: number) => setCerts((p) => p.filter((_, idx) => idx !== i));
  const setCertField = (i: number, key: keyof CertRow, val: unknown) =>
    setCerts((p) => p.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)));
  const setStandardType = (i: number, val: string) =>
    setCerts((p) => p.map((c, idx) =>
      idx === i ? { ...c, standard_type: val, certification_type: "" } : c,
    ));

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: FormErrors = {};
    const ucErrors: { [k: number]: FormErrors } = {};

    if (!unitData.supplier_code.trim()) e.supplier_code = "Unit name is required";

    (unitData.unit_contacts ?? []).forEach((nc, i) => {
      const hasData = nc.full_name.trim() || nc.email.trim() || nc.phone.trim();
      if (!hasData) return;
      const ce: FormErrors = {};
      if (!nc.full_name.trim()) ce.full_name = "Full name is required";
      if (nc.email.trim() && !looksLikeEmail(nc.email)) ce.email = "Invalid email";
      if (Object.keys(ce).length) ucErrors[i] = ce;
    });

    certs.forEach((cert, i) => {
      const hasData = cert.standard_type || cert.certification_type || cert.certificate_name || cert.start_date;
      if (!hasData) return;
      if (!cert.standard_type) e[`cert_${i}_standard`] = "Standard type required";
      else if (!cert.certification_type) e[`cert_${i}_type`] = "Certification required";
      if (cert.start_date && cert.end_date && cert.end_date < cert.start_date)
        e[`cert_${i}_end`] = "Expiry must be after start";
    });

    setUnitErrors(e);
    setUnitContactErrors(ucErrors);
    return Object.keys(e).length === 0 && Object.keys(ucErrors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);

    try {
      // Build contacts: selected existing first, then new ones from the unit form
      const contacts: unknown[] = [];

      if (selectedContactId !== null) {
        const c = allContacts.find((x) => x.id_contact === selectedContactId);
        if (c) contacts.push({
          full_name: c.full_name ?? "",
          email: c.email ?? undefined,
          phone: c.phone ?? undefined,
          role_label: c.role_label ?? undefined,
          is_primary_contact: c.is_primary_contact ?? false,
        });
      }

      for (const nc of unitData.unit_contacts ?? []) {
        if (!nc.full_name.trim()) continue;
        contacts.push({
          full_name: nc.full_name,
          email: nc.email || undefined,
          phone: nc.phone || undefined,
          role_label: nc.role_label || undefined,
          role_name: nc.role_name || undefined,
          is_primary_contact: nc.is_primary_contact,
        });
      }

      const certifications = certs
        .filter((c) => c.standard_type || c.certification_type || c.certificate_name)
        .map(({ file: _file, ...rest }) => ({
          ...rest,
          start_date: rest.start_date || undefined,
          end_date: rest.end_date || undefined,
          comments: rest.comments || undefined,
        }));

      await supplierAPI.createUnitComplete(groupId, {
        unit: {
          supplier_code:         unitData.supplier_code,
          address_line:          unitData.address_line          || undefined,
          city:                  unitData.city                  || undefined,
          country:               unitData.country               || undefined,
          continent:             unitData.continent             || undefined,
          area:                  unitData.area                  || undefined,
          website:               unitData.website               || undefined,
          commodity:             serializeMultiSelect(unitData.commodity),
          family:                serializeMultiSelect(unitData.family),
          sub_family:            serializeMultiSelect(unitData.sub_family),
          product_line:          serializeMultiSelect(unitData.product_line),
          carbon_footprint:      unitData.carbon_footprint      || undefined,
          green_electricity_pct: unitData.green_electricity_pct || undefined,
        },
        contacts,
        certifications,
      });

      onSuccess();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to create unit");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Add unit</p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900">New unit for this group</h3>
        </div>
        <button
          onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {apiError && (
          <div className="mx-6 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {apiError}
          </div>
        )}

        {/* ── Unit details (location, commodity, family, product line, sustainability, contacts) ── */}
        <div className="px-6 py-6">
          <SupplierUnitForm
            data={unitData}
            errors={unitErrors}
            unitContactErrors={unitContactErrors}
            onChange={handleUnitChange}
          />
        </div>

        {/* ── Reuse an existing contact ─────────────────────────────────── */}
        {allContacts.length > 0 && (
          <Section
            label="Reuse an existing contact"
            subtitle="Optionally link a contact already registered in this group or another unit."
          >
            <div className="space-y-2">
              {allContacts.map((c) => {
                const sel = selectedContactId === c.id_contact;
                return (
                  <button
                    key={c.id_contact}
                    type="button"
                    onClick={() => setSelectedContactId(sel ? null : c.id_contact)}
                    className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${
                      sel
                        ? "border-[#0f2744] bg-[#0f2744]/5 shadow-sm ring-1 ring-[#0f2744]/10"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      sel ? "bg-[#0f2744] text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {sel
                        ? <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        : (c.full_name?.[0]?.toUpperCase() ?? "?")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${sel ? "text-[#0f2744]" : "text-slate-900"}`}>{c.full_name}</p>
                      {c.role_label && <p className="mt-0.5 text-xs text-slate-500">{c.role_label}</p>}
                      {c.email && <p className={`mt-0.5 text-xs ${sel ? "text-[#0f2744]/70" : "text-slate-400"}`}>{c.email}</p>}
                    </div>
                    <span className={`ml-2 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      c.source === "group" ? "bg-slate-100 text-slate-500" : "bg-indigo-50 text-indigo-600"
                    }`}>
                      {c.source === "group" ? "Group" : c.source_label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Certifications ───────────────────────────────────────────── */}
        <Section
          label="Certifications"
          subtitle="Optional — add quality and compliance certifications for this unit."
          action={
            <button
              type="button"
              onClick={addCert}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              + Add
            </button>
          }
        >
          {certs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
              No certifications added yet.
            </p>
          ) : (
            <div className="space-y-4">
              {certs.map((cert, i) => (
                <CertCard
                  key={i}
                  cert={cert}
                  index={i}
                  errors={unitErrors}
                  onRemove={() => removeCert(i)}
                  onField={(k, v) => setCertField(i, k, v)}
                  onStandardType={(v) => setStandardType(i, v)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button
          onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create Unit"}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Section wrapper (FlowC layout chrome)
// ---------------------------------------------------------------------------

const Section: React.FC<{
  label: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, subtitle, action, children }) => (
  <div className="px-6 py-6">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h4 className="text-sm font-bold text-slate-900">{label}</h4>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Certification card
// ---------------------------------------------------------------------------

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#0f2744]/40 focus:ring-4 focus:ring-[#0f2744]/8";

const inputErrCls =
  "w-full rounded-xl border border-red-400 bg-red-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition";

const CertField: React.FC<{
  label: string;
  error?: string;
  span?: 1 | 2;
  children: React.ReactNode;
}> = ({ label, error, span, children }) => (
  <div className={span === 2 ? "sm:col-span-2" : ""}>
    {label && <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>}
    {children}
    {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
  </div>
);

const CertCard: React.FC<{
  cert: CertRow;
  index: number;
  errors: FormErrors;
  onRemove: () => void;
  onField: (k: keyof CertRow, v: unknown) => void;
  onStandardType: (v: string) => void;
}> = ({ cert, index, errors, onRemove, onField, onStandardType }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const typeOptions = cert.standard_type ? (CERT_TYPES_BY_STANDARD[cert.standard_type] ?? []) : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">Certification #{index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CertField label="Standard Type *" error={errors[`cert_${index}_standard`]} span={2}>
          <select
            value={cert.standard_type}
            onChange={(e) => onStandardType(e.target.value)}
            className={errors[`cert_${index}_standard`] ? inputErrCls : inputCls}
          >
            <option value="">Select type…</option>
            {CERTIFICATION_STANDARD_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </CertField>

        {cert.standard_type && (
          <CertField label="Certification *" error={errors[`cert_${index}_type`]} span={2}>
            <select
              value={cert.certification_type}
              onChange={(e) => onField("certification_type", e.target.value)}
              className={errors[`cert_${index}_type`] ? inputErrCls : inputCls}
            >
              <option value="">Select certification…</option>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </CertField>
        )}

        <CertField label="Name / Reference" span={2}>
          <input
            className={inputCls}
            placeholder="e.g. QMS-2024-CN-001"
            value={cert.certificate_name}
            onChange={(e) => onField("certificate_name", e.target.value)}
          />
        </CertField>

        <CertField label="Issue Date">
          <input
            type="date"
            className={inputCls}
            value={cert.start_date}
            onChange={(e) => onField("start_date", e.target.value)}
          />
        </CertField>

        <CertField label="Expiry Date" error={errors[`cert_${index}_end`]}>
          <input
            type="date"
            className={errors[`cert_${index}_end`] ? inputErrCls : inputCls}
            value={cert.end_date}
            onChange={(e) => onField("end_date", e.target.value)}
          />
        </CertField>

        <CertField label="Comments" span={2}>
          <textarea
            className={`${inputCls} min-h-[60px]`}
            rows={2}
            placeholder="Notes…"
            value={cert.comments}
            onChange={(e) => onField("comments", e.target.value)}
          />
        </CertField>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Document</label>
          <div
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-4 py-3 transition ${
              cert.file ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white hover:border-slate-400"
            }`}
          >
            {cert.file ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <span className="max-w-xs truncate font-semibold">{cert.file.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onField("file", null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="ml-1 text-red-500 underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Click to upload PDF / PNG / JPG</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => onField("file", e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
    </div>
  );
};
