import React, { useCallback } from "react";
import { UserPlus, X } from "lucide-react";
import {
  ALL_FAMILIES,
  ALL_COMMODITIES,
  getSubFamiliesForFamilies,
  getFamiliesForCommodities,
} from "../../data/familySubfamilyData";
import {
  UnitFormData,
  ContactFormData,
  FormErrors,
} from "../../types/onboarding";
import {
  CreatableMultiSelect,
  FormInput,
  FormCheckbox,
  FormSelect,
} from "./FormElements";

interface SupplierUnitFormProps {
  data: UnitFormData;
  errors: FormErrors;
  unitContactErrors?: { [key: number]: FormErrors };
  onChange: (field: keyof UnitFormData, value: any) => void;
  groupContacts?: ContactFormData[];
}

const COUNTRIES = [
  "China", "India", "Vietnam", "Thailand", "Indonesia",
  "Germany", "France", "Italy", "Poland", "Netherlands",
  "United States", "Canada", "Mexico", "Brazil", "Japan",
  "South Korea", "Taiwan", "Malaysia", "United Kingdom", "Spain",
  "Australia", "Other",
];

const DEFAULT_PRODUCT_LINES = [
  "Power Electronics", "Signal Processing", "Thermal Management",
  "EMC Solutions", "Energy Storage", "Drive Systems",
  "Automation & Control", "Lighting", "Wireless & RF",
];

const EMPTY_CONTACT: ContactFormData = {
  full_name: "", email: "", phone: "",
  role_label: "", role_name: "", is_primary_contact: false,
};

/** Compact inline section divider */
const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="col-span-2 mt-4 mb-1 flex items-center gap-3">
    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
      {label}
    </span>
    <div className="h-px flex-1 bg-slate-200" />
  </div>
);

