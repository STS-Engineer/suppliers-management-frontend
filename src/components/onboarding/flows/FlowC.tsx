/**
 * Flow C — Add another unit to an existing supplier group
 *
 * Single-form: unit details + responsible contact + certifications are submitted
 * together through POST /suppliers/groups/{groupId}/units/complete.
 *
 * Field set, validation, and business rules are aligned with SupplierUnitForm.
 */

import React, { useEffect, useRef, useState } from "react";
import { supplierAPI } from "../../../services/supplierOnboardingAPI";
import {
  CERTIFICATION_STANDARD_TYPE_OPTIONS,
  CERT_TYPES_BY_STANDARD,
} from "../../../utils/onboarding";
import { ContactResponse } from "../../../types/onboarding";
import { CreatableMultiSelect } from "../FormElements";

// ---------------------------------------------------------------------------
// Constants — kept in sync with SupplierUnitForm
// ---------------------------------------------------------------------------

const COUNTRIES = [
  "China", "India", "Vietnam", "Thailand", "Indonesia",
  "Germany", "France", "Italy", "Poland", "Netherlands",
  "United States", "Canada", "Mexico", "Brazil", "Japan",
  "South Korea", "Taiwan", "Malaysia", "United Kingdom", "Spain",
  "Australia", "Morocco", "Tunisia", "Turkey", "Other",
];

const DEFAULT_FAMILIES = [
  "Electronics", "Electromechanical", "Magnetics", "Passive Components",
  "Chemicals", "Raw Materials", "Metals", "Plastics", "Packaging",
  "Mechanical Parts", "PCB & Assemblies", "Cables & Connectors",
  "Software & Services", "Tooling & Equipment",
];

const DEFAULT_SUB_FAMILIES = [
  "Ferrites", "Inductors", "Transformers", "Capacitors", "Resistors",
  "Diodes", "MOSFETs", "IGBTs", "Sensors", "Filters", "Connectors",
  "Switches", "Relays", "Motors", "Coatings", "Adhesives", "Laminates",
  "Substrates",
];

const DEFAULT_PRODUCT_LINES = [
  "Power Electronics", "Signal Processing", "Thermal Management",
  "EMC Solutions", "Energy Storage", "Drive Systems",
  "Automation & Control", "Lighting", "Wireless & RF",
];

const DEFAULT_CATEGORIES = [
  "Ferrites", "Chokes", "Wire coils", "Inductors", "Transformers",
  "Capacitors", "Resistors", "Diodes", "MOSFETs", "IGBTs", "Sensors",
  "Filters", "Connectors", "Switches", "Relays", "Motors",
  "PCB Assemblies", "Cables", "Coatings", "Laminates",
];

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
  role_name: string;
  is_primary_contact: boolean;
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
  standard_type: "", certification_type: "", certificate_name: "",
  start_date: "", end_date: "", comments: "", file: null,
};

const EMPTY_NEW_CONTACT: NewContact = {
  full_name: "", email: "", phone: "", role_label: "",
  role_name: "", is_primary_contact: false,
};

