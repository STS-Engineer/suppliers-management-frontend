/**
 * Supplier Unit Form Step
 */

import React from "react";
import { UserPlus, X } from "lucide-react";
import { UnitFormData, ContactFormData, FormErrors } from "../../types/onboarding";
import { CreatableMultiSelect, FormInput, FormCheckbox } from "./FormElements";

interface SupplierUnitFormProps {
  data: UnitFormData;
  errors: FormErrors;
  onChange: (field: keyof UnitFormData, value: any) => void;
  groupContacts?: ContactFormData[];
}

const COUNTRIES = [
  "China", "India", "Vietnam", "Thailand", "Indonesia",
  "Germany", "France", "Italy", "Poland", "Netherlands",
  "United States", "Canada", "Mexico", "Brazil",
  "Japan", "South Korea", "Taiwan", "Malaysia",
  "United Kingdom", "Spain", "Australia", "Other",
];

const DEFAULT_FAMILIES = [
  "Electronics", "Electromechanical", "Magnetics", "Passive Components",
  "Chemicals", "Raw Materials", "Metals", "Plastics", "Packaging",
  "Mechanical Parts", "PCB & Assemblies", "Cables & Connectors",
  "Software & Services", "Tooling & Equipment",
];

const DEFAULT_CATEGORIES = [
  "Ferrites", "Chokes", "Wire coils", "Inductors", "Transformers",
  "Capacitors", "Resistors", "Diodes", "MOSFETs", "IGBTs",
  "Sensors", "Filters", "Connectors", "Switches", "Relays",
  "Motors", "PCB Assemblies", "Cables", "Coatings", "Laminates",
];

