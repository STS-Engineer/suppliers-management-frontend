/**
 * Certifications Form Step
 */

import React, { useEffect, useState } from "react";
import {
  CertificationFormData,
  FormErrors,
  OnboardingSelectionOptions,
} from "../../types/onboarding";
import { supplierAPI } from "../../services/supplierOnboardingAPI";
import { getCertificationTypeOptions } from "../../utils/onboarding";
import { FormInput, FormSelect } from "./FormElements";

interface CertificationsFormProps {
  certifications: CertificationFormData[];
  errors: { [key: number]: FormErrors };
  onAddCertification: () => void;
  onRemoveCertification: (index: number) => void;
  onChange: (
    index: number,
    field: keyof CertificationFormData,
    value: any,
  ) => void;
}

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CNY", "INR"];

type CertificationOptionList = ReadonlyArray<
  OnboardingSelectionOptions["certification_types"][number]
>;

const DEFAULT_CERT_OPTIONS: CertificationOptionList =
  getCertificationTypeOptions();

export const CertificationsForm: React.FC<CertificationsFormProps> = ({
  certifications,
  errors,
  onAddCertification,
  onRemoveCertification,
  onChange,
}) => {
  const [certOptions, setCertOptions] =
    useState<CertificationOptionList>(DEFAULT_CERT_OPTIONS);

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      try {
        const response = await supplierAPI.getOnboardingOptions();
        if (!active || !response?.data?.certification_types) return;

        setCertOptions(response.data.certification_types);
      } catch (error) {
        console.error("Failed to load certification options:", error);
      }
    };

    loadOptions();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="form-section">
      <div className="section-header">
        <h2>Quality Certifications</h2>
        <p>
          Add the certifications for the first unit in this supplier master.
          Additional units will capture their own certifications later.
        </p>
      </div>

      <div className="space-y-6">
        {certifications.map((cert, index) => (
          <div key={index} className="certification-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Certification #{index + 1}
              </h3>
              {certifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => onRemoveCertification(index)}
                  className="btn-icon-danger"
                  title="Remove certification"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div className="form-grid">
              <div className="col-span-2">
                <FormSelect
                  label="Certification Type"
                  name={`cert-${index}-type`}
                  value={cert.certification_type}
                  onChange={(e) =>
                    onChange(index, "certification_type", e.target.value)
                  }
                  options={certOptions}
                  placeholder="Select certification type"
                  error={errors[index]?.certification_type}
                  required
                />
              </div>

              <div className="col-span-2">
                <FormInput
                  label="Certificate Name"
                  name={`cert-${index}-name`}
                  value={cert.certificate_name}
                  onChange={(e) =>
                    onChange(index, "certificate_name", e.target.value)
                  }
                  placeholder="e.g., Quality Management System"
                  error={errors[index]?.certificate_name}
                />
              </div>

              <FormInput
                label="Start Date"
                name={`cert-${index}-start`}
                type="date"
                value={cert.start_date}
                onChange={(e) => onChange(index, "start_date", e.target.value)}
                error={errors[index]?.start_date}
              />

              <FormInput
                label="Expiry Date"
                name={`cert-${index}-end`}
                type="date"
                value={cert.end_date}
                onChange={(e) => onChange(index, "end_date", e.target.value)}
                error={errors[index]?.end_date}
              />

              <div className="col-span-2">
                <label
                  htmlFor={`cert-${index}-comments`}
                  className="form-label"
                >
                  Comments
                </label>
                <textarea
                  id={`cert-${index}-comments`}
                  value={cert.comments}
                  onChange={(e) => onChange(index, "comments", e.target.value)}
                  placeholder="Additional notes about this certification..."
                  rows={3}
                  className="form-textarea"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddCertification}
          className="btn btn-secondary btn-outline"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Certification
        </button>
      </div>

      {certifications.length === 0 && (
        <div className="info-box mt-6">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0z"
              clipRule="evenodd"
            />
          </svg>
          <p>
            Certifications are optional. Add relevant quality and compliance
            certifications if available.
          </p>
        </div>
      )}
    </div>
  );
};
