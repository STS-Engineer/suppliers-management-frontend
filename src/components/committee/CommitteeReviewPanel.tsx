/**
 * CommitteeReviewPanel — shows committee review status + final-decision dialog.
 * Used inside RelationEvaluationPage when panel_decision = "panel_add_exec_committee".
 */
import { useEffect, useState } from "react";
import supplierAPI from "../../services/supplierOnboardingAPI";

type Decision = {
  id_decision: number;
  member_email: string;
  member_name: string | null;
  member_position: string | null;
  decision: string | null;
  comments: string | null;
  decided_at: string | null;
  accessed_at: string | null;
  suggested_supplier_status: string | null;
  suggested_strategic_mention: string | null;
};

type Review = {
  id_review: number;
  id_relation: number;
  status: string;
  initiated_by: string | null;
  initiated_at: string | null;
  all_decided_at: string | null;
  final_decision: string | null;
  final_decision_by: string | null;
  final_decision_at: string | null;
  final_decision_comments: string | null;
  supplier_snapshot: Record<string, string | null> | null;
  decisions: Decision[];
  total_members: number;
  decided_count: number;
  approved_count: number;
  rejected_count: number;
};

const fmt = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return d; }
};

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision)
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400">Pending</span>;
  if (decision === "approved")
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Approved</span>;
  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Rejected</span>;
}

function StatusBadge({ status, finalDecision }: { status: string; finalDecision: string | null }) {
  if (finalDecision === "approved")
    return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ Added to panel — Committee validated</span>;
  if (finalDecision === "rejected")
    return <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">✗ Rejected by committee</span>;
  if (status === "completed")
    return <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">All responded — Awaiting final decision</span>;
  if (status === "in_progress")
    return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">In Progress</span>;
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Pending</span>;
}

