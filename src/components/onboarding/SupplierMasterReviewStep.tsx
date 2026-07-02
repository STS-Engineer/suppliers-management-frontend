import type { OnboardingStep } from "../../types/onboarding";
import React from "react";
import { OnboardingFormData } from "../../types/onboarding";

interface SupplierMasterReviewStepProps {
  data: OnboardingFormData;
  onSubmit: () => void;
  onBack: () => void;
  onEditStep: (step: OnboardingStep) => void;
  isLoading: boolean;
  error?: string;
}

export const SupplierMasterReviewStep: React.FC<
  SupplierMasterReviewStepProps
> = ({ data, onSubmit, onBack, onEditStep, isLoading, error }) => {
  return (
    <div className="space-y-8">
      <div className="section-header">
        <div className="section-header-content">
          <h2 className="section-header-title">Review Supplier Master</h2>
          <p className="section-header-subtitle">
            Confirm the group, first unit, contacts, and certifications before
            creating the supplier master. Unit evaluation and site assignment
            follow in the next lifecycle workspace.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 space-y-1">
          {error.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Supplier Group
            </h3>
            <button
              type="button"
              onClick={() => onEditStep("supplier")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0f2744] bg-[#0f2744] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a3a5c] active:scale-95"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Name
              </p>
              <p className="mt-1 text-gray-900">{data.group.nom || "Not set"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Scope
              </p>
              <p className="mt-1 text-gray-900">
                {data.group.supplier_scope || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Global Owner
              </p>
              <p className="mt-1 text-gray-900">
                {data.group.supplier_owner || "Assigned per site relation"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Group Context
              </p>
              <p className="mt-1 text-gray-900">
                {[
                  data.group.strategique ? "Strategic" : null,
                  data.group.monopolistique ? "Monopolistic" : null,
                  data.group.directed ? "Directed" : null,
                  data.group.multi_site ? "Multi-site" : null,
                ]
                  .filter(Boolean)
                  .join(" • ") || "Standard"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">First Unit</h3>
            <button
              type="button"
              onClick={() => onEditStep("unit")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0f2744] bg-[#0f2744] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a3a5c] active:scale-95"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Unit Code
              </p>
              <p className="mt-1 text-gray-900">
                {data.unit.supplier_name || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Location
              </p>
              <p className="mt-1 text-gray-900">
                {[data.unit.city, data.unit.country].filter(Boolean).join(", ") ||
                  "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Products & Services
              </p>
              <p className="mt-1 text-gray-900">
                {[
                  ...data.unit.family,
                  ...data.unit.sub_family,
                  ...data.unit.product_line,
                ]
                  .filter(Boolean)
                  .join(" • ") || "Not set"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Contacts & Certifications
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEditStep("contacts")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0f2744] bg-[#0f2744] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a3a5c] active:scale-95"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit contacts
            </button>
            <button
              type="button"
              onClick={() => onEditStep("certifications")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0f2744] bg-[#0f2744] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a3a5c] active:scale-95"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit certifications
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Contacts
            </p>
            <div className="mt-3 space-y-3">
              {data.contacts.map((contact, index) => (
                <div
                  key={`${contact.email}-${index}`}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm"
                >
                  <p className="font-medium text-gray-900">
                    {contact.full_name || "Unnamed contact"}
                  </p>
                  <p className="text-gray-600">{contact.email || "No email"}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Certifications
            </p>
            <div className="mt-3 space-y-3">
              {data.certifications.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  No certifications added yet.
                </div>
              )}
              {data.certifications.map((cert, index) => (
                <div
                  key={`${cert.certification_type}-${index}`}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm"
                >
                  <p className="font-medium text-gray-900">
                    {cert.certification_type || "Unspecified certification"}
                  </p>
                  <p className="text-gray-600">
                    {cert.certificate_name || "No certificate name"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
        After this master is created, assign the unit to a site, then record
        the initial unit evaluation scorecard. Supplier qualification is owned
        at unit level, while site relations keep the owner and scope for each
        assigned site.
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onEditStep("supplier")}
          disabled={isLoading}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-6 py-3 font-semibold text-amber-800 transition-all duration-200 hover:bg-amber-100 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Review And Edit Details
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={onSubmit}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-white font-semibold hover:from-amber-600 hover:to-amber-500 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Creating Supplier Master..." : "Create Supplier Master"}
        </button>
      </div>
    </div>
  );
};
