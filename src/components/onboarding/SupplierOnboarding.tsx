/**
 * Main Supplier Onboarding Container
 * Manages form state, steps, and API integration
 */

import React, { useState } from "react";
import {
  OnboardingFormData,
  OnboardingStep,
  GroupFormData,
  UnitFormData,
  ContactFormData,
  CertificationFormData,
} from "../../types/onboarding";
import { StepProgress } from "./StepProgress";
import { SupplierGroupForm } from "./SupplierGroupForm";
import { SupplierUnitForm } from "./SupplierUnitForm";
import { ContactsForm } from "./ContactsForm";
import { CertificationsForm } from "./CertificationsForm";
import { SupplierMasterReviewStep } from "./SupplierMasterReviewStep";
import { SupplierMasterSuccessPage } from "./SupplierMasterSuccessPage";
import { supplierAPI } from "../../services/supplierOnboardingAPI";
import { SupplierMasterCreationResponse } from "../../types/onboarding";
import { SupplierManagement } from "./SupplierManagement";
import { PageIntro } from "../UI";

interface SupplierOnboardingProps {
  onClose?: () => void;
}

const MASTER_STEPS: Array<{
  id: OnboardingStep;
  label: string;
  description: string;
}> = [
  { id: "supplier", label: "Supplier Info", description: "Group profile" },
  { id: "unit", label: "Unit Location", description: "First unit" },
  { id: "contacts", label: "Contacts", description: "Primary contacts" },
  {
    id: "certifications",
    label: "Certifications",
    description: "Quality records",
  },
  { id: "review", label: "Review", description: "Create master" },
];

const EMPTY_FORM: OnboardingFormData = {
  group: {
    nom: "",
    supplier_scope: "local",
    supplier_owner: "",
    strategique: false,
    monopolistique: false,
    multi_site: false,
    directed: false,
    exit_supplier: false,
    strategic_reason: "",
    supplier_type: [],
  },
  unit: {
    supplier_code: "",
    address_line: "",
    city: "",
    country: "",
    product_type: "",
    product_category: "",
    amount_value: "",
    amount_currency: "USD",
  },
  contacts: [
    {
      full_name: "",
      email: "",
      role_label: "",
      role_name: "",
      phone: "",
      is_primary_contact: true,
    },
  ],
  certifications: [],
  evaluation: {
    operational_grade: undefined,
    operational_score: undefined,
    class_value: undefined,
    class_score: undefined,
    impact_score: undefined,
    strategic_mention: "none",
    panel_decision: undefined,
    comments: "",
    top: "",
    lta: "",
    sqma: "",
    family_coverage: "",
    competitiveness: "",
    geo_coverage: "",
    cons_or_wd: "",
    financial_health: "",
    prod_lia_ins: "",
    prod: "",
    management_system: undefined,
    customer_communication: undefined,
    development_design: undefined,
    production_manufacturing: undefined,
    quality_audits: undefined,
    suppliers_subcontractors: undefined,
    deliveries: undefined,
    environment_ethic_rules: undefined,
    impact_question_1: "",
    impact_question_2: "",
    impact_question_3: "",
    impact_question_4: "",
    impact_question_5: "",
    impact_question_6: "",
  },
  site_id: 0,
  supplier_scope: "local",
  supplier_owner: "",
  template_id: "",
};

