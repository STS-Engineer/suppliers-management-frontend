/**
 * StepIndicator - compact progress bar for phase-2 flows
 */

import React from "react";

interface StepIndicatorProps {
  steps: string[];
  current: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  current,
}) => (
  <div className="mb-6 overflow-x-auto">
    <div className="flex min-w-max items-start gap-0">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <React.Fragment key={label}>
            <div className="flex min-w-[88px] flex-1 flex-col items-center text-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  done || active
                    ? "border-blue-700 bg-blue-700 text-white"
                    : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {done ? "✓" : index + 1}
              </div>
              <span
                className={`mt-2 text-[11px] leading-4 ${
                  active
                    ? "font-semibold text-blue-700"
                    : done
                      ? "font-medium text-slate-600"
                      : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div className="flex flex-[1.4] items-center px-2 pt-4">
                <div
                  className={`h-0.5 w-full rounded-full transition-colors ${
                    index < current ? "bg-blue-700" : "bg-slate-200"
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);
