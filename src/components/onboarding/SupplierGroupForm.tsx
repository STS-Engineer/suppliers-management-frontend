import React from "react";
import { GroupFormData, FormErrors } from "../../types/onboarding";
import { FormInput, FormSelect } from "./FormElements";
import { MemberDirectoryPicker } from "../common/MemberDirectoryPicker";
import supplierAPI from "../../services/supplierOnboardingAPI";

interface SupplierGroupFormProps {
  data: GroupFormData;
  errors: FormErrors;
  onChange: (field: keyof GroupFormData, value: any) => void;
  onBlur?: (field: keyof GroupFormData) => void;
}

export const SupplierGroupForm: React.FC<SupplierGroupFormProps> = ({
  data,
  errors,
  onChange,
  onBlur,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-sm font-bold text-slate-900">Supplier Group Information</h2>
        <p className="mt-0.5 text-xs text-slate-500">Parent entity — shared across all units</p>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <FormInput
              label="Supplier Group Name"
              name="nom"
              value={data.nom}
              onChange={(e) => onChange("nom", e.target.value)}
              placeholder="e.g., Mersen Group, Kemet Group"
              error={errors.nom}
              required
              helperText="Legal or commercial group name"
            />
          </div>

          <FormSelect
            label="Scope"
            name="supplier_scope"
            value={data.supplier_scope}
            onChange={(e) => onChange("supplier_scope", e.target.value)}
            options={[
              { value: "local", label: "Local" },
              { value: "global", label: "Global" },
            ]}
            placeholder="Select scope"
            error={errors.supplier_scope}
            required
          />

          <div className="form-group">
            <label htmlFor="supplier_owner" className="form-label">
              Global Owner Email
              {data.supplier_scope === "global" && <span className="ml-1 text-red-500">*</span>}
            </label>
            <MemberDirectoryPicker
              fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
              fetchKey="group_owner"
              value={data.supplier_owner}
              onChange={(email) => onChange("supplier_owner", email)}
              placeholder="name@avocarbon.com"
            />
            {errors.supplier_owner && <p className="form-error">{errors.supplier_owner}</p>}
            <p className="form-helper">
              {data.supplier_scope === "global"
                ? "Default owner for all unit-site relations"
                : "Leave blank for local suppliers"}
            </p>
          </div>

          {/* Commodity — inherited from units */}
          <div className="md:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Commodities are set at unit level</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Select the commodity for each unit in the next step. The group will automatically inherit the aggregated set from all its units.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
