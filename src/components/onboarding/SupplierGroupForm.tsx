/**
 * =========================================================
 * SupplierGroupForm.tsx
 * ONLY supplier group identity information
 * =========================================================
 */

import React from "react";
import { GroupFormData, FormErrors } from "../../types/onboarding";
import { FormInput, FormSelect } from "./FormElements";

const CATEGORY_OPTIONS = [
  "Electronic",
  "Material",
  "Plastic/Stamping",
  "Ferrites",
  "Wire for brushes",
  "Wire for Chokes",
];

interface SupplierGroupFormProps {
  data: GroupFormData;
  errors: FormErrors;
  onChange: (field: keyof GroupFormData, value: any) => void;
}

export const SupplierGroupForm: React.FC<SupplierGroupFormProps> = ({
  data,
  errors,
  onChange,
}) => {
  const toggleCategory = (value: string) => {
    const nextValue = data.supplier_type.includes(value)
      ? data.supplier_type.filter((entry) => entry !== value)
      : [...data.supplier_type, value];

    onChange("supplier_type", nextValue);
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="px-6 sm:px-8 py-8">
        <div className="section-header mb-8">
          <div className="section-header-content">
            <h2 className="section-header-title">Supplier Group Information</h2>

            <p className="section-header-subtitle">
              Parent supplier group information
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <FormInput
              label="Supplier Group Name"
              name="nom"
              value={data.nom}
              onChange={(e) => onChange("nom", e.target.value)}
              placeholder="e.g., Mersen Group, Kemet Group"
              error={errors.nom}
              required
              helperText="Parent supplier group or legal supplier group"
            />
          </div>

          <FormSelect
            label="Supplier Scope"
            name="supplier_scope"
            value={data.supplier_scope}
            onChange={(e) => onChange("supplier_scope", e.target.value)}
            options={[
              { value: "local", label: "Local" },
              { value: "regional", label: "Regional" },
              { value: "global", label: "Global" },
            ]}
            placeholder="Select supplier scope"
            error={errors.supplier_scope}
            required
          />

          <div className="md:col-span-2">
            <FormInput
              label="Global Supplier Owner Email"
              name="supplier_owner"
              type="email"
              value={data.supplier_owner}
              onChange={(e) => onChange("supplier_owner", e.target.value)}
              placeholder="name@avocarbon.com"
              error={errors.supplier_owner}
              required={data.supplier_scope === "global"}
              helperText={
                data.supplier_scope === "global"
                  ? "This owner will be used by default for all unit-site relations."
                  : "Leave blank for local or regional suppliers. Site assignment will request the owner later."
              }
            />
          </div>

          <div className="md:col-span-2">
            <label className="form-label">
              Category
              <span className="ml-1 text-red-500">*</span>
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              {CATEGORY_OPTIONS.map((option) => {
                const selected = data.supplier_type.includes(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleCategory(option)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-blue-700 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {errors.supplier_type && (
              <p className="form-error">{errors.supplier_type}</p>
            )}
            <p className="form-helper">
              Select one or more categories for this supplier group.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
