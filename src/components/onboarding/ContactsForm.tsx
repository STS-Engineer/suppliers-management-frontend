/**
 * Contacts Form Step
 */

import React, { useState } from "react";
import { ContactFormData, FormErrors } from "../../types/onboarding";
import { FormInput, FormCheckbox } from "./FormElements";

interface ContactsFormProps {
  contacts: ContactFormData[];
  errors: { [key: number]: FormErrors };
  onAddContact: () => void;
  onRemoveContact: (index: number) => void;
  onChange: (index: number, field: keyof ContactFormData, value: any) => void;
  onBlur: (index: number, field: keyof ContactFormData) => void;
}

export const ContactsForm: React.FC<ContactsFormProps> = ({
  contacts,
  errors,
  onAddContact,
  onRemoveContact,
  onChange,
  onBlur,
}) => {
  return (
    <div className="form-section">
      <div className="section-header">
        <div className="section-header-icon">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
          </svg>
        </div>
        <div className="section-header-content">
          <h2 className="section-header-title">Supplier Contacts</h2>
          <p className="section-header-subtitle">
            Add key contacts from the supplier organization
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {contacts.map((contact, index) => (
          <div key={index} className="contact-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Contact #{index + 1}</h3>
              {contacts.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveContact(index)}
                  className="btn-icon-danger"
                  title="Remove contact"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
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
              <div className="col-span-2">
                <FormInput
                  label="Full Name"
                  name={`contact-${index}-full_name`}
                  value={contact.full_name}
                  onChange={(e) => onChange(index, "full_name", e.target.value)}
                  placeholder="e.g., John Zhang"
                  error={errors[index]?.full_name}
                  required
                />
              </div>

              <FormInput
                label="Email"
                name={`contact-${index}-email`}
                type="email"
                value={contact.email}
                onChange={(e) => onChange(index, "email", e.target.value)}
                onBlur={() => onBlur(index, "email")}
                placeholder="john@example.com"
                error={errors[index]?.email}
                required
              />

              <FormInput
                label="Phone"
                name={`contact-${index}-phone`}
                value={contact.phone}
                onChange={(e) => onChange(index, "phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
                error={errors[index]?.phone}
              />

              <FormInput
                label="Role Label"
                name={`contact-${index}-role_label`}
                value={contact.role_label}
                onChange={(e) => onChange(index, "role_label", e.target.value)}
                placeholder="e.g., Quality Manager"
                error={errors[index]?.role_label}
                helperText="e.g., Quality Manager, Procurement Manager"
              />

              <div className="col-span-2">
                <FormInput
                  label="Detailed Role Description"
                  name={`contact-${index}-role_name`}
                  value={contact.role_name}
                  onChange={(e) => onChange(index, "role_name", e.target.value)}
                  placeholder="Full role description"
                  error={errors[index]?.role_name}
                />
              </div>

              <FormCheckbox
                label="Primary Contact"
                name={`contact-${index}-is_primary`}
                checked={contact.is_primary_contact}
                onChange={(e) =>
                  onChange(index, "is_primary_contact", e.target.checked)
                }
                helperText="This contact will receive all notifications"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddContact}
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
          Add Another Contact
        </button>
      </div>

      <div className="info-box mt-6">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0z"
            clipRule="evenodd"
          />
        </svg>
        <p>
          At least one primary contact is required. They will receive the
          assessment template and prequalification instructions.
        </p>
      </div>
    </div>
  );
};
