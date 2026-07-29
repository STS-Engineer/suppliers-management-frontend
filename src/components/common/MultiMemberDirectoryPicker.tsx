/**
 * MultiMemberDirectoryPicker — a list of MemberDirectoryPicker rows for fields
 * that collect several AVO Carbon emails at once (CC lists, multi-recipient
 * "Send To" fields, etc). Each row is independently searchable/removable,
 * with an "add another" button to append an empty row.
 */

import React from "react";
import { MemberDirectoryPicker } from "./MemberDirectoryPicker";

interface Props {
  fetchDirectory: () => Promise<any>;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  /** Unique key prefix so each row's picker fetch-effect is independent. */
  fetchKeyPrefix: string;
}

export const MultiMemberDirectoryPicker: React.FC<Props> = ({
  fetchDirectory,
  values,
  onChange,
  placeholder = "name@avocarbon.com",
  addLabel = "+ Add another",
  fetchKeyPrefix,
}) => {
  const rows = values.length > 0 ? values : [""];

  return (
    <div className="space-y-2">
      {rows.map((email, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <MemberDirectoryPicker
              fetchDirectory={fetchDirectory}
              fetchKey={`${fetchKeyPrefix}_${idx}`}
              value={email}
              onChange={(v) => onChange(rows.map((e, i) => (i === idx ? v : e)))}
              placeholder={placeholder}
            />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, i) => i !== idx))}
              className="mt-2 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500"
              title="Remove"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, ""])}
        className="text-[11px] font-semibold text-blue-600 hover:underline"
      >
        {addLabel}
      </button>
    </div>
  );
};
