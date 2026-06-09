/**
 * Step Progress Indicator
 * Shows current step in multi-step form — matches app design language
 */

import React from "react";
import { Check } from "lucide-react";
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
  { id: "certifications", label: "Certifications", description: "Quality records" },
  { id: "evaluation", label: "Evaluation", description: "Class and operational" },
  { id: "configuration", label: "Configuration", description: "Site and owner" },
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
    <div className="bg-white px-6 py-5">
      <div className="mx-auto max-w-4xl">
        <div className="relative flex items-start justify-between">
          {/* Track line */}
          <div className="absolute left-0 right-0 top-4 h-px bg-slate-200" style={{ zIndex: 0 }}>
            <div
              className="h-full bg-gradient-to-r from-[#0f2744] to-blue-600 transition-all duration-500"
              style={{ width: `${Math.max(0, (currentIndex / (steps.length - 1)) * 100)}%` }}
            />
          </div>

          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = step.id === currentStep;
            const isUpcoming = index > currentIndex;

            return (
              <div
                key={step.id}
                className="relative z-10 flex flex-1 flex-col items-center"
              >
                <button
                  type="button"
                  disabled={!onStepClick}
                  onClick={() => onStepClick?.(step.id)}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-200",
                    isCompleted
                      ? "border-[#0f2744] bg-[#0f2744] text-white"
                      : isCurrent
                      ? "border-[#0f2744] bg-white text-[#0f2744] shadow-[0_0_0_4px_rgba(15,39,68,0.12)]"
                      : "border-slate-300 bg-white text-slate-400",
                    onStepClick && !isUpcoming ? "cursor-pointer hover:opacity-80" : "cursor-default",
                  ].join(" ")}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </button>

                <div className="mt-2 text-center">
                  <p className={`text-xs font-semibold ${isCurrent ? "text-[#0f2744]" : isCompleted ? "text-slate-600" : "text-slate-400"}`}>
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
