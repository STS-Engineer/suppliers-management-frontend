/**
 * CommitteeVotePage — public page (no auth required).
 * Accessed via the unique link sent to each committee member.
 * Route: /committee-vote/:token
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import supplierAPI from "../services/supplierOnboardingAPI";

type VoteForm = {
  id_decision: number;
  id_review: number;
  member_name: string | null;
  member_position: string | null;
  member_email: string;
  already_decided: boolean;
  decision: string | null;
  comments: string | null;
  decided_at: string | null;
  token_expires_at: string | null;
  supplier_snapshot: Record<string, string | null> | null;
  review_status: string;
};

const fmt = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
};

export default function CommitteeVotePage() {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState<VoteForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | "">("");
  const [comments, setComments] = useState("");
  const [suggestedStatus, setSuggestedStatus] = useState("");
  const [suggestedStrategic, setSuggestedStrategic] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    supplierAPI
      .getCommitteeVoteForm(token)
      .then((res: any) => {
        const d = res?.data ?? res;
        setForm(d);
        if (d.already_decided) {
          setDecision(d.decision ?? "");
          setComments(d.comments ?? "");
          setSubmitted(true);
        }
      })
      .catch((e: any) => setError(e?.message || "Invalid or expired link."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!decision || !token) return;
    setSubmitting(true);
    try {
      await supplierAPI.submitCommitteeVote(token, decision, comments || undefined, suggestedStatus || undefined, suggestedStrategic.length ? suggestedStrategic.join(",") : undefined);
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#062B49]" />
          Loading…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mb-2 text-base font-bold text-slate-800">Link Error</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!form) return null;

  const snap = form.supplier_snapshot ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 overflow-hidden rounded-2xl bg-[#062B49] shadow-lg">
          <div className="px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
                  AvoCarbon Supplier Management
                </p>
                <h1 className="text-lg font-bold text-white">Committee Validation</h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-blue-200">
              Dear <strong className="text-white">{form.member_name}</strong>
              {form.member_position ? ` (${form.member_position})` : ""},
              please review the supplier below and submit your decision.
            </p>
          </div>
        </div>

        {/* Supplier info card */}
        <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-3.5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Supplier Information</h2>
          </div>
          <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-slate-100 sm:grid-cols-3">
            {[
              { label: "Supplier", value: snap.supplier_name },
              { label: "Plant", value: snap.site_name },
              { label: "Family", value: snap.family },
              { label: "Grade", value: snap.final_grade },
              { label: "Status", value: snap.supplier_status },
            ].map(({ label, value }) => (
              <div key={label} className="px-5 py-3">
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <p className="text-sm font-semibold text-slate-800">{value || "—"}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Decision card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-3.5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              {submitted ? "Your Decision" : "Submit Your Decision"}
            </h2>
          </div>
          <div className="p-6">
            {submitted ? (
              <div className="text-center">
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                  decision === "approved" ? "bg-emerald-100" : "bg-red-100"
                }`}>
                  {decision === "approved" ? (
                    <svg className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-7 w-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <p className={`text-lg font-bold ${decision === "approved" ? "text-emerald-700" : "text-red-700"}`}>
                  {decision === "approved" ? "Approved" : "Rejected"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Decision submitted{form.decided_at ? ` on ${fmt(form.decided_at)}` : ""}
                </p>
                {comments && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Comments</p>
                    <p className="mt-1 text-sm text-slate-700">{comments}</p>
                  </div>
                )}
                <p className="mt-5 text-xs text-slate-400">Thank you for your response. The VP Conversion has been notified.</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="mb-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecision("approved")}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 py-5 transition ${
                      decision === "approved"
                        ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200"
                        : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      decision === "approved" ? "bg-emerald-500" : "bg-slate-100"
                    }`}>
                      <svg className={`h-5 w-5 ${decision === "approved" ? "text-white" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className={`text-sm font-bold ${decision === "approved" ? "text-emerald-700" : "text-slate-600"}`}>
                      Approve
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision("rejected")}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 py-5 transition ${
                      decision === "rejected"
                        ? "border-red-400 bg-red-50 ring-2 ring-red-200"
                        : "border-slate-200 hover:border-red-300 hover:bg-red-50/50"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      decision === "rejected" ? "bg-red-500" : "bg-slate-100"
                    }`}>
                      <svg className={`h-5 w-5 ${decision === "rejected" ? "text-white" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <span className={`text-sm font-bold ${decision === "rejected" ? "text-red-700" : "text-slate-600"}`}>
                      Reject
                    </span>
                  </button>
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                    Comments <span className="text-slate-300 font-normal normal-case tracking-normal">(optional)</span>
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={3}
                    placeholder="Provide any comments or justification…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-3 focus:ring-blue-100"
                  />
                </div>

                {/* Suggestions */}
                <div className="mb-5 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60">
                  <div className="border-b border-amber-200/60 bg-amber-50 px-4 py-2.5">
                    <p className="text-xs font-bold text-amber-800">Suggest a change <span className="font-normal text-amber-600">(optional)</span></p>
                    <p className="text-[10px] text-amber-600">If you believe adjustments are needed, suggest them here. The VP Conversion will review all suggestions before making the final decision.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:items-start">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Suggested Supplier Status</label>
                      <select
                        value={suggestedStatus}
                        onChange={(e) => setSuggestedStatus(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      >
                        <option value="">— No suggestion —</option>
                        <option value="Can Quote and Be Awarded">Can Quote and Be Awarded</option>
                        <option value="Can Quote but Not be Awarded">Can Quote but Not be Awarded</option>
                        <option value="New business on Hold">New Business on Hold</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Suggested Strategic Mention</label>
                      <div className="flex flex-col gap-1.5">
                        {["None", "Strategic", "Monopolistic", "Directed"].map((opt) => {
                          const val = opt.toLowerCase();
                          const checked = suggestedStrategic.includes(val);
                          return (
                            <label key={val} className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSuggestedStrategic((prev) =>
                                    checked ? prev.filter((v) => v !== val) : [...prev, val]
                                  )
                                }
                                className="h-3.5 w-3.5 rounded border-slate-300 text-amber-500 accent-amber-500"
                              />
                              <span className="text-xs text-slate-700">{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!decision || submitting}
                  className="w-full rounded-xl bg-[#062B49] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0C5381] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Submitting…" : "Submit Decision"}
                </button>

                <p className="mt-3 text-center text-[11px] text-slate-400">
                  Expires: {fmt(form.token_expires_at)} · This link is unique to you.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
