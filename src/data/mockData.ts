export type SupplierStatus =
  | "Active"
  | "On Hold"
  | "Exit"
  | "Can Quote"
  | "Can Quote & Deliver"
  | "Business On Hold"
  | "Pending Self-Assessment"
  | "Pending Committee"
  | "Pending COMEX"
  | "Under Qualification";

export type SupplierType = "Strategic" | "Local";
export type SupplierClass = "A" | "B" | "C" | "D";
export type CommitteeDecision = "Approved" | "Rejected" | "Escalate to COMEX" | "Pending";
export type ComexDecision = "Approved" | "Rejected" | "Pending";
export type PanelCase = "Standard" | "Limited Validation" | "Exceptional";
export type OverrideDecision = "Approved" | "Rejected" | "Pending";
export type DevelopmentPlanStatus =
  | "Not Required"
  | "Requested"
  | "Received"
  | "Under Review"
  | "Revision Requested"
  | "Accepted"
  | "Overdue";

export type ActionPlanStatus =
  | "Not Required"
  | "Requested"
  | "Received"
  | "Under Review"
  | "Revision Requested"
  | "Approved"
  | "Overdue"
  | "Escalated to VP";

export type Supplier = {
  id: string;
  name: string;
  type: SupplierType;
  status: SupplierStatus;
  supplierClass: SupplierClass;
  score: number;
  risk: number;
  owner: string;
  country: string;
  category: string;
  annualVolume: string;
  nextReview: string;
  panel: string;
};

export type OnboardingCase = {
  id: string;
  supplierName: string;
  source: "Plant Request" | "Product Line" | "Other";
  type: SupplierType;
  strategic: boolean;
  owner: string;
  buyer: string;
  country: string;
  category: string;
  annualVolumeEur: number;
  supplierStartedFromScratch: boolean;
  selfAssessmentSentDate: string;
  selfAssessmentReceivedDate?: string;
  completenessPct: number;
  missingItems: string[];
  pmJustification?: string;
  validationPackPrepared: boolean;
  validationPackItems: string[];
  committeeDecision: CommitteeDecision;
  committeeComment: string;
  comexDecision?: ComexDecision;
  panelCase: PanelCase;
  initialClassManual?: SupplierClass;
  initialClassAuto?: SupplierClass;
  initialTier?: 1 | 2 | 3 | 4;
};

export type EvaluationCase = {
  supplierId: string;
  quality: number;
  logistics: number;
  service: number;
  compliance: number;
  lastEvaluationDate: string;
  overrideRequested: boolean;
  overrideReason?: string;
  overrideDecision?: OverrideDecision;
  forcedStatus?: SupplierStatus;
  developmentPlanStatus: DevelopmentPlanStatus;
  actionPlanStatus: ActionPlanStatus;
  actionPlanDueDate?: string;
  annualFormalReviewDate: string;
};

export type ActionPlanRow = {
  supplier: string;
  issue: string;
  status: ActionPlanStatus;
  dueDate: string;
  owner: string;
};

export type AnnualReviewRow = {
  supplier: string;
  committee: string;
  decisionNeeded: boolean;
  proposedStatus: SupplierStatus;
  finalStatus: SupplierStatus;
};

const TODAY = new Date("2026-04-23");

