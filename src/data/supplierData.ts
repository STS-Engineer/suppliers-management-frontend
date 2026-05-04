import rawBoardData from "./board_data.json";

const EMPTY = "-";

type RawColumn = {
  column_id: string;
  column: string;
  type: string;
  value: unknown;
};

type RawItem = {
  item_id: string;
  item_name: string;
  group?: string;
  created_at?: string;
  updated_at?: string;
  columns?: RawColumn[];
};

type RawBoardData = {
  items?: RawItem[];
};

const toText = (value: unknown): string => {
  if (value == null) return EMPTY;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "object" && entry !== null && "name" in entry) {
          return String((entry as { name?: unknown }).name ?? EMPTY);
        }
        return String(entry);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    const objectValue = value as { text?: unknown; checked?: unknown };
    if (objectValue.text != null) return String(objectValue.text);
    if (typeof objectValue.checked === "boolean") {
      return objectValue.checked ? "Yes" : "No";
    }
  }

  return JSON.stringify(value);
};

const getCol = (item: RawItem, name: string): string => {
  const column = (item.columns ?? []).find((entry) => entry.column === name);
  return toText(column?.value);
};

const toNumber = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapScope = (area: string): string => {
  const text = area.toLowerCase();
  if (text.includes("world")) return "Global";
  if (text.includes("asia") || text.includes("europe") || text.includes("america")) {
    return "Regional";
  }
  return "Local";
};

const mapPanel = (strategic: string): string => {
  const text = strategic.toLowerCase();
  if (text.includes("monopolistic") || text.includes("strategic")) return "Strategic";
  return "Approved";
};

const mapStatus = (status: string): string => {
  return status === EMPTY ? "Active" : status;
};

const mapPaymentCode = (top: string): string => {
  const normalized = top.toLowerCase();
  if (normalized.includes("90")) return "NET_90";
  if (normalized.includes("60")) return "NET_60";
  if (normalized.includes("45")) return "NET_45";
  return "NET_30";
};

const data = rawBoardData as RawBoardData;
const items = Array.isArray(data.items) ? data.items : [];

