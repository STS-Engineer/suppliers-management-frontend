/**
 * Supplier Unit Form Step
 */

import React from "react";
import { UnitFormData, FormErrors } from "../../types/onboarding";
import { FormInput, FormSelect } from "./FormElements";

interface SupplierUnitFormProps {
  data: UnitFormData;
  errors: FormErrors;
  onChange: (field: keyof UnitFormData, value: any) => void;
}

const COUNTRIES = [
  "China",
  "India",
  "Vietnam",
  "Thailand",
  "Indonesia",
  "Germany",
  "France",
  "Italy",
  "Poland",
  "Netherlands",
  "United States",
  "Canada",
  "Mexico",
  "Brazil",
  "Japan",
  "South Korea",
  "Taiwan",
  "Malaysia",
  "United Kingdom",
  "Spain",
  "Australia",
  "Other",
];

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CNY", "INR", "other"];

export const SupplierUnitForm: React.FC<SupplierUnitFormProps> = ({
  data,
  errors,
  onChange,
}) => {
  return (
    <div className="form-section">
      <div className="section-header">
        <h2>Unit Location</h2>
        <p>Register the supplier unit, plant, or operating location details.</p>
      </div>

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

        <div className="col-span-2 mt-2 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            Products & Services
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Describe the products, materials, or services provided by this
            supplier unit.
          </p>
        </div>

        <FormInput
          label="Product Type"
          name="product_type"
          value={data.product_type}
          onChange={(e) => onChange("product_type", e.target.value)}
          placeholder="e.g., Electronics, Chemicals"
          error={errors.product_type}
        />

        <FormInput
          label="Product Category"
          name="product_category"
          value={data.product_category}
          onChange={(e) => onChange("product_category", e.target.value)}
          placeholder="e.g., Semiconductors, PCBs"
          error={errors.product_category}
        />

        <div className="col-span-2 mt-2 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            Annual Volume & Spend
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Capture the estimated yearly business volume for this supplier unit.
          </p>
        </div>

        <FormInput
          label="Annual Spend Value"
          name="amount_value"
          type="number"
          value={data.amount_value}
          onChange={(e) => onChange("amount_value", e.target.value)}
          placeholder="0.00"
          error={errors.amount_value}
          helperText="Estimated annual purchase amount"
        />

        <FormSelect
          label="Main Currency"
          name="amount_currency"
          value={data.amount_currency}
          onChange={(e) => onChange("amount_currency", e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          placeholder="Select currency"
        />
      </div>
    </div>
  );
};
