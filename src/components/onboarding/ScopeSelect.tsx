/**
 * ScopeSelect - supplier relation scope selector
 */

import React from "react";

interface ScopeSelectProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const SCOPES = [
  { value: "local", label: "Local", desc: "Single site with focused coverage" },
  { value: "global", label: "Global", desc: "Broader group-level coverage" },
  {
    value: "strategic",
    label: "Strategic",
    desc: "Critical relation with elevated attention",
  },
];

export const ScopeSelect: React.FC<ScopeSelectProps> = ({
  value,
  onChange,
  disabled,
}) => (
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {SCOPES.map((scope) => {
      const selected = value === scope.value;

      return (
        <button
          key={scope.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(scope.value)}
          className={`rounded-xl border px-3 py-3 text-left transition ${
            selected
              ? "border-blue-700 bg-blue-50 shadow-sm"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <div
            className={`text-sm font-semibold ${
              selected ? "text-blue-700" : "text-slate-900"
            }`}
          >
            {scope.label}
          </div>
          <div
            className={`mt-1 text-xs leading-5 ${
              selected ? "text-blue-600" : "text-slate-500"
            }`}
          >
            {scope.desc}
          </div>
        </button>
      );
    })}
  </div>
);

/**
 * FormField - label + optional error wrapper
 */

interface FormFieldProps {
  label: string;
  error?: string;
  span?: 1 | 2;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  span = 1,
  children,
}) => (
  <div className={span === 2 ? "sm:col-span-2" : ""}>
    <label className="mb-2 block text-sm font-medium text-slate-700">
      {label}
    </label>
    {children}
    {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
  </div>
);
