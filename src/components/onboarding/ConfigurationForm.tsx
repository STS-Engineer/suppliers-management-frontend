/**
 * ConfigurationForm.tsx
 * Site, supplier scope, owner, annual spend, and optional assessment template.
 *
 * Owner override: when the group has a supplier_owner (global groups), that
 * value is shown as default but the user can override it per relation.
 *
 * Unit contact: if a unit-level contact was entered in the unit step, it is
 * shown as the default responsible person for this relation. The user can
 * optionally add a different one.
 */

import React, { useEffect, useState } from "react";
import { FormErrors } from "../../types/onboarding";
import { FormInput, FormSelect } from "./FormElements";
import { supplierAPI } from "../../services/supplierOnboardingAPI";

export type SupplierScope = "local" | "global";

interface SiteOption {
  id_site: number;
  site_name: string;
  city?: string;
  country?: string;
}

interface TemplateOption {
  id_template: number;
  template_name?: string;
  name?: string;
}

interface ConfigurationFormProps {
  siteId: number | "";
  supplierScope: SupplierScope;
  supplierOwner: string;
  annualSpendValue: string;
  annualSpendCurrency: string;
  fiscalYear: number | "";
  templateId: number | "";
  errors: FormErrors;
  onChange: (field: string, value: any) => void;
  /** Group-level default owner (pre-fills the relation owner field) */
  groupSupplierOwner?: string;
  /** Unit-level contact (shown as default responsible person for this relation) */
  unitContactName?: string;
  unitContactEmail?: string;
  unitContactRole?: string;
}

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CNY", "INR", "MAD", "other"];

