import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import supplierAPI from "../services/supplierOnboardingAPI";

interface PeerVote {
  approver_email: string | null;
  is_plant_manager: boolean | null;
  approver_role: string | null;
  decision: string | null;
  decided_at: string | null;
}

interface VoteForm {
  vote_id: number;
  approver_email: string | null;
  approver_role: string | null;
  committee_level: string | null;
  already_decided: boolean;
  decision: string | null;
  token_expires_at: string | null;
  requires_project_manager: boolean;
  all_votes: PeerVote[];
  // Identity
  opportunity_name: string | null;
  opportunity_type: string | null;
  phase_from: string | null;
  requested_by: string | null;
  message: string | null;
  idea_owner: string | null;
  project_owner: string | null;
  change_mode: string | null;
  // Scope
  scope_in: string | null;
  scope_out: string | null;
  customers: string | null;
  // Supplier before/after
  proposed_supplier_name: string | null;
  country_after: string | null;
  supplier_asked: boolean | null;
  supplier_asked_result: string | null;
  // Risks & benefits
  stp_risks: Record<string, string> | null;
  stp_benefits: { if_we_do?: string; if_not?: string } | null;
  // Pricing
  current_price: number | null;
  proposed_price: number | null;
  current_price_n1: number | null;
  proposed_price_n1: number | null;
  current_price_n2: number | null;
  proposed_price_n2: number | null;
  current_price_n3: number | null;
  proposed_price_n3: number | null;
  // Quantities
  annual_quantity_n1: number | null;
  annual_quantity_n2: number | null;
  annual_quantity_n3: number | null;
  annual_quantity_n4: number | null;
  // Savings
  saving_year_n: number | null;
  saving_year_n1: number | null;
  saving_year_n2: number | null;
  saving_year_n3: number | null;
  period_saving: number | null;
  expected_annual_saving: number | null;
  // ROI & investment
  roi_percent: number | null;
  roi_period_percent: number | null;
  total_investment: number | null;
  tooling_cost: number | null;
  travel_cost: number | null;
  qualification_cost: number | null;
  other_cost: number | null;
  // Logistics
  incoterms_before: string | null;
  incoterms_after: string | null;
  place_of_incoterms_before: string | null;
  place_of_incoterms_after: string | null;
  top_days_before: number | null;
  top_days_after: number | null;
  // Planning
  planned_start_date: string | null;
  planned_end_date: string | null;
  duration_months: number | null;
}

const NEXT_PHASE: Record<string, string> = {
  "Phase 0": "Phase 1", "Phase 1": "Phase 2",
  "Phase 2": "Phase 3", "Phase 3": "Phase 4", "Phase 4": "Closed",
};

const eur = (v: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

// Unit prices (e.g. 2.50 €/pc) need decimal precision — eur() rounds to whole
// euros, which silently collapses distinct before/after prices to the same value.
const eurPrice = (v: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v);

const num = (v: number | null, decimals = 0) =>
  v == null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals }).format(v);

const val = (v: string | number | null) => (v == null || v === "" ? "—" : String(v));

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 font-medium">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-blue-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

