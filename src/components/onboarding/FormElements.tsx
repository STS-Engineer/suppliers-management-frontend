/**
 * Form Elements — shared form primitives for the onboarding flow
 */

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

// ─── FormInput ────────────────────────────────────────────────────────────────

interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  helperText?: string;
  min?: number;
  max?: number;
  step?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  suffix?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label, name, type = "text", value, onChange, onBlur, placeholder,
  error, required = false, disabled = false, readOnly = false,
  helperText, min, max, step, inputMode, suffix,
}) => {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          id={name} name={name} type={type} value={value} onChange={onChange} onBlur={onBlur}
          placeholder={placeholder} disabled={disabled} readOnly={readOnly}
          min={min} max={max} step={step} inputMode={inputMode}
          className={`form-input ${suffix ? "pr-10" : ""} ${error ? "border-red-500" : "border-gray-300"}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      {helperText && <p className="form-helper">{helperText}</p>}
    </div>
  );
};

// ─── FormSelect ───────────────────────────────────────────────────────────────

interface FormSelectProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: ReadonlyArray<{ readonly value: string | number; readonly label: string }>;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label, name, value, onChange, options, placeholder,
  error, required = false, disabled = false, helperText,
}) => {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <select
        id={name} name={name} value={value} onChange={onChange} disabled={disabled}
        className={`form-select ${error ? "border-red-500" : "border-gray-300"}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="form-error">{error}</p>}
      {helperText && <p className="form-helper">{helperText}</p>}
    </div>
  );
};

// ─── FormCheckbox ─────────────────────────────────────────────────────────────

interface FormCheckboxProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  helperText?: string;
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
  label, name, checked, onChange, helperText,
}) => {
  return (
    <div className="form-group flex items-start gap-3">
      <input
        id={name} name={name} type="checkbox" checked={checked} onChange={onChange}
        className="form-checkbox mt-1"
      />
      <div>
        <label htmlFor={name} className="form-label cursor-pointer">{label}</label>
        {helperText && <p className="form-helper">{helperText}</p>}
      </div>
    </div>
  );
};

// ─── FormTextarea ─────────────────────────────────────────────────────────────

interface FormTextareaProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  error?: string;
  rows?: number;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label, name, value, onChange, placeholder, error, rows = 4,
}) => {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">{label}</label>
      <textarea
        id={name} name={name} value={value} onChange={onChange}
        placeholder={placeholder} rows={rows}
        className={`form-textarea ${error ? "border-red-500" : "border-gray-300"}`}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

// ─── CreatableMultiSelect ─────────────────────────────────────────────────────

const LS_PREFIX = "avocarbon_form_options_";

function loadOptions(storageKey: string, defaults: string[]): string[] {
  try {
    const raw = localStorage.getItem(LS_PREFIX + storageKey);
    const saved: string[] = raw ? JSON.parse(raw) : [];
    const all = [...new Set([...defaults, ...saved])];
    return all;
  } catch {
    return defaults;
  }
}

function saveOption(storageKey: string, option: string) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + storageKey);
    const saved: string[] = raw ? JSON.parse(raw) : [];
    if (!saved.includes(option)) {
      localStorage.setItem(LS_PREFIX + storageKey, JSON.stringify([...saved, option]));
    }
  } catch {}
}

interface CreatableMultiSelectProps {
  label: string;
  name: string;
  value: string[];
  onChange: (values: string[]) => void;
  storageKey: string;
  defaultOptions?: string[];
  /** When provided, the dropdown shows only these options (cascading filter). */
  availableOptions?: string[];
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
}

export const CreatableMultiSelect: React.FC<CreatableMultiSelectProps> = ({
  label, name, value, onChange, storageKey,
  defaultOptions = [], availableOptions,
  placeholder = "Search or create…",
  required = false, helperText, error,
}) => {
  const [options, setOptions] = useState<string[]>(() =>
    loadOptions(storageKey, defaultOptions)
  );
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // When availableOptions is provided use it as the source; otherwise use full options list.
  const sourceOptions = availableOptions ?? options;

  const filtered = sourceOptions.filter(
    (o) =>
      o.toLowerCase().includes(search.toLowerCase()) &&
      !value.includes(o)
  );

  const canCreate =
    search.trim().length > 0 &&
    !options.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  const toggle = (option: string) => {
    onChange(
      value.includes(option)
        ? value.filter((v) => v !== option)
        : [...value, option]
    );
  };

  const createOption = () => {
    const newOpt = search.trim();
    if (!newOpt) return;
    saveOption(storageKey, newOpt);
    setOptions((prev) => [...new Set([...prev, newOpt])]);
    onChange([...value, newOpt]);
    setSearch("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canCreate) createOption();
      else if (filtered.length > 0) toggle(filtered[0]);
    }
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div className="form-group" ref={containerRef}>
      <label className="form-label">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="ml-0.5 text-slate-400 hover:text-rose-600 transition"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger input */}
      <div className="relative">
        <div
          className={`flex cursor-text items-center gap-2 rounded-lg border bg-white px-3 py-2 ${
            open ? "border-blue-400 ring-4 ring-blue-100" : error ? "border-red-400" : "border-gray-300"
          }`}
          onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        >
          <input
            ref={inputRef}
            id={name}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : "Add more…"}
            className="flex-1 border-0 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
          />
          <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 && !canCreate && (
                <p className="px-4 py-3 text-xs text-slate-400">
                  {search ? "No matching options" : "Start typing to search or create"}
                </p>
              )}

              {filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => { toggle(o); setSearch(""); inputRef.current?.focus(); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex-1">{o}</span>
                  {value.includes(o) && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))}

              {canCreate && (
                <button
                  type="button"
                  onClick={createOption}
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm font-semibold text-[#0f2744] hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Create &ldquo;{search.trim()}&rdquo;
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {helperText && <p className="form-helper">{helperText}</p>}
    </div>
  );
};