export const GROUPS = items.map((item, index) => {
  const area = getCol(item, "Area");
  const strategic = getCol(item, "Strategic");
  const top = getCol(item, "TOP");
  const score = toNumber(getCol(item, "Last Eval Score"));

  return {
    id: index + 1,
    groupName: toText(item.group ?? EMPTY),
    nom: toText(item.item_name),
    GlobalSupplier: getCol(item, "Global Supplier"),
    "Global Supplier": getCol(item, "Global Supplier"),
    scope: mapScope(area),
    strategic,
    Strategic: strategic,
    monopolistic: strategic.toLowerCase().includes("monopolistic"),
    multiSite: getCol(item, "Main Plants").includes(","),
    "Main Plants": getCol(item, "Main Plants"),
    description: `${getCol(item, "Family")} / ${getCol(item, "Product Lines")}`,
    status: mapStatus(getCol(item, "Del. Status")),
    "Del. Status": mapStatus(getCol(item, "Del. Status")),
    supplierClass: getCol(item, "Cat. Pur."),
    "Cat. Pur.": getCol(item, "Cat. Pur."),
    strategicNature: strategic,
    category: getCol(item, "Commodity") !== EMPTY ? getCol(item, "Commodity") : toText(item.group ?? EMPTY),
    Commodity: getCol(item, "Commodity") !== EMPTY ? getCol(item, "Commodity") : toText(item.group ?? EMPTY),
    subCategory: getCol(item, "Family"),
    Family: getCol(item, "Family"),
    hq: area,
    Area: area,
    annualVolume: EMPTY,
    panel: mapPanel(strategic),
    owner: getCol(item, "Commodity Resp"),
    "Commodity Resp": getCol(item, "Commodity Resp"),
    supplierLeader: getCol(item, "Supplier Leader"),
    "Supplier Leader": getCol(item, "Supplier Leader"),
    responsiblePlant: getCol(item, "Plant"),
    Plant: getCol(item, "Plant"),
    nextReview: getCol(item, "Req Date AP"),
    "Req Date AP": getCol(item, "Req Date AP"),
    score,
    "Last Eval Score": score,
    qualityScore: score,
    deliveryScore: score,
    complianceScore: score,
    responsivenessScore: score,
    sustainabilityScore: score,
    innovationScore: score,
    risk: getCol(item, "Financial Health"),
    paymentTermCode: mapPaymentCode(top),
    paymentTermLabel: top,
    TOP: top,
    paymentTransitDays: toNumber(getCol(item, "Transit Days")),
    "Transit Days": toNumber(getCol(item, "Transit Days")),
    paymentCurrency: "EUR",
    incoterms: getCol(item, "Place Inco"),
    "Place Inco": getCol(item, "Place Inco"),
    preferredCurrency: "EUR",
    frameworkAgreement: getCol(item, "LTA") !== EMPTY && getCol(item, "LTA").toLowerCase() !== "none",
    LTA: getCol(item, "LTA"),
    transitDays: toNumber(getCol(item, "Transit Days")),
    hasVMI: getCol(item, "Consignement").toLowerCase() === "yes",
    Consignement: getCol(item, "Consignement"),
    isSingleSource: strategic.toLowerCase().includes("monopolistic"),
    hasActiveCAPAR: false,
    sanctionsScreenDate: toText(item.updated_at ?? EMPTY),
    esgRating: EMPTY,
    conflictMineralsCompliant: getCol(item, "Cert") !== EMPTY,
    rohsReachCompliant: getCol(item, "Cert") !== EMPTY,
    notes: `Supplier email: ${getCol(item, "Supplier Email")}`,
    lastKnownPeriod: getCol(item, "Last Known E. Period"),
    "Last Known E. Period": getCol(item, "Last Known E. Period"),
    lastEval: getCol(item, "Last known Eval"),
    "Last known Eval": getCol(item, "Last known Eval"),
    cert: getCol(item, "Cert"),
    Cert: getCol(item, "Cert"),
    sqma: getCol(item, "SQMA"),
    SQMA: getCol(item, "SQMA"),
    competitiveness: getCol(item, "Competitiveness"),
    Competitiveness: getCol(item, "Competitiveness"),
    familyCoverage: getCol(item, "Family Cover."),
    "Family Cover.": getCol(item, "Family Cover."),
    geoCoverage: getCol(item, "Geo . Cover"),
    "Geo . Cover": getCol(item, "Geo . Cover"),
    financialHealth: getCol(item, "Financial Health"),
    "Financial Health": getCol(item, "Financial Health"),
    "Supplier Email": getCol(item, "Supplier Email"),
    createdAt: toText(item.created_at ?? EMPTY),
    updatedAt: toText(item.updated_at ?? EMPTY),
  };
});

export const UNITS = GROUPS.map((group, index) => ({
  id: index + 1,
  groupId: group.id,
  code: `${group.groupName}-${index + 1}`,
  name: group.responsiblePlant,
  Plant: group.responsiblePlant,
  city: group.incoterms,
  "Place Inco": group.incoterms,
  country: group.hq,
  Area: group.hq,
  branchType: "Manufacturing",
  productType: group.description,
  "Product Lines": group.description,
  productCategory: group.category,
  Commodity: group.category,
  amountValue: group.score ?? 0,
  amountCurrency: "Score",
  status: group.status,
  "Del. Status": group.status,
  isoCertified: group.cert !== EMPTY,
  Cert: group.cert,
  transitDays: group.transitDays,
  "Transit Days": group.transitDays,
}));

export const CERTIFICATIONS = GROUPS.filter((group) => group.cert !== EMPTY).map((group, index) => ({
  id: index + 1,
  unitId: group.id,
  groupId: group.id,
  certType: "Supplier Certification",
  name: group.cert,
  Cert: group.cert,
  issuingBody: EMPTY,
  scope: group.subCategory,
  Family: group.subCategory,
  certNumber: undefined as string | undefined,
  startDate: group.createdAt,
  endDate: undefined as string | undefined,
  expiryMarginDays: 0,
  status: "Valid",
}));

