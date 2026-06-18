/**
 * Flow C — Add another unit to an existing supplier group
 *
 * Single-form: unit details + responsible contact + certifications are submitted
 * together through POST /suppliers/groups/{groupId}/units/complete.
 */

import React, { useEffect, useRef, useState } from "react";
import { supplierAPI } from "../../../services/supplierOnboardingAPI";
import {
  CERTIFICATION_STANDARD_TYPE_OPTIONS,
  CERT_TYPES_BY_STANDARD,
} from "../../../utils/onboarding";
import { ContactResponse } from "../../../types/onboarding";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface NewContact {
  full_name: string;
  email: string;
  phone: string;
  role_label: string;
}

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

interface FlowCProps {
  groupId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const EMPTY_CERT: CertRow = {
  standard_type: "",
  certification_type: "",
  certificate_name: "",
  start_date: "",
  end_date: "",
  comments: "",
  file: null,
};

const EMPTY_NEW_CONTACT: NewContact = {
  full_name: "",
  email: "",
  phone: "",
  role_label: "",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FlowC: React.FC<FlowCProps> = ({ groupId, onSuccess, onCancel }) => {
  // Unit fields
  const [supplierCode, setSupplierCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [continent, setContinent] = useState("");
  const [area, setArea] = useState("");
  const [productType, setProductType] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [commodityResponsible, setCommodityResponsible] = useState("");
  const [mainPlants, setMainPlants] = useState("");
  const [scope1Ghg, setScope1Ghg] = useState("");
  const [scope2Ghg, setScope2Ghg] = useState("");
  const [ghgComments, setGhgComments] = useState("");
  const [ghgRequestedDate, setGhgRequestedDate] = useState("");
  const [ghgCompletionPct, setGhgCompletionPct] = useState("");

  // Contacts
  const [allContacts, setAllContacts] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [addNewContact, setAddNewContact] = useState(false);
  const [newContact, setNewContact] = useState<NewContact>(EMPTY_NEW_CONTACT);

  // Certifications
  const [certs, setCerts] = useState<CertRow[]>([]);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Load group + all unit contacts
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [groupRes, unitsRes] = await Promise.all([
          supplierAPI.listContactsForGroup(groupId),
          supplierAPI.listUnitsForGroup(groupId),
        ]);
        if (!active) return;

        const groupContacts: ContactOption[] = (groupRes.data?.items || []).map(
          (c: ContactResponse) => toContactOption(c, "group"),
        );

        const units: Array<{ id_supplier_unit: number; supplier_code: string; unit_code?: string }> =
          unitsRes.data?.units || [];

        const unitContactChunks = await Promise.all(
          units.map(async (u) => {
            try {
              const r = await supplierAPI.listContactsForUnit(u.id_supplier_unit);
              return (r.data?.items || []).map((c: ContactResponse) =>
                toContactOption(
                  c,
                  "unit",
                  u.supplier_code || `Unit ${u.id_supplier_unit}`,
                ),
              );
            } catch {
              return [];
            }
          }),
        );

        const seen = new Set<number>();
        const merged: ContactOption[] = [];
        for (const c of [...groupContacts, ...unitContactChunks.flat()]) {
          if (!seen.has(c.id_contact)) {
            seen.add(c.id_contact);
            merged.push(c);
          }
        }
        if (active) setAllContacts(merged);
      } catch { /* keep empty */ }
    };
    load();
    return () => { active = false; };
  }, [groupId]);

  // Cert helpers
  const addCert = () => setCerts((p) => [...p, { ...EMPTY_CERT }]);
  const removeCert = (i: number) => setCerts((p) => p.filter((_, idx) => idx !== i));
  const setCertField = (i: number, key: keyof CertRow, val: any) =>
    setCerts((p) => p.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)));
  const setStandardType = (i: number, val: string) =>
    setCerts((p) => p.map((c, idx) => idx === i ? { ...c, standard_type: val, certification_type: "" } : c));

  // Validation
  const validate = () => {
    const e: Record<string, string> = {};
    if (!supplierCode.trim()) e.supplierCode = "Supplier name is required";
    if (addNewContact && !newContact.full_name.trim())
      e.contactName = "Contact full name is required";
    certs.forEach((cert, i) => {
      const hasData = cert.standard_type || cert.certification_type || cert.certificate_name || cert.start_date;
      if (!hasData) return;
      if (!cert.standard_type) e[`cert_${i}_standard`] = "Standard type required";
      else if (!cert.certification_type) e[`cert_${i}_type`] = "Certification required";
      if (cert.start_date && cert.end_date && cert.end_date < cert.start_date)
        e[`cert_${i}_end`] = "Expiry must be after start";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);

    try {
      // Build contact payload
      const contacts: any[] = [];
      if (addNewContact && newContact.full_name.trim()) {
        contacts.push({
          full_name: newContact.full_name,
          email: newContact.email || undefined,
          phone: newContact.phone || undefined,
          role_label: newContact.role_label || undefined,
          is_primary_contact: false,
        });
      } else if (selectedContactId !== null) {
        const c = allContacts.find((x) => x.id_contact === selectedContactId);
        if (c) {
          contacts.push({
            full_name: c.full_name ?? "",
            email: c.email ?? undefined,
            phone: c.phone ?? undefined,
            role_label: c.role_label ?? undefined,
            is_primary_contact: false,
          });
        }
      }

      // Build certifications payload (skip empty rows)
      const certifications = certs
        .filter((c) => c.standard_type || c.certification_type || c.certificate_name)
        .map(({ file, ...rest }) => ({
          ...rest,
          start_date: rest.start_date || undefined,
          end_date: rest.end_date || undefined,
          comments: rest.comments || undefined,
        }));

      await supplierAPI.createUnitComplete(groupId, {
        unit: {
          supplier_code: supplierCode,
          address_line: address || undefined,
          city: city || undefined,
          country: country || undefined,
          continent: continent || undefined,
          area: area || undefined,
          product_type: productType || undefined,
          product_category: productCategory || undefined,
          supplier_email: supplierEmail || undefined,
          commodity_responsible: commodityResponsible || undefined,
          main_plants: mainPlants || undefined,
          scope1_ghg: scope1Ghg ? scope1Ghg : undefined,
          scope2_ghg: scope2Ghg ? scope2Ghg : undefined,
          ghg_comments: ghgComments || undefined,
          ghg_requested_date: ghgRequestedDate || undefined,
          ghg_completion_pct: ghgCompletionPct || undefined,
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

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Add unit</p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900">New unit for this group</h3>
        </div>
        <button onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {/* ── Error ── */}
        {apiError && (
          <div className="mx-6 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {apiError}
          </div>
        )}

        {/* ── Section 1: Unit Details ── */}
        <Section label="Unit Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Unit Name *" error={errors.supplierCode} span={2}>
              <input className={cx()} placeholder="e.g. Mersen — Shanghai Plant"
                value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} />
            </Field>
            <Field label="Street Address" span={2}>
              <input className={cx()} placeholder="123 Industrial Park Rd"
                value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="City">
              <input className={cx()} placeholder="City"
                value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="Country">
              <input className={cx()} placeholder="Country"
                value={country} onChange={(e) => setCountry(e.target.value)} />
            </Field>
            <Field label="Continent">
              <input className={cx()} placeholder="e.g. Asia, Europe"
                value={continent} onChange={(e) => setContinent(e.target.value)} />
            </Field>
            <Field label="Area / Region">
              <input className={cx()} placeholder="e.g. Greater China"
                value={area} onChange={(e) => setArea(e.target.value)} />
            </Field>
            <Field label="Product Type">
              <input className={cx()} placeholder="e.g. Electronics"
                value={productType} onChange={(e) => setProductType(e.target.value)} />
            </Field>
            <Field label="Product Category">
              <input className={cx()} placeholder="e.g. Semiconductors"
                value={productCategory} onChange={(e) => setProductCategory(e.target.value)} />
            </Field>
            <Field label="Supplier Email">
              <input className={cx()} type="email" placeholder="contact@supplier.com"
                value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} />
            </Field>
            <Field label="Commodity Responsible">
              <input className={cx()} placeholder="e.g. John Smith"
                value={commodityResponsible} onChange={(e) => setCommodityResponsible(e.target.value)} />
            </Field>
            <Field label="Main Plants" span={2}>
              <input className={cx()} placeholder="e.g. FR01, DE03 (comma-separated)"
                value={mainPlants} onChange={(e) => setMainPlants(e.target.value)} />
            </Field>
            <Field label="Scope 1 GHG (tCO₂e)">
              <input className={cx()} type="number" placeholder="0.00"
                value={scope1Ghg} onChange={(e) => setScope1Ghg(e.target.value)} />
            </Field>
            <Field label="Scope 2 GHG (tCO₂e)">
              <input className={cx()} type="number" placeholder="0.00"
                value={scope2Ghg} onChange={(e) => setScope2Ghg(e.target.value)} />
            </Field>
            <Field label="GHG Requested Date">
              <input className={cx()} type="date"
                value={ghgRequestedDate} onChange={(e) => setGhgRequestedDate(e.target.value)} />
            </Field>
            <Field label="GHG Completion %">
              <input className={cx()} placeholder="e.g. 75%"
                value={ghgCompletionPct} onChange={(e) => setGhgCompletionPct(e.target.value)} />
            </Field>
            <Field label="GHG Comments" span={2}>
              <textarea className={cx() + " resize-none"} rows={2} placeholder="Notes on GHG data collection…"
                value={ghgComments} onChange={(e) => setGhgComments(e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* ── Section 2: Responsible Person ── */}
        <Section label="Supplier External Contact"
          subtitle="The supplier-side person responsible for this unit. Shown as the default external contact when assigning to a plant.">
          {allContacts.length > 0 && (
            <div className="mb-4 space-y-2">
              {allContacts.map((c) => {
                const sel = selectedContactId === c.id_contact && !addNewContact;
                return (
                  <button key={c.id_contact} type="button"
                    onClick={() => { setSelectedContactId(sel ? null : c.id_contact); setAddNewContact(false); }}
                    className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${
                      sel
                        ? "border-[#0f2744] bg-[#0f2744]/5 shadow-sm ring-1 ring-[#0f2744]/10"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}>
                    {/* Avatar */}
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      sel ? "bg-[#0f2744] text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {sel ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (c.full_name?.[0]?.toUpperCase() ?? "?")}
                    </div>

                    {/* Name + role + email — no truncation on name/role */}
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold leading-tight ${sel ? "text-[#0f2744]" : "text-slate-900"}`}>
                        {c.full_name}
                      </div>
                      {c.role_label && (
                        <div className="mt-0.5 text-xs text-slate-500">{c.role_label}</div>
                      )}
                      {c.email && (
                        <div className={`mt-0.5 text-xs ${sel ? "text-[#0f2744]/70" : "text-slate-400"}`}>
                          {c.email}
                        </div>
                      )}
                    </div>

                    {/* Source badge — right-aligned, never pushed off-screen */}
                    <span className={`ml-2 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      c.source === "group"
                        ? "bg-slate-100 text-slate-500"
                        : "bg-indigo-50 text-indigo-600"
                    }`}>
                      {c.source === "group" ? "Group" : c.source_label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {allContacts.length > 0 && (
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[11px] text-slate-400">or</span>
              </div>
            </div>
          )}

          <button type="button"
            onClick={() => { setAddNewContact((p) => !p); setSelectedContactId(null); }}
            className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
              addNewContact
                ? "border-[#0f2744]/30 bg-[#0f2744]/5 text-[#0f2744]"
                : "border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50"
            }`}>
            {addNewContact ? "▾ New supplier contact" : "+ Add a new supplier contact"}
          </button>

          {addNewContact && (
            <div className="mt-3 grid grid-cols-1 gap-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:grid-cols-2">
              <Field label="Full Name *" error={errors.contactName} span={2}>
                <input className={cx()} placeholder="Marie Dupont"
                  value={newContact.full_name} onChange={(e) => setNewContact((p) => ({ ...p, full_name: e.target.value }))} />
              </Field>
              <Field label="Email">
                <input className={cx()} type="email" placeholder="marie@avocarbon.com"
                  value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <input className={cx()} placeholder="+33 1 23 45 67 89"
                  value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))} />
              </Field>
              <Field label="Role at Supplier" span={2}>
                <input className={cx()} placeholder="Quality Manager, Sales Contact…"
                  value={newContact.role_label} onChange={(e) => setNewContact((p) => ({ ...p, role_label: e.target.value }))} />
              </Field>
            </div>
          )}
        </Section>

        {/* ── Section 3: Certifications ── */}
        <Section label="Certifications"
          subtitle="Optional — add quality and compliance certifications for this unit."
          action={
            <button type="button" onClick={addCert}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
              + Add
            </button>
          }>
          {certs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
              No certifications added yet.
            </p>
          ) : (
            <div className="space-y-4">
              {certs.map((cert, i) => (
                <CertCard key={i} cert={cert} index={i} errors={errors}
                  onRemove={() => removeCert(i)}
                  onField={(k, v) => setCertField(i, k, v)}
                  onStandardType={(v) => setStandardType(i, v)} />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
          {submitting ? "Creating…" : "Create Unit"}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

const cx = () =>
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#0f2744]/40 focus:ring-4 focus:ring-[#0f2744]/8";

const Section: React.FC<{
  label: string; subtitle?: string;
  action?: React.ReactNode; children: React.ReactNode;
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

const Field: React.FC<{
  label: string; error?: string; span?: 1 | 2; children: React.ReactNode;
}> = ({ label, error, span, children }) => (
  <div className={span === 2 ? "sm:col-span-2" : ""}>
    <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
    {children}
    {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// Certification card
// ---------------------------------------------------------------------------

const CertCard: React.FC<{
  cert: CertRow; index: number; errors: Record<string, string>;
  onRemove: () => void;
  onField: (k: keyof CertRow, v: any) => void;
  onStandardType: (v: string) => void;
}> = ({ cert, index, errors, onRemove, onField, onStandardType }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const typeOptions = cert.standard_type ? (CERT_TYPES_BY_STANDARD[cert.standard_type] ?? []) : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">Certification #{index + 1}</span>
        <button type="button" onClick={onRemove}
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50">
          Remove
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Standard Type *" error={errors[`cert_${index}_standard`]} span={2}>
          <select value={cert.standard_type} onChange={(e) => onStandardType(e.target.value)} className={cx()}>
            <option value="">Select type…</option>
            {CERTIFICATION_STANDARD_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        {cert.standard_type && (
          <Field label="Certification *" error={errors[`cert_${index}_type`]} span={2}>
            <select value={cert.certification_type} onChange={(e) => onField("certification_type", e.target.value)} className={cx()}>
              <option value="">Select certification…</option>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}

        <Field label="Name / Reference" span={2}>
          <input className={cx()} placeholder="e.g. QMS-2024-CN-001"
            value={cert.certificate_name} onChange={(e) => onField("certificate_name", e.target.value)} />
        </Field>

        <Field label="Issue Date">
          <input type="date" className={cx()} value={cert.start_date}
            onChange={(e) => onField("start_date", e.target.value)} />
        </Field>
        <Field label="Expiry Date" error={errors[`cert_${index}_end`]}>
          <input type="date" className={cx()} value={cert.end_date}
            onChange={(e) => onField("end_date", e.target.value)} />
        </Field>

        <Field label="Comments" span={2}>
          <textarea className={`${cx()} min-h-[60px]`} rows={2} placeholder="Notes…"
            value={cert.comments} onChange={(e) => onField("comments", e.target.value)} />
        </Field>

        {/* File upload */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Document</label>
          <div onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-4 py-3 transition ${
              cert.file ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white hover:border-slate-400"
            }`}>
            {cert.file ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <span className="font-semibold truncate max-w-xs">{cert.file.name}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); onField("file", null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="ml-1 text-red-500 underline">Remove</button>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Click to upload PDF / PNG / JPG</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
            onChange={(e) => onField("file", e.target.files?.[0] ?? null)} />
        </div>
      </div>
    </div>
  );
};
