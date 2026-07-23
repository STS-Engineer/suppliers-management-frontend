// Sourcing Committee roles and per-tier mandatory-approver mapping (Phase 1-4).
// Mirrors app/features/gate_approval/constants.py on the backend.

export const COMMITTEE_LEVELS = ["Light", "Intermediate", "Full"] as const;
export type CommitteeLevel = (typeof COMMITTEE_LEVELS)[number];

// NOTE: Project Leader is NOT a committee voter. The Project Manager / leader is
// designated by the Plant Manager on their approval vote (like Phase 0) and is
// notified only once the whole panel approves.
export const ALL_ROLES = [
  "Purchasing Director",
  "Plant Manager",
  "Product Line Manager",
  "COO/VP",
  "CEO",
  "Idea Owner",
  "Quality",
  "Engineering",
  "Finance",
  "Operations",
  "Supply Chain",
  "VP Conversion",
] as const;

// Negotiation opportunities skip the Plant Manager / Project Leader / committee
// tier entirely — a single approver, either Purchasing Director or VP
// Conversion, decides the gate.
export const NEGOTIATION_APPROVER_ROLES = [
  "Purchasing Director",
  "VP Conversion",
] as const;

// Tier-dependent mandatory roles — applies ONLY to the Phase 1 gate, where the
// committee level is chosen. Phase 2/3/4 always use CORE_MANDATORY_ROLES below,
// regardless of which tier was picked at Phase 1.
export const MANDATORY_ROLES_BY_TIER: Record<CommitteeLevel, string[]> = {
  Light: ["Purchasing Director", "Plant Manager"],
  Intermediate: [
    "Purchasing Director",
    "Plant Manager",
    "Product Line Manager",
    "COO/VP",
  ],
  Full: ["Purchasing Director", "Plant Manager", "CEO"],
};

// Phase 2/3/4 mandatory roles — fixed, independent of committee tier.
export const CORE_MANDATORY_ROLES = ["Purchasing Director", "Plant Manager"];

export function mandatoryRolesForPhase(
  phaseStatus: string | undefined,
  tier: CommitteeLevel,
): string[] {
  if (phaseStatus === "Phase 1") return MANDATORY_ROLES_BY_TIER[tier];
  return CORE_MANDATORY_ROLES;
}