export const ConfigurationForm: React.FC<ConfigurationFormProps> = ({
  siteId,
  supplierScope,
  supplierOwner,
  annualSpendValue,
  annualSpendCurrency,
  fiscalYear,
  templateId,
  errors,
  onChange,
  groupSupplierOwner,
  unitContactName,
  unitContactEmail,
  unitContactRole,
}) => {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [sitesResponse, templatesResponse] = await Promise.all([
          supplierAPI.listSiteOptions(),
          supplierAPI.listAssessmentTemplates(),
        ]);

        if (!active) return;

        setSites(sitesResponse.data || []);
        setTemplates(templatesResponse.data || []);
      } catch (error) {
        console.error("Failed to load configuration options:", error);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const hasUnitContact = unitContactName?.trim();

  return (
    <div className="form-section">
      <div className="section-header">
        <h2>Scope &amp; Assignment</h2>
        <p>Configure the supplier relation, owner, annual spend, and baseline workflow.</p>
      </div>

      <div className="form-grid">
        {/* Site */}
        <div className="col-span-2">
          <FormSelect
            label="AVOCarbon Site (Plant)"
            name="site_id"
            value={siteId}
            onChange={(e) =>
              onChange("site_id", e.target.value ? Number(e.target.value) : "")
            }
            options={sites.map((site) => ({
              value: site.id_site,
              label: `${site.site_name} (${site.city || site.country || "Unknown"})`,
            }))}
            placeholder="Select the site for this supplier relation"
            error={errors.site_id}
            required
          />
        </div>

        {/* Scope */}
        <div className="col-span-2 border-t pt-6">
          <h3 className="section-subheader">Supplier Scope</h3>
        </div>

        <div className="col-span-2">
          <FormSelect
            label="Supplier Scope"
            name="supplier_scope"
            value={supplierScope}
            onChange={(e) => onChange("supplier_scope", e.target.value)}
            options={[
              {
                value: "local",
                label: "Local — One AVOCarbon site or local region",
              },
              {
                value: "global",
                label: "Global — Several countries or regions",
              },
            ]}
            placeholder="Select supplier scope"
            error={errors.supplier_scope}
            required
          />
        </div>

        <div className="classification-info col-span-2">
          {supplierScope === "global" && (
            <div className="info-box info-blue">
              <strong>Global Supplier</strong>
              <p>Supplier supports multiple countries, regions, or sites.</p>
            </div>
          )}
          {supplierScope === "local" && (
            <div className="info-box info-green">
              <strong>Local Supplier</strong>
              <p>Supplier supports one plant or local perimeter only.</p>
            </div>
          )}
        </div>

        {/* Supplier owner override */}
        <div className="col-span-2 border-t pt-6">
          <h3 className="section-subheader">Supplier Owner Assignment</h3>
          {groupSupplierOwner && (
            <p className="text-xs text-slate-500 mt-1">
              The group default owner is{" "}
              <span className="font-medium text-slate-700">
                {groupSupplierOwner}
              </span>
              . You can override it specifically for this unit–plant relation
              below.
            </p>
          )}
        </div>

        <div className="col-span-2">
          <FormInput
            label="Supplier Owner for this Relation"
            name="supplier_owner"
            value={supplierOwner}
            onChange={(e) => onChange("supplier_owner", e.target.value)}
            placeholder={
              groupSupplierOwner || "e.g., john.doe@avocarbon.com"
            }
            error={errors.supplier_owner}
            required
            helperText={
              groupSupplierOwner
                ? "Leave as-is to keep the group default or enter a different email to override for this site."
                : "Usually assigned by Purchasing or Commodity Leader."
            }
          />
        </div>

        {/* Annual spend for this relation */}
        <div className="col-span-2 border-t pt-6">
          <h3 className="section-subheader">Annual Spend for this Relation</h3>
          <p className="text-xs text-slate-500 mt-1">
            Estimated annual purchasing volume specific to this unit–plant
            assignment. This supplements the unit-level spend estimate.
          </p>
        </div>

        <FormInput
          label="Annual Spend Value"
          name="annual_spend_value"
          type="number"
          value={annualSpendValue}
          onChange={(e) => onChange("annual_spend_value", e.target.value)}
          placeholder="0.00"
          error={errors.annual_spend_value}
          helperText="Estimated annual purchase amount for this relation"
        />

        <FormSelect
          label="Currency"
          name="annual_spend_currency"
          value={annualSpendCurrency}
          onChange={(e) => onChange("annual_spend_currency", e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          placeholder="Select currency"
        />

        <div className="col-span-2">
          <FormInput
            label="Fiscal Year"
            name="fiscal_year"
            type="number"
            value={fiscalYear === "" ? "" : String(fiscalYear)}
            onChange={(e) =>
              onChange(
                "fiscal_year",
                e.target.value ? Number(e.target.value) : "",
              )
            }
            placeholder={String(new Date().getFullYear())}
            error={errors.fiscal_year}
            helperText="Year this spend estimate applies to (e.g. 2025). Leave blank if not yet known."
          />
        </div>

        {/* Unit contact reference */}
        {hasUnitContact && (
          <>
            <div className="col-span-2 border-t pt-6">
              <h3 className="section-subheader">
                Responsible Person for this Relation
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                The unit-level contact defined in the previous step is used as
                the default for this relation. You can assign a different one
                per relation on the supplier management page after creation.
              </p>
            </div>
            <div className="col-span-2">
              <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-200">
                  <svg
                    className="h-4 w-4 text-blue-700"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-blue-900">
                    {unitContactName}
                  </p>
                  {unitContactRole && (
                    <p className="text-xs text-blue-700">{unitContactRole}</p>
                  )}
                  {unitContactEmail && (
                    <p className="text-xs text-blue-600">{unitContactEmail}</p>
                  )}
                </div>
                <span className="ml-auto rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
                  Default
                </span>
              </div>
            </div>
          </>
        )}

        {/* Assessment template */}
        <div className="col-span-2 border-t pt-6">
          <h3 className="section-subheader">Assessment Launch</h3>
        </div>

        <div className="col-span-2">
          <FormSelect
            label="Assessment Template"
            name="template_id"
            value={templateId}
            onChange={(e) =>
              onChange(
                "template_id",
                e.target.value ? Number(e.target.value) : "",
              )
            }
            options={templates.map((template) => ({
              value: template.id_template,
              label:
                template.template_name ||
                template.name ||
                `Template ${template.id_template}`,
            }))}
            placeholder="Optional: select a template to launch"
            error={errors.template_id}
          />
        </div>
      </div>
    </div>
  );
};