const onboardingCases: OnboardingCase[] = [
  {
    id: "OB-2026-001",
    supplierName: "JKL Technologies",
    source: "Plant Request",
    type: "Local",
    strategic: false,
    owner: "Adam Martin",
    buyer: "Lina Bernard",
    country: "Spain",
    category: "Automation",
    annualVolumeEur: 720000,
    supplierStartedFromScratch: true,
    selfAssessmentSentDate: "2026-03-26",
    selfAssessmentReceivedDate: "2026-04-02",
    completenessPct: 95,
    missingItems: ["Latest insurance certificate"],
    pmJustification: "Proceed with temporary waiver while waiting renewal copy.",
    validationPackPrepared: true,
    validationPackItems: [
      "Risk memo",
      "Supplier capability summary",
      "Compliance checklist",
      "Financial exposure note",
      "Site visit report",
    ],
    committeeDecision: "Approved",
    committeeComment: "Approved with limited validation for first 90 days.",
    panelCase: "Limited Validation",
    initialClassManual: "B",
    initialClassAuto: "B",
    initialTier: 2,
  },
  {
    id: "OB-2026-002",
    supplierName: "Nexa Circuits",
    source: "Product Line",
    type: "Strategic",
    strategic: true,
    owner: "Emily Johnson",
    buyer: "Sofia Ben Amar",
    country: "France",
    category: "Electronics",
    annualVolumeEur: 2150000,
    supplierStartedFromScratch: true,
    selfAssessmentSentDate: "2026-04-04",
    selfAssessmentReceivedDate: "2026-04-15",
    completenessPct: 82,
    missingItems: ["Conflict minerals declaration", "Business continuity plan"],
    validationPackPrepared: false,
    validationPackItems: ["Draft risk memo"],
    committeeDecision: "Pending",
    committeeComment: "Pending PM completeness decision and additional docs.",
    panelCase: "Standard",
    initialClassManual: "B",
    initialClassAuto: "B",
    initialTier: 2,
  },
  {
    id: "OB-2026-003",
    supplierName: "Baltic Metals",
    source: "Other",
    type: "Strategic",
    strategic: true,
    owner: "Karim Haddad",
    buyer: "Noah Petit",
    country: "Poland",
    category: "Raw Material",
    annualVolumeEur: 3400000,
    supplierStartedFromScratch: false,
    selfAssessmentSentDate: "2026-02-20",
    selfAssessmentReceivedDate: "2026-03-01",
    completenessPct: 100,
    missingItems: [],
    validationPackPrepared: true,
    validationPackItems: [
      "Risk memo",
      "Supplier capability summary",
      "Compliance checklist",
      "Financial exposure note",
      "Commodity concentration analysis",
    ],
    committeeDecision: "Escalate to COMEX",
    committeeComment: "Single-source dependency requires COMEX final decision.",
    comexDecision: "Approved",
    panelCase: "Exceptional",
    initialClassManual: "C",
    initialClassAuto: "C",
    initialTier: 3,
  },
];

const evaluationCases: EvaluationCase[] = [
  {
    supplierId: "SUP-001",
    quality: 86,
    logistics: 80,
    service: 79,
    compliance: 90,
    lastEvaluationDate: "2026-02-15",
    overrideRequested: false,
    developmentPlanStatus: "Not Required",
    actionPlanStatus: "Not Required",
    annualFormalReviewDate: "2026-12-10",
  },
  {
    supplierId: "SUP-002",
    quality: 52,
    logistics: 48,
    service: 58,
    compliance: 60,
    lastEvaluationDate: "2025-09-16",
    overrideRequested: true,
    overrideReason: "Temporary production dependency for one customer line.",
    overrideDecision: "Rejected",
    developmentPlanStatus: "Requested",
    actionPlanStatus: "Escalated to VP",
    actionPlanDueDate: "2026-04-12",
    annualFormalReviewDate: "2026-11-22",
  },
  {
    supplierId: "SUP-003",
    quality: 68,
    logistics: 65,
    service: 66,
    compliance: 72,
    lastEvaluationDate: "2025-11-02",
    overrideRequested: false,
    developmentPlanStatus: "Under Review",
    actionPlanStatus: "Received",
    actionPlanDueDate: "2026-05-02",
    annualFormalReviewDate: "2026-12-10",
  },
  {
    supplierId: "SUP-004",
    quality: 93,
    logistics: 91,
    service: 89,
    compliance: 94,
    lastEvaluationDate: "2026-03-10",
    overrideRequested: false,
    developmentPlanStatus: "Not Required",
    actionPlanStatus: "Not Required",
    annualFormalReviewDate: "2026-12-10",
  },
  {
    supplierId: "SUP-005",
    quality: 60,
    logistics: 57,
    service: 58,
    compliance: 63,
    lastEvaluationDate: "2025-10-14",
    overrideRequested: true,
    overrideReason: "Customer transfer in progress, request temporary maintain quote.",
    overrideDecision: "Pending",
    developmentPlanStatus: "Accepted",
    actionPlanStatus: "Under Review",
    actionPlanDueDate: "2026-05-08",
    annualFormalReviewDate: "2026-11-22",
  },
];

type SupplierBase = Omit<Supplier, "status" | "supplierClass" | "score" | "risk" | "nextReview"> & {
  panelCase: PanelCase;
  onboardingCaseId?: string;
};