export const SupplierUnitForm: React.FC<SupplierUnitFormProps> = ({
  data,
  errors,
  unitContactErrors = {},
  onChange,
  groupContacts = [],
}) => {
  const contacts: ContactFormData[] = data.unit_contacts ?? [];
  const hasGroupContacts = groupContacts.some((c) => c.full_name.trim());

  const availableFamilies = getFamiliesForCommodities(data.commodity ?? []);
  const availableSubFamilies = getSubFamiliesForFamilies(data.family);

  const toggleCommodity = (value: string) => {
    const next = (data.commodity ?? []).includes(value)
      ? (data.commodity ?? []).filter((c) => c !== value)
      : [...(data.commodity ?? []), value];
    onChange("commodity", next);
    // Reset families that are no longer valid for the new commodity set
    if (next.length > 0) {
      const allowed = getFamiliesForCommodities(next);
      const cleanedFamilies = data.family.filter((f) => allowed.includes(f));
      if (cleanedFamilies.length !== data.family.length) {
        onChange("family", cleanedFamilies);
      }
    }
  };

  const handleFamilyChange = useCallback(
    (newFamilies: string[]) => {
      onChange("family", newFamilies);
      if (newFamilies.length > 0) {
        const allowed = getSubFamiliesForFamilies(newFamilies);
        const cleaned = data.sub_family.filter((sf) => allowed.includes(sf));
        if (cleaned.length !== data.sub_family.length) {
          onChange("sub_family", cleaned);
        }
      }
    },
    [data.sub_family, onChange],
  );

  const updateContact = (index: number, field: keyof ContactFormData, value: any) => {
    const updated = contacts.map((c, i) => i === index ? { ...c, [field]: value } : c);
    onChange("unit_contacts", updated);
  };

  const addContact = () => onChange("unit_contacts", [...contacts, { ...EMPTY_CONTACT }]);
  const removeContact = (index: number) =>
    onChange("unit_contacts", contacts.filter((_, i) => i !== index));

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-sm font-bold text-slate-900">Unit Location</h2>
        <p className="mt-0.5 text-xs text-slate-500">Physical plant or operating location for this unit</p>
      </div>

      <div className="px-6 py-5">
        {/* ── Location ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <FormInput
              label="Unit Name"
              name="supplier_code"
              value={data.supplier_code}
              onChange={(e) => onChange("supplier_code", e.target.value)}
              placeholder="e.g., ACME-CN-001"
              error={errors.supplier_code}
              required
              helperText="Unique identifier for this unit"
            />
          </div>

          <div className="md:col-span-2">
            <FormInput
              label="Street Address"
              name="address_line"
              value={data.address_line}
              onChange={(e) => onChange("address_line", e.target.value)}
              placeholder="e.g., 123 Industrial Park Road"
              error={errors.address_line}
            />
          </div>

          <FormInput
            label="City"
            name="city"
            value={data.city}
            onChange={(e) => onChange("city", e.target.value)}
            placeholder="e.g., Shanghai"
            error={errors.city}
          />

          <FormSelect
            label="Country"
            name="country"
            value={data.country}
            onChange={(e) => onChange("country", e.target.value)}
            options={COUNTRIES.map((c) => ({ value: c, label: c }))}
            placeholder="Select country"
            error={errors.country}
          />

          <FormInput
            label="Continent"
            name="continent"
            value={data.continent}
            onChange={(e) => onChange("continent", e.target.value)}
            placeholder="e.g., Asia, Europe"
            error={errors.continent}
          />

          <FormInput
            label="Area / Region"
            name="area"
            value={data.area}
            onChange={(e) => onChange("area", e.target.value)}
            placeholder="e.g., Greater China, Central Europe"
            error={errors.area}
          />

          <div className="md:col-span-2">
            <FormInput
              label="Website"
              name="website"
              type="url"
              value={data.website}
              onChange={(e) => onChange("website", e.target.value)}
              placeholder="https://supplier.com"
              error={errors.website}
            />
          </div>

          {/* ── Commodity ──────────────────────────────────────────────── */}
          <SectionDivider label="Commodity" />

          <div className="md:col-span-2">
            <div className="mb-1.5 flex items-center gap-1">
              <label className="form-label">Commodity</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_COMMODITIES.map((option) => {
                const selected = (data.commodity ?? []).includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleCommodity(option)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
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
            {errors.commodity && (
              <p className="form-error mt-1">{errors.commodity}</p>
            )}
            <p className="form-helper mt-1">Filters the available families below.</p>
          </div>

          {/* ── Product Classification ──────────────────────────────────── */}
          <SectionDivider label="Product Classification" />

          <div>
            <CreatableMultiSelect
              label="Family"
              name="family"
              value={data.family}
              onChange={handleFamilyChange}
              storageKey="unit_family"
              defaultOptions={ALL_FAMILIES}
              availableOptions={(data.commodity ?? []).length > 0 ? availableFamilies : undefined}
              placeholder="Select or type a family…"
              helperText={
                (data.commodity ?? []).length > 0
                  ? `${availableFamilies.length} families for selected commodities`
                  : "Product family (multiple allowed)"
              }
            />
          </div>

          <div>
            <CreatableMultiSelect
              label="Sub Family"
              name="sub_family"
              value={data.sub_family}
              onChange={(v) => onChange("sub_family", v)}
              storageKey="unit_sub_family"
              availableOptions={availableSubFamilies}
              placeholder={data.family.length === 0 ? "Select a family first…" : "Select sub-families…"}
              helperText={
                data.family.length === 0
                  ? "Filtered by selected families"
                  : `${availableSubFamilies.length} sub-families available`
              }
            />
          </div>

          <div className="md:col-span-2">
            <CreatableMultiSelect
              label="Product Line"
              name="product_line"
              value={data.product_line}
              onChange={(v) => onChange("product_line", v)}
              storageKey="unit_product_line"
              defaultOptions={DEFAULT_PRODUCT_LINES}
              placeholder="e.g., Power Electronics, EMC Solutions…"
              helperText="Specific product lines or application areas"
            />
          </div>

          {/* ── Sustainability ──────────────────────────────────────────── */}
          <SectionDivider label="Sustainability" />

          <FormInput
            label="Carbon Footprint"
            name="carbon_footprint"
            value={data.carbon_footprint}
            onChange={(e) => onChange("carbon_footprint", e.target.value)}
            placeholder="e.g., 12 500"
            suffix="tCO₂e"
            helperText="Annual carbon footprint"
            error={errors.carbon_footprint}
          />

          <FormInput
            label="Green Electricity"
            name="green_electricity_pct"
            type="number"
            value={data.green_electricity_pct}
            onChange={(e) => onChange("green_electricity_pct", e.target.value)}
            placeholder="0"
            min={0}
            max={100}
            suffix="%"
            helperText="Share from renewable sources"
            error={errors.green_electricity_pct}
          />
        </div>

        {/* ── Group contacts reference ────────────────────────────────── */}
        {hasGroupContacts && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Group Contacts
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="space-y-1.5">
              {groupContacts
                .filter((c) => c.full_name.trim())
                .map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs"
                  >
                    <span className="font-semibold text-slate-800">{c.full_name}</span>
                    {c.role_label && <span className="text-slate-500">· {c.role_label}</span>}
                    {c.email && <span className="ml-auto text-slate-400">{c.email}</span>}
                    {c.is_primary_contact && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Unit contacts ───────────────────────────────────────────── */}
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Unit Contacts
              </span>
              <div className="h-px w-12 bg-slate-200" />
            </div>
            <button
              type="button"
              onClick={addContact}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add contact
            </button>
          </div>

          {contacts.length === 0 ? (
            <div
              onClick={addContact}
              className="cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 py-6 text-center transition hover:border-slate-400 hover:bg-white"
            >
              <UserPlus className="mx-auto mb-1.5 h-4 w-4 text-slate-400" />
              <p className="text-xs font-medium text-slate-500">No unit contacts yet — click to add</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <div key={index} className="contact-card">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700">
                      Contact #{index + 1}
                      {contact.is_primary_contact && (
                        <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          Primary
                        </span>
                      )}
                    </h4>
                    {contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <FormInput
                        label="Full Name"
                        name={`unit-contact-${index}-full_name`}
                        value={contact.full_name}
                        onChange={(e) => updateContact(index, "full_name", e.target.value)}
                        placeholder="e.g., John Zhang"
                        required
                        error={unitContactErrors[index]?.full_name}
                      />
                    </div>
                    <FormInput
                      label="Email"
                      name={`unit-contact-${index}-email`}
                      type="email"
                      value={contact.email}
                      onChange={(e) => updateContact(index, "email", e.target.value)}
                      placeholder="john@supplier.com"
                      error={unitContactErrors[index]?.email}
                    />
                    <FormInput
                      label="Phone"
                      name={`unit-contact-${index}-phone`}
                      value={contact.phone}
                      onChange={(e) => updateContact(index, "phone", e.target.value)}
                      placeholder="+86 21 1234 5678"
                    />
                    <FormInput
                      label="Role"
                      name={`unit-contact-${index}-role_label`}
                      value={contact.role_label}
                      onChange={(e) => updateContact(index, "role_label", e.target.value)}
                      placeholder="e.g., Quality Manager"
                    />
                    <FormInput
                      label="Role description"
                      name={`unit-contact-${index}-role_name`}
                      value={contact.role_name}
                      onChange={(e) => updateContact(index, "role_name", e.target.value)}
                      placeholder="Full role description"
                    />
                    <div className="sm:col-span-2">
                      <FormCheckbox
                        label="Primary contact"
                        name={`unit-contact-${index}-primary`}
                        checked={contact.is_primary_contact}
                        onChange={(e) => updateContact(index, "is_primary_contact", e.target.checked)}
                        helperText="Receives all notifications for this unit"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
