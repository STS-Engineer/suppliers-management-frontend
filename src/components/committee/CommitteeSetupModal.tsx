/**
 * CommitteeSetupModal — VP fills name + email for each of the 6 fixed roles,
 * then sends the review to the committee.
 */
import { useEffect, useState } from "react";
import supplierAPI from "../../services/supplierOnboardingAPI";

const ROLES = [
  "Purchasing VP",
  "Quality Manager",
  "Supply Chain Manager",
  "Operation Manager",
  "Financial Controller",
  "R&D Manager",
] as const;

type RoleEntry = {
  id_member?: number;
  name: string;
  email: string;
};

type SupplierInfo = {
  supplierName: string;
  supplierCode: string;
  siteName: string;
  relationId: number;
};

export default function CommitteeSetupModal({
  supplierInfo,
  onClose,
  onSent,
}: {
  supplierInfo: SupplierInfo;
  onClose: () => void;
  onSent: () => void;
}) {
  const [entries, setEntries] = useState<Record<string, RoleEntry>>(() =>
    Object.fromEntries(ROLES.map((r) => [r, { name: "", email: "" }]))
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing members and pre-fill matching roles
  useEffect(() => {
    (async () => {
      try {
        const res: any = await supplierAPI.listCommitteeMembers();
        const existing: { id_member: number; name: string; position: string; email: string }[] =
          res?.data ?? [];
        setEntries((prev) => {
          const next = { ...prev };
          for (const m of existing) {
            if (next[m.position] !== undefined) {
              next[m.position] = { id_member: m.id_member, name: m.name, email: m.email };
            }
          }
          return next;
        });
      } catch {
        // start with empty form
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (role: string, field: "name" | "email", value: string) => {
    setEntries((prev) => ({ ...prev, [role]: { ...prev[role], [field]: value } }));
  };

  const handleSend = async () => {
    const filled = ROLES.filter((r) => entries[r].name.trim() && entries[r].email.trim());
    if (filled.length === 0) {
      setError("Please fill in at least one committee member.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Upsert each filled role
      for (const role of ROLES) {
        const e = entries[role];
        if (!e.name.trim() || !e.email.trim()) continue;
        if (e.id_member) {
          await supplierAPI.updateCommitteeMember(e.id_member, {
            name: e.name.trim(),
            email: e.email.trim(),
            is_active: true,
          });
        } else {
          await supplierAPI.createCommitteeMember({
            name: e.name.trim(),
            position: role,
            email: e.email.trim(),
            is_active: true,
          });
        }
      }
      // Initiate review
      await supplierAPI.initiateCommitteeReview(supplierInfo.relationId);
      onSent();
    } catch (e: any) {
      setError(e?.message ?? "Failed to send to committee.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_80px_rgba(2,6,23,0.4)] dark:bg-[#0d1929]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0f2744] px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-base font-bold">Send to Executive Committee</h2>
                  <p className="text-xs text-slate-300">
                    {supplierInfo.supplierName} · {supplierInfo.supplierCode} · {supplierInfo.siteName}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
            Each member will receive a secure email link to submit their decision. Fill in the name and email for each role. Rows left blank will be skipped.
          </p>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
              <span className="text-sm text-slate-400">Loading existing members…</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Column headers */}
              <div className="grid grid-cols-[180px_1fr_1fr] gap-3 px-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email Address</span>
              </div>

              {ROLES.map((role) => (
                <div key={role} className="grid grid-cols-[180px_1fr_1fr] items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{role}</span>
                  </div>
                  <input
                    value={entries[role].name}
                    onChange={(e) => update(role, "name", e.target.value)}
                    placeholder="Full name"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-white/[0.08] dark:bg-[#111e30] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-[#162235]"
                  />
                  <input
                    value={entries[role].email}
                    onChange={(e) => update(role, "email", e.target.value)}
                    placeholder="name@avocarbon.com"
                    type="email"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-white/[0.08] dark:bg-[#111e30] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-[#162235]"
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-900/10 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={submitting || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {submitting ? "Sending…" : "Send to Committee"}
          </button>
        </div>
      </div>
    </div>
  );
}