export const AGREEMENTS = GROUPS.map((group, index) => ({
  id: index + 1,
  groupId: group.id,
  type: group.frameworkAgreement ? "Framework" : "Spot",
  name: `${group.nom} Commercial Terms`,
  startDate: group.createdAt,
  endDate: undefined as string | undefined,
  value: group.paymentTransitDays ?? 0,
  currency: "Days",
  description: `TOP: ${group.paymentTermLabel} | LTA: ${group.frameworkAgreement ? "Yes" : "No"} | Consignment: ${group.hasVMI ? "Yes" : "No"}`,
  consignmentMode: group.hasVMI ? "Consignement" : "Standard",
  paymentTerms: group.paymentTermLabel,
  TOP: group.paymentTermLabel,
  lta: group.frameworkAgreement ? "Yes" : "No",
  LTA: group.LTA,
  Consignement: group.Consignement,
}));

export const CONTACTS = GROUPS.map((group, index) => ({
  id: index + 1,
  groupId: group.id,
  unitId: group.id,
  roleLabel: "SUP",
  roleName: "Supplier Leader",
  fullName: group.supplierLeader,
  "Supplier Leader": group.supplierLeader,
  phone: EMPTY,
  email: group.notes.replace("Supplier email: ", ""),
  "Supplier Email": group["Supplier Email"],
  isPrimary: true,
  language: "en",
  owner: group.owner,
  "Commodity Resp": group["Commodity Resp"],
}));

export const OPPORTUNITIES = GROUPS.map((group, index) => ({
  id: index + 1,
  groupId: group.id,
  name: `${group.nom} Performance Follow-up`,
  type: "Supplier Performance",
  status: group.status,
  ideaOwner: group.owner,
  purchasingOwner: group.owner,
  expectedAnnualSaving: 0,
  currency: "EUR",
  plannedStart: group.nextReview,
  realStart: undefined as string | undefined,
  durationMonths: 0,
  results: group.score ?? 0,
  "Last Eval Score": group["Last Eval Score"],
  budgetYear: new Date().getFullYear(),
  phaseStatus: group.lastEval,
  "Last known Eval": group["Last known Eval"],
  validationDecision: group.competitiveness,
  Competitiveness: group.Competitiveness,
  savingScore: 0,
  difficultyScore: 0,
  priorityScore: group.score ?? 0,
  priorityCategory: group.strategic,
  Strategic: group.Strategic,
  assumptionsSummary: `SQMA: ${group.sqma} | Family Cover: ${group.familyCoverage} | Geo Cover: ${group.geoCoverage}`,
  SQMA: group.SQMA,
  "Family Cover.": group["Family Cover."],
  "Geo . Cover": group["Geo . Cover"],
  comments: group.financialHealth,
  "Financial Health": group["Financial Health"],
}));

export const FINANCIALS = GROUPS.map((group, index) => ({
  id: index + 1,
  groupId: group.id,
  opportunityId: group.id,
  name: `${group.nom} Payment Metrics`,
  budgetValue: group.paymentTransitDays ?? 0,
  "Transit Days": group["Transit Days"],
  currency: "Days",
  budgetStatus: group.status,
  plannedStart: group.nextReview,
  realStart: undefined as string | undefined,
  durationMonths: 0,
  cumulatedSaving: toNumber(group.lastKnownPeriod.replace(/[^0-9.-]/g, "")) ?? 0,
  deltaVsExpectedYTD: toNumber(String(group.deliveryScore ?? 0)) ?? 0,
  deltaVsBudgetYTD: toNumber(String(group.complianceScore ?? 0)) ?? 0,
  status: group.status,
  follower: group.owner,
  forecastEOY: group.score ?? 0,
  "Last Eval Score": group["Last Eval Score"],
  expectedAnnualSaving: 0,
  comments: `Transit Days: ${group.transitDays ?? EMPTY} | Financial Health: ${group.financialHealth}`,
  realApDays: toNumber(getCol(items[index], "Real AP days (Val)")),
  "Real AP days (Val)": toNumber(getCol(items[index], "Real AP days (Val)")),
  top: group.paymentTermLabel,
  TOP: group.TOP,
  "Financial Health": group["Financial Health"],
}));