export default function CommitteeReviewPanel({
  relationId,
  isVpConversion,
  onReviewChange,
}: {
  relationId: number;
  isVpConversion: boolean;
  onReviewChange?: () => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Final decision dialog
  const [showFinal, setShowFinal] = useState(false);
  const [finalDecision, setFinalDecision] = useState<"approved" | "rejected" | "">("");
  const [finalComments, setFinalComments] = useState("");
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);

  // Members management
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<{ id_member: number; name: string; position: string; email: string; is_active: boolean }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", position: "", email: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res: any = await supplierAPI.getLatestCommitteeReview(relationId);
      setReview(res?.data ?? null);
    } catch {
      // no review yet
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    setMembersLoading(true);
    try {
      const res: any = await supplierAPI.listCommitteeMembers();
      setMembers(res?.data ?? []);
    } catch {
      // ignore
    } finally {
      setMembersLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!addForm.name || !addForm.position || !addForm.email) return;
    setAddLoading(true);
    setAddError(null);
    try {
      await supplierAPI.createCommitteeMember(addForm);
      setAddForm({ name: "", position: "", email: "" });
      await loadMembers();
    } catch (e: any) {
      setAddError(e?.message ?? "Failed to add member.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleActive = async (m: { id_member: number; is_active: boolean }) => {
    try {
      await supplierAPI.updateCommitteeMember(m.id_member, { is_active: !m.is_active });
      await loadMembers();
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    if (isVpConversion) {
      (async () => {
        setMembersLoading(true);
        try {
          const res: any = await supplierAPI.listCommitteeMembers();
          const loaded = res?.data ?? [];
          setMembers(loaded);
          if (loaded.length === 0) setShowMembers(true);
        } catch {
          // ignore
        } finally {
          setMembersLoading(false);
        }
      })();
    }
  }, [relationId]);

  const handleInitiate = async () => {
    setInitiating(true);
    setError(null);
    try {
      await supplierAPI.initiateCommitteeReview(relationId);
      await load();
      onReviewChange?.();
    } catch (e: any) {
      setError(e?.message || "Failed to send to committee.");
    } finally {
      setInitiating(false);
    }
  };

  const handleFinalDecision = async () => {
    if (!finalDecision || !review) return;
    setFinalSubmitting(true);
    setFinalError(null);
    try {
      await supplierAPI.submitCommitteeFinalDecision(review.id_review, finalDecision, finalComments || undefined);
      setShowFinal(false);
      setFinalDecision("");
      setFinalComments("");
      await load();
      onReviewChange?.();
    } catch (e: any) {
      setFinalError(e?.message || "Failed to submit decision.");
    } finally {
      setFinalSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#062B49]" />
        <span className="text-sm text-slate-400">Loading committee status…</span>
      </div>
    );
  }

  const progressPct = review && review.total_members > 0
    ? Math.round((review.decided_count / review.total_members) * 100)
    : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm dark:border-indigo-500/20 dark:bg-[#111e30]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50/60 px-5 py-3.5 dark:border-indigo-500/20 dark:bg-indigo-900/10">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200">Committee Validation</p>
            <p className="text-[10px] text-indigo-500">Requires committee approval before panel inclusion</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {review && (
            <StatusBadge status={review.status} finalDecision={review.final_decision} />
          )}
          {isVpConversion && (
            <button
              type="button"
              onClick={() => { if (!showMembers) loadMembers(); setShowMembers((v) => !v); }}
              title="Manage committee members"
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${showMembers ? "border-indigo-300 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" : "border-indigo-200 bg-white text-indigo-500 hover:bg-indigo-50 dark:bg-transparent dark:hover:bg-indigo-500/10"}`}
            >
              ⚙ Members
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* ── Members management section ── */}
        {showMembers && isVpConversion && (
          <div className="mb-5 overflow-hidden rounded-xl border border-indigo-100 dark:border-indigo-500/20">
            <div className="border-b border-indigo-100 bg-indigo-50/40 px-4 py-2.5 dark:border-indigo-500/20 dark:bg-indigo-900/10">
              <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200">Committee Members</p>
              <p className="text-[10px] text-indigo-400">Configure who receives committee review emails</p>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
              {membersLoading ? (
                <div className="px-4 py-3 text-center text-xs text-slate-400">Loading…</div>
              ) : members.length === 0 ? (
                <div className="px-4 py-3 text-center text-xs text-slate-400">No members configured yet. Add the 6 committee members below.</div>
              ) : (
                members.map((m) => (
                  <div key={m.id_member} className={`flex items-center justify-between px-4 py-2.5 ${!m.is_active ? "opacity-50" : ""}`}>
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{m.name}</p>
                      <p className="text-[10px] text-slate-400">{m.position} · {m.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(m)}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold transition ${m.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    >
                      {m.is_active ? "Active" : "Inactive"}
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 bg-slate-50/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              {addError && <p className="mb-2 text-[10px] text-red-600">{addError}</p>}
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                />
                <input
                  value={addForm.position}
                  onChange={(e) => setAddForm((f) => ({ ...f, position: e.target.value }))}
                  placeholder="Position (e.g. Quality Manager)"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                />
                <input
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email address"
                  type="email"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                />
              </div>
              <button
                type="button"
                onClick={handleAddMember}
                disabled={addLoading || !addForm.name || !addForm.position || !addForm.email}
                className="mt-2 w-full rounded-lg bg-indigo-600 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700 disabled:opacity-40"
              >
                {addLoading ? "Adding…" : "+ Add Member"}
              </button>
            </div>
          </div>
        )}

        {!review ? (
          /* No review yet */
          <div className="text-center py-4">
            <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              This supplier requires committee validation
            </p>
            <p className="mb-5 text-xs text-slate-400">
              Send a review request to all committee members. Each member will receive an email with a secure link to submit their decision.
            </p>
            {isVpConversion ? (
              <button
                type="button"
                onClick={handleInitiate}
                disabled={initiating}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {initiating ? "Sending…" : "Send to Committee"}
              </button>
            ) : (
              <p className="text-xs text-slate-400">Only VP Conversion can initiate the committee review.</p>
            )}
          </div>
        ) : (
          <>
            {/* Progress bar */}
            {review.total_members > 0 && !review.final_decision && (
              <div className="mb-5">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Responses: {review.decided_count} / {review.total_members}
                  </span>
                  <span className="text-slate-400">{progressPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex gap-3 text-[10px] text-slate-400">
                  <span className="text-emerald-600 font-semibold">{review.approved_count} Approved</span>
                  <span className="text-red-600 font-semibold">{review.rejected_count} Rejected</span>
                  <span>{review.total_members - review.decided_count} Pending</span>
                </div>
              </div>
            )}

            {/* Final decision banner */}
            {review.final_decision && (
              <div className={`mb-4 rounded-xl border px-4 py-3 ${
                review.final_decision === "approved"
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-900/10"
                  : "border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-900/10"
              }`}>
                <p className={`text-xs font-bold ${review.final_decision === "approved" ? "text-emerald-700" : "text-red-700"}`}>
                  Final Decision: {review.final_decision === "approved" ? "Approved" : "Rejected"}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  By {review.final_decision_by} · {fmt(review.final_decision_at)}
                </p>
                {review.final_decision_comments && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">"{review.final_decision_comments}"</p>
                )}
              </div>
            )}

            {/* Member decisions table */}
            <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-white/[0.06]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.03]">
                    <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wide text-slate-400">Member</th>
                    <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wide text-slate-400">Position</th>
                    <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wide text-slate-400">Decision</th>
                    <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wide text-slate-400">Suggestions</th>
                    <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wide text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                  {review.decisions.map((d) => (
                    <tr key={d.id_decision} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{d.member_name || d.member_email}</p>
                        {d.accessed_at && (
                          <p className="text-[10px] text-slate-400">Opened {fmt(d.accessed_at)}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{d.member_position || "—"}</td>
                      <td className="px-4 py-2.5">
                        <DecisionBadge decision={d.decision} />
                        {d.comments && (
                          <p className="mt-1 text-[10px] text-slate-400 max-w-[160px] truncate" title={d.comments}>
                            "{d.comments}"
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {(d.suggested_supplier_status || (d.suggested_strategic_mention && d.suggested_strategic_mention.split(",").some(v => v && v !== "none"))) ? (
                          <div className="space-y-1">
                            {d.suggested_supplier_status && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                Status: {d.suggested_supplier_status}
                              </span>
                            )}
                            {d.suggested_strategic_mention && d.suggested_strategic_mention.split(",").filter(v => v && v !== "none").map(v => (
                              <span key={v} className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 ring-1 ring-purple-200">
                                Strategic: {v.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fmt(d.decided_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions row */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[10px] text-slate-400">
                Sent {fmt(review.initiated_at)} by {review.initiated_by}
              </p>
              <div className="flex gap-2">
                {isVpConversion && review.status === "in_progress" && (
                  <button
                    type="button"
                    onClick={handleInitiate}
                    disabled={initiating}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {initiating ? "Sending…" : "Re-send emails"}
                  </button>
                )}
                {isVpConversion && review.status === "completed" && !review.final_decision && (
                  <button
                    type="button"
                    onClick={() => setShowFinal(true)}
                    className="rounded-xl bg-[#062B49] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0C5381]"
                  >
                    Make Final Decision
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Final decision modal */}
      {showFinal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowFinal(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#111e30]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Final Committee Decision</h2>
              <p className="mt-0.5 text-xs text-slate-400">Review all committee responses and make the final decision.</p>
            </div>
            <div className="p-6">
              {/* Summary */}
              {review && (
                <>
                  <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-white/[0.04]">
                    <div>
                      <p className="text-lg font-bold text-emerald-600">{review.approved_count}</p>
                      <p className="text-[10px] text-slate-400">Approved</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-600">{review.rejected_count}</p>
                      <p className="text-[10px] text-slate-400">Rejected</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-600">{review.total_members - review.decided_count}</p>
                      <p className="text-[10px] text-slate-400">Pending</p>
                    </div>
                  </div>
                  {/* Member suggestions */}
                  {review.decisions.some(d => d.suggested_supplier_status || (d.suggested_strategic_mention && d.suggested_strategic_mention.split(",").some(v => v && v !== "none"))) && (
                    <div className="mb-4 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-900/10">
                      <p className="border-b border-amber-200/60 bg-amber-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:border-amber-500/20 dark:bg-amber-900/20">
                        Member Suggestions
                      </p>
                      <div className="divide-y divide-amber-100 dark:divide-amber-500/10">
                        {review.decisions.filter(d => d.suggested_supplier_status || (d.suggested_strategic_mention && d.suggested_strategic_mention.split(",").some(v => v && v !== "none"))).map(d => (
                          <div key={d.id_decision} className="px-3 py-2">
                            <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{d.member_name || d.member_email} <span className="font-normal text-slate-400">({d.member_position})</span></p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {d.suggested_supplier_status && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                  Status → {d.suggested_supplier_status}
                                </span>
                              )}
                              {d.suggested_strategic_mention && d.suggested_strategic_mention.split(",").filter(v => v && v !== "none").map(v => (
                                <span key={v} className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                                  Strategic → {v.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {finalError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                  {finalError}
                </div>
              )}

              <div className="mb-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFinalDecision("approved")}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 transition ${
                    finalDecision === "approved"
                      ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100"
                      : "border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${finalDecision === "approved" ? "bg-emerald-500" : "bg-slate-100"}`}>
                    <svg className={`h-4 w-4 ${finalDecision === "approved" ? "text-white" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className={`text-xs font-bold ${finalDecision === "approved" ? "text-emerald-700" : "text-slate-600"}`}>Approve Supplier</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFinalDecision("rejected")}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-4 transition ${
                    finalDecision === "rejected"
                      ? "border-red-400 bg-red-50 ring-2 ring-red-100"
                      : "border-slate-200 hover:border-red-300"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${finalDecision === "rejected" ? "bg-red-500" : "bg-slate-100"}`}>
                    <svg className={`h-4 w-4 ${finalDecision === "rejected" ? "text-white" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <span className={`text-xs font-bold ${finalDecision === "rejected" ? "text-red-700" : "text-slate-600"}`}>Reject Supplier</span>
                </button>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Comments <span className="font-normal normal-case tracking-normal text-slate-300">(optional)</span>
                </label>
                <textarea
                  value={finalComments}
                  onChange={(e) => setFinalComments(e.target.value)}
                  rows={3}
                  placeholder="Final notes or justification…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-3 focus:ring-blue-100 dark:border-white/[0.08] dark:bg-[#0d1929] dark:text-slate-200"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowFinal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalDecision}
                  disabled={!finalDecision || finalSubmitting}
                  className="flex-1 rounded-xl bg-[#062B49] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0C5381] disabled:opacity-40"
                >
                  {finalSubmitting ? "Submitting…" : "Confirm Decision"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
