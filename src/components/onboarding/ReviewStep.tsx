/**
 * Review & Confirmation Step
 */

import React from "react";
import { OnboardingFormData } from "../../types/onboarding";
import {
  IMPACT_RESULT_OPTIONS,
  getPldOptionLabel,
  PANEL_DECISION_OPTIONS,
  STRATEGIC_MENTION_OPTIONS,
} from "../../utils/onboarding";

interface ReviewStepProps {
  data: OnboardingFormData;
  onSubmit: () => void;
  isLoading: boolean;
  error?: string;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  data,
  onSubmit,
  isLoading,
  error,
}) => {
  const evaluation = data.evaluation;
  const latestCertification =
    data.certifications.find((cert) => cert.certification_type)?.certification_type ||
    "Not provided";
  const finalGradePreview =
    evaluation.operational_grade && evaluation.class_value
      ? `${evaluation.operational_grade}${evaluation.class_value}`
      : "Computed after submission";
  const operationalSummary = [
    ["Management System", evaluation.management_system],
    ["Customer Communication", evaluation.customer_communication],
    ["Development / Design", evaluation.development_design],
    ["Production / Manufacturing", evaluation.production_manufacturing],
    ["Quality and Audits", evaluation.quality_audits],
    ["Suppliers and Sub-Contractors", evaluation.suppliers_subcontractors],
    ["Deliveries", evaluation.deliveries],
    ["Environment and Ethic Rules", evaluation.environment_ethic_rules],
  ] as const;

  const impactSummary = [
    [
      "Add competitiveness to the group",
      IMPACT_RESULT_OPTIONS.find(
        (option) => option.value === evaluation.impact_question_1,
      )?.label || "Not specified",
    ],
    [
      "Help in decreasing the Carbon Footprint",
      IMPACT_RESULT_OPTIONS.find(
        (option) => option.value === evaluation.impact_question_2,
      )?.label || "Not specified",
    ],
    [
      "Improve operational performances",
      IMPACT_RESULT_OPTIONS.find(
        (option) => option.value === evaluation.impact_question_3,
      )?.label || "Not specified",
    ],
    [
      "Reduce limited-supply risk",
      IMPACT_RESULT_OPTIONS.find(
        (option) => option.value === evaluation.impact_question_4,
      )?.label || "Not specified",
    ],
    [
      "Supply missing materials or components",
      IMPACT_RESULT_OPTIONS.find(
        (option) => option.value === evaluation.impact_question_5,
      )?.label || "Not specified",
    ],
    [
      "Expand family or commodity coverage",
      IMPACT_RESULT_OPTIONS.find(
        (option) => option.value === evaluation.impact_question_6,
      )?.label || "Not specified",
    ],
  ] as const;

  const strategicMentionLabel = evaluation.strategic_mention
    ? evaluation.strategic_mention
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map(
          (value) =>
            STRATEGIC_MENTION_OPTIONS.find((option) => option.value === value)
              ?.label || value,
        )
        .join(", ")
    : "Not specified";

  const panelDecisionLabel =
    PANEL_DECISION_OPTIONS.find(
      (option) => option.value === evaluation.panel_decision,
    )?.label || "Not specified";

  return (
    <div className="space-y-8">
      <div className="section-header">
        <div className="section-header-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="section-header-content">
          <h2 className="section-header-title">Review & Confirm</h2>
          <p className="section-header-subtitle">
            Review the supplier baseline before creating the onboarding cycle.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="font-semibold text-red-900">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Supplier Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Group Name
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {data.group.nom}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Unit Code
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {data.unit.supplier_code}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Class Evaluation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Class Score
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {evaluation.class_score ?? "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Class Value
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {evaluation.class_value ?? "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Quality Certification
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {latestCertification}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Final Grade Preview
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {finalGradePreview}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>TOP: {getPldOptionLabel("top", evaluation.top)}</div>
            <div>LTA: {getPldOptionLabel("lta", evaluation.lta)}</div>
            <div>Productivity: {getPldOptionLabel("prod", evaluation.prod)}</div>
            <div>SQMA: {getPldOptionLabel("sqma", evaluation.sqma)}</div>
            <div>
              Family Coverage: {getPldOptionLabel("family_coverage", evaluation.family_coverage)}
            </div>
            <div>
              Competitiveness: {getPldOptionLabel("competitiveness", evaluation.competitiveness)}
            </div>
            <div>
              Geo Coverage: {getPldOptionLabel("geo_coverage", evaluation.geo_coverage)}
            </div>
            <div>
              Cons. OR WD: {getPldOptionLabel("cons_or_wd", evaluation.cons_or_wd)}
            </div>
            <div>
              Financial Health: {getPldOptionLabel("financial_health", evaluation.financial_health)}
            </div>
            <div>
              Prod. Lia. Ins: {getPldOptionLabel("prod_lia_ins", evaluation.prod_lia_ins)}
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-600">
            Quality Certification is sourced from the certifications step and
            stored separately from the class-criteria snapshot.
          </p>
        </div>

        <div className="bg-gradient-to-br from-sky-50 to-cyan-50 rounded-lg border border-sky-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Operational Self-Assessment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Operational Score
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {evaluation.operational_score ?? "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Operational Grade
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {evaluation.operational_grade || "Not specified"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {operationalSummary.map(([label, value]) => (
              <div key={label}>
                {label}: {value ?? "Not specified"}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-lime-50 rounded-lg border border-emerald-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Impact and Decision
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Impact Score
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {evaluation.impact_score ?? "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Strategic Mention
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {strategicMentionLabel}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Panel Decision
              </p>
              <p className="mt-2 text-lg font-medium text-gray-900">
                {panelDecisionLabel}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {impactSummary.map(([label, value]) => (
              <div key={label}>
                {label}: {value}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-gray-200">
        <button
          type="button"
          disabled={isLoading}
          onClick={onSubmit}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-white font-semibold hover:from-amber-600 hover:to-amber-500 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Submitting..." : "Submit & Start Onboarding"}
        </button>
      </div>
    </div>
  );
};
