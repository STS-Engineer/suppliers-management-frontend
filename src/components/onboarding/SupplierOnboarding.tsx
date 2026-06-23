/**
 * Main Supplier Onboarding Container
 * Manages form state, steps, and API integration
 */

import React, { useState } from "react";
import { useBlocker } from "react-router-dom";
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
import { supplierAPI, SupplierApiError } from "../../services/supplierOnboardingAPI";
import { SupplierMasterCreationResponse } from "../../types/onboarding";
import { SupplierManagement } from "./SupplierManagement";
import { InlineAlert, PageIntro } from "../UI";

interface SupplierOnboardingProps {
  onClose?: () => void;
}

const MASTER_STEPS: Array<{
  id: OnboardingStep;
  label: string;
  description: string;
}> = [
  { id: "supplier", label: "Supplier Info", description: "Group profile" },
  { id: "contacts", label: "Contacts", description: "Group contacts" },
  { id: "unit", label: "Unit Location", description: "First unit" },
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
    continent: "",
    area: "",
    family: [],
    sub_family: [],
    product_line: [],
    website: "",
    supplier_email: "",
    commodity_responsible: "",
    main_plants: "",
    carbon_footprint: "",
    green_electricity_pct: "",
    copper_brass_pct: "",
    category: [],
    scope1_ghg: "",
    scope2_ghg: "",
    ghg_comments: "",
    ghg_requested_date: "",
    ghg_completion_pct: "",
    unit_contacts: [],
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
  annual_spend_value: "",
  annual_spend_currency: "USD",
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

  const hasMeaningfulContactData = (contact: ContactFormData) =>
    !!(
      contact.full_name.trim() ||
      contact.email.trim() ||
      contact.role_label.trim() ||
      contact.role_name.trim() ||
      contact.phone.trim()
    );

  const looksLikeEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const emptyToUndefined = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const cleanedUnitPayload = (unit: UnitFormData) => ({
    ...unit,
    ghg_requested_date: emptyToUndefined(unit.ghg_requested_date),
    scope1_ghg: emptyToUndefined(unit.scope1_ghg),
    scope2_ghg: emptyToUndefined(unit.scope2_ghg),
  });

  // â”€â”€ Navigation guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const formHasData =
    !!masterResponse === false &&
    (formData.group.nom.trim().length > 0 ||
      formData.contacts.some(hasMeaningfulContactData) ||
      formData.unit.supplier_code.trim().length > 0 ||
      formData.unit.unit_contacts.some(hasMeaningfulContactData) ||
      formData.certifications.some(
        (certification) =>
          !!(
            certification.standard_type?.trim() ||
            certification.certification_type?.trim() ||
            certification.certificate_name?.trim() ||
            certification.amount_value?.trim() ||
            certification.start_date ||
            certification.end_date ||
            certification.expiry_mode?.trim() ||
            certification.comments?.trim()
          ),
      ));

  const blocker = useBlocker(formHasData);

  const buildCertificationErrors = () => {
    const certificationErrors: Record<number, Record<string, string>> = {};

    formData.certifications.forEach((certification, index) => {
      const rowErrors: Record<string, string> = {};
      const hasAnyValue =
        certification.standard_type?.trim() ||
        certification.certification_type?.trim() ||
        certification.certificate_name?.trim() ||
        certification.amount_value?.trim() ||
        certification.start_date ||
        certification.end_date ||
        certification.expiry_mode?.trim() ||
        certification.comments?.trim();

      if (!hasAnyValue) {
        return;
      }

      if (!certification.standard_type?.trim()) {
        rowErrors.standard_type =
          "Standard category is required when adding a certification";
      }

      if (
        certification.standard_type &&
        !certification.certification_type?.trim()
      ) {
        rowErrors.certification_type = "Certification is required";
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

  const buildUnitContactErrors = () => {
    const unitContactErrors: Record<number, Record<string, string>> = {};

    formData.unit.unit_contacts.forEach((contact, index) => {
      if (!hasMeaningfulContactData(contact)) {
        return;
      }

      const rowErrors: Record<string, string> = {};
      if (!contact.full_name.trim()) {
        rowErrors.full_name =
          "Full name is required when adding a unit contact";
      }
      if (contact.email.trim() && !looksLikeEmail(contact.email)) {
        rowErrors.email = "Enter a valid email address";
      }

      if (Object.keys(rowErrors).length > 0) {
        unitContactErrors[index] = rowErrors;
      }
    });

    return unitContactErrors;
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
    if (field === "email") {
      const emailError =
        value && !looksLikeEmail(value) ? "Must be a valid email address" : undefined;
      setErrors((prev) => ({
        ...prev,
        contacts: {
          ...(prev.contacts ?? {}),
          [index]: { ...(prev.contacts?.[index] ?? {}), email: emailError },
        },
      }));
    } else if (errors.contacts?.[index]?.[field]) {
      setErrors((prev) => ({
        ...prev,
        contacts: {
          ...(prev.contacts ?? {}),
          [index]: { ...(prev.contacts?.[index] ?? {}), [field]: undefined },
        },
      }));
    }
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
          standard_type: "",
          certification_type: "",
          iatf_category: "",
          certificate_name: "",
          amount_value: "",
          amount_currency: "USD",
          start_date: "",
          end_date: "",
          expiry_mode: "",
          comments: "",
          file: null,
          file_name: "",
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
        } else if (
          formData.group.supplier_owner.trim() &&
          !looksLikeEmail(formData.group.supplier_owner)
        ) {
          groupErrors.supplier_owner = "Enter a valid email address";
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
        if (
          formData.unit.supplier_email.trim() &&
          !looksLikeEmail(formData.unit.supplier_email)
        ) {
          unitErrors.supplier_email = "Enter a valid email address";
        }
        if (Object.keys(unitErrors).length > 0) {
          newErrors.unit = unitErrors;
        }
        const unitContactErrors = buildUnitContactErrors();
        if (Object.keys(unitContactErrors).length > 0) {
          newErrors.unit_contacts = unitContactErrors;
        }
        break;
      }

      case "contacts":
        const contactErrors: any = {};
        let hasPrimaryContact = false;
        formData.contacts.forEach((contact, idx) => {
          const contactIdx = contactErrors[idx] || {};
          if (!contact.full_name) {
            contactIdx.full_name = "Name is required";
          }
          if (!contact.email) {
            contactIdx.email = "Email is required";
          } else if (!looksLikeEmail(contact.email)) {
            contactIdx.email = "Must be a valid email address";
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
    const unitContactErrors = buildUnitContactErrors();
    if (
      !validateStep(currentStep) ||
      Object.keys(certificationErrors).length > 0 ||
      Object.keys(unitContactErrors).length > 0
    ) {
      setValidationNotice(
        "Please review the missing or invalid fields before creating the supplier master.",
      );
      setErrors((prev) => ({
        ...prev,
        certifications:
          Object.keys(certificationErrors).length > 0
            ? certificationErrors
            : prev.certifications,
        unit_contacts:
          Object.keys(unitContactErrors).length > 0
            ? unitContactErrors
            : prev.unit_contacts,
      }));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setValidationNotice(null);

    try {
      const { unit_contacts } = formData.unit;

      const cleanedCertifications = formData.certifications.map(
        ({ file, ...cert }) => ({
          ...cert,
          amount_value: cert.amount_value ? cert.amount_value : null,
          start_date: cert.start_date ? cert.start_date : null,
          end_date: cert.end_date ? cert.end_date : null,
        }),
      );

      const payloadData = {
        group: {
          ...formData.group,
          supplier_type: formData.group.supplier_type.join(", "),
        },
        unit: cleanedUnitPayload(formData.unit),
        unit_contacts: unit_contacts.filter(hasMeaningfulContactData),
        contacts: formData.contacts,
        certifications: cleanedCertifications.filter((c) => c.standard_type?.trim()),
        annual_spend_value: formData.annual_spend_value || undefined,
        annual_spend_currency: formData.annual_spend_currency || undefined,
      };

      console.log("Submitting supplier master data:", payloadData);
      const response = await supplierAPI.createSupplierMaster(payloadData);
      setCreatedGroupContext({
        supplier_scope: formData.group.supplier_scope,
        supplier_owner: formData.group.supplier_owner,
      });
      setMasterResponse(response);
    } catch (error) {
      if (error instanceof SupplierApiError && Array.isArray(error.details) && error.details.length > 0) {
        const contactErrors: { [index: number]: { [field: string]: string } } = {};
        const groupErrors: { [field: string]: string } = {};
        const unitErrors: { [field: string]: string } = {};
        const certErrors: { [index: number]: { [field: string]: string } } = {};
        const fieldMessages: string[] = [];
        let firstStep: OnboardingStep | null = null;

        const humanize = (msg: string) =>
          msg.replace(/^Value error,\s*/i, "").replace(/^\w/, (c) => c.toUpperCase());

        for (const detail of error.details as { field: string; message: string }[]) {
          const f = detail.field;
          const msg = humanize(detail.message);

          const contactMatch = f.match(/^body\.contacts\.(\d+)\.(\w+)$/);
          const groupMatch = f.match(/^body\.group\.(\w+)$/);
          const unitMatch = f.match(/^body\.unit\.(\w+)$/);
          const certMatch = f.match(/^body\.certifications\.(\d+)\.(\w+)$/);

          if (contactMatch) {
            const idx = parseInt(contactMatch[1], 10);
            contactErrors[idx] = { ...(contactErrors[idx] ?? {}), [contactMatch[2]]: msg };
            fieldMessages.push(`Contact #${idx + 1} — ${contactMatch[2]}: ${msg}`);
            if (!firstStep) firstStep = "contacts";
          } else if (groupMatch) {
            groupErrors[groupMatch[1]] = msg;
            fieldMessages.push(`Supplier group — ${groupMatch[1]}: ${msg}`);
            if (!firstStep) firstStep = "supplier";
          } else if (unitMatch) {
            unitErrors[unitMatch[1]] = msg;
            fieldMessages.push(`Supplier unit — ${unitMatch[1]}: ${msg}`);
            if (!firstStep) firstStep = "unit";
          } else if (certMatch) {
            const idx = parseInt(certMatch[1], 10);
            certErrors[idx] = { ...(certErrors[idx] ?? {}), [certMatch[2]]: msg };
            fieldMessages.push(`Certification #${idx + 1} — ${certMatch[2]}: ${msg}`);
            if (!firstStep) firstStep = "certifications";
          } else {
            fieldMessages.push(msg);
          }
        }

        const newErrors: any = {};
        if (Object.keys(contactErrors).length > 0) newErrors.contacts = contactErrors;
        if (Object.keys(groupErrors).length > 0) newErrors.group = groupErrors;
        if (Object.keys(unitErrors).length > 0) newErrors.unit = unitErrors;
        if (Object.keys(certErrors).length > 0) newErrors.certifications = certErrors;
        if (Object.keys(newErrors).length > 0) setErrors((prev) => ({ ...prev, ...newErrors }));
        if (firstStep) setCurrentStep(firstStep);

        setSubmitError(fieldMessages.join("\n"));
      } else {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "An error occurred while submitting the form",
        );
      }
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
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50">
      <PageIntro
        eyebrow="Lifecycle Â· Phase 1"
        title="Create Supplier Master"
        description="Set up the supplier group, first unit, contacts and certifications. Site assignment and relation evaluations follow in the next phase."
        actions={
          onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Close
            </button>
          ) : undefined
        }
      />

      {/* Progress Steps */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <StepProgress currentStep={currentStep} steps={MASTER_STEPS} />
      </div>

      {/* Unsaved-progress banner */}
      {formHasData && (
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-white">
            !
          </span>
          <p className="text-xs font-medium text-amber-800">
            Unsaved progress complete all steps and click{" "}
            <strong>Create</strong> to save. Navigating away will discard your
            data.
          </p>
        </div>
      )}

      {/* Form Content */}
      <div className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
          {validationNotice ? (
            <div className="mb-6">
              <InlineAlert
                title="Please check the form"
                message={validationNotice}
                tone="warning"
              />
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
              unitContactErrors={errors.unit_contacts || {}}
              onChange={handleUnitChange}
              groupContacts={formData.contacts}
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
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
            {draftSaved && (
              <div className="mb-3">
                <InlineAlert
                  title="Draft saved"
                  message="Your progress has been saved."
                  tone="info"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentStep === "supplier"}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  className="h-4 w-4"
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
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f2744] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a3a5c]"
              >
                Continue
                <svg
                  className="h-4 w-4"
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

      {/* â”€â”€ Leave confirmation modal â”€â”€ */}
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.25)]">
            <div className="border-b border-slate-100 bg-amber-50 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    Leave without saving?
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    You have unsaved progress on this supplier creation. Leaving
                    now will discard everything you've entered.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4">
              <button
                type="button"
                onClick={() => blocker.reset?.()}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Stay and continue
              </button>
              <button
                type="button"
                onClick={() => blocker.proceed?.()}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Leave and discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
