import React from "react";
import { SupplierMasterCreationResponse } from "../../types/onboarding";

interface SupplierMasterSuccessPageProps {
  response: SupplierMasterCreationResponse;
  onContinueToSites: () => void;
  onNewSupplier: () => void;
}

export const SupplierMasterSuccessPage: React.FC<
  SupplierMasterSuccessPageProps
> = ({ response, onContinueToSites, onNewSupplier }) => {
  const supplier = response.data || {
    group_id: 0,
    group_code: "GRP-000000",
    group_name: "Unknown",
    unit_id: 0,
    unit_code: "N/A",
    unit_reference_code: "UNT-000000",
    contacts_count: 0,
    certifications_count: 0,
  };

  const nextActions = [
    "Assign this unit to an Avocarbon site.",
    "Set the relation owner and scope.",
    "Record the initial unit evaluation after the first site assignment.",
    "Add another unit for the same supplier group.",
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-green-400 to-green-500 text-white shadow-lg">
              <svg
                className="h-10 w-10"
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-600">
              Lifecycle Phase 1 Complete
            </p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">
              Supplier Master Created
            </h1>
            <p className="mt-3 text-base text-gray-600">
              {supplier.group_name} and its first unit are now saved. The next
              step is to assign the unit to at least one Avocarbon site, then
              record the unit qualification and scorecard.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Supplier Group
              </p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {supplier.group_name}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {supplier.group_code ||
                  `GRP-${String(supplier.group_id).padStart(6, "0")}`}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                First Unit
              </p>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {supplier.unit_reference_code ||
                  `UNT-${String(supplier.unit_id).padStart(6, "0")}`}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Supplier code: {supplier.unit_code}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
            <p className="font-semibold text-blue-900">You can now:</p>
            <ul className="mt-3 space-y-2">
              {nextActions.map((action) => (
                <li key={action} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-700" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onContinueToSites}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 font-semibold text-white shadow-md transition hover:from-blue-700 hover:to-blue-600 hover:shadow-lg"
            >
              Continue to Site Assignment
            </button>

            <button
              type="button"
              onClick={onNewSupplier}
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
            >
              Create Another Supplier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
