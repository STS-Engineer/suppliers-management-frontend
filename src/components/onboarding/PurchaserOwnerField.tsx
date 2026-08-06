/**
 * PurchaserOwnerField — searchable purchaser picker for the supplier owner field.
 *
 * Fetches all active local purchasers (across every plant) + group-level
 * purchasers from the API, presents them as a selectable list, and falls back
 * to an AVO Carbon directory search (via MemberDirectoryPicker) for emails not
 * in that list.
 */

import React, { useEffect, useState } from "react";
import { supplierAPI } from "../../services/supplierOnboardingAPI";
import { MemberDirectoryPicker } from "../common/MemberDirectoryPicker";

export interface PurchaserOption {
  id_identity: number;
  full_name: string;
  email: string;
  access_profile: string;
}

interface Props {
  siteId: number;
  value: string;
  onChange: (email: string) => void;
  siteName?: string;
}

const PROFILE_LABEL: Record<string, string> = {
  purchasing_director: "Director",
  global_purchaser: "Global",
  local_purchaser: "Local",
};

export const PurchaserOwnerField: React.FC<Props> = ({
  siteId,
  value,
  onChange,
}) => {
  const [localPurchasers, setLocalPurchasers] = useState<PurchaserOption[]>([]);
  const [groupPurchasers, setGroupPurchasers] = useState<PurchaserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [manualMode, setManualMode] = useState(false);
  // Snapshot of the last confirmed/saved value (kept in sync whenever we're
  // NOT in manual mode) -- used so "← Back to list" only clears a value the
  // user was actively abandoning mid-edit, never a value that was already
  // saved before this field was even opened (e.g. an external contractor's
  // email that just happens not to be in the local/group directory).
  const savedValueRef = React.useRef(value);
  useEffect(() => {
    if (!manualMode) savedValueRef.current = value;
  }, [value, manualMode]);

  useEffect(() => {
    setLoading(true);
    setLocalPurchasers([]);
    setGroupPurchasers([]);
    supplierAPI
      .getSitePurchasers(siteId)
      .then((res: any) => {
        const local: PurchaserOption[] = res.data?.local_purchasers ?? [];
        const group: PurchaserOption[] = res.data?.group_purchasers ?? [];
        setLocalPurchasers(local);
        setGroupPurchasers(group);
        // If current value isn't in the directory, open manual (directory search) mode
        const known = [...local, ...group].some((p) => p.email === value);
        if (value && !known) {
          setManualMode(true);
        }
      })
      .catch(() => {
        // Non-fatal: show directory search if fetch fails
        setManualMode(true);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const allPurchasers = [...localPurchasers, ...groupPurchasers];
  const q = search.toLowerCase();
  const filtered = q
    ? allPurchasers.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q),
      )
    : allPurchasers;

  const filteredLocal = filtered.filter((p) =>
    localPurchasers.some((s) => s.email === p.email),
  );
  const filteredGroup = filtered.filter((p) =>
    groupPurchasers.some((g) => g.email === p.email),
  );

  const handleSelectCard = (email: string) => {
    onChange(email);
    setManualMode(false);
    setSearch("");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-400">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />
        Loading purchasers…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Search bar */}
      {allPurchasers.length > 0 && !manualMode && (
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0f2744]/40 focus:bg-white focus:ring-2 focus:ring-[#0f2744]/8"
          />
        </div>
      )}

      {/* Purchaser list */}
      {!manualMode && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              No purchasers found.
            </p>
          ) : (
            <>
              {filteredLocal.length > 0 && (
                <div>
                  <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Local purchasers
                  </p>
                  {filteredLocal.map((p) => (
                    <PurchaserRow
                      key={p.email}
                      purchaser={p}
                      selected={value === p.email}
                      onClick={() => handleSelectCard(p.email)}
                    />
                  ))}
                </div>
              )}
              {filteredGroup.length > 0 && (
                <div>
                  <p
                    className={`border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${
                      filteredLocal.length > 0 ? "border-t" : ""
                    }`}
                  >
                    Group purchasers
                  </p>
                  {filteredGroup.map((p) => (
                    <PurchaserRow
                      key={p.email}
                      purchaser={p}
                      selected={value === p.email}
                      onClick={() => handleSelectCard(p.email)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Manual entry toggle / AVO Carbon directory search */}
      {!manualMode ? (
        <button
          type="button"
          onClick={() => setManualMode(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2 text-xs font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Enter a different email
        </button>
      ) : (
        <div className="space-y-2">
          <MemberDirectoryPicker
            fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
            value={value}
            onChange={(email) => {
              onChange(email);
              setManualMode(false);
            }}
            placeholder="Rechercher dans l'annuaire AVO Carbon…"
            fetchKey="purchaser-manual-entry"
          />
          {allPurchasers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setManualMode(false);
                // Only clear if the value is a fresh, unconfirmed edit the
                // user is walking away from — not the value that was
                // already saved when this field was opened.
                if (
                  value !== savedValueRef.current &&
                  !allPurchasers.some((p) => p.email === value)
                )
                  onChange("");
              }}
              className="text-xs font-medium text-slate-400 underline hover:text-slate-600"
            >
              ← Back to list
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const PurchaserRow: React.FC<{
  purchaser: PurchaserOption;
  selected: boolean;
  onClick: () => void;
}> = ({ purchaser, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-left text-sm transition last:border-b-0 ${
      selected
        ? "bg-[#0f2744]/5 border-l-2 border-l-[#0f2744]"
        : "bg-white hover:bg-slate-50 border-l-2 border-l-transparent"
    }`}
  >
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        selected ? "bg-[#0f2744] text-white" : "bg-slate-100 text-slate-500"
      }`}
    >
      {selected ? (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        purchaser.full_name[0]?.toUpperCase() ?? "?"
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className={`truncate text-xs font-semibold ${selected ? "text-[#0f2744]" : "text-slate-800"}`}>
        {purchaser.full_name}
      </p>
      <p className="truncate text-[10px] text-slate-400">{purchaser.email}</p>
    </div>
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
      {PROFILE_LABEL[purchaser.access_profile] ?? purchaser.access_profile}
    </span>
  </button>
);
