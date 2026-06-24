/**
 * Certifications Form Step
 *
 * Two-level cascading select:
 *  1. Standard Type  (Quality / Environmental / Safety / Energy / Other)
 *  2. Certification  — a fixed list per category
 *                      Quality  → IATF 16949:2016 | ISO 9001 (cat BCD) | ISO 9001 | ISO 13485 | Distributor | None
 *                      Environmental → ISO 14001 | ISO 14064 | REACH | RoHS | None
 *                      …
 *
 * Plus: certificate name (free text), dates, comments, file upload.
 */

import React, { useRef } from "react";
import { CertificationFormData, FormErrors } from "../../types/onboarding";
import {
  CERTIFICATION_STANDARD_TYPE_OPTIONS,
  CERT_TYPES_BY_STANDARD,
} from "../../utils/onboarding";
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

export const CertificationsForm: React.FC<CertificationsFormProps> = ({
  certifications,
  errors,
  onAddCertification,
  onRemoveCertification,
  onChange,
}) => {
  return (
    <div className="form-section">
      <div className="mb-6 flex items-start gap-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 ring-1 ring-amber-200">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Quality &amp; Compliance Certifications</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Select the standard category first, then pick the specific certification from the list. Upload the certificate document if available.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {certifications.map((cert, index) => (
          <CertificationCard
            key={index}
            cert={cert}
            index={index}
            errors={errors[index] ?? {}}
            onRemove={() => onRemoveCertification(index)}
            onChange={(field, value) => onChange(index, field, value)}
            canRemove={certifications.length > 0}
          />
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

// ---------------------------------------------------------------------------
// Individual card
// ---------------------------------------------------------------------------

interface CardProps {
  cert: CertificationFormData;
  index: number;
  errors: FormErrors;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (field: keyof CertificationFormData, value: any) => void;
}

const CertificationCard: React.FC<CardProps> = ({
  cert,
  index,
  errors,
  canRemove,
  onRemove,
  onChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const certTypeOptions = cert.standard_type
    ? (CERT_TYPES_BY_STANDARD[cert.standard_type] ?? [])
    : [];

  const handleStandardTypeChange = (value: string) => {
    onChange("standard_type", value);
    // Reset specific cert when category changes
    onChange("certification_type", "");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onChange("file", file);
    onChange("file_name", file?.name ?? "");
  };

  return (
    <div className="certification-card">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Certification #{index + 1}</h3>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="btn-icon-danger"
            title="Remove certification"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
        {/* 1 — Standard category */}
        <div className="col-span-2">
          <FormSelect
            label="Standard Type"
            name={`cert-${index}-standard_type`}
            value={cert.standard_type}
            onChange={(e) => handleStandardTypeChange(e.target.value)}
            options={CERTIFICATION_STANDARD_TYPE_OPTIONS as any}
            placeholder="Select type (Quality, Environmental…)"
            error={errors.standard_type}
            required
          />
        </div>

        {/* 2 — Specific certification (only shown once category is picked) */}
        {cert.standard_type && (
          <div className="col-span-2">
            <FormSelect
              label="Certification"
              name={`cert-${index}-certification_type`}
              value={cert.certification_type}
              onChange={(e) => onChange("certification_type", e.target.value)}
              options={certTypeOptions}
              placeholder="Select certification"
              error={errors.certification_type}
              required
            />
          </div>
        )}

        {/* 3 — Certificate name / reference (free text) */}
        <div className="col-span-2">
          <FormInput
            label="Certificate Name / Reference"
            name={`cert-${index}-name`}
            value={cert.certificate_name}
            onChange={(e) => onChange("certificate_name", e.target.value)}
            placeholder="e.g., QMS-2024-CN-001"
            error={errors.certificate_name}
          />
        </div>

        {/* 4 — Validity dates */}
        <FormInput
          label="Issue Date"
          name={`cert-${index}-start`}
          type="date"
          value={cert.start_date}
          onChange={(e) => onChange("start_date", e.target.value)}
          error={errors.start_date}
        />

        <FormInput
          label="Expiry Date"
          name={`cert-${index}-end`}
          type="date"
          value={cert.end_date}
          onChange={(e) => onChange("end_date", e.target.value)}
          error={errors.end_date}
        />

        {/* 5 — Comments */}
        <div className="col-span-2">
          <label htmlFor={`cert-${index}-comments`} className="form-label">
            Comments
          </label>
          <textarea
            id={`cert-${index}-comments`}
            value={cert.comments}
            onChange={(e) => onChange("comments", e.target.value)}
            placeholder="Additional notes about this certification…"
            rows={2}
            className="form-textarea"
          />
        </div>

        {/* 6 — File upload */}
        <div className="col-span-2">
          <label className="form-label">Certificate Document</label>
          <div
            className={`mt-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-5 transition cursor-pointer ${
              cert.file
                ? "border-emerald-400 bg-emerald-50"
                : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {cert.file ? (
              <div className="flex items-center gap-3 text-sm text-emerald-700">
                <svg
                  className="w-5 h-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-medium truncate max-w-xs">
                  {cert.file.name}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("file", null);
                    onChange("file_name", "");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="ml-2 text-red-500 hover:text-red-700 text-xs underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <svg
                  className="w-8 h-8 text-slate-400 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-sm text-slate-500">
                  <span className="font-medium text-slate-700">
                    Click to upload
                  </span>{" "}
                  or drag &amp; drop
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PDF, PNG, JPG up to 10 MB
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
};