export const SupplierOnboarding: React.FC<SupplierOnboardingProps> = ({
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("supplier");
  const [formData, setFormData] = useState<OnboardingFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ [key: string]: any }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [masterResponse, setMasterResponse] =
    useState<SupplierMasterCreationResponse | null>(null);
  const [createdGroupContext, setCreatedGroupContext] = useState<{
    supplier_scope: string;
    supplier_owner: string;
  } | null>(null);
  const [showSiteAssignment, setShowSiteAssignment] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);

  const buildCertificationErrors = () => {
    const certificationErrors: Record<number, Record<string, string>> = {};

    formData.certifications.forEach((certification, index) => {
      const rowErrors: Record<string, string> = {};
      const hasAnyValue =
        certification.certification_type.trim() ||
        certification.certificate_name.trim() ||
        certification.amount_value.trim() ||
        certification.start_date ||
        certification.end_date ||
        certification.expiry_mode.trim() ||
        certification.comments.trim();

      if (!hasAnyValue) {
        return;
      }

      if (!certification.certification_type.trim()) {
        rowErrors.certification_type =
          "Certification type is required when adding a certification";
      }

      if (
        certification.start_date &&
        certification.end_date &&
        certification.end_date < certification.start_date
      ) {
        rowErrors.end_date = "Expiry date must be on or after start date";
      }

      if (Object.keys(rowErrors).length > 0) {
        certificationErrors[index] = rowErrors;
      }
    });

    return certificationErrors;
  };

  const handleGroupChange = (field: keyof GroupFormData, value: any) => {
    setValidationNotice(null);
    setFormData((prev) => ({
      ...prev,
      group: { ...prev.group, [field]: value },
    }));
    if (errors.group?.[field]) {
      setErrors((prev) => ({
        ...prev,
        group: { ...prev.group, [field]: undefined },
      }));
    }
  };

  const handleUnitChange = (field: keyof UnitFormData, value: any) => {
    setValidationNotice(null);
    setFormData((prev) => ({
      ...prev,
      unit: { ...prev.unit, [field]: value },
    }));
    if (errors.unit?.[field]) {
      setErrors((prev) => ({
        ...prev,
        unit: { ...prev.unit, [field]: undefined },
      }));
    }
  };

  const handleContactChange = (
    index: number,
    field: keyof ContactFormData,
    value: any,
  ) => {
    setValidationNotice(null);
    setFormData((prev) => {
      const newContacts = [...prev.contacts];
      newContacts[index] = { ...newContacts[index], [field]: value };
      return { ...prev, contacts: newContacts };
    });
  };

  const handleAddContact = () => {
    setFormData((prev) => ({
      ...prev,
      contacts: [
        ...prev.contacts,
        {
          full_name: "",
          email: "",
          role_label: "",
          role_name: "",
          phone: "",
          is_primary_contact: false,
        },
      ],
    }));
  };

  const handleRemoveContact = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index),
    }));
  };

  const handleCertificationChange = (
    index: number,
    field: keyof CertificationFormData,
    value: any,
  ) => {
    setValidationNotice(null);
    setFormData((prev) => {
      const newCerts = [...prev.certifications];
      newCerts[index] = { ...newCerts[index], [field]: value };
      return { ...prev, certifications: newCerts };
    });
    if (
      errors.certifications?.[index]?.[field] ||
      errors.certifications?.[index]?.end_date
    ) {
      setErrors((prev) => {
        const nextCertifications = { ...(prev.certifications || {}) };
        const nextRow = { ...(nextCertifications[index] || {}) };
        delete nextRow[field];
        if (field === "start_date" || field === "end_date") {
          delete nextRow.end_date;
        }
        if (Object.keys(nextRow).length === 0) {
          delete nextCertifications[index];
        } else {
          nextCertifications[index] = nextRow;
        }
        return { ...prev, certifications: nextCertifications };
      });
    }
  };

  const handleAddCertification = () => {
    setFormData((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        {
          certification_type: "",
          certificate_name: "",
          amount_value: "",
          amount_currency: "USD",
          start_date: "",
          end_date: "",
          expiry_mode: "",
          comments: "",
        },
      ],
    }));
  };

  const handleRemoveCertification = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
  };

  const validateStep = (step: OnboardingStep): boolean => {
    const newErrors: any = {};

    switch (step) {
      case "supplier": {
        const groupErrors: Record<string, string> = {};
        if (!formData.group.nom) {
          groupErrors.nom = "Supplier name is required";
        }
        if (!formData.group.supplier_scope) {
          groupErrors.supplier_scope = "Supplier scope is required";
        }
        if (
          formData.group.supplier_scope === "global" &&
          !formData.group.supplier_owner.trim()
        ) {
          groupErrors.supplier_owner =
            "Global supplier owner email is required";
        }
        if (formData.group.supplier_type.length === 0) {
          groupErrors.supplier_type = "Select at least one category";
        }
        if (Object.keys(groupErrors).length > 0) {
          newErrors.group = groupErrors;
        }
        break;
      }

      case "unit": {
        const unitErrors: Record<string, string> = {};
        if (!formData.unit.supplier_code) {
          unitErrors.supplier_code = "Supplier code is required";
        }
        if (Object.keys(unitErrors).length > 0) {
          newErrors.unit = unitErrors;
        }
        break;
      }

      case "contacts":
        const contactErrors: any = {};
        formData.contacts.forEach((contact, idx) => {
          const contactIdx = contactErrors[idx] || {};
          if (!contact.full_name) {
            contactIdx.full_name = "Name is required";
          }
          if (!contact.email) {
            contactIdx.email = "Email is required";
          }
          if (Object.keys(contactIdx).length > 0) {
            contactErrors[idx] = contactIdx;
          }
        });
        if (Object.keys(contactErrors).length > 0) {
          newErrors.contacts = contactErrors;
        }
        break;

      case "certifications":
        const certificationErrors = buildCertificationErrors();
        if (Object.keys(certificationErrors).length > 0) {
          newErrors.certifications = certificationErrors;
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setValidationNotice(null);
      const steps = MASTER_STEPS.map((step) => step.id);
      const nextIndex = steps.indexOf(currentStep) + 1;
      if (nextIndex < steps.length) {
        setCurrentStep(steps[nextIndex]);
      }
    } else {
      setValidationNotice(
        "Please complete the required fields highlighted below before continuing.",
      );
    }
  };

  const handlePrevious = () => {
    setValidationNotice(null);
    const steps = MASTER_STEPS.map((step) => step.id);
    const prevIndex = steps.indexOf(currentStep) - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const handleSubmit = async () => {
    const certificationErrors = buildCertificationErrors();
    if (
      !validateStep(currentStep) ||
      Object.keys(certificationErrors).length > 0
    ) {
      setValidationNotice(
        "Please review the missing or invalid fields before creating the supplier master.",
      );
      if (Object.keys(certificationErrors).length > 0) {
        setErrors((prev) => ({ ...prev, certifications: certificationErrors }));
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setValidationNotice(null);

    try {
      // Clean payload: convert empty strings to null for numeric and date fields
      const cleanedUnit = {
        ...formData.unit,
        amount_value: formData.unit.amount_value
          ? formData.unit.amount_value
          : null,
      };

      const cleanedCertifications = formData.certifications.map((cert) => ({
        ...cert,
        amount_value: cert.amount_value ? cert.amount_value : null,
        start_date: cert.start_date ? cert.start_date : null,
        end_date: cert.end_date ? cert.end_date : null,
      }));

      // Clean evaluation: only include fields with values
      const payloadData = {
        group: {
          ...formData.group,
          supplier_type: formData.group.supplier_type.join(", "),
        },
        unit: cleanedUnit,
        contacts: formData.contacts,
        certifications: cleanedCertifications,
      };

      console.log("Submitting supplier master data:", payloadData);
      const response = await supplierAPI.createSupplierMaster(payloadData);
      setCreatedGroupContext({
        supplier_scope: formData.group.supplier_scope,
        supplier_owner: formData.group.supplier_owner,
      });
      setMasterResponse(response);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "An error occurred while submitting the form",
      );
      console.error("Submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success page
  if (showSiteAssignment && masterResponse?.data) {
    return (
      <SupplierManagement
        groupId={masterResponse.data.group_id}
        groupName={masterResponse.data.group_name}
        initialGroupScope={createdGroupContext?.supplier_scope}
        initialGroupOwner={createdGroupContext?.supplier_owner}
        onClose={() => setShowSiteAssignment(false)}
      />
    );
  }

  if (masterResponse) {
    return (
      <SupplierMasterSuccessPage
        response={masterResponse}
        onContinueToSites={() => setShowSiteAssignment(true)}
        onNewSupplier={() => {
          setFormData(EMPTY_FORM);
          setCurrentStep("supplier");
          setMasterResponse(null);
          setCreatedGroupContext(null);
          setShowSiteAssignment(false);
        }}
      />
    );
  }

  return (
    <div className="onboarding-container">
      <div className="mx-auto w-full max-w-[1700px] px-2 pt-2 sm:px-4 lg:px-6">
        <PageIntro
          eyebrow="Lifecycle Phase 1"
          title="Create Supplier Master"
          description="Start by creating the supplier group, its first unit, contacts, and certifications for the first unit. Site assignment, owner allocation, extra-unit certifications, and relation evaluations will follow in the next phase."
          actions={
            onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/20 bg-white/12 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/18"
              >
                Close
              </button>
            ) : undefined
          }
        />
      </div>

      {/* Progress Steps */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <StepProgress currentStep={currentStep} steps={MASTER_STEPS} />
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto max-w-[1700px] px-2 py-8 sm:px-4 lg:px-6">
          {validationNotice ? (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {validationNotice}
            </div>
          ) : null}

          {currentStep === "supplier" && (
            <SupplierGroupForm
              data={formData.group}
              errors={errors.group || {}}
              onChange={handleGroupChange}
            />
          )}

          {currentStep === "unit" && (
            <SupplierUnitForm
              data={formData.unit}
              errors={errors.unit || {}}
              onChange={handleUnitChange}
            />
          )}

          {currentStep === "contacts" && (
            <ContactsForm
              contacts={formData.contacts}
              errors={errors.contacts || {}}
              onAddContact={handleAddContact}
              onRemoveContact={handleRemoveContact}
              onChange={handleContactChange}
            />
          )}

          {currentStep === "certifications" && (
            <CertificationsForm
              certifications={formData.certifications}
              errors={errors.certifications || {}}
              onAddCertification={handleAddCertification}
              onRemoveCertification={handleRemoveCertification}
              onChange={handleCertificationChange}
            />
          )}

          {currentStep === "review" && (
            <SupplierMasterReviewStep
              data={formData}
              onSubmit={handleSubmit}
              onBack={handlePrevious}
              onEditStep={(step) => {
                setValidationNotice(null);
                setCurrentStep(step);
              }}
              isLoading={isSubmitting}
              error={submitError || undefined}
            />
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      {currentStep !== "review" && (
        <div className="bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Draft Save Message */}
            {draftSaved && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Draft saved successfully!
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentStep === "supplier"}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Previous
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-white font-semibold hover:from-amber-600 hover:to-amber-500 transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                Next
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
