/**
 * Success Page
 * Shown after successful supplier onboarding submission
 */

import React from "react";
import { OnboardingResponse } from "../../types/onboarding";

interface SuccessPageProps {
  response: OnboardingResponse;
  onNewSupplier: () => void;
  onViewSupplier: () => void;
}

export const SuccessPage: React.FC<SuccessPageProps> = ({
  response,
  onNewSupplier,
  onViewSupplier,
}) => {
  const supplier = response.data?.supplier || {
    group_id: 0,
    group_name: "Unknown",
    unit_id: 0,
    unit_code: "N/A",
  };
  const prequalification = response.data?.prequalification;
  const emails = response.data?.emails;

  const emailItems = [
    {
      key: "creation_notification",
      title: "Supplier Creation Notification",
      desc: "Sent to the primary contact with supplier details.",
      sent: emails?.creation_notification,
    },
    {
      key: "owner_assignment",
      title: "Owner Assignment Notification",
      desc: "Sent to the assigned supplier owner.",
      sent: emails?.owner_assignment,
    },
    {
      key: "assessment_template",
      title: "Self-Assessment Template",
      desc: "Sent when the baseline questionnaire is launched.",
      sent: emails?.assessment_template,
    },
    {
      key: "prequalification_launch",
      title: "Prequalification Overview",
      desc: "Sent with the initial lifecycle and evaluation summary.",
      sent: emails?.prequalification_launch,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-600 rounded-full blur-xl opacity-20" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-r from-green-400 to-green-500 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Supplier Onboarding Complete!
          </h1>
          <p className="text-xl text-gray-600">
            {supplier.group_name} has been successfully created and the initial
            lifecycle baseline has been recorded.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Supplier Details
              </h3>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                Created
              </span>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Group Name
                </span>
                <span className="text-gray-900 font-medium">
                  {supplier.group_name}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Group ID
                </span>
                <span className="font-mono text-sm text-gray-700 bg-gray-50 px-3 py-1 rounded">
                  {supplier.group_id}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Unit Code
                </span>
                <span className="text-gray-900 font-medium">
                  {supplier.unit_code}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Unit ID
                </span>
                <span className="font-mono text-sm text-gray-700 bg-gray-50 px-3 py-1 rounded">
                  {supplier.unit_id}
                </span>
              </div>
            </div>
          </div>

          {prequalification && (
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Baseline Evaluation
                </h3>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  Recorded
                </span>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Evaluation Cycle ID
                  </span>
                  <span className="font-mono text-sm text-gray-700 bg-gray-50 px-3 py-1 rounded">
                    {prequalification.cycle_id ?? "Not created"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Assessment ID
                  </span>
                  <span className="font-mono text-sm text-gray-700 bg-gray-50 px-3 py-1 rounded">
                    {prequalification.assessment_id ?? "Not created"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Template ID
                  </span>
                  <span className="font-mono text-sm text-gray-700 bg-gray-50 px-3 py-1 rounded">
                    {prequalification.template_id ?? "Not linked"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Score Card ID
                  </span>
                  <span className="font-mono text-sm text-gray-700 bg-gray-50 px-3 py-1 rounded">
                    {prequalification.score_card_id ?? "Not created"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Classification ID
                  </span>
                  <span className="font-mono text-sm text-gray-700 bg-gray-50 px-3 py-1 rounded">
                    {prequalification.classification_id ?? "Not created"}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-4 pt-3 border-t border-gray-100">
                  Theoretical class, operational, and impact baselines are now
                  stored for this supplier relation.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Email Notifications
              </h3>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                Processed
              </span>
            </div>
            <div className="px-6 py-4 space-y-4">
              {emailItems.map((item) => (
                <div
                  key={item.key}
                  className="flex gap-3 py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-shrink-0">
                    <svg
                      className={`w-5 h-5 ${
                        item.sent === false ? "text-amber-500" : "text-green-500"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.desc}
                      {item.sent === false ? " Not sent yet." : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-slate-100 to-slate-50 border-l-4 border-slate-600 rounded-lg p-6">
            <div className="flex gap-3">
              <svg
                className="w-6 h-6 text-slate-700 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-bold text-slate-900 mb-2">Next Steps:</p>
                <ul className="space-y-2 text-sm text-slate-800">
                  <li>• Monitor supplier self-assessment completion in the evaluations area.</li>
                  <li>• Track the supplier relation lifecycle from the supplier dashboard.</li>
                  <li>• Reassess operational grade from KPI data when performance feeds become available.</li>
                  <li>• Recompute class only when one of the 11 class criteria changes.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onViewSupplier}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-700 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg"
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
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            View Supplier
          </button>

          <button
            type="button"
            onClick={onNewSupplier}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
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
            Add Another Supplier
          </button>
        </div>
      </div>
    </div>
  );
};