function YearTable({
  label,
  rows,
}: {
  label: string;
  rows: { year: string; current: number | null; proposed: number | null; qty?: number | null; saving?: number | null }[];
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left text-slate-400 font-medium pb-1 pr-3">Year</th>
            <th className="text-right text-slate-400 font-medium pb-1 pr-3">Current (€)</th>
            <th className="text-right text-slate-400 font-medium pb-1 pr-3">Proposed (€)</th>
            {rows[0]?.qty !== undefined && <th className="text-right text-slate-400 font-medium pb-1 pr-3">Qty</th>}
            {rows[0]?.saving !== undefined && <th className="text-right text-slate-400 font-medium pb-1">Saving (€)</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year} className="border-b border-slate-50">
              <td className="py-1 pr-3 font-semibold text-slate-600">{r.year}</td>
              <td className="py-1 pr-3 text-right text-slate-700">{eurPrice(r.current)}</td>
              <td className="py-1 pr-3 text-right font-semibold text-blue-700">{eurPrice(r.proposed)}</td>
              {r.qty !== undefined && <td className="py-1 pr-3 text-right text-slate-600">{num(r.qty)}</td>}
              {r.saving !== undefined && (
                <td className={`py-1 text-right font-semibold ${r.saving != null && r.saving > 0 ? "text-emerald-700" : "text-slate-600"}`}>
                  {eur(r.saving)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GateApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState<VoteForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [decision, setDecision] = useState<"Approved" | "Rejected" | "Needs Review" | "">("");
  const [comment, setComment] = useState("");
  const [pmEmail, setPmEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    supplierAPI
      .getVoteForm(token)
      .then((res) => setForm(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const needsPmEmail = form?.requires_project_manager && decision === "Approved";

  async function submit() {
    if (!decision || !token) return;
    if (needsPmEmail && !pmEmail.trim()) {
      setSubmitError("Please enter the Project Manager email before confirming.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await supplierAPI.submitVote(token, {
        decision,
        comment: comment || undefined,
        project_manager_email: needsPmEmail ? pmEmail.trim() : undefined,
      });
      // Decision is committed — show done screen immediately
      setDone(true);
      // Re-fetch in background to update all_votes panel; ignore failures
      try {
        const refreshed = await supplierAPI.getVoteForm(token);
        setForm(refreshed.data);
      } catch { /* non-critical — done screen already showing */ }
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit your decision. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-400">
        Loading approval form…
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="text-3xl mb-3">🔗</div>
          <p className="text-slate-700 font-semibold text-sm mb-1">Link unavailable</p>
          <p className="text-slate-400 text-xs">{error}</p>
        </div>
      </div>
    );

  if (!form) return null;

  if (form.already_decided || done) {
    const myDecision = done ? decision : form.decision;
    const decisionColor =
      myDecision === "Approved" ? "text-emerald-600" :
      myDecision === "Rejected" ? "text-red-600" : "text-amber-600";
    const decisionIcon =
      myDecision === "Approved" ? "✅" :
      myDecision === "Rejected" ? "❌" : "🔄";

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-md mx-auto space-y-4">

          {/* Decision confirmation */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
            <div className="text-4xl mb-3">{decisionIcon}</div>
            <p className={`font-bold text-xl ${decisionColor}`}>{myDecision}</p>
            <p className="text-slate-500 text-sm mt-1">Your decision has been recorded.</p>
            <p className="text-slate-400 text-xs">Thank you for your response.</p>
            {form.opportunity_name && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mb-0.5">Opportunity</p>
                <p className="text-sm font-semibold text-slate-700">{form.opportunity_name}</p>
                {form.opportunity_type && (
                  <p className="text-xs text-slate-400">{form.opportunity_type}</p>
                )}
              </div>
            )}
          </div>

          {/* Panel decisions */}
          {form.all_votes.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                Panel Decisions
              </p>
              <div className="space-y-2.5">
                {form.all_votes.map((v, i) => {
                  const isSelf = v.approver_email === form.approver_email;
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] ${isSelf ? "font-semibold text-slate-800" : "text-slate-600"}`}>
                          {v.approver_email}
                          {isSelf && " (you)"}
                        </span>
                        {v.approver_role ? (
                          <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                            {v.approver_role}
                          </span>
                        ) : (
                          v.is_plant_manager && (
                            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                              Plant Mgr
                            </span>
                          )
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          v.decision === "Approved" ? "text-emerald-600" :
                          v.decision === "Rejected" ? "text-red-600" :
                          v.decision === "Needs Review" ? "text-amber-600" :
                          "text-slate-400 italic font-normal"
                        }`}
                      >
                        {v.decision === "Approved" ? "✅ Approved" :
                         v.decision === "Rejected" ? "❌ Rejected" :
                         v.decision === "Needs Review" ? "🔄 Needs Review" :
                         "Pending…"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-slate-300">
            Avocarbon · Suppliers Management
          </p>
        </div>
      </div>
    );
  }

  const phaseArrow = `${val(form.phase_from)} → ${NEXT_PHASE[form.phase_from ?? ""] ?? "next phase"}`;

  const hasPricingData = form.current_price != null || form.current_price_n1 != null;
  const hasCosts = (form.tooling_cost ?? 0) + (form.travel_cost ?? 0) + (form.qualification_cost ?? 0) + (form.other_cost ?? 0) > 0;
  const hasIncoterms = (v: string | null) => v != null && v !== "" && v !== "0";
  const hasTopDays = (v: number | null) => v != null && v > 0;
  const hasLogistics =
    hasIncoterms(form.incoterms_before) || hasIncoterms(form.incoterms_after) ||
    hasIncoterms(form.place_of_incoterms_before) || hasIncoterms(form.place_of_incoterms_after) ||
    hasTopDays(form.top_days_before) || hasTopDays(form.top_days_after);
  const hasScope = !!(form.scope_in || form.scope_out || form.customers);
  const hasSupplier = !!(
    form.proposed_supplier_name ||
    form.country_after ||
    form.supplier_asked_result
  );
  const risks = form.stp_risks ?? {};
  const riskRows = [
    { label: "Material Indexation", before: risks.material_indexation_before, after: risks.material_indexation_after, desc: risks.material_indexation_desc },
    { label: "Exchange Rate", before: risks.exchange_rate_before, after: risks.exchange_rate_after, desc: risks.exchange_rate_desc },
    { label: "Local Content", before: risks.local_content_before, after: risks.local_content_after, desc: risks.local_content_desc },
    { label: "Quality", before: risks.quality_before, after: risks.quality_after, desc: risks.quality_desc },
    { label: "Other", before: risks.other_before, after: risks.other_after, desc: risks.other_desc },
  ].filter((r) => r.before || r.after || r.desc);
  const specRows = [
    { label: "Same Spec", value: risks.material_same_spec },
    { label: "Same Tooling", value: risks.same_tooling },
    { label: "Same Dimension", value: risks.same_dimension },
    { label: "Same Process", value: risks.same_process },
  ].filter((r) => r.value);
  const hasRisks = riskRows.length > 0 || specRows.length > 0;
  const hasBenefits = !!(form.stp_benefits?.if_we_do || form.stp_benefits?.if_not);

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-1">
                Gate Approval — {phaseArrow}
              </p>
              <h1 className="text-base font-bold text-slate-800 leading-snug">{val(form.opportunity_name)}</h1>
              <p className="text-xs text-slate-400 mt-0.5">{val(form.opportunity_type)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold px-2.5 py-1">
              Pending your decision
            </span>
          </div>
          {form.requested_by && (
            <p className="text-xs text-slate-500 mt-3">
              Requested by <span className="font-semibold text-slate-700">{form.requested_by}</span>
            </p>
          )}
          {(form.approver_role || form.committee_level) && (
            <p className="text-xs text-slate-500 mt-1">
              Your role: <span className="font-semibold text-slate-700">{form.approver_role ?? "—"}</span>
              {form.committee_level && ` · ${form.committee_level} Committee`}
            </p>
          )}
          {form.message && (
            <div className="mt-3 bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-800 border border-blue-100">
              {form.message}
            </div>
          )}
        </div>

        {/* Mutual visibility — other approvers' status */}
        {form.all_votes.length > 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Panel Decisions
            </p>
            <div className="space-y-2">
              {form.all_votes.map((v, i) => {
                const isSelf = v.approver_email === form.approver_email;
                return (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className={isSelf ? "font-semibold text-slate-800" : "text-slate-600"}>
                        {v.approver_email}
                        {isSelf && " (you)"}
                      </span>
                      {v.approver_role ? (
                        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                          {v.approver_role}
                        </span>
                      ) : (
                        v.is_plant_manager && (
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                            Plant Mgr
                          </span>
                        )
                      )}
                    </div>
                    <span
                      className={`font-semibold ${
                        v.decision === "Approved"
                          ? "text-emerald-600"
                          : v.decision === "Rejected"
                            ? "text-red-600"
                            : v.decision === "Needs Review"
                              ? "text-amber-600"
                              : "text-slate-400 italic font-normal"
                      }`}
                    >
                      {v.decision === "Approved"
                        ? "✅ Approved"
                        : v.decision === "Rejected"
                          ? "❌ Rejected"
                          : v.decision === "Needs Review"
                            ? "🔄 Needs Review"
                            : "Pending…"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dossier */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
            Opportunity Dossier
          </p>

          {/* People & context */}
          <Section title="Context">
            <Row label="Idea Owner" value={val(form.idea_owner)} />
            <Row label="Project Manager" value={val(form.project_owner)} />
            <Row label="Change Type" value={val(form.change_mode)} highlight={form.change_mode === "Standard"} />
            <Row label="Opportunity Type" value={val(form.opportunity_type)} />
          </Section>

          {/* Scope */}
          {hasScope && (
            <>
              <hr className="border-slate-100" />
              <Section title="Scope">
                {form.scope_in && <Row label="Scope IN" value={val(form.scope_in)} />}
                {form.scope_out && <Row label="Scope OUT" value={val(form.scope_out)} />}
                {form.customers && <Row label="Customers" value={val(form.customers)} />}
              </Section>
            </>
          )}

          {/* Supplier before/after */}
          {hasSupplier && (
            <>
              <hr className="border-slate-100" />
              <Section title="Supplier (After)">
                {form.proposed_supplier_name && <Row label="Proposed Supplier" value={val(form.proposed_supplier_name)} />}
                {form.country_after && <Row label="Country After" value={val(form.country_after)} />}
                {form.supplier_asked != null && (
                  <Row label="Current Supplier Asked" value={form.supplier_asked ? "Yes" : "No"} />
                )}
                {form.supplier_asked_result && <Row label="Result" value={val(form.supplier_asked_result)} />}
              </Section>
            </>
          )}

          <hr className="border-slate-100" />

          {/* STP pricing table */}
          {hasPricingData && (
            <>
              <YearTable
                label="Price Comparison & Savings by Year"
                rows={[
                  // annual_quantity_n1 pairs with the un-suffixed price/saving fields
                  // (Year N), n2 with the "_n1" fields (Year N+1), etc. — the "n" index
                  // is one year ahead of the row label (see compute_stp_financials).
                  { year: "N",   current: form.current_price,   proposed: form.proposed_price,   qty: form.annual_quantity_n1, saving: form.saving_year_n  },
                  { year: "N+1", current: form.current_price_n1, proposed: form.proposed_price_n1, qty: form.annual_quantity_n2, saving: form.saving_year_n1 },
                  { year: "N+2", current: form.current_price_n2, proposed: form.proposed_price_n2, qty: form.annual_quantity_n3, saving: form.saving_year_n2 },
                  { year: "N+3", current: form.current_price_n3, proposed: form.proposed_price_n3, qty: form.annual_quantity_n4, saving: form.saving_year_n3 },
                ].filter((r) => r.current != null || r.proposed != null)}
              />
              <hr className="border-slate-100" />
            </>
          )}

          {/* Savings summary */}
          <Section title="Total Savings">
            <Row label="Period Saving" value={eur(form.period_saving)} highlight />
            <Row label="Expected Annual Saving" value={eur(form.expected_annual_saving)} highlight />
            <Row label="ROI" value={form.roi_percent != null ? `${form.roi_percent.toFixed(1)} %` : "—"} />
            {form.roi_period_percent != null && (
              <Row label="ROI (period)" value={`${form.roi_period_percent.toFixed(1)} %`} />
            )}
          </Section>

          {/* Investment & costs */}
          {hasCosts && (
            <>
              <hr className="border-slate-100" />
              <Section title="Investment & Costs">
                {form.total_investment != null && <Row label="Total Investment" value={eur(form.total_investment)} />}
                {form.tooling_cost != null && form.tooling_cost > 0 && <Row label="Tooling" value={eur(form.tooling_cost)} />}
                {form.travel_cost != null && form.travel_cost > 0 && <Row label="Travel" value={eur(form.travel_cost)} />}
                {form.qualification_cost != null && form.qualification_cost > 0 && <Row label="Qualification" value={eur(form.qualification_cost)} />}
                {form.other_cost != null && form.other_cost > 0 && <Row label="Other" value={eur(form.other_cost)} />}
              </Section>
            </>
          )}

          {/* Logistics */}
          {hasLogistics && (
            <>
              <hr className="border-slate-100" />
              <Section title="Logistics">
                {hasIncoterms(form.incoterms_before) && <Row label="Incoterms Before" value={val(form.incoterms_before)} />}
                {hasIncoterms(form.incoterms_after) && <Row label="Incoterms After" value={val(form.incoterms_after)} />}
                {hasIncoterms(form.place_of_incoterms_before) && <Row label="Place of Incoterms Before" value={val(form.place_of_incoterms_before)} />}
                {hasIncoterms(form.place_of_incoterms_after) && <Row label="Place of Incoterms After" value={val(form.place_of_incoterms_after)} />}
                {hasTopDays(form.top_days_before) && <Row label="TOP Before" value={`${form.top_days_before} days`} />}
                {hasTopDays(form.top_days_after) && <Row label="TOP After" value={`${form.top_days_after} days`} />}
              </Section>
            </>
          )}

          {/* Risks */}
          {hasRisks && (
            <>
              <hr className="border-slate-100" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Risks</p>
                {riskRows.length > 0 && (
                  <table className="w-full text-[11px] mb-2">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left text-slate-400 font-medium pb-1 pr-3">Category</th>
                        <th className="text-left text-slate-400 font-medium pb-1 pr-3">Before</th>
                        <th className="text-left text-slate-400 font-medium pb-1 pr-3">After</th>
                        <th className="text-left text-slate-400 font-medium pb-1">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskRows.map((r) => (
                        <tr key={r.label} className="border-b border-slate-50">
                          <td className="py-1 pr-3 font-semibold text-slate-600">{r.label}</td>
                          <td className="py-1 pr-3 text-slate-700">{val(r.before ?? null)}</td>
                          <td className="py-1 pr-3 text-slate-700">{val(r.after ?? null)}</td>
                          <td className="py-1 text-slate-500">{r.desc || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {specRows.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {specRows.map((r) => (
                      <Row key={r.label} label={r.label} value={val(r.value ?? null)} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Benefits */}
          {hasBenefits && (
            <>
              <hr className="border-slate-100" />
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Benefits</p>
                {form.stp_benefits?.if_we_do && (
                  <p className="text-xs text-slate-700">
                    <span className="font-semibold text-emerald-700">If we do: </span>
                    {form.stp_benefits.if_we_do}
                  </p>
                )}
                {form.stp_benefits?.if_not && (
                  <p className="text-xs text-slate-700">
                    <span className="font-semibold text-red-700">If not: </span>
                    {form.stp_benefits.if_not}
                  </p>
                )}
              </div>
            </>
          )}

          <hr className="border-slate-100" />

          {/* Planning */}
          <Section title="Planning">
            <Row label="Planned Start" value={val(form.planned_start_date)} />
            {form.planned_end_date && <Row label="Planned End" value={val(form.planned_end_date)} />}
            <Row label="Duration" value={form.duration_months ? `${form.duration_months} months` : "—"} />
          </Section>
        </div>

        {/* Decision card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400 mb-4">
            Your Decision
          </p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {(["Approved", "Rejected", "Needs Review"] as const).map((d) => {
              const active = decision === d;
              const cfg = {
                Approved: { bg: active ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 text-slate-600 hover:border-emerald-300", icon: "✅" },
                Rejected: { bg: active ? "bg-red-600 text-white border-red-600" : "border-slate-200 text-slate-600 hover:border-red-300", icon: "❌" },
                "Needs Review": { bg: active ? "bg-amber-500 text-white border-amber-500" : "border-slate-200 text-slate-600 hover:border-amber-300", icon: "🔄" },
              }[d];
              return (
                <button
                  key={d}
                  onClick={() => setDecision(d)}
                  className={`rounded-xl border-2 py-3 text-xs font-semibold transition-all ${cfg.bg}`}
                >
                  <span className="block text-lg mb-1">{cfg.icon}</span>
                  {d}
                </button>
              );
            })}
          </div>

          <textarea
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="Comment (optional but recommended if rejecting or requesting review)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          {/* PM designation — plant manager only, when approving */}
          {needsPmEmail && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-blue-800">
                Designate Project Manager <span className="text-red-500">*</span>
              </p>
              <p className="text-[11px] text-blue-600">
                As Plant Manager, your approval assigns the Project Manager who will lead
                this project through Phase 1 and beyond. They will receive a notification email.
              </p>
              <input
                type="email"
                required
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="project.manager@avocarbon.com"
                value={pmEmail}
                onChange={(e) => setPmEmail(e.target.value)}
              />
            </div>
          )}

          {submitError && (
            <p className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
              {submitError}
            </p>
          )}

          <button
            onClick={submit}
            disabled={!decision || submitting}
            className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {submitting ? "Submitting…" : "Confirm Decision"}
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-300">
          Avocarbon · Suppliers Management · This link expires in 72 hours
        </p>
      </div>
    </div>
  );
}
