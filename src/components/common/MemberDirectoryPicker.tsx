/**
 * MemberDirectoryPicker — searchable AVO Carbon member picker.
 *
 * Fetches the member directory (live from the AVO Carbon Central MCP, with a
 * local fallback if that's unreachable) via the given `fetchDirectory` call,
 * and lets the user filter it by typing a few letters of a name, email, or
 * role. Falls back to free-text entry if the directory can't be loaded or
 * the wanted email isn't listed.
 *
 * Once a value is selected (from the list or typed manually), it collapses
 * to a compact confirmed card with a "Change" action — it does not stay
 * stuck open on the full list after a pick.
 *
 * Used for the gate approval Project Manager designation (public, token-based
 * fetch) and for committee approver role assignment (authenticated fetch) —
 * pass whichever `fetchDirectory` fits the call site.
 */

import React, { useEffect, useState } from "react";

export interface MemberDirectoryEntry {
  people_id: number;
  full_name: string;
  email: string;
  work_unit_name?: string | null;
  role_name?: string | null;
}

interface Props {
  fetchDirectory: () => Promise<any>;
  value: string;
  onChange: (email: string) => void;
  /** Fires only when a directory entry is clicked (not on manual entry) — use
   * this to also capture full_name/role_name/etc alongside the email. */
  onSelectEntry?: (entry: MemberDirectoryEntry) => void;
  placeholder?: string;
  /** Re-fetches when this changes (e.g. a token or role key). */
  fetchKey?: string | number;
}

export const MemberDirectoryPicker: React.FC<Props> = ({
  fetchDirectory,
  value,
  onChange,
  onSelectEntry,
  placeholder = "name@avocarbon.com",
  fetchKey,
}) => {
  const [members, setMembers] = useState<MemberDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [stale, setStale] = useState(false);
  // false = show the confirmed compact card (a value is already picked);
  // true = show the search box + full list so the user can pick/change.
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchDirectory()
      .then((res: any) => {
        const entries: MemberDirectoryEntry[] = res.data?.entries ?? [];
        setMembers(entries);
        setStale(res.data?.source === "cache");
        const known = entries.some((m) => m.email === value);
        if (value && !known) {
          setManualMode(true);
          setManualEmail(value);
        } else if (entries.length === 0) {
          setManualMode(true);
          setManualEmail(value);
        } else {
          // Either a known value is already confirmed (collapsed card), or
          // there's no value yet — open the list so the user can pick one.
          setBrowsing(!value);
        }
      })
      .catch(() => {
        // Non-fatal: fall back to manual entry if the directory can't load
        setManualMode(true);
        if (value) setManualEmail(value);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? members.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.role_name ?? "").toLowerCase().includes(q),
      )
    : members;
  // Surface the currently-selected member at the top, regardless of
  // alphabetical order, so a pre-filled selection is visible without searching.
  const ordered = value
    ? [...filtered].sort((a, b) => (a.email === value ? -1 : b.email === value ? 1 : 0))
    : filtered;

  const selectedEntry = members.find((m) => m.email === value);

  const handleManualConfirm = () => {
    onChange(manualEmail.trim());
    setManualMode(false);
    setBrowsing(false);
  };

  const handleSelectCard = (entry: MemberDirectoryEntry) => {
    onChange(entry.email);
    onSelectEntry?.(entry);
    setManualMode(false);
    setManualEmail("");
    setSearch("");
    setBrowsing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs text-slate-400">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />
        Loading AVO Carbon directory…
      </div>
    );
  }

  // Confirmed compact view — a value is selected and we're not actively
  // browsing/editing it.
  if (!manualMode && !browsing && selectedEntry) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-blue-800">{selectedEntry.full_name}</p>
          <p className="truncate text-[10px] text-blue-600/80">
            {selectedEntry.email}
            {selectedEntry.role_name ? ` · ${selectedEntry.role_name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBrowsing(true)}
          className="shrink-0 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
        >
          Change
        </button>
      </div>
    );
  }

  // Confirmed compact view for a manually-entered email that isn't in the
  // directory (not a directory pick, so no name/role to show).
  if (!manualMode && !browsing && !selectedEntry && value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-white">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700">{value}</p>
          <p className="text-[10px] text-slate-400">Not in the AVO Carbon directory</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setManualMode(true);
            setManualEmail(value);
          }}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
        >
          Change
        </button>
      </div>
    );
  }

  // Confirmed compact view for "intentionally left empty" — reached via the
  // "Leave empty" action below, so it doesn't look unfinished if the field
  // is optional.
  if (!manualMode && !browsing && !value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2">
        <p className="flex-1 text-xs text-slate-400">Nobody selected</p>
        <button
          type="button"
          onClick={() => setBrowsing(true)}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
        >
          Select
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stale && !manualMode && members.length > 0 && (
        <p className="text-[10px] text-amber-600">
          Live directory unavailable — showing the last synced list.
        </p>
      )}

      {/* Search bar */}
      {members.length > 0 && !manualMode && (
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
            placeholder="Type a name, email, or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-blue-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}

      {/* Member list */}
      {!manualMode && (
        <div className="max-h-56 overflow-y-auto overflow-x-hidden rounded-xl border border-blue-200">
          {ordered.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              No matching member found.
            </p>
          ) : (
            ordered.slice(0, 50).map((m) => (
              <MemberRow
                key={m.email}
                member={m}
                selected={value === m.email}
                onClick={() => handleSelectCard(m)}
              />
            ))
          )}
        </div>
      )}

      {/* Manual entry toggle / input */}
      {!manualMode ? (
        <div className="flex items-center gap-2">
          {selectedEntry && (
            <button
              type="button"
              onClick={() => setBrowsing(false)}
              className="text-xs font-medium text-slate-400 underline hover:text-slate-600"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setManualMode(true);
              setManualEmail(value);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-200 py-2 text-xs font-medium text-blue-500 transition hover:border-blue-300 hover:text-blue-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Enter a different email
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setBrowsing(false);
            }}
            className="shrink-0 text-xs font-medium text-slate-400 underline hover:text-slate-600"
          >
            Leave empty
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="email"
              autoFocus
              placeholder={placeholder}
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualConfirm();
                if (e.key === "Escape" && members.length > 0) setManualMode(false);
              }}
              className="w-full rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={handleManualConfirm}
              disabled={!manualEmail.trim()}
              className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              Use
            </button>
          </div>
          {members.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setManualMode(false);
                setManualEmail("");
                setBrowsing(!members.some((m) => m.email === value));
                if (!members.some((m) => m.email === value)) onChange("");
              }}
              className="text-xs font-medium text-slate-400 underline hover:text-slate-600"
            >
              ← Back to directory
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MemberRow: React.FC<{
  member: MemberDirectoryEntry;
  selected: boolean;
  onClick: () => void;
}> = ({ member, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 border-b border-blue-50 px-4 py-2.5 text-left text-sm transition last:border-b-0 ${
      selected
        ? "bg-blue-50 border-l-2 border-l-blue-600"
        : "bg-white hover:bg-blue-50/50 border-l-2 border-l-transparent"
    }`}
  >
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
      }`}
    >
      {selected ? (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        member.full_name[0]?.toUpperCase() ?? "?"
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className={`truncate text-xs font-semibold ${selected ? "text-blue-700" : "text-slate-800"}`}>
        {member.full_name}
      </p>
      <p className="truncate text-[10px] text-slate-400">
        {member.email}
        {member.role_name ? ` · ${member.role_name}` : ""}
      </p>
    </div>
    {member.work_unit_name && (
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
        {member.work_unit_name}
      </span>
    )}
  </button>
);