const supplierBase: SupplierBase[] = [
  {
    id: "SUP-001",
    name: "ABC Electronics",
    type: "Strategic",
    owner: "Emily Johnson",
    country: "France",
    category: "Electronics",
    annualVolume: "EUR 2.6M",
    panel: "SB1",
    panelCase: "Standard",
  },
  {
    id: "SUP-002",
    name: "XYZ Components",
    type: "Local",
    owner: "Karim Haddad",
    country: "Germany",
    category: "Machined Parts",
    annualVolume: "EUR 540K",
    panel: "SB3",
    panelCase: "Exceptional",
  },
  {
    id: "SUP-003",
    name: "DEF Manufacturing",
    type: "Strategic",
    owner: "Nina Costa",
    country: "Italy",
    category: "Raw Material",
    annualVolume: "EUR 1.9M",
    panel: "SB2",
    panelCase: "Limited Validation",
  },
  {
    id: "SUP-004",
    name: "JKL Technologies",
    type: "Local",
    owner: "Adam Martin",
    country: "Spain",
    category: "Automation",
    annualVolume: "EUR 720K",
    panel: "SB1",
    panelCase: "Limited Validation",
    onboardingCaseId: "OB-2026-001",
  },
  {
    id: "SUP-005",
    name: "Nordic Polymer",
    type: "Strategic",
    owner: "Meriem Saidi",
    country: "Sweden",
    category: "Polymer",
    annualVolume: "EUR 3.2M",
    panel: "SB4",
    panelCase: "Exceptional",
  },
];

