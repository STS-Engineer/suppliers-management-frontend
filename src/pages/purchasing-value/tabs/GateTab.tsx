import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDot,
  Clock,
  Copy,
  Mail,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";
import { useAuth } from "../../../context/AuthContext";
import { MemberDirectoryPicker } from "../../../components/common/MemberDirectoryPicker";
import {
  ALL_ROLES,
  COMMITTEE_LEVELS,
  mandatoryRolesForPhase,
  NEGOTIATION_APPROVER_ROLES,
  type CommitteeLevel,
} from "../../../data/gateApprovalConstants";
import type { Opp, Tab } from "../types";
import { EDITOR_PROFILES, STATUS_COLORS } from "../constants";
import { fmtDate, fmtDateTime } from "../utils";
import { RemindModal } from "../modals/RemindModal";

export function GateTab({
  opp,
  userEmail,
  onRefresh,
  onNavigate,
}: {
  opp: Opp;
  userEmail: string;
  onRefresh: (o: Opp) => void;
  onNavigate: (tab: Tab) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  // The per-reviewer approval/validation links (and the "Send Approval Links"
  // action) are only exposed to the Purchasing Director and the Conversion
  // owner (vp_conversion access profile) — same privileged pair used for STP
  // revision decisions. Everyone else still sees request status, just not the
  // copyable approval links.
  const canSeeApprovalLinks =
    user?.access_profile === "purchasing_director" ||
    user?.access_profile === "vp_conversion";
  // Reminders only re-send an approver their own existing link (never expose it
  // to the clicker), so they're open to any editor — broader than the copyable
  // approval links above.
  const canRemindApprovers = EDITOR_PROFILES.includes(
    user?.access_profile ?? "",
  );
  // Start study
  const [showStart, setShowStart] = useState(false);
  // Gate decision
  const [decision, setDecision] = useState<"Go" | "No Go" | "Review">("Go");
  const [pm, setPm] = useState(opp.project_owner ?? "");
  const [comments, setComments] = useState("");
  const [showGate, setShowGate] = useState(false);
  // Gate approval request (Phase 0)
  const [showApproval, setShowApproval] = useState(false);
  const [plantManagerEmail, setPlantManagerEmail] = useState("");
  const [purchasingManagerEmails, setPurchasingManagerEmails] = useState<string[]>([""]);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  // Reminder to pending approvers (re-sends the existing approval link) — the
  // confirmation + result is handled by RemindModal.
  const [remindOpen, setRemindOpen] = useState(false);
  // Negotiation: single approver (Purchasing Director or VP Conversion) —
  // used for both the Phase 0 request and every Phase 1-4 committee request,
  // replacing the Plant Manager/committee-tier flow for this opportunity type.
  const isNegotiation = opp.opportunity_type === "Negotiation";
  const [negotiationApproverRole, setNegotiationApproverRole] = useState<
    (typeof NEGOTIATION_APPROVER_ROLES)[number]
  >(NEGOTIATION_APPROVER_ROLES[0]);
  const [negotiationApproverEmail, setNegotiationApproverEmail] = useState("");
  // Purchasing Director / VP Conversion accounts, fetched so the approver
  // picker (Negotiation single-approver + committee required-approver rows
  // for these two roles) is a select instead of a free-text email field.
  const [approverAccounts, setApproverAccounts] = useState<
    {
      id_identity: number;
      full_name: string;
      email: string;
      access_profile: string;
    }[]
  >([]);
  useEffect(() => {
    supplierAPI
      .getNegotiationApprovers()
      .then((r: { data?: typeof approverAccounts }) =>
        setApproverAccounts(r.data ?? []),
      )
      .catch(() => {});
  }, []);
  const ROLE_LABEL_TO_PROFILE: Record<string, string> = {
    "Purchasing Director": "purchasing_director",
    "VP Conversion": "vp_conversion",
  };
  const accountsForRole = (roleLabel: string) =>
    approverAccounts.filter(
      (a) => a.access_profile === ROLE_LABEL_TO_PROFILE[roleLabel],
    );
  // Sourcing committee approval request (Phase 1-4)
  const [committeeLevel, setCommitteeLevel] = useState<CommitteeLevel | "">("");
  const [approverEmails, setApproverEmails] = useState<Record<string, string>>(
    {},
  );
  const [showOptionalApprovers, setShowOptionalApprovers] = useState(false);
  const [approvalRequests, setApprovalRequests] = useState<
    {
      request_id: number;
      phase_from: string | null;
      requested_by: string | null;
      requested_at: string | null;
      status: string | null;
      consensus_result: string | null;
      committee_level: string | null;
      pm_notified_email?: string | null;
      pm_notified_at?: string | null;
      pm_notification_status?: string | null;
      votes: {
        vote_id: number;
        approver_email: string | null;
        access_token: string | null;
        is_plant_manager: boolean | null;
        approver_role: string | null;
        decision: string | null;
        decided_at: string | null;
        comment: string | null;
        project_manager_email: string | null;
        reminder_count?: number;
        last_reminded_at?: string | null;
      }[];
    }[]
  >([]);

  useEffect(() => {
    supplierAPI
      .getGateApprovalStatus(opp.opportunity_id)
      .then((res) => {
        const requests = res.data ?? [];
        setApprovalRequests(requests);
        // Pre-fill PM email from the most recent approved vote that carries a PM designation
        const pmFromVotes = requests
          .flatMap(
            (r: {
              votes: {
                decision: string | null;
                project_manager_email: string | null;
              }[];
            }) => r.votes,
          )
          .find(
            (v: {
              decision: string | null;
              project_manager_email: string | null;
            }) => v.decision === "Approved" && v.project_manager_email,
          )?.project_manager_email;
        if (pmFromVotes) setPm(pmFromVotes);
      })
      .catch(() => {});
  }, [opp.opportunity_id, opp.phase_status]);

  // Phase 1-4 committee gate: pre-fill the Plant Manager approver with whoever
  // approved as plant manager at Phase 0. Only empty fields are seeded, so a
  // manual override is preserved. (The Project Manager / leader is no longer a
  // voter — the Plant Manager designates it on their own vote, pre-filled with
  // the Phase 0 carry-over; see the approval vote page.)
  useEffect(() => {
    if (!showApproval || isNegotiation) return;
    const plantManagerEmail = approvalRequests
      .flatMap((r) => r.votes)
      .find((v) => v.is_plant_manager && v.approver_email)?.approver_email;
    if (!plantManagerEmail) return;
    setApproverEmails((m) =>
      m["Plant Manager"]?.trim()
        ? m
        : { ...m, "Plant Manager": plantManagerEmail },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showApproval, isNegotiation, approvalRequests]);

  // While the opportunity is awaiting a gate decision, approvers vote on the
  // external /approve link pages — poll so the app reflects new votes live and
  // shows the AUTOMATIC phase transition (once everyone approves) without a
  // manual refresh. Stops as soon as the status/phase changes.
  useEffect(() => {
    const awaiting =
      opp.status === "Awaiting Validation" ||
      opp.status === "Under Committee Review";
    if (!awaiting) return;
    const timer = setInterval(async () => {
      try {
        const st = await supplierAPI.getGateApprovalStatus(opp.opportunity_id);
        setApprovalRequests(st.data ?? []);
        // A completed gate means consensus was applied (phase advanced, or sent
        // back for rework / cancelled) — pull the fresh opportunity and update.
        const anyCompleted = (st.data ?? []).some(
          (r: { status: string | null }) => r.status === "Completed",
        );
        if (anyCompleted) {
          const fresh = await supplierAPI.getOpportunity(opp.opportunity_id);
          const f = fresh.data as Opp;
          if (f.status !== opp.status || f.phase_status !== opp.phase_status) {
            onRefresh(f);
          }
        }
      } catch {
        /* transient network error — keep polling */
      }
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp.opportunity_id, opp.status, opp.phase_status]);

  async function submitApprovalRequest() {
    // Block submission if STP format is incomplete for Sourcing/Technical types
    if (opp.phase_status === "Phase 0" && phase0Missing.length > 0) {
      setApprovalError(
        `Complete all required fields before sending: ${phase0Missing.map((c) => c.label).join(", ")}`,
      );
      return;
    }
    let requestPayload: {
      plant_manager_email?: string;
      purchasing_manager_emails?: string[];
      approver_role?: string;
      approver_email?: string;
      message?: string;
    };
    if (isNegotiation) {
      const approverEmail = negotiationApproverEmail.trim();
      if (!approverEmail) {
        setApprovalError("Approver email is required.");
        return;
      }
      requestPayload = {
        approver_role: negotiationApproverRole,
        approver_email: approverEmail,
        plant_manager_email: plantManagerEmail.trim() || undefined,
        message: approvalMessage || undefined,
      };
    } else {
      const pm = plantManagerEmail.trim();
      if (!pm) {
        setApprovalError("Plant Manager email is required.");
        return;
      }
      const purchasing = purchasingManagerEmails
        .map((e) => e.trim())
        .filter(Boolean);
      requestPayload = {
        plant_manager_email: pm,
        purchasing_manager_emails: purchasing,
        message: approvalMessage || undefined,
      };
    }
    setApprovalSubmitting(true);
    setApprovalError(null);
    try {
      await supplierAPI.requestGateApproval(opp.opportunity_id, requestPayload);
      const res = await supplierAPI.getGateApprovalStatus(opp.opportunity_id);
      const requests = res.data ?? [];
      setApprovalRequests(requests);
      // Reflect the new opportunity status (Awaiting Validation) immediately —
      // without this the badge stays stale until a manual page refresh.
      const freshOpp = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(freshOpp.data as Opp);
      const pmFromVotes = requests
        .flatMap(
          (r: {
            votes: {
              decision: string | null;
              project_manager_email: string | null;
            }[];
          }) => r.votes,
        )
        .find(
          (v: {
            decision: string | null;
            project_manager_email: string | null;
          }) => v.decision === "Approved" && v.project_manager_email,
        )?.project_manager_email;
      if (pmFromVotes) setPm(pmFromVotes);
      setShowApproval(false);
      setPlantManagerEmail("");
      setPurchasingManagerEmails([""]);
      setNegotiationApproverEmail("");
      setApprovalMessage("");
    } catch (e: unknown) {
      setApprovalError(e instanceof Error ? e.message : "Failed");
    } finally {
      setApprovalSubmitting(false);
    }
  }

  async function submitCommitteeApprovalRequest() {
    if (committeeMissing.length > 0) {
      setApprovalError(
        `Complete all required fields before sending: ${committeeMissing.map((c) => c.label).join(", ")}`,
      );
      return;
    }
    let committee_level: string | undefined;
    let approvers: { role: string; email: string }[];
    if (isNegotiation) {
      const approverEmail = negotiationApproverEmail.trim();
      if (!approverEmail) {
        setApprovalError("Approver email is required.");
        return;
      }
      committee_level = undefined;
      approvers = [{ role: negotiationApproverRole, email: approverEmail }];
    } else {
      const tier =
        opp.committee_level ||
        committeeLevel ||
        (opp.phase_status !== "Phase 1" ? "Light" : "");
      if (!tier) {
        setApprovalError(
          "Select a committee level (Light, Intermediate or Full).",
        );
        return;
      }
      const mandatoryRoles = mandatoryRolesForPhase(
        opp.phase_status,
        tier as CommitteeLevel,
      );
      const missing = mandatoryRoles.filter(
        (r) => !(approverEmails[r] ?? "").trim(),
      );
      if (missing.length) {
        setApprovalError(`Missing required approver(s): ${missing.join(", ")}`);
        return;
      }
      committee_level = opp.committee_level ? undefined : tier;
      approvers = Object.entries(approverEmails)
        .filter(([, email]) => email.trim())
        .map(([role, email]) => ({ role, email: email.trim() }));
    }
    setApprovalSubmitting(true);
    setApprovalError(null);
    try {
      await supplierAPI.requestCommitteeGateApproval(opp.opportunity_id, {
        committee_level,
        approvers,
        message: approvalMessage || undefined,
      });
      const res = await supplierAPI.getGateApprovalStatus(opp.opportunity_id);
      setApprovalRequests(res.data ?? []);
      // Reflect the new opportunity status (Under Committee Review) immediately —
      // without this the badge stays stale until a manual page refresh.
      const freshOpp = await supplierAPI.getOpportunity(opp.opportunity_id);
      onRefresh(freshOpp.data as Opp);
      setShowApproval(false);
      setApproverEmails({});
      setNegotiationApproverEmail("");
      setApprovalMessage("");
    } catch (e: unknown) {
      setApprovalError(e instanceof Error ? e.message : "Failed");
    } finally {
      setApprovalSubmitting(false);
    }
  }

  // After a reminder is sent from the modal, refresh the request so the
  // "reminded N× · date" counts update in place.
  async function refreshApprovalStatus() {
    try {
      const st = await supplierAPI.getGateApprovalStatus(opp.opportunity_id);
      setApprovalRequests(st.data ?? []);
    } catch {
      /* non-blocking */
    }
  }

  // Manually (re)send the Project Manager handover email for a given gate.
  const [pmSendingId, setPmSendingId] = useState<number | null>(null);
  const [pmMsg, setPmMsg] = useState<Record<number, string>>({});
  async function resendPmEmail(requestId: number) {
    setPmSendingId(requestId);
    setPmMsg((m) => ({ ...m, [requestId]: "" }));
    try {
      const res = await supplierAPI.resendPmNotification(requestId);
      setPmMsg((m) => ({
        ...m,
        [requestId]:
          res.delivery === "sent"
            ? `Email sent to ${res.pm_email}.`
            : `Delivery failed for ${res.pm_email} — check SMTP / try again.`,
      }));
      await refreshApprovalStatus();
    } catch (e: unknown) {
      setPmMsg((m) => ({
        ...m,
        [requestId]: e instanceof Error ? e.message : "Failed to send.",
      }));
    } finally {
      setPmSendingId(null);
    }
  }

  const isAssigned = opp.status === "Assigned";
  const isWorkingOn =
    opp.status === "Working on it" || opp.status === "Needs Rework";
  // Phase 0 uses "Awaiting Validation"; Phase 1-4 committee gates use
  // "Under Committee Review" (see GateApprovalService.create_committee_approval_request) —
  // the opportunity is locked in whichever status until quorum is reached.
  const isAwaitingGate =
    opp.status === "Awaiting Validation" && opp.phase_status === "Phase 0";
  const isPhase1Working =
    opp.phase_status === "Phase 1" &&
    (opp.status === "Working on it" || opp.status === "Needs Rework");
  const isUnderCommittee =
    opp.status === "Under Committee Review" &&
    ["Phase 1", "Phase 2", "Phase 3", "Phase 4"].includes(
      opp.phase_status ?? "",
    );
  const isPendingGateDecision = isAwaitingGate || isUnderCommittee;
  const isClosed = opp.phase_status === "Closed";
  // Gate-approval requests for whichever phase the opportunity is currently
  // in (Phase 0-3 are all gate-eligible on the backend — see
  // GateApprovalService._GATE_ELIGIBLE_PHASES).
  const activeGateRequests = approvalRequests.filter(
    (r) => r.phase_from === opp.phase_status && r.status !== "Superseded",
  );
  const allGateApproved = activeGateRequests.some(
    (r) => r.status === "Completed" && r.consensus_result === "Go",
  );
  const needsPm =
    decision === "Go" &&
    opp.opportunity_type &&
    !["Negotiation", "Cash"].includes(opp.opportunity_type) &&
    opp.phase_status === "Phase 0";
  const inp =
    "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const GATE_ELIGIBLE_PHASES = [
    "Phase 0",
    "Phase 1",
    "Phase 2",
    "Phase 3",
    "Phase 4",
  ];
  // Negotiation skips Phase 2 entirely — Phase 1 Go lands directly on Phase 3.
  const NEXT_GATE_PHASE: Record<string, string> = {
    "Phase 0": "Phase 1",
    "Phase 1": isNegotiation ? "Phase 3" : "Phase 2",
    "Phase 2": "Phase 3",
    "Phase 3": "Phase 4",
    "Phase 4": "Closed",
  };

  // ── STP section completeness (saved values on opp) ─────────────────
  const isStpType = !["Negotiation", "Cash"].includes(
    opp.opportunity_type ?? "",
  );
  const stpGateSections = isStpType
    ? [
        {
          label: "Scope (Scope IN + Customers)",
          ok: !!(opp.scope_in && opp.customers),
        },
        {
          label: "Quantities (Annual N1)",
          ok: !!(opp.annual_quantity_n1 && opp.annual_quantity_n1 > 0),
        },
        {
          label: "Prices (Before/After)",
          ok: !!(opp.current_price && opp.proposed_price),
        },
        {
          label: "Logistics (Incoterms + Country after)",
          ok: !!(
            opp.incoterms_before &&
            opp.incoterms_after &&
            opp.country_after
          ),
        },
        {
          label: "Risks (Material indexation Before/After)",
          ok: !!(
            opp.stp_risks?.material_indexation_before &&
            opp.stp_risks?.material_indexation_after
          ),
        },
        {
          label: "Benefits (If we do)",
          ok: !!(opp.stp_benefits?.if_we_do || opp.stp_benefits?.if_not),
        },
        {
          label: "Planning (Phase 1 weeks)",
          ok: !!(opp.phase1_weeks && opp.phase1_weeks > 0),
        },
      ]
    : [];
  const stpGateMissing = stpGateSections.filter((s) => !s.ok);

  // ── Pre-submission validation checks ──────────────────────────────
  // Phase 0 → PM validation: what must be filled
  const phase0Checks = [
    {
      ok: opp.expected_annual_saving != null,
      label: "Est. Annual Saving is required",
    },
    {
      ok: !!opp.duration_months && opp.duration_months > 0,
      label: "Duration (months) is required",
    },
    { ok: !!opp.planned_start_date, label: "Planned Start Date is required" },
    {
      ok:
        (opp.currency ?? "EUR") === "EUR" ||
        (!!opp.fx_rate_to_eur && opp.fx_rate_to_eur > 0),
      label: `FX rate to EUR required — opportunity uses ${opp.currency ?? "EUR"} with no conversion rate set`,
    },
    // Phase 3/4: the real deployment start must be recorded before a review can
    // be requested — savings are flowing, so the timing must be firm. (It can
    // also be entered from the Budgeting page for opportunities that reached
    // Phase 3 without it.) Mirrors the backend committee-request guard.
    ...(["Phase 3", "Phase 4"].includes(opp.phase_status ?? "")
      ? [
          {
            ok: !!opp.real_start_date,
            label: "Deployment Start Date (Real Savings Start) is required",
          },
        ]
      : []),
    // Execution start date: required for non-Negotiation types from the first
    // committee phase (Phase 1) onward — Negotiation has no execution/tooling
    // phase so it never needs one. Mirrors the backend committee-request guard.
    ...(!["Negotiation", "Cash"].includes(opp.opportunity_type ?? "") &&
    ["Phase 1", "Phase 2", "Phase 3", "Phase 4"].includes(
      opp.phase_status ?? "",
    )
      ? [
          {
            ok: !!opp.execution_start_date,
            label: "Execution Start Date is required",
          },
        ]
      : []),
    // Purchasing Owner + Conversion Owner become mandatory from Phase 2: the
    // Purchasing Owner receives tracking/escalation alerts and the Conversion
    // Owner enters the monthly actuals that start flowing in execution — the
    // opportunity can't be tracked past Phase 2 without them. Applies to every
    // opportunity type. Mirrors the backend committee-request guard.
    ...(["Phase 2", "Phase 3", "Phase 4"].includes(opp.phase_status ?? "")
      ? [
          {
            ok: !!opp.purchasing_owner,
            label: "Purchasing Owner is required",
          },
          {
            ok: !!opp.conversion_owner,
            label: "Conversion Owner is required",
          },
        ]
      : []),
    ...(!["Negotiation", "Cash"].includes(opp.opportunity_type ?? "")
      ? [
          {
            ok: !!opp.plant_id,
            label: "Plant selected (Sourcing / Technical)",
          },
          { ok: !!opp.scope_in, label: "Scope IN required (part number)" },
          // "Proposed New Supplier — After" only becomes mandatory from Phase 1:
          // Phase 0 is an exploratory study (free-text candidate is optional), and
          // from Phase 1 the field is a panel dropdown that writes
          // proposed_supplier_id (NOT proposed_supplier_name), so the gate must
          // validate the id — matching the missingFlags.supplierName highlight.
          ...((opp.phase_status ?? "") === "Phase 0"
            ? []
            : [
                {
                  ok: !!opp.proposed_supplier_id,
                  label: "Proposed New Supplier — After (from panel) required",
                },
              ]),
          {
            ok: !!opp.current_price && !!opp.proposed_price,
            label: "Before/After unit prices required",
          },
          ...stpGateMissing,
        ]
      : []), // Negotiation/Cash skip PLD scoring — nothing extra required here.
  ];
  const phase0Missing = phase0Checks.filter((c) => !c.ok);
  // Same completeness checklist (STP fields, duration, planned start date,
  // FX rate, etc.) reused for the Phase 1-4 sourcing committee request — the
  // underlying data these gates decide on shouldn't be incomplete either.
  const committeeMissing = phase0Missing;

  // Shared "single approver" picker for Negotiation — Purchasing Director or
  // VP Conversion — reused for both the Phase 0 request and every Phase 1-4
  // committee request.
  const negotiationApproverFields = (
    <div className="space-y-2">
      <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
        Approver <span className="text-red-500">*</span>
      </label>
      <p className="text-[10px] text-slate-400 mb-1">
        Either role can decide this gate alone.
      </p>
      <div className="flex gap-2">
        {NEGOTIATION_APPROVER_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setNegotiationApproverRole(role)}
            className={`flex-1 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
              negotiationApproverRole === role
                ? "border-amber-400 bg-amber-100 text-amber-800"
                : "border-slate-200 bg-white text-slate-500 hover:border-amber-300"
            }`}
          >
            {role}
          </button>
        ))}
      </div>
      <select
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        value={negotiationApproverEmail}
        onChange={(e) => setNegotiationApproverEmail(e.target.value)}
      >
        <option value="">— select {negotiationApproverRole} —</option>
        {accountsForRole(negotiationApproverRole).map((a) => (
          <option key={a.id_identity} value={a.email}>
            {a.full_name} ({a.email})
          </option>
        ))}
      </select>
    </div>
  );

  const act = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (isClosed)
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        This opportunity is closed.
      </div>
    );

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Status context bar */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p>
              <span className="font-semibold text-slate-500">Phase:</span>{" "}
              <span className="font-bold text-slate-800">
                {opp.phase_status}
              </span>
            </p>
            <p>
              <span className="font-semibold text-slate-500">Status:</span>{" "}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[opp.status ?? ""] ?? "bg-slate-100 text-slate-600"}`}
              >
                {opp.status}
              </span>
            </p>
            {opp.validation_decision && (
              <p>
                <span className="font-semibold text-slate-500">Last gate:</span>{" "}
                <span className="font-bold">{opp.validation_decision}</span>{" "}
                {opp.val_date ? `on ${fmtDate(opp.val_date)}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* STEP 1 — Phase 0: Start Study (Assigned → Working on it) */}
      {isAssigned && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-bold text-blue-700 mb-1">
            Step 1 — Start Phase 0 Study
          </p>
          <p className="text-[11px] text-blue-600 mb-3">
            Click to change status from <strong>Assigned</strong> to{" "}
            <strong>Working on it</strong> and begin the Opportunity Study.
          </p>
          <button
            disabled={loading}
            onClick={() =>
              act(async () => {
                const res = await supplierAPI.startStudy(
                  opp.opportunity_id,
                  userEmail,
                );
                onRefresh(res.data as Opp);
                const updatedOpp = res.data as Opp;
                onNavigate("edit");
              })
            }
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <CircleDot size={13} />
            )}{" "}
            Start Phase 0 Study
          </button>
        </div>
      )}

      {/* STEP 2 — Submit & Request Gate Approval (merged).
          Gate approval is required by the backend for Phase 0-3 (see
          GateApprovalService._GATE_ELIGIBLE_PHASES / apply_gate_decision's
          GATE_APPROVAL_REQUIRED guard) — this block used to only render for
          Phase 0, leaving Phase 1-3 with no way to actually request the
          quorum vote the "Apply decision" button demands. */}
      {isWorkingOn && GATE_ELIGIBLE_PHASES.includes(opp.phase_status ?? "") && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-3">
          {/* Context badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full bg-amber-200/70 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
              {opp.phase_status}
            </span>
            {opp.phase_status === "Phase 0" && (
              <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                STP Opportunity Study
              </span>
            )}
            <span className="text-[10px] text-amber-500">
              Gate: {opp.phase_status} →{" "}
              {NEXT_GATE_PHASE[opp.phase_status ?? ""] ?? "next phase"}
            </span>
          </div>

          {/* Pre-submission checklist — Phase 0 only; Phase 1-3 have no
              equivalent backend pre-checks before a gate approval request. */}
          {opp.phase_status === "Phase 0" ? (
            phase0Missing.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-white p-3 space-y-1.5">
                <p className="text-[10.5px] font-bold text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> {phase0Missing.length} item
                  {phase0Missing.length > 1 ? "s" : ""} missing before
                  submission:
                </p>
                {phase0Missing.map((c, i) => (
                  <p
                    key={i}
                    className="flex items-start gap-1.5 text-[11px] text-amber-600"
                  >
                    <span className="shrink-0 text-amber-400">✗</span> {c.label}
                  </p>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={11} /> All checks passed — ready to submit
                to PM
              </div>
            )
          ) : (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={11} /> Ready to request the {opp.phase_status}{" "}
              gate approval.
            </div>
          )}

          {/* Formal approval with unique links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-700">
                Request Formal Approval
              </p>
              {!isClosed && (
                <button
                  onClick={() => setShowApproval((v) => !v)}
                  className="text-[11px] font-semibold text-amber-600 hover:underline"
                >
                  {showApproval ? "Cancel" : "+ Request →"}
                </button>
              )}
            </div>
            <p className="text-[11px] text-amber-600">
              Send each reviewer a unique link — they see the full opportunity
              dossier and vote Approved / Rejected / Needs Review.
            </p>

            {showApproval && opp.phase_status === "Phase 0" && (
              <div className="rounded-xl border border-amber-200 bg-white p-3 space-y-3">
                {phase0Missing.length > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-[10.5px] font-bold text-orange-700 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Complete before sending
                    </p>
                    <ul className="space-y-1">
                      {phase0Missing.map((c, idx) => (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() => onNavigate("edit")}
                            className="flex w-full items-center gap-1.5 text-left text-[10px] text-orange-700 hover:text-orange-900 hover:underline"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                            {c.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {approvalError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {approvalError}
                  </p>
                )}
                {isNegotiation ? (
                  <>
                    {negotiationApproverFields}
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                        Plant Manager email (optional — informational only)
                      </label>
                      <p className="text-[10px] text-slate-400 mb-1">
                        Notified by email only — does not vote.
                      </p>
                      <MemberDirectoryPicker
                        fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
                        fetchKey="plant_manager_negotiation"
                        value={plantManagerEmail}
                        onChange={setPlantManagerEmail}
                        placeholder="plant.manager@avocarbon.com"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                        Plant Manager email{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <p className="text-[10px] text-slate-400 mb-1">
                        Will vote and designate the Project Manager upon
                        approval.
                      </p>
                      <MemberDirectoryPicker
                        fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
                        fetchKey="plant_manager"
                        value={plantManagerEmail}
                        onChange={setPlantManagerEmail}
                        placeholder="plant.manager@avocarbon.com"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                        Purchasing Manager email(s)
                      </label>
                      <p className="text-[10px] text-slate-400 mb-1">
                        Additional approvers — vote only, no PM designation.
                      </p>
                      <div className="space-y-2">
                        {purchasingManagerEmails.map((email, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <MemberDirectoryPicker
                                fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
                                fetchKey={`purchasing_manager_${idx}`}
                                value={email}
                                onChange={(v) =>
                                  setPurchasingManagerEmails((list) =>
                                    list.map((e, i) => (i === idx ? v : e)),
                                  )
                                }
                                placeholder="purchasing@avocarbon.com"
                              />
                            </div>
                            {purchasingManagerEmails.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPurchasingManagerEmails((list) =>
                                    list.filter((_, i) => i !== idx),
                                  )
                                }
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
                          onClick={() => setPurchasingManagerEmails((list) => [...list, ""])}
                          className="text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          + Add another approver
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Message (optional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Context or specific points for the reviewers…"
                    value={approvalMessage}
                    onChange={(e) => setApprovalMessage(e.target.value)}
                  />
                </div>
                <button
                  disabled={approvalSubmitting || phase0Missing.length > 0}
                  onClick={submitApprovalRequest}
                  className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                  title={
                    phase0Missing.length > 0
                      ? `Complete required fields first: ${phase0Missing.map((c) => c.label).join(", ")}`
                      : undefined
                  }
                >
                  {approvalSubmitting ? "Sending…" : "Send Approval Links"}
                </button>
              </div>
            )}

            {showApproval && opp.phase_status !== "Phase 0" && (
              <div className="rounded-xl border border-amber-200 bg-white p-3 space-y-3">
                {committeeMissing.length > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-[10.5px] font-bold text-orange-700 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Complete before sending
                    </p>
                    <ul className="space-y-1">
                      {committeeMissing.map((c, idx) => (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() => onNavigate("edit")}
                            className="flex w-full items-center gap-1.5 text-left text-[10px] text-orange-700 hover:text-orange-900 hover:underline"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                            {c.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {approvalError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {approvalError}
                  </p>
                )}
                {isNegotiation ? (
                  negotiationApproverFields
                ) : (
                  <>
                    {/* Committee level is only chosen/shown at Phase 1 — Phase 2/3/4
                        reuse the locked tier silently (it no longer affects which
                        roles are mandatory there, see mandatoryRolesForPhase), so
                        we skip straight to Required approvers / Add optional
                        reviewers instead of showing the tier picker or badge again. */}
                    {opp.phase_status === "Phase 1" &&
                      (opp.committee_level ? (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
                          Committee level locked at{" "}
                          <span className="font-bold text-slate-800">
                            {opp.committee_level}
                          </span>{" "}
                          (chosen at Phase 1).
                        </div>
                      ) : (
                        <div>
                          <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                            Committee level{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-2">
                            {COMMITTEE_LEVELS.map((lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => setCommitteeLevel(lvl)}
                                className={`flex-1 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                                  committeeLevel === lvl
                                    ? "border-amber-400 bg-amber-100 text-amber-800"
                                    : "border-slate-200 bg-white text-slate-500 hover:border-amber-300"
                                }`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                    {(() => {
                      // Phase 2-4 don't need a tier to determine mandatory roles
                      // (see mandatoryRolesForPhase) — default to "Light" so the
                      // required-approvers section still renders even for legacy
                      // opportunities that never had a committee_level recorded
                      // (e.g. their Phase 1 gate predates this feature).
                      const tier = (opp.committee_level ||
                        committeeLevel ||
                        (opp.phase_status !== "Phase 1" ? "Light" : "")) as
                        | CommitteeLevel
                        | "";
                      if (!tier) return null;
                      const mandatoryRoles = mandatoryRolesForPhase(
                        opp.phase_status,
                        tier,
                      );
                      const optionalRoles = ALL_ROLES.filter(
                        (r) => !mandatoryRoles.includes(r),
                      );
                      return (
                        <>
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                              {opp.phase_status === "Phase 1"
                                ? `Required approvers — ${tier} Committee`
                                : `Required approvers — ${opp.phase_status}`}
                            </p>
                            {mandatoryRoles.map((role) => (
                              <div
                                key={role}
                                className="flex items-start gap-2"
                              >
                                <span className="w-40 shrink-0 pt-2 text-[10.5px] font-semibold text-slate-500">
                                  {role} <span className="text-red-500">*</span>
                                </span>
                                {ROLE_LABEL_TO_PROFILE[role] ? (
                                  <select
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                    value={approverEmails[role] ?? ""}
                                    onChange={(e) =>
                                      setApproverEmails((m) => ({
                                        ...m,
                                        [role]: e.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">— select {role} —</option>
                                    {accountsForRole(role).map((a) => (
                                      <option
                                        key={a.id_identity}
                                        value={a.email}
                                      >
                                        {a.full_name} ({a.email})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="min-w-0 flex-1">
                                    <MemberDirectoryPicker
                                      fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
                                      fetchKey={role}
                                      value={approverEmails[role] ?? ""}
                                      onChange={(email) =>
                                        setApproverEmails((m) => ({
                                          ...m,
                                          [role]: email,
                                        }))
                                      }
                                      placeholder="name@avocarbon.com"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                setShowOptionalApprovers((s) => !s)
                              }
                              className="text-[11px] font-semibold text-amber-600 hover:underline"
                            >
                              {showOptionalApprovers ? "Hide" : "+ Add"}{" "}
                              optional reviewers
                            </button>
                            {showOptionalApprovers && (
                              <div className="mt-2 space-y-2">
                                {optionalRoles.map((role) => (
                                  <div
                                    key={role}
                                    className="flex items-start gap-2"
                                  >
                                    <span className="w-40 shrink-0 pt-2 text-[10.5px] font-semibold text-slate-400">
                                      {role}
                                    </span>
                                    {ROLE_LABEL_TO_PROFILE[role] ? (
                                      <select
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        value={approverEmails[role] ?? ""}
                                        onChange={(e) =>
                                          setApproverEmails((m) => ({
                                            ...m,
                                            [role]: e.target.value,
                                          }))
                                        }
                                      >
                                        <option value="">
                                          — select {role} (optional) —
                                        </option>
                                        {accountsForRole(role).map((a) => (
                                          <option
                                            key={a.id_identity}
                                            value={a.email}
                                          >
                                            {a.full_name} ({a.email})
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <div className="min-w-0 flex-1">
                                        <MemberDirectoryPicker
                                          fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
                                          fetchKey={role}
                                          value={approverEmails[role] ?? ""}
                                          onChange={(email) =>
                                            setApproverEmails((m) => ({
                                              ...m,
                                              [role]: email,
                                            }))
                                          }
                                          placeholder="name@avocarbon.com (optional)"
                                        />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}

                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-slate-600">
                    Message (optional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Context or specific points for the reviewers…"
                    value={approvalMessage}
                    onChange={(e) => setApprovalMessage(e.target.value)}
                  />
                </div>
                <button
                  disabled={
                    approvalSubmitting ||
                    committeeMissing.length > 0 ||
                    (isNegotiation
                      ? !negotiationApproverEmail.trim()
                      : !(
                          opp.committee_level ||
                          committeeLevel ||
                          (opp.phase_status !== "Phase 1" ? "Light" : "")
                        ))
                  }
                  onClick={submitCommitteeApprovalRequest}
                  className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                  title={
                    committeeMissing.length > 0
                      ? `Complete required fields first: ${committeeMissing.map((c) => c.label).join(", ")}`
                      : undefined
                  }
                >
                  {approvalSubmitting ? "Sending…" : "Send Approval Links"}
                </button>
              </div>
            )}

            {/* Existing approval requests for the current gate (exclude superseded) */}
            {activeGateRequests.map((req) => (
              <div
                key={req.request_id}
                className="rounded-xl border border-amber-200 bg-white p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-700">
                    by {req.requested_by ?? "—"}
                    {req.requested_at ? ` · ${fmtDate(req.requested_at)}` : ""}
                    {req.committee_level && (
                      <span className="ml-1.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700">
                        {req.committee_level}
                      </span>
                    )}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      req.status === "Completed" &&
                      req.consensus_result === "Go"
                        ? "bg-emerald-100 text-emerald-700"
                        : req.status === "Completed" &&
                            req.consensus_result === "No Go"
                          ? "bg-red-100 text-red-700"
                          : req.status === "Completed"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {req.status === "Completed"
                      ? req.consensus_result
                      : "Pending"}
                  </span>
                </div>
                <div className="space-y-2">
                  {req.votes.map((v) => (
                    <div key={v.vote_id} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600">
                            {v.approver_email}
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
                        <div className="flex items-center gap-2">
                          {v.decision ? (
                            <>
                              <span
                                className={`font-semibold ${
                                  v.decision === "Approved"
                                    ? "text-emerald-600"
                                    : v.decision === "Rejected"
                                      ? "text-red-600"
                                      : "text-amber-600"
                                }`}
                              >
                                {v.decision === "Approved"
                                  ? "✅"
                                  : v.decision === "Rejected"
                                    ? "❌"
                                    : "🔄"}{" "}
                                {v.decision}
                              </span>
                              {v.decided_at && (
                                <span className="text-slate-400">
                                  {fmtDate(v.decided_at)}
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 italic">
                                Pending…
                              </span>
                              {v.access_token && canSeeApprovalLinks && (
                                <button
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      `${window.location.origin}/approve/${v.access_token}`,
                                    )
                                  }
                                  className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                                  title="Copy approval link to clipboard"
                                >
                                  Copy link
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Show designated PM below the vote row */}
                      {v.is_plant_manager && v.project_manager_email && (
                        <p className="text-[10px] text-green-700 pl-1">
                          PM assigned:{" "}
                          <span className="font-semibold">
                            {v.project_manager_email}
                          </span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {req.votes.some((v) => v.comment) && (
                  <div className="border-t border-slate-200 pt-2 space-y-1">
                    {req.votes
                      .filter((v) => v.comment)
                      .map((v) => (
                        <p
                          key={v.vote_id}
                          className="text-[10.5px] text-slate-500 italic"
                        >
                          {v.approver_email}: &ldquo;{v.comment}&rdquo;
                        </p>
                      ))}
                  </div>
                )}
              </div>
            ))}
            {activeGateRequests.length === 0 && !showApproval && (
              <p className="text-[11px] text-amber-500/70">
                No formal approval requests yet for this gate.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Awaiting review banners */}
      {isAwaitingGate && !allGateApproved && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <p className="font-bold flex items-center gap-1.5">
            <Clock size={12} /> Awaiting Validation
          </p>
          <p className="mt-0.5">
            Approval request sent
            {opp.validation_request_sent_at
              ? ` on ${fmtDate(opp.validation_request_sent_at)}`
              : ""}
            . Waiting for all approvers to vote.
          </p>
        </div>
      )}
      {isAwaitingGate && allGateApproved && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs">
          <p className="font-bold flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 size={12} /> All Approvers Validated — Ready to Apply
            Gate
          </p>
          <p className="mt-0.5 text-emerald-600">
            All reviewers have given their Go. Click{" "}
            <strong>"Apply decision"</strong> below, select <strong>Go</strong>,
            and confirm to advance to{" "}
            {NEXT_GATE_PHASE[opp.phase_status ?? ""] ?? "the next phase"}.
          </p>
        </div>
      )}
      {isUnderCommittee && !allGateApproved && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-xs text-purple-700">
          <p className="font-bold flex items-center gap-1.5">
            <Users size={12} /> Under Committee Review
          </p>
          <p className="mt-0.5">
            {opp.committee_level ? `${opp.committee_level} Committee — ` : ""}
            approval request sent
            {opp.validation_request_sent_at
              ? ` on ${fmtDate(opp.validation_request_sent_at)}`
              : ""}
            . Waiting for all approvers to vote.
          </p>
        </div>
      )}
      {isUnderCommittee && allGateApproved && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs">
          <p className="font-bold flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 size={12} /> All Approvers Validated — Ready to Apply
            Gate
          </p>
          <p className="mt-0.5 text-emerald-600">
            All reviewers have given their Go. Click{" "}
            <strong>"Apply decision"</strong> below, select <strong>Go</strong>,
            and confirm to advance to{" "}
            {NEXT_GATE_PHASE[opp.phase_status ?? ""] ?? "the next phase"}.
          </p>
        </div>
      )}
      {opp.status === "Needs Rework" && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-700">
          <p className="font-bold">
            Needs Rework — review comments in the history below, then resubmit.
          </p>
        </div>
      )}

      {/* GATE DECISION — manual apply is only ever accepted by the backend at
          Phase 0 (see apply_gate_decision's GATE_APPROVAL_REQUIRED guard in
          purchasing_value/service.py); Phase 1-4 can ONLY advance via the gate
          approval vote flow above, so this section is hidden for those phases
          to avoid a button that always fails. */}
      {isAwaitingGate && (
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-700">
              Gate Decision ({opp.phase_status})
            </p>
            <button
              onClick={() => setShowGate((s) => !s)}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              {showGate ? "Hide" : "Apply decision →"}
            </button>
          </div>
          {!showGate && (
            <p className="text-[11px] text-slate-400">
              Click "Apply decision" to record Go / No Go / Review.
            </p>
          )}
          {showGate && isStpType && stpGateMissing.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
              <p className="text-[10.5px] font-bold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle size={11} /> STP incomplete —{" "}
                {stpGateMissing.length} section
                {stpGateMissing.length > 1 ? "s" : ""} missing:
              </p>
              {stpGateMissing.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onNavigate("edit")}
                  className="flex w-full items-start gap-1.5 text-left text-[11px] text-amber-600 hover:text-amber-800 hover:underline"
                >
                  <span className="shrink-0 text-amber-400">✗</span> {s.label}
                </button>
              ))}
              <p className="text-[10.5px] text-amber-500 pt-0.5">
                Click a section above to jump to the STP Study tab, fill it in
                and save before applying a Go decision.
              </p>
            </div>
          )}
          {showGate && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const res = await supplierAPI.applyGateDecision(
                    opp.opportunity_id,
                    {
                      decision,
                      decided_by: userEmail,
                      comments: comments || undefined,
                      project_manager: pm || undefined,
                    },
                  );
                  onRefresh(res.data as Opp);
                  setComments("");
                  setPm("");
                  const updated = res.data as Opp;
                  if (decision === "Go") {
                    if (updated.phase_status === "Phase 1")
                      onNavigate("project");
                    else if (
                      ["Phase 2", "Phase 3", "Phase 4"].includes(
                        updated.phase_status ?? "",
                      )
                    )
                      onNavigate("financial");
                  } else if (decision === "No Go") {
                    onNavigate("overview");
                  }
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-2">
                {(["Go", "No Go", "Review"] as const).map((d) => (
                  <label
                    key={d}
                    className={`flex items-center justify-center gap-1.5 cursor-pointer rounded-xl border-2 py-3 text-sm font-bold transition-all ${
                      decision === d
                        ? d === "Go"
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : d === "No Go"
                            ? "border-red-400 bg-red-50 text-red-700"
                            : "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-slate-200 text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="gate"
                      value={d}
                      checked={decision === d}
                      onChange={() => setDecision(d)}
                      className="sr-only"
                    />
                    {d === "Go" ? (
                      <CheckCircle2 size={14} />
                    ) : d === "No Go" ? (
                      <XCircle size={14} />
                    ) : (
                      <AlertTriangle size={14} />
                    )}{" "}
                    {d}
                  </label>
                ))}
              </div>
              {needsPm && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Project Manager email *
                  </label>
                  <MemberDirectoryPicker
                    fetchDirectory={() => supplierAPI.getPmDirectoryAuthenticated()}
                    fetchKey="manual_gate_pm"
                    value={pm}
                    onChange={setPm}
                    placeholder="project.manager@avocarbon.com"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  {decision === "No Go"
                    ? "Rejection reason (required for audit)"
                    : decision === "Review"
                      ? "What needs to be reworked?"
                      : "Decision comments"}
                </label>
                <textarea
                  rows={3}
                  className={`${inp} resize-none`}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-[10.5px] text-slate-500">
                {decision === "Go" && opp.phase_status === "Phase 0" && (
                  <>
                    ✓ Will validate opportunity · Create Financial Line
                    {!["Negotiation", "Cash"].includes(
                      opp.opportunity_type ?? "",
                    )
                      ? " · Create Project"
                      : ""}{" "}
                    · Advance to Phase 1
                  </>
                )}
                {decision === "Go" && opp.phase_status === "Phase 1" && (
                  <>✓ Advance to Phase 2 — Enable execution tracking</>
                )}
                {decision === "No Go" && (
                  <>✗ Opportunity will be closed and cancelled — irreversible</>
                )}
                {decision === "Review" && (
                  <>
                    ↩ Send back for rework — submitter must correct and resubmit
                  </>
                )}
              </div>
              <button
                type="submit"
                disabled={
                  loading ||
                  (decision === "Go" && isStpType && stpGateMissing.length > 0)
                }
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${decision === "Go" ? "bg-emerald-600 hover:bg-emerald-700" : decision === "No Go" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}
              >
                {loading && <RefreshCw size={13} className="animate-spin" />}{" "}
                Apply {decision}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Approval Status — only shown outside of Phase 0 / Phase 1 working cards */}
      {!(isWorkingOn && opp.phase_status === "Phase 0") &&
        !isPhase1Working &&
        approvalRequests.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
              Approval Requests
            </p>
            {approvalRequests.map((req) => (
              <div
                key={req.request_id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-700">
                    Phase {req.phase_from} → next &nbsp;·&nbsp; by{" "}
                    {req.requested_by ?? "—"}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      req.status === "Completed" &&
                      req.consensus_result === "Go"
                        ? "bg-emerald-100 text-emerald-700"
                        : req.status === "Completed" &&
                            req.consensus_result === "No Go"
                          ? "bg-red-100 text-red-700"
                          : req.status === "Completed"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {req.status === "Completed"
                      ? req.consensus_result
                      : "Pending"}
                  </span>
                </div>
                <div className="space-y-1">
                  {req.votes.map((v) => (
                    <div
                      key={v.vote_id}
                      className="flex items-center justify-between text-[11px]"
                    >
                      <span className="text-slate-600">{v.approver_email}</span>
                      <div className="flex items-center gap-2">
                        {v.decision ? (
                          <>
                            <span
                              className={`font-semibold ${
                                v.decision === "Approved"
                                  ? "text-emerald-600"
                                  : v.decision === "Rejected"
                                    ? "text-red-600"
                                    : "text-amber-600"
                              }`}
                            >
                              {v.decision === "Approved"
                                ? "✅"
                                : v.decision === "Rejected"
                                  ? "❌"
                                  : "🔄"}{" "}
                              {v.decision}
                            </span>
                            {v.decided_at && (
                              <span className="text-slate-400">
                                {fmtDate(v.decided_at)}
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 italic">
                              Pending…
                            </span>
                            {(v.reminder_count ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                <Bell size={9} />
                                {v.reminder_count}×
                                {v.last_reminded_at && (
                                  <span className="font-medium text-amber-600/80">
                                    · {fmtDateTime(v.last_reminded_at)}
                                  </span>
                                )}
                              </span>
                            )}
                            {v.access_token && canSeeApprovalLinks && (
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/approve/${v.access_token}`,
                                  )
                                }
                                className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                              >
                                Copy link
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Project Manager handover — per gate: confirm the PM was
                    emailed once the panel approved, and allow a manual (re)send
                    (e.g. if the automatic email failed). */}
                {req.status === "Completed" &&
                  req.consensus_result === "Go" && (
                    <div className="space-y-1.5 border-t border-slate-200 pt-2 text-[10.5px]">
                      {req.pm_notified_email &&
                      req.pm_notification_status === "sent" ? (
                        <p className="flex items-start gap-1.5 text-slate-600">
                          <CheckCircle2
                            size={12}
                            className="mt-0.5 shrink-0 text-emerald-500"
                          />
                          <span>
                            Project Manager notified:{" "}
                            <span className="font-semibold text-slate-700">
                              {req.pm_notified_email}
                            </span>
                            {req.pm_notified_at && (
                              <span className="text-slate-400">
                                {" "}
                                · {fmtDateTime(req.pm_notified_at)}
                              </span>
                            )}
                          </span>
                        </p>
                      ) : req.pm_notified_email ? (
                        <p className="flex items-start gap-1.5 text-red-600">
                          <AlertTriangle
                            size={12}
                            className="mt-0.5 shrink-0 text-red-500"
                          />
                          <span>
                            PM email failed to send to{" "}
                            <span className="font-semibold">
                              {req.pm_notified_email}
                            </span>
                            .
                          </span>
                        </p>
                      ) : (
                        <p className="flex items-start gap-1.5 text-slate-500">
                          <AlertTriangle
                            size={12}
                            className="mt-0.5 shrink-0 text-amber-500"
                          />
                          <span>Project Manager not yet emailed.</span>
                        </p>
                      )}
                      {canRemindApprovers && (
                        <button
                          onClick={() => resendPmEmail(req.request_id)}
                          disabled={pmSendingId === req.request_id}
                          title="Send the opportunity handover email to the Project Manager"
                          className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                        >
                          <Mail size={12} />
                          {pmSendingId === req.request_id
                            ? "Sending…"
                            : req.pm_notification_status === "sent"
                              ? "Resend PM email"
                              : "Send PM email"}
                        </button>
                      )}
                      {pmMsg[req.request_id] && (
                        <p className="text-[10.5px] text-slate-500">
                          {pmMsg[req.request_id]}
                        </p>
                      )}
                    </div>
                  )}
                {req.votes.some((v) => v.comment) && (
                  <div className="border-t border-slate-200 pt-2 space-y-1">
                    {req.votes
                      .filter((v) => v.comment)
                      .map((v) => (
                        <p
                          key={v.vote_id}
                          className="text-[10.5px] text-slate-500 italic"
                        >
                          {v.approver_email}: &ldquo;{v.comment}&rdquo;
                        </p>
                      ))}
                  </div>
                )}
                {/* Reminder — still-open request with at least one undecided
                    approver, restricted to the same privileged pair that can
                    send approval links. Re-sends each pending approver their
                    existing link; anyone who already voted is skipped. */}
                {req.status === "Pending" &&
                  req.votes.some((v) => !v.decision) &&
                  canRemindApprovers && (
                    <div className="space-y-1.5 border-t border-slate-200 pt-2">
                      {req.votes.some((v) => (v.reminder_count ?? 0) > 0) && (
                        <p className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                          <Bell size={11} className="text-amber-500" />
                          {req.votes.reduce(
                            (s, v) => s + (v.reminder_count ?? 0),
                            0,
                          )}{" "}
                          reminder
                          {req.votes.reduce(
                            (s, v) => s + (v.reminder_count ?? 0),
                            0,
                          ) === 1
                            ? ""
                            : "s"}{" "}
                          sent
                          {(() => {
                            const last = req.votes
                              .map((v) => v.last_reminded_at)
                              .filter(Boolean)
                              .sort()
                              .pop();
                            return last ? ` · last ${fmtDateTime(last)}` : "";
                          })()}
                        </p>
                      )}
                      <button
                        onClick={() => setRemindOpen(true)}
                        title="Re-send the approval link to approvers who haven't decided yet"
                        className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        <Bell size={12} />
                        Send reminder to pending approvers
                      </button>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}

      {remindOpen && (
        <RemindModal
          oppName={opp.opportunity_name ?? `#${opp.opportunity_id}`}
          opportunityId={opp.opportunity_id}
          onClose={() => setRemindOpen(false)}
          onSent={refreshApprovalStatus}
        />
      )}

      {/* Audit trail from comments */}
      {opp.comments && opp.comments.includes("[") && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Decision History
          </p>
          <div className="space-y-1">
            {opp.comments
              .split("\n")
              .filter((l) => l.trim().startsWith("["))
              .map((line, i) => (
                <p
                  key={i}
                  className="text-[11px] text-slate-600 bg-slate-50 rounded px-3 py-1.5"
                >
                  {line.trim()}
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

