/**
 * Form Input Component
 * Reusable input field with validation
 */

import React from "react";

interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  helperText?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  required = false,
  disabled = false,
  readOnly = false,
  helperText,
}) => {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={`form-input ${error ? "border-red-500" : "border-gray-300"}`}
      />
      {error && <p className="form-error">{error}</p>}
      {helperText && <p className="form-helper">{helperText}</p>}
    </div>
  );
};

interface FormSelectProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: ReadonlyArray<{
    readonly value: string | number;
    readonly label: string;
  }>;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  error,
  required = false,
  disabled = false,
}) => {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`form-select ${error ? "border-red-500" : "border-gray-300"}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

interface FormCheckboxProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  helperText?: string;
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
  label,
  name,
  checked,
  onChange,
  helperText,
}) => {
  return (
    <div className="form-group flex items-start gap-3">
      <input
        id={name}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="form-checkbox mt-1"
      />
      <div>
        <label htmlFor={name} className="form-label cursor-pointer">
          {label}
        </label>
        {helperText && <p className="form-helper">{helperText}</p>}
      </div>
    </div>
  );
};

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
  label,
  name,
  value,
  onChange,
  placeholder,
  error,
  rows = 4,
}) => {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`form-textarea ${error ? "border-red-500" : "border-gray-300"}`}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};
