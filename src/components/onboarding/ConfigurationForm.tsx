/**
 * ConfigurationForm.tsx
 * Site, supplier scope, owner, and optional assessment template
 */

import React, { useEffect, useState } from "react";
import { FormErrors } from "../../types/onboarding";
import { FormInput, FormSelect } from "./FormElements";
import { supplierAPI } from "../../services/supplierOnboardingAPI";

export type SupplierScope = "local" | "regional" | "global";

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
  templateId: number | "";
  errors: FormErrors;
  onChange: (field: string, value: any) => void;
}

export const ConfigurationForm: React.FC<ConfigurationFormProps> = ({
  siteId,
  supplierScope,
  supplierOwner,
  templateId,
  errors,
  onChange,
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

  return (
    <div className="form-section">
      <div className="section-header">
        <h2>Scope & Assignment</h2>
        <p>Configure the supplier relation, owner, and baseline workflow.</p>
      </div>

      <div className="form-grid">
        <div className="col-span-2">
          <FormSelect
            label="AVOCarbon Site"
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
                label: "Local - One AVOCarbon site or local region",
              },
              // {
              //   value: "regional",
              //   label: "Regional - Several sites in one region",
              // },
              {
                value: "global",
                label: "Global - Several countries or regions",
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

          {supplierScope === "regional" && (
            <div className="info-box info-warning">
              <strong>Regional Supplier</strong>
              <p>Supplier supports several sites in the same region.</p>
            </div>
          )}

          {supplierScope === "local" && (
            <div className="info-box info-green">
              <strong>Local Supplier</strong>
              <p>Supplier supports one plant or local perimeter only.</p>
            </div>
          )}
        </div>

        <div className="col-span-2 border-t pt-6">
          <h3 className="section-subheader">Supplier Owner Assignment</h3>
        </div>

        <div className="col-span-2">
          <FormInput
            label="Supplier Owner Name or Email"
            name="supplier_owner"
            value={supplierOwner}
            onChange={(e) => onChange("supplier_owner", e.target.value)}
            placeholder="e.g., john.doe@avocarbon.com"
            error={errors.supplier_owner}
            required
            helperText="Usually assigned by Purchasing or Commodity Leader."
          />
        </div>

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