function classifyScore(score: number): SupplierClass {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

function classToTier(c: SupplierClass): 1 | 2 | 3 | 4 {
  if (c === "A") return 1;
  if (c === "B") return 2;
  if (c === "C") return 3;
  return 4;
}

export function getCadenceMonths(type: SupplierType, risk: number): number {
  if (type === "Strategic") return risk >= 60 ? 3 : 6;
  return 12;
}

export function formatDateLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, toIso: string): number {
  const to = new Date(toIso);
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function resolvePanelStatus(panelCase: PanelCase, cls: SupplierClass, hasRejectedOverride: boolean): SupplierStatus {
  if (hasRejectedOverride && cls === "D") return "Business On Hold";
  if (panelCase === "Standard") return cls === "D" ? "On Hold" : "Can Quote & Deliver";
  if (panelCase === "Limited Validation") return cls === "D" ? "Business On Hold" : "Can Quote";
  return "Business On Hold";
}

function resolveRisk(score: number): number {
  return Math.max(5, Math.min(95, 100 - score));
}

export const suppliers: Supplier[] = supplierBase.map((s) => {
  const ev = evaluationCases.find((x) => x.supplierId === s.id);
  if (!ev) {
    return {
      ...s,
      status: "Under Qualification",
      supplierClass: "C",
      score: 60,
      risk: 40,
      nextReview: formatDateLabel(addMonths("2026-04-23", 6)),
    };
  }

  const score = Math.round(
    ev.quality * 0.35 + ev.logistics * 0.25 + ev.service * 0.2 + ev.compliance * 0.2,
  );
  const supplierClass = classifyScore(score);
  const risk = resolveRisk(score);
  const cadence = getCadenceMonths(s.type, risk);
  const nextReviewIso = addMonths(ev.lastEvaluationDate, cadence);
  const nextReview = formatDateLabel(nextReviewIso);

  const needsHoldEscalation =
    ev.actionPlanStatus === "Escalated to VP" || (supplierClass === "D" && ev.overrideDecision === "Rejected");

  const status = resolvePanelStatus(s.panelCase, supplierClass, needsHoldEscalation);

  return {
    ...s,
    status,
    supplierClass,
    score,
    risk,
    nextReview,
  };
});

export const onboardingPipeline = onboardingCases.map((x) => {
  const isComplete = x.completenessPct >= 90 || Boolean(x.pmJustification);
  const canSubmitCommittee = isComplete && x.validationPackPrepared;
  const committeeDone = x.committeeDecision === "Approved" || x.committeeDecision === "Rejected" || x.committeeDecision === "Escalate to COMEX";
  const comexDone = x.committeeDecision !== "Escalate to COMEX" || x.comexDecision === "Approved" || x.comexDecision === "Rejected";

  return {
    ...x,
    isComplete,
    canSubmitCommittee,
    committeeDone,
    comexDone,
  };
});

export const evaluationRows = [
  { area: "Quality", weight: 35 },
  { area: "Logistics", weight: 25 },
  { area: "Service", weight: 20 },
  { area: "Compliance", weight: 20 },
];

export const evaluationCenter = suppliers.map((s) => {
  const ev = evaluationCases.find((x) => x.supplierId === s.id);
  const cadenceMonths = getCadenceMonths(s.type, s.risk);
  const nextReviewIso = ev ? addMonths(ev.lastEvaluationDate, cadenceMonths) : "2026-10-23";
  const daysToNextReview = daysBetween(TODAY, nextReviewIso);
  const cycleDue = daysToNextReview <= 0;
  const tier = classToTier(s.supplierClass);

  return {
    supplierId: s.id,
    supplierName: s.name,
    type: s.type,
    owner: s.owner,
    supplierClass: s.supplierClass,
    tier,
    score: s.score,
    risk: s.risk,
    status: s.status,
    cadenceMonths,
    lastEvaluationDate: ev ? formatDateLabel(ev.lastEvaluationDate) : "N/A",
    nextReviewDate: formatDateLabel(nextReviewIso),
    daysToNextReview,
    cycleDue,
    overrideRequested: ev?.overrideRequested ?? false,
    overrideDecision: ev?.overrideDecision ?? "Pending",
    developmentPlanStatus: ev?.developmentPlanStatus ?? "Not Required",
    actionPlanStatus: ev?.actionPlanStatus ?? "Not Required",
    actionPlanDueDate: ev?.actionPlanDueDate ? formatDateLabel(ev.actionPlanDueDate) : "N/A",
    quality: ev?.quality ?? 0,
    logistics: ev?.logistics ?? 0,
    service: ev?.service ?? 0,
    compliance: ev?.compliance ?? 0,
  };
});

export const actionPlans: ActionPlanRow[] = evaluationCenter
  .filter((x) => x.actionPlanStatus !== "Not Required")
  .map((x) => ({
    supplier: x.supplierName,
    issue:
      x.supplierClass === "D"
        ? "Critical performance class D - corrective action required"
        : "Recurring KPI deviations - structured supplier plan required",
    status: x.actionPlanStatus,
    dueDate: x.actionPlanDueDate,
    owner: x.owner,
  }));

export const annualReviewRows: AnnualReviewRow[] = evaluationCenter.map((x) => {
  const decisionNeeded =
    x.supplierClass === "C" ||
    x.supplierClass === "D" ||
    x.overrideRequested ||
    x.status === "Business On Hold";

  const proposedStatus: SupplierStatus =
    x.supplierClass === "D" ? "Business On Hold" : x.status;

  const finalStatus =
    x.overrideRequested && x.overrideDecision === "Approved" ? "Can Quote" : proposedStatus;

  return {
    supplier: x.supplierName,
    committee: "Purchasing Manager + VP Conversion & Productivity + VP Operations",
    decisionNeeded,
    proposedStatus,
    finalStatus,
  };
});

export const classDistribution = ["A", "B", "C", "D"].map((cls) => ({
  name: cls,
  value: suppliers.filter((s) => s.supplierClass === cls).length,
}));

export const trendData = [
  { month: "Nov", quality: 73, logistics: 69, service: 75 },
  { month: "Dec", quality: 75, logistics: 70, service: 77 },
  { month: "Jan", quality: 77, logistics: 73, service: 79 },
  { month: "Feb", quality: 79, logistics: 75, service: 80 },
  { month: "Mar", quality: 81, logistics: 78, service: 82 },
  { month: "Apr", quality: 82, logistics: 79, service: 84 },
];

export const dashboardMetrics = {
  totalSuppliers: suppliers.length,
  activeSuppliers: suppliers.filter((s) => s.status === "Can Quote & Deliver" || s.status === "Active").length,
  onHoldSuppliers: suppliers.filter((s) => s.status === "On Hold" || s.status === "Business On Hold").length,
  pendingOnboarding: onboardingPipeline.filter((x) => x.committeeDecision === "Pending").length,
  overridesPending: evaluationCenter.filter((x) => x.overrideRequested && x.overrideDecision === "Pending").length,
  actionPlansOverdue: evaluationCenter.filter(
    (x) => x.actionPlanStatus === "Overdue" || x.actionPlanStatus === "Escalated to VP",
  ).length,
  strategicCOrD: evaluationCenter.filter(
    (x) => x.type === "Strategic" && (x.supplierClass === "C" || x.supplierClass === "D"),
  ).length,
};

export const reviewPlaybook = {
  committeeScope: "Committee validates dossier completeness, risk exposure and recommendation.",
  comexWhen: "COMEX is required for escalations: single-source strategic dependency or unresolved risk exceptions.",
  initialClassRule:
    "Initial class is auto-calculated from first scorecard, PM can set manual class with justification before committee.",
  overrideRule:
    "PM override request must include business impact, mitigation actions, and target end date. VP decides approve/reject.",
  devPlanRule:
    "Class C/D triggers supplier development plan. If still C/D in next cycle, action plan is mandatory.",
  onHoldRule:
    "If action plan remains missing after reminder window, supplier owner proposes On Hold and VP validates final block.",
  annualReview:
    "Annual formal review consolidates performance, class, overrides and hold/exit decisions with PM + VP governance.",
};
