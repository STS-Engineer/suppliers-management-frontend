/**
 * Step Progress Indicator
 * Shows current step in multi-step form
 */

import React from "react";
import { OnboardingStep } from "../../types/onboarding";

interface StepConfig {
  id: OnboardingStep;
  label: string;
  description: string;
}

const STEPS: StepConfig[] = [
  { id: "supplier", label: "Supplier Info", description: "Group profile" },
  { id: "unit", label: "Unit Location", description: "Plant and scope" },
  { id: "contacts", label: "Contacts", description: "Key contacts" },
  {
    id: "certifications",
    label: "Certifications",
    description: "Quality records",
  },
  {
    id: "evaluation",
    label: "Evaluation",
    description: "Class and operational",
  },
  {
    id: "configuration",
    label: "Configuration",
    description: "Site and owner",
  },
  { id: "review", label: "Review", description: "Lifecycle check" },
];

interface StepProgressProps {
  currentStep: OnboardingStep;
  onStepClick?: (step: OnboardingStep) => void;
  steps?: StepConfig[];
}

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  onStepClick,
  steps = STEPS,
}) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between relative">
          {/* Background line */}
          <div
            className="absolute top-5 left-0 right-0 h-1 bg-gray-200"
            style={{
              width: "100%",
              zIndex: 0,
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
              style={{
                width: `${(currentIndex / (steps.length - 1)) * 100}%`,
              }}
            />
          </div>

          {/* Steps */}
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = step.id === currentStep;
            const isActive = index <= currentIndex;

            return (
              <div
                key={step.id}
                className="flex flex-col items-center relative z-10 flex-1"
              >
                {/* Step Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-lg scale-110"
                      : "bg-white border-2 border-gray-300 text-gray-600"
                  } ${isCurrent ? "ring-4 ring-amber-200" : ""}`}
                  onClick={() => onStepClick?.(step.id)}
                  role={onStepClick ? "button" : "status"}
                  tabIndex={onStepClick ? 0 : -1}
                >
                  {isCompleted ? (
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step Label */}
                <div className="mt-3 text-center">
                  <p
                    className={`text-sm font-semibold transition-colors duration-300 ${
                      isActive ? "text-amber-600" : "text-gray-600"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