const DEFAULT_SUB_FAMILIES = [
  "Ferrites", "Inductors", "Transformers", "Capacitors", "Resistors",
  "Diodes", "MOSFETs", "IGBTs", "Sensors", "Filters",
  "Connectors", "Switches", "Relays", "Motors", "Coatings",
  "Adhesives", "Laminates", "Substrates",
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

export const SupplierUnitForm: React.FC<SupplierUnitFormProps> = ({
  data, errors, onChange, groupContacts = [],
}) => {
  const contacts: ContactFormData[] = data.unit_contacts ?? [];
  const hasGroupContacts = groupContacts.some((c) => c.full_name.trim());

  const updateContact = (index: number, field: keyof ContactFormData, value: any) => {
    const updated = contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    onChange("unit_contacts", updated);
  };

  const addContact = () => onChange("unit_contacts", [...contacts, { ...EMPTY_CONTACT }]);
  const removeContact = (index: number) =>
    onChange("unit_contacts", contacts.filter((_, i) => i !== index));

  return (
    <div className="form-section">
      <div className="section-header">
        <h2>Unit Location</h2>
        <p>Register the supplier unit, plant, or operating location details.</p>
      </div>

      {/* ── Identity ── */}
      <div className="form-grid">
        <div className="col-span-2">
          <FormInput
            label="Supplier name"
            name="supplier_code"
            value={data.supplier_code}
            onChange={(e) => onChange("supplier_code", e.target.value)}
            placeholder="e.g., ACME-CN-001"
            error={errors.supplier_code}
            required
            helperText="Unique identifier for this supplier unit"
          />
        </div>

        <div className="col-span-2">
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
          label="Website"
          name="website"
          type="url"
          value={data.website}
          onChange={(e) => onChange("website", e.target.value)}
          placeholder="https://supplier.com"
          error={errors.website}
        />
      </div>

      {/* ── Product classification ── */}
      <div className="col-span-2 mt-6 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">Product Classification</h3>
        <p className="mt-1 text-sm text-slate-500">
          Classify the products or services provided by this unit. Select existing values or type to create new ones.
        </p>
      </div>

      <div className="form-grid mt-4">
        <div className="col-span-2 md:col-span-1">
          <CreatableMultiSelect
            label="Family"
            name="family"
            value={data.family}
            onChange={(v) => onChange("family", v)}
            storageKey="unit_family"
            defaultOptions={DEFAULT_FAMILIES}
            placeholder="e.g., Electronics, Magnetics…"
            helperText="Main product family for this unit"
          />
        </div>

        <div className="col-span-2 md:col-span-1">
          <CreatableMultiSelect
            label="Sub Family"
            name="sub_family"
            value={data.sub_family}
            onChange={(v) => onChange("sub_family", v)}
            storageKey="unit_sub_family"
            defaultOptions={DEFAULT_SUB_FAMILIES}
            placeholder="e.g., Ferrites, Capacitors…"
            helperText="Sub-category within the family"
          />
        </div>

        <div className="col-span-2">
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
      </div>

      {/* ── Sustainability & qualification ── */}
      <div className="col-span-2 mt-6 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">Sustainability &amp; Qualification</h3>
        <p className="mt-1 text-sm text-slate-500">
          Environmental data and supplier qualification category.
        </p>
      </div>

      <div className="form-grid mt-4">
        <FormInput
          label="Carbon Footprint"
          name="carbon_footprint"
          value={data.carbon_footprint}
          onChange={(e) => onChange("carbon_footprint", e.target.value)}
          placeholder="e.g., 12 500"
          suffix="tCO₂e"
          helperText="Annual carbon footprint in tonnes CO₂ equivalent"
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
          helperText="Share of electricity from renewable sources"
          error={errors.green_electricity_pct}
        />

        <FormInput
          label="Copper / Brass content"
          name="copper_brass_pct"
          type="number"
          value={data.copper_brass_pct}
          onChange={(e) => onChange("copper_brass_pct", e.target.value)}
          placeholder="0"
          min={0}
          max={100}
          suffix="%"
          helperText="Percentage of copper or brass in the product"
          error={errors.copper_brass_pct}
        />

        <CreatableMultiSelect
          label="Category"
          name="category"
          value={data.category}
          onChange={(v) => onChange("category", v)}
          storageKey="unit_category"
          defaultOptions={DEFAULT_CATEGORIES}
          placeholder="e.g., Ferrites, Chokes, Wire coils…"
          helperText="Product categories supplied by this unit"
        />
      </div>

      {/* ── Group contacts reference ── */}
      {hasGroupContacts && (
        <div className="mt-8">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Group contacts (reference)</h3>
          <p className="mb-3 text-xs text-slate-500">
            Registered at group level — apply to all units in this supplier group.
          </p>
          <div className="space-y-1.5">
            {groupContacts.filter((c) => c.full_name.trim()).map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
                <span className="font-semibold text-slate-800">{c.full_name}</span>
                {c.role_label && <span className="text-slate-500">· {c.role_label}</span>}
                {c.email && <span className="ml-auto text-slate-400">{c.email}</span>}
                {c.is_primary_contact && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Primary</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Unit-specific contacts ── */}
      <div className="mt-8">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Unit contacts</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Supplier-side contacts specific to this unit (quality manager, sales contact, etc.).
            </p>
          </div>
          <button
            type="button"
            onClick={addContact}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add contact
          </button>
        </div>

        {contacts.length === 0 ? (
          <div
            onClick={addContact}
            className="mt-3 cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-slate-400 hover:bg-white"
          >
            <UserPlus className="mx-auto mb-2 h-5 w-5 text-slate-400" />
            <p className="text-sm font-medium text-slate-500">No unit contacts yet</p>
            <p className="mt-0.5 text-xs text-slate-400">Click to add the first contact for this unit</p>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {contacts.map((contact, index) => (
              <div key={index} className="contact-card">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">
                    Contact #{index + 1}
                    {contact.is_primary_contact && (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Primary</span>
                    )}
                  </h4>
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(index)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <div className="col-span-2">
                    <FormInput
                      label="Full Name"
                      name={`unit-contact-${index}-full_name`}
                      value={contact.full_name}
                      onChange={(e) => updateContact(index, "full_name", e.target.value)}
                      placeholder="e.g., John Zhang"
                      required
                    />
                  </div>
                  <FormInput
                    label="Email"
                    name={`unit-contact-${index}-email`}
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateContact(index, "email", e.target.value)}
                    placeholder="john@supplier.com"
                  />
                  <FormInput
                    label="Phone"
                    name={`unit-contact-${index}-phone`}
                    value={contact.phone}
                    onChange={(e) => updateContact(index, "phone", e.target.value)}
                    placeholder="+86 21 1234 5678"
                  />
                  <FormInput
                    label="Role label"
                    name={`unit-contact-${index}-role_label`}
                    value={contact.role_label}
                    onChange={(e) => updateContact(index, "role_label", e.target.value)}
                    placeholder="e.g., Quality Manager"
                  />
                  <FormInput
                    label="Detailed role description"
                    name={`unit-contact-${index}-role_name`}
                    value={contact.role_name}
                    onChange={(e) => updateContact(index, "role_name", e.target.value)}
                    placeholder="Full role description"
                  />
                  <div className="col-span-2">
                    <FormCheckbox
                      label="Primary contact"
                      name={`unit-contact-${index}-primary`}
                      checked={contact.is_primary_contact}
                      onChange={(e) => updateContact(index, "is_primary_contact", e.target.checked)}
                      helperText="This contact will receive all notifications for this unit"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
