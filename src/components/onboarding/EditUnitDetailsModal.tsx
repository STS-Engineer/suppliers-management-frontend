/**
 * EditUnitDetailsModal — single unified place to edit a supplier unit's
 * profile fields and manage its contacts, opened from the "Edit details"
 * button in UnitSiteRelationsPanel's header.
 *
 * Two sections:
 *  - Unit Details: the descriptive/free-text unit fields that are most
 *    prone to a typo at onboarding time (name, address, commodity
 *    classification, sustainability figures, etc). Reuses the same form
 *    primitives and commodity→family→sub-family cascade as SupplierUnitForm
 *    so editing feels identical to creation.
 *  - Contacts: the SUPPLIER-side people to reach for this unit (name,
 *    email, phone, role — one can be marked "Primary"). This is a distinct
 *    concept from the "Supplier Owner", which is the AVOCARBON buyer /
 *    commodity leader responsible for the relation (set elsewhere, on the
 *    relation itself) — see the note in the Contacts section header.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Globe2,
  Info,
  Leaf,
  MapPin,
  Pencil,
  Sprout,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { ContactResponse, SupplierUnitResponse } from "../../types/onboarding";
import { supplierAPI } from "../../services/supplierOnboardingAPI";
import { useAuth } from "../../context/AuthContext";
import { broadcastInvalidate } from "../../lib/crossTabSync";
import { SectionCard } from "../UI";
import {
  CreatableMultiSelect,
  FormCheckbox,
  FormInput,
  FormSelect,
} from "./FormElements";
import {
  ALL_COMMODITIES,
  ALL_FAMILIES,
  getFamiliesForCommodities,
  getSubFamiliesForFamilies,
  toDisplayLabel,
} from "../../data/familySubfamilyData";
import { COUNTRIES, DEFAULT_PRODUCT_LINES } from "../../data/onboardingConstants";

interface Props {
  unit: SupplierUnitResponse;
  onClose: () => void;
  onUnitUpdated: (updatedUnit: SupplierUnitResponse) => void;
}

type UnitFormState = {
  supplier_name: string;
  address_line: string;
  city: string;
  country: string;
  continent: string;
  area: string;
  commodity: string[];
  family: string[];
  sub_family: string[];
  product_line: string[];
  website: string;
  carbon_footprint: string;
  green_electricity_pct: string;
};

const csvToArray = (v?: string | null): string[] =>
  v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

const toFormState = (unit: SupplierUnitResponse): UnitFormState => ({
  supplier_name: unit.supplier_name ?? "",
  address_line: unit.address_line ?? "",
  city: unit.city ?? "",
  country: unit.country ?? "",
  continent: unit.continent ?? "",
  area: unit.area ?? "",
  commodity: csvToArray(unit.commodity),
  family: csvToArray(unit.family),
  sub_family: csvToArray(unit.sub_family),
  product_line: csvToArray(unit.product_line),
  website: unit.website ?? "",
  carbon_footprint: unit.carbon_footprint ?? "",
  green_electricity_pct: unit.green_electricity_pct ?? "",
});

type ContactFormState = {
  full_name: string;
  email: string;
  phone: string;
  role_label: string;
  role_name: string;
  is_primary_contact: boolean;
};

const emptyContactForm: ContactFormState = {
  full_name: "",
  email: "",
  phone: "",
  role_label: "",
  role_name: "",
  is_primary_contact: false,
};

const contactToForm = (contact: ContactResponse): ContactFormState => ({
  full_name: contact.full_name ?? "",
  email: contact.email ?? "",
  phone: contact.phone ?? "",
  role_label: contact.role_label ?? "",
  role_name: contact.role_name ?? "",
  is_primary_contact: contact.is_primary_contact ?? false,
});

// ---------------------------------------------------------------------------
// Contact form fields — shared between the "add" and "edit" panels.
// ---------------------------------------------------------------------------
const ContactFields: React.FC<{
  form: ContactFormState;
  onChange: (patch: Partial<ContactFormState>) => void;
  idPrefix: string;
}> = ({ form, onChange, idPrefix }) => (
  <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormInput
          label="Full name"
          name={`${idPrefix}-full_name`}
          value={form.full_name}
          onChange={(e) => onChange({ full_name: e.target.value })}
          placeholder="e.g., John Zhang"
          required
        />
      </div>
      <FormInput
        label="Email"
        name={`${idPrefix}-email`}
        type="email"
        value={form.email}
        onChange={(e) => onChange({ email: e.target.value })}
        placeholder="john@supplier.com"
      />
      <FormInput
        label="Phone"
        name={`${idPrefix}-phone`}
        value={form.phone}
        onChange={(e) => onChange({ phone: e.target.value })}
        placeholder="+86 21 1234 5678"
      />
      <FormInput
        label="Role"
        name={`${idPrefix}-role_label`}
        value={form.role_label}
        onChange={(e) => onChange({ role_label: e.target.value })}
        placeholder="e.g., Quality Manager"
      />
      <FormInput
        label="Role description"
        name={`${idPrefix}-role_name`}
        value={form.role_name}
        onChange={(e) => onChange({ role_name: e.target.value })}
        placeholder="Optional — full role description"
      />
      <div className="sm:col-span-2">
        <FormCheckbox
          label="Primary contact for this unit"
          name={`${idPrefix}-primary`}
          checked={form.is_primary_contact}
          onChange={(e) => onChange({ is_primary_contact: e.target.checked })}
          helperText="The one main point of contact to reach at the supplier for this unit."
        />
      </div>
    </div>
  </div>
);

export const EditUnitDetailsModal: React.FC<Props> = ({
  unit,
  onClose,
  onUnitUpdated,
}) => {
  const queryClient = useQueryClient();

  // Editing a unit's own details (name, address, city, commodity, etc.) is
  // restricted to purchasing_director/vp_conversion — mirrors PRIVILEGED in
  // the backend suppliers router. Everyone else can still view every field,
  // they just can't submit changes.
  const { user } = useAuth();
  const canEditUnitDetails = ["purchasing_director", "vp_conversion"].includes(
    user?.access_profile ?? "",
  );

  // ── Unit details section ──────────────────────────────────────────────
  const [unitForm, setUnitForm] = useState<UnitFormState>(() => toFormState(unit));
  const [savingUnit, setSavingUnit] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [unitSaved, setUnitSaved] = useState(false);

  useEffect(() => {
    setUnitForm(toFormState(unit));
  }, [unit]);

  const updateUnitField = <K extends keyof UnitFormState>(
    field: K,
    value: UnitFormState[K],
  ) => {
    setUnitForm((prev) => ({ ...prev, [field]: value }));
    setUnitSaved(false);
  };

  const availableFamilies = useMemo(
    () => getFamiliesForCommodities(unitForm.commodity),
    [unitForm.commodity],
  );
  const availableSubFamilies = useMemo(
    () =>
      unitForm.family.length > 0
        ? getSubFamiliesForFamilies(unitForm.family)
        : [],
    [unitForm.family],
  );

  const toggleCommodity = (value: string) => {
    const next = unitForm.commodity.includes(value)
      ? unitForm.commodity.filter((c) => c !== value)
      : [...unitForm.commodity, value];
    updateUnitField("commodity", next);
    if (next.length > 0) {
      const allowed = getFamiliesForCommodities(next);
      const cleaned = unitForm.family.filter((f) => allowed.includes(f));
      if (cleaned.length !== unitForm.family.length) {
        updateUnitField("family", cleaned);
      }
    }
  };

  const handleFamilyChange = (next: string[]) => {
    updateUnitField("family", next);
    if (next.length > 0) {
      const allowed = getSubFamiliesForFamilies(next);
      const cleaned = unitForm.sub_family.filter((sf) => allowed.includes(sf));
      if (cleaned.length !== unitForm.sub_family.length) {
        updateUnitField("sub_family", cleaned);
      }
    }
  };

  const saveUnit = async () => {
    if (!canEditUnitDetails) return;
    setSavingUnit(true);
    setUnitError(null);
    setUnitSaved(false);
    try {
      const payload: Record<string, unknown> = {
        ...unitForm,
        commodity: unitForm.commodity.join(","),
        family: unitForm.family.join(","),
        sub_family: unitForm.sub_family.join(","),
        product_line: unitForm.product_line.join(","),
      };
      const res: any = await supplierAPI.updateSupplierUnit(
        unit.id_supplier_unit,
        payload,
      );
      const updated: SupplierUnitResponse =
        res?.data ?? { ...unit, ...payload };
      onUnitUpdated(updated);
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "sitePanel",
      });
      broadcastInvalidate("sitePanel");
      setUnitSaved(true);
    } catch (err) {
      setUnitError(
        err instanceof Error ? err.message : "Failed to save unit details.",
      );
    } finally {
      setSavingUnit(false);
    }
  };

  // ── Contacts section ──────────────────────────────────────────────────
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsError(null);
    try {
      const res: any = await supplierAPI.listContactsForUnit(unit.id_supplier_unit);
      setContacts(res?.data?.items ?? []);
    } catch {
      setContactsError("Failed to load contacts.");
    } finally {
      setContactsLoading(false);
    }
  }, [unit.id_supplier_unit]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const sortedContacts = useMemo(
    () =>
      [...contacts].sort(
        (a, b) => Number(b.is_primary_contact) - Number(a.is_primary_contact),
      ),
    [contacts],
  );

  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [editContactForm, setEditContactForm] =
    useState<ContactFormState>(emptyContactForm);
  const [savingContactId, setSavingContactId] = useState<number | null>(null);

  const startEditContact = (contact: ContactResponse) => {
    setEditingContactId(contact.id_contact);
    setEditContactForm(contactToForm(contact));
  };

  const cancelEditContact = () => {
    setEditingContactId(null);
    setEditContactForm(emptyContactForm);
  };

  const saveEditedContact = async () => {
    if (!canEditUnitDetails) return;
    if (editingContactId === null) return;
    if (!editContactForm.full_name.trim()) {
      setContactsError("Full name is required.");
      return;
    }
    setSavingContactId(editingContactId);
    setContactsError(null);
    try {
      await supplierAPI.updateContact(editingContactId, { ...editContactForm });
      setEditingContactId(null);
      setEditContactForm(emptyContactForm);
      await loadContacts();
    } catch (err) {
      setContactsError(
        err instanceof Error ? err.message : "Failed to update contact.",
      );
    } finally {
      setSavingContactId(null);
    }
  };

  const [addingContact, setAddingContact] = useState(false);
  const [newContactForm, setNewContactForm] =
    useState<ContactFormState>(emptyContactForm);
  const [savingNewContact, setSavingNewContact] = useState(false);

  const saveNewContact = async () => {
    if (!canEditUnitDetails) return;
    if (!newContactForm.full_name.trim()) {
      setContactsError("Full name is required to add a contact.");
      return;
    }
    setSavingNewContact(true);
    setContactsError(null);
    try {
      await supplierAPI.addContactToUnit(unit.id_supplier_unit, {
        ...newContactForm,
      });
      setNewContactForm(emptyContactForm);
      setAddingContact(false);
      await loadContacts();
    } catch (err) {
      setContactsError(
        err instanceof Error ? err.message : "Failed to add contact.",
      );
    } finally {
      setSavingNewContact(false);
    }
  };

  // Lock body scroll while the modal is open (same pattern as other modals
  // in this folder, e.g. RelationDetailsModal).
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const scrollY = window.scrollY;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      window.scrollTo({ top: scrollY, behavior: "auto" });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#062B49]/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-[#f4f7fa] shadow-[0_40px_100px_rgba(6,43,73,0.32)]">
        {/* Hero header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0C2A45] via-[#0f3459] to-[#153f66] px-7 py-6 text-white">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-white/5"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">
                  Edit unit details
                </p>
                <h2 className="mt-0.5 text-xl font-bold tracking-tight">
                  {unit.supplier_name || "Unnamed unit"}
                </h2>
                {(unit.city || unit.country) && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
                    <MapPin className="h-3.5 w-3.5" />
                    {[unit.city, unit.country].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl border border-white/15 bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-7">
          <div className="space-y-6">
            {/* ── Unit details ── */}
            <SectionCard
              title="Unit details"
              subtitle="Fix a typo or update the profile captured for this unit at onboarding."
              action={
                <div className="flex items-center gap-3">
                  {unitSaved && (
                    <span className="text-xs font-semibold text-emerald-600">
                      Saved
                    </span>
                  )}
                  {unitError && (
                    <span className="text-xs font-medium text-rose-600">
                      {unitError}
                    </span>
                  )}
                  {canEditUnitDetails ? (
                    <button
                      type="button"
                      onClick={saveUnit}
                      disabled={savingUnit}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f2744] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0f2744]/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {savingUnit ? "Saving…" : "Save unit details"}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-slate-400">
                      Read-only — only Purchasing Director / VP Conversion can edit.
                    </span>
                  )}
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormInput
                    label="Unit name"
                    name="supplier_name"
                    value={unitForm.supplier_name}
                    onChange={(e) => updateUnitField("supplier_name", e.target.value)}
                    required
                    disabled={!canEditUnitDetails}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FormInput
                    label="Street address"
                    name="address_line"
                    value={unitForm.address_line}
                    onChange={(e) => updateUnitField("address_line", e.target.value)}
                    disabled={!canEditUnitDetails}
                  />
                </div>
                <FormInput
                  label="City"
                  name="city"
                  value={unitForm.city}
                  onChange={(e) => updateUnitField("city", e.target.value)}
                  disabled={!canEditUnitDetails}
                />
                <FormSelect
                  label="Country"
                  name="country"
                  value={unitForm.country}
                  onChange={(e) => updateUnitField("country", e.target.value)}
                  options={COUNTRIES.map((c) => ({ value: c, label: c }))}
                  placeholder="Select country"
                  disabled={!canEditUnitDetails}
                />
                <FormInput
                  label="Continent"
                  name="continent"
                  value={unitForm.continent}
                  onChange={(e) => updateUnitField("continent", e.target.value)}
                  disabled={!canEditUnitDetails}
                />
                <FormInput
                  label="Area / region"
                  name="area"
                  value={unitForm.area}
                  onChange={(e) => updateUnitField("area", e.target.value)}
                  disabled={!canEditUnitDetails}
                />
                <div className="sm:col-span-2">
                  <FormInput
                    label="Website"
                    name="website"
                    type="url"
                    value={unitForm.website}
                    onChange={(e) => updateUnitField("website", e.target.value)}
                    placeholder="https://supplier.com"
                    disabled={!canEditUnitDetails}
                  />
                </div>

                {/* ── Commodity classification ── */}
                <div className="sm:col-span-2 mt-2 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <Globe2 className="h-3.5 w-3.5" />
                    Commodity classification
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="sm:col-span-2">
                  <label className="form-label">Commodity</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_COMMODITIES.map((option) => {
                      const selected = unitForm.commodity.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => canEditUnitDetails && toggleCommodity(option)}
                          disabled={!canEditUnitDetails}
                          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            selected
                              ? "border-[#0f2744] bg-[#0f2744] text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <p className="form-helper mt-1">Filters the families below.</p>
                </div>

                <div className="sm:col-span-2">
                  <CreatableMultiSelect
                    label="Family"
                    name="family"
                    value={unitForm.family}
                    onChange={handleFamilyChange}
                    storageKey="unit_family"
                    defaultOptions={ALL_FAMILIES}
                    availableOptions={
                      unitForm.commodity.length > 0 ? availableFamilies : undefined
                    }
                    displayLabel={toDisplayLabel}
                    placeholder="Select or type a family…"
                    helperText={
                      unitForm.commodity.length > 0
                        ? `${availableFamilies.length} families for selected commodities`
                        : "Product family (multiple allowed)"
                    }
                    disabled={!canEditUnitDetails}
                  />
                </div>

                <div className="sm:col-span-2">
                  <CreatableMultiSelect
                    label="Sub-family"
                    name="sub_family"
                    value={unitForm.sub_family}
                    onChange={(v) => updateUnitField("sub_family", v)}
                    storageKey="unit_sub_family"
                    availableOptions={availableSubFamilies}
                    displayLabel={toDisplayLabel}
                    disabled={!canEditUnitDetails || unitForm.family.length === 0}
                    placeholder={
                      unitForm.family.length === 0
                        ? "Select a family first…"
                        : "Select sub-families…"
                    }
                    helperText={
                      unitForm.family.length === 0
                        ? "Select a family first"
                        : `${availableSubFamilies.length} sub-families available`
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <CreatableMultiSelect
                    label="Product line"
                    name="product_line"
                    value={unitForm.product_line}
                    onChange={(v) => updateUnitField("product_line", v)}
                    storageKey="unit_product_line"
                    defaultOptions={DEFAULT_PRODUCT_LINES}
                    placeholder="e.g., Assembly, Brush, Seals…"
                    helperText="Specific product lines or application areas"
                    disabled={!canEditUnitDetails}
                  />
                </div>

                {/* ── Sustainability ── */}
                <div className="sm:col-span-2 mt-2 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <Leaf className="h-3.5 w-3.5" />
                    Sustainability
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <FormInput
                  label="Carbon footprint"
                  name="carbon_footprint"
                  value={unitForm.carbon_footprint}
                  onChange={(e) => updateUnitField("carbon_footprint", e.target.value)}
                  placeholder="e.g., 12 500"
                  suffix="tCO₂e"
                  disabled={!canEditUnitDetails}
                />
                <FormInput
                  label="Green electricity"
                  name="green_electricity_pct"
                  type="number"
                  value={unitForm.green_electricity_pct}
                  onChange={(e) =>
                    updateUnitField("green_electricity_pct", e.target.value)
                  }
                  min={0}
                  max={100}
                  suffix="%"
                  disabled={!canEditUnitDetails}
                />
              </div>
            </SectionCard>

            {/* ── Contacts ── */}
            <SectionCard
              title="Contacts"
              subtitle="Who to reach at the supplier for this unit — not the Avocarbon side."
              action={
                canEditUnitDetails && !addingContact && (
                  <button
                    type="button"
                    onClick={() => setAddingContact(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add contact
                  </button>
                )
              }
            >
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-xs leading-5 text-sky-900">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
                <p>
                  These are <strong>supplier-side</strong> people — the main
                  point of contact for this unit. This is different from the{" "}
                  <strong>Supplier Owner</strong> (the AVOCARBON buyer /
                  commodity leader responsible for this relation), which is
                  set from the relation's own details, not here.
                </p>
              </div>

              {contactsError && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {contactsError}
                </div>
              )}

              {contactsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  Loading contacts…
                </div>
              ) : sortedContacts.length === 0 && !addingContact ? (
                <div
                  onClick={() => canEditUnitDetails && setAddingContact(true)}
                  className={`rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-8 text-center transition ${
                    canEditUnitDetails
                      ? "cursor-pointer hover:border-slate-400 hover:bg-white"
                      : ""
                  }`}
                >
                  <Users className="mx-auto mb-1.5 h-5 w-5 text-slate-400" />
                  <p className="text-xs font-medium text-slate-500">
                    {canEditUnitDetails
                      ? "No contacts recorded for this unit yet — click to add one"
                      : "No contacts recorded for this unit yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedContacts.map((contact) => (
                    <div
                      key={contact.id_contact}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.03)]"
                    >
                      {editingContactId === contact.id_contact ? (
                        <div className="space-y-3">
                          <ContactFields
                            form={editContactForm}
                            onChange={(patch) =>
                              setEditContactForm((f) => ({ ...f, ...patch }))
                            }
                            idPrefix={`edit-${contact.id_contact}`}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={saveEditedContact}
                              disabled={savingContactId === contact.id_contact}
                              className="rounded-lg bg-[#0f2744] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#0f2744]/90 disabled:opacity-50"
                            >
                              {savingContactId === contact.id_contact
                                ? "Saving…"
                                : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditContact}
                              className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                              {(contact.full_name || "?")[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                                {contact.full_name || "—"}
                                {contact.is_primary_contact && (
                                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                    Primary
                                  </span>
                                )}
                                {contact.role_label && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                    {contact.role_label}
                                  </span>
                                )}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {[contact.email, contact.phone]
                                  .filter(Boolean)
                                  .join(" · ") || "No contact details"}
                              </p>
                            </div>
                          </div>
                          {canEditUnitDetails && (
                            <button
                              type="button"
                              onClick={() => startEditContact(contact)}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {addingContact && (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    <Sprout className="h-3.5 w-3.5" />
                    New contact
                  </div>
                  <ContactFields
                    form={newContactForm}
                    onChange={(patch) =>
                      setNewContactForm((f) => ({ ...f, ...patch }))
                    }
                    idPrefix="new-contact"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveNewContact}
                      disabled={savingNewContact}
                      className="rounded-lg bg-[#0f2744] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#0f2744]/90 disabled:opacity-50"
                    >
                      {savingNewContact ? "Saving…" : "Add contact"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingContact(false);
                        setNewContactForm(emptyContactForm);
                      }}
                      className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
};