// ---------------------------------------------------------------------------
// Validation helpers — same regex as SupplierUnitForm
// ---------------------------------------------------------------------------

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const serializeMultiSelect = (values: string[]) => values.length ? values.join(",") : undefined;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FlowC: React.FC<FlowCProps> = ({ groupId, onSuccess, onCancel }) => {
  // ── Unit identity & location ──────────────────────────────────────────────
  const [supplierCode,       setSupplierCode]       = useState("");
  const [address,            setAddress]            = useState("");
  const [city,               setCity]               = useState("");
  const [country,            setCountry]            = useState("");
  const [continent,          setContinent]          = useState("");
  const [area,               setArea]               = useState("");
  const [website,            setWebsite]            = useState("");
  const [supplierEmail,      setSupplierEmail]      = useState("");
  const [commodityResponsible, setCommodityResponsible] = useState("");
  const [mainPlants,         setMainPlants]         = useState("");

  // ── Product classification ────────────────────────────────────────────────
  const [family,       setFamily]      = useState<string[]>([]);
  const [subFamily,    setSubFamily]   = useState<string[]>([]);
  const [productLine,  setProductLine] = useState<string[]>([]);
  const [category,     setCategory]    = useState<string[]>([]);

  // ── Sustainability ────────────────────────────────────────────────────────
  const [carbonFootprint,     setCarbonFootprint]     = useState("");
  const [greenElectricityPct, setGreenElectricityPct] = useState("");
  const [copperBrassPct,      setCopperBrassPct]      = useState("");

  // ── GHG ──────────────────────────────────────────────────────────────────
  const [scope1Ghg,         setScope1Ghg]         = useState("");
  const [scope2Ghg,         setScope2Ghg]         = useState("");
  const [ghgComments,       setGhgComments]       = useState("");
  const [ghgRequestedDate,  setGhgRequestedDate]  = useState("");
  const [ghgCompletionPct,  setGhgCompletionPct]  = useState("");

  // ── Contacts ──────────────────────────────────────────────────────────────
  const [allContacts,       setAllContacts]       = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [newContacts,       setNewContacts]       = useState<NewContact[]>([]);

  // ── Certifications ────────────────────────────────────────────────────────
  const [certs, setCerts] = useState<CertRow[]>([]);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState<string | null>(null);

  // ── Load existing contacts ────────────────────────────────────────────────
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

        const units: Array<{ id_supplier_unit: number; supplier_code: string }> =
          unitsRes.data?.units || [];

        const chunks = await Promise.all(
          units.map(async (u) => {
            try {
              const r = await supplierAPI.listContactsForUnit(u.id_supplier_unit);
              return (r.data?.items || []).map((c: ContactResponse) =>
                toContactOption(c, "unit", u.supplier_code || `Unit ${u.id_supplier_unit}`),
              );
            } catch { return []; }
          }),
        );

        const seen = new Set<number>();
        const merged: ContactOption[] = [];
        for (const c of [...groupContacts, ...chunks.flat()]) {
          if (!seen.has(c.id_contact)) { seen.add(c.id_contact); merged.push(c); }
        }
        if (active) setAllContacts(merged);
      } catch { /* keep empty */ }
    };
    load();
    return () => { active = false; };
  }, [groupId]);

  // ── New contacts helpers ──────────────────────────────────────────────────
  const addNewContact = () => setNewContacts((p) => [...p, { ...EMPTY_NEW_CONTACT }]);
  const removeNewContact = (i: number) => setNewContacts((p) => p.filter((_, idx) => idx !== i));
  const updateNewContact = (i: number, field: keyof NewContact, val: string | boolean) =>
    setNewContacts((p) => p.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)));

  // ── Cert helpers ──────────────────────────────────────────────────────────
  const addCert    = () => setCerts((p) => [...p, { ...EMPTY_CERT }]);
  const removeCert = (i: number) => setCerts((p) => p.filter((_, idx) => idx !== i));
  const setCertField = (i: number, key: keyof CertRow, val: unknown) =>
    setCerts((p) => p.map((c, idx) => (idx === i ? { ...c, [key]: val } : c)));
  const setStandardType = (i: number, val: string) =>
    setCerts((p) => p.map((c, idx) => idx === i ? { ...c, standard_type: val, certification_type: "" } : c));

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};

    if (!supplierCode.trim()) e.supplierCode = "Unit name is required";

    if (supplierEmail.trim() && !looksLikeEmail(supplierEmail))
      e.supplierEmail = "Enter a valid email address";

    newContacts.forEach((nc, i) => {
      const hasData = nc.full_name.trim() || nc.email.trim() || nc.phone.trim();
      if (!hasData) return;
      if (!nc.full_name.trim()) e[`nc_${i}_name`] = "Full name is required";
      if (nc.email.trim() && !looksLikeEmail(nc.email)) e[`nc_${i}_email`] = "Invalid email";
    });

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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);

    try {
      const contacts: unknown[] = [];

      // Selected existing contact
      if (selectedContactId !== null) {
        const c = allContacts.find((x) => x.id_contact === selectedContactId);
        if (c) {
          contacts.push({
            full_name: c.full_name ?? "",
            email: c.email ?? undefined,
            phone: c.phone ?? undefined,
            role_label: c.role_label ?? undefined,
            is_primary_contact: c.is_primary_contact ?? false,
          });
        }
      }

      // New contacts (skip empty rows)
      for (const nc of newContacts) {
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
        .map(({ file, ...rest }) => ({
          ...rest,
          start_date: rest.start_date || undefined,
          end_date:   rest.end_date   || undefined,
          comments:   rest.comments   || undefined,
        }));

      await supplierAPI.createUnitComplete(groupId, {
        unit: {
          supplier_code:         supplierCode,
          address_line:          address             || undefined,
          city:                  city                || undefined,
          country:               country             || undefined,
          continent:             continent           || undefined,
          area:                  area                || undefined,
          website:               website             || undefined,
          supplier_email:        supplierEmail       || undefined,
          commodity_responsible: commodityResponsible || undefined,
          main_plants:           mainPlants          || undefined,
          // Product classification
          family:                serializeMultiSelect(family),
          sub_family:            serializeMultiSelect(subFamily),
          product_line:          serializeMultiSelect(productLine),
          category:              serializeMultiSelect(category),
          // Sustainability
          carbon_footprint:      carbonFootprint     || undefined,
          green_electricity_pct: greenElectricityPct || undefined,
          copper_brass_pct:      copperBrassPct      || undefined,
          // GHG
          scope1_ghg:            scope1Ghg           ? scope1Ghg  : undefined,
          scope2_ghg:            scope2Ghg           ? scope2Ghg  : undefined,
          ghg_comments:          ghgComments         || undefined,
          ghg_requested_date:    ghgRequestedDate    || undefined,
          ghg_completion_pct:    ghgCompletionPct    || undefined,
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
        <button onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
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

        {/* ── 1. Unit Location ─────────────────────────────────────────── */}
        <Section label="Unit Location" subtitle="Register the supplier unit, plant, or operating location.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Unit Name *" error={errors.supplierCode} span={2}>
              <input className={cx()} placeholder="e.g. ACME-CN-001"
                value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} />
            </Field>

            <Field label="Street Address" span={2}>
              <input className={cx()} placeholder="123 Industrial Park Road"
                value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>

            <Field label="City">
              <input className={cx()} placeholder="e.g. Shanghai"
                value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>

            <Field label="Country">
              <select className={cx()} value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Select country</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Continent">
              <input className={cx()} placeholder="e.g. Asia, Europe"
                value={continent} onChange={(e) => setContinent(e.target.value)} />
            </Field>

            <Field label="Area / Region">
              <input className={cx()} placeholder="e.g. Greater China"
                value={area} onChange={(e) => setArea(e.target.value)} />
            </Field>

            <Field label="Website">
              <input className={cx()} type="url" placeholder="https://supplier.com"
                value={website} onChange={(e) => setWebsite(e.target.value)} />
            </Field>

            <Field label="Supplier Email" error={errors.supplierEmail}>
              <input className={cx(errors.supplierEmail)} type="email" placeholder="contact@supplier.com"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
                onBlur={() => {
                  if (supplierEmail.trim() && !looksLikeEmail(supplierEmail))
                    setErrors((p) => ({ ...p, supplierEmail: "Enter a valid email address" }));
                  else
                    setErrors((p) => { const n = { ...p }; delete n.supplierEmail; return n; });
                }} />
            </Field>

            <Field label="Commodity Responsible">
              <input className={cx()} placeholder="e.g. John Smith"
                value={commodityResponsible} onChange={(e) => setCommodityResponsible(e.target.value)} />
            </Field>

            <Field label="Main Plants (Avocarbon)" span={2}>
              <input className={cx()} placeholder="e.g. FR01, DE03 (comma-separated)"
                value={mainPlants} onChange={(e) => setMainPlants(e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* ── 2. Product Classification ────────────────────────────────── */}
        <Section label="Product Classification"
          subtitle="Classify the products or services provided by this unit. Select existing values or type to create new ones.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <CreatableMultiSelect
                label="Family"
                name="family"
                value={family}
                onChange={setFamily}
                storageKey="unit_family"
                defaultOptions={DEFAULT_FAMILIES}
                placeholder="e.g., Electronics, Magnetics…"
                helperText="Main product family for this unit"
              />
            </div>

            <div>
              <CreatableMultiSelect
                label="Sub Family"
                name="sub_family"
                value={subFamily}
                onChange={setSubFamily}
                storageKey="unit_sub_family"
                defaultOptions={DEFAULT_SUB_FAMILIES}
                placeholder="e.g., Ferrites, Capacitors…"
                helperText="Sub-category within the family"
              />
            </div>

            <div className="sm:col-span-2">
              <CreatableMultiSelect
                label="Product Line"
                name="product_line"
                value={productLine}
                onChange={setProductLine}
                storageKey="unit_product_line"
                defaultOptions={DEFAULT_PRODUCT_LINES}
                placeholder="e.g., Power Electronics, EMC Solutions…"
                helperText="Specific product lines or application areas"
              />
            </div>

            <div>
              <CreatableMultiSelect
                label="Category"
                name="category"
                value={category}
                onChange={setCategory}
                storageKey="unit_category"
                defaultOptions={DEFAULT_CATEGORIES}
                placeholder="e.g., Ferrites, Chokes…"
                helperText="Product categories supplied by this unit"
              />
            </div>
          </div>
        </Section>

        {/* ── 3. Sustainability & Qualification ───────────────────────── */}
        <Section label="Sustainability & Qualification"
          subtitle="Environmental data and supplier qualification metrics.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Carbon Footprint">
              <div className="flex">
                <input className={cx() + " rounded-r-none border-r-0"} placeholder="e.g. 12 500"
                  value={carbonFootprint} onChange={(e) => setCarbonFootprint(e.target.value)} />
                <span className="inline-flex items-center rounded-r-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500">
                  tCO₂e
                </span>
              </div>
            </Field>

            <Field label="Green Electricity">
              <div className="flex">
                <input className={cx() + " rounded-r-none border-r-0"} type="number" min={0} max={100} placeholder="0"
                  value={greenElectricityPct} onChange={(e) => setGreenElectricityPct(e.target.value)} />
                <span className="inline-flex items-center rounded-r-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500">
                  %
                </span>
              </div>
            </Field>

            <Field label="Copper / Brass content">
              <div className="flex">
                <input className={cx() + " rounded-r-none border-r-0"} type="number" min={0} max={100} placeholder="0"
                  value={copperBrassPct} onChange={(e) => setCopperBrassPct(e.target.value)} />
                <span className="inline-flex items-center rounded-r-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500">
                  %
                </span>
              </div>
            </Field>
          </div>
        </Section>

        {/* ── 4. GHG Emissions ────────────────────────────────────────── */}
        <Section label="GHG Emissions Data"
          subtitle="Greenhouse gas footprint reported by the supplier (optional).">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <textarea className={cx() + " resize-none"} rows={2}
                placeholder="Notes on GHG data collection…"
                value={ghgComments} onChange={(e) => setGhgComments(e.target.value)} />
            </Field>
          </div>
        </Section>

        {/* ── 5. Supplier Contacts ─────────────────────────────────────── */}
        <Section label="Supplier Contacts"
          subtitle="Supplier-side contacts for this unit (quality manager, sales contact, etc.).">

          {/* Existing contacts picker */}
          {allContacts.length > 0 && (
            <>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Reuse an existing contact
              </p>
              <div className="mb-4 space-y-2">
                {allContacts.map((c) => {
                  const sel = selectedContactId === c.id_contact;
                  return (
                    <button key={c.id_contact} type="button"
                      onClick={() => setSelectedContactId(sel ? null : c.id_contact)}
                      className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${
                        sel
                          ? "border-[#0f2744] bg-[#0f2744]/5 shadow-sm ring-1 ring-[#0f2744]/10"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}>
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
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-[11px] text-slate-400">or add new contacts</span></div>
              </div>
            </>
          )}

          {/* New contacts */}
          {newContacts.length === 0 ? (
            <button type="button" onClick={addNewContact}
              className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:bg-slate-50">
              + Add a new supplier contact
            </button>
          ) : (
            <div className="space-y-4">
              {newContacts.map((nc, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Contact #{i + 1}
                      {nc.is_primary_contact && (
                        <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Primary</span>
                      )}
                    </span>
                    <button type="button" onClick={() => removeNewContact(i)}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50">
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Full Name *" error={errors[`nc_${i}_name`]} span={2}>
                      <input className={cx(errors[`nc_${i}_name`])} placeholder="Marie Dupont"
                        value={nc.full_name}
                        onChange={(e) => updateNewContact(i, "full_name", e.target.value)} />
                    </Field>

                    <Field label="Email" error={errors[`nc_${i}_email`]}>
                      <input className={cx(errors[`nc_${i}_email`])} type="email" placeholder="marie@supplier.com"
                        value={nc.email}
                        onChange={(e) => updateNewContact(i, "email", e.target.value)}
                        onBlur={() => {
                          if (nc.email.trim() && !looksLikeEmail(nc.email))
                            setErrors((p) => ({ ...p, [`nc_${i}_email`]: "Invalid email" }));
                          else
                            setErrors((p) => { const n = { ...p }; delete n[`nc_${i}_email`]; return n; });
                        }} />
                    </Field>

                    <Field label="Phone">
                      <input className={cx()} placeholder="+33 1 23 45 67 89"
                        value={nc.phone}
                        onChange={(e) => updateNewContact(i, "phone", e.target.value)} />
                    </Field>

                    <Field label="Role label">
                      <input className={cx()} placeholder="Quality Manager, Sales Contact…"
                        value={nc.role_label}
                        onChange={(e) => updateNewContact(i, "role_label", e.target.value)} />
                    </Field>

                    <Field label="Detailed role description">
                      <input className={cx()} placeholder="Full role description"
                        value={nc.role_name}
                        onChange={(e) => updateNewContact(i, "role_name", e.target.value)} />
                    </Field>

                    <Field label="" span={2}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={nc.is_primary_contact}
                          onChange={(e) => updateNewContact(i, "is_primary_contact", e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
                        <span className="text-sm font-medium text-slate-700">Primary contact</span>
                        <span className="text-xs text-slate-400">— receives all notifications for this unit</span>
                      </label>
                    </Field>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addNewContact}
                className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:bg-slate-50">
                + Add another contact
              </button>
            </div>
          )}
        </Section>

        {/* ── 6. Certifications ───────────────────────────────────────── */}
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
// Helpers
// ---------------------------------------------------------------------------

const cx = (error?: string) =>
  `w-full rounded-xl border ${error ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"} px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-[#0f2744]/40 focus:ring-4 focus:ring-[#0f2744]/8`;

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
    {label && <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>}
    {children}
    {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// Certification card (unchanged)
// ---------------------------------------------------------------------------

const CertCard: React.FC<{
  cert: CertRow; index: number; errors: Record<string, string>;
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
            <select value={cert.certification_type}
              onChange={(e) => onField("certification_type", e.target.value)} className={cx()}>
              <option value="">Select certification…</option>
              {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}

        <Field label="Name / Reference" span={2}>
          <input className={cx()} placeholder="e.g. QMS-2024-CN-001"
            value={cert.certificate_name}
            onChange={(e) => onField("certificate_name", e.target.value)} />
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
            value={cert.comments}
            onChange={(e) => onField("comments", e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Document</label>
          <div onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-4 py-3 transition ${
              cert.file ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-white hover:border-slate-400"
            }`}>
            {cert.file ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <span className="max-w-xs truncate font-semibold">{cert.file.name}</span>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onField("file", null); if (fileRef.current) fileRef.current.value = ""; }}
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

