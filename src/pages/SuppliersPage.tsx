import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Filter,
  RotateCcw,
  Search,
  UsersRound,
  BarChart3,
  Star,
  AlertTriangle,
} from "lucide-react";
import { Pagination } from "../components/common/Pagination";
import { SectionCard } from "../components/UI";
import {
  AGREEMENTS,
  CERTIFICATIONS,
  CONTACTS,
  FINANCIALS,
  GROUPS,
  OPPORTUNITIES,
  UNITS,
} from "../data/supplierData";

const tabs = [
  "Overview",
  "Units",
  "Certifications",
  "Agreements",
  "Contacts",
  "Opportunities",
  "Financials",
] as const;

type TabKey = (typeof tabs)[number];
type ViewMode = "Group Scan" | "Supplier Detail";
type ScanSort = "score-desc" | "review-asc" | "strategic-first" | "name-asc";
type ScanFilter = "all" | "attention" | "strategic" | "missing-cert";
type GroupRecord = (typeof GROUPS)[number];
const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];

const PAGE_SIZE = 8;

const normalizeSearchText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getSupplierSearchText = (group: GroupRecord) =>
  [
    group.nom,
    group.GlobalSupplier,
    group.groupName,
    group.category,
    group.Commodity,
    group.Family,
    group.scope,
    group.hq,
    group.status,
    group.supplierClass,
    group.strategic,
    group.owner,
    group.supplierLeader,
    group.responsiblePlant,
    group["Main Plants"],
    group["Supplier Email"],
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(" ");

const getEditDistance = (left: string, right: string) => {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + cost,
      );
      diagonal = above;
    }
  }

  return previous[right.length];
};

const isCloseSearchToken = (token: string, candidate: string) => {
  if (candidate.includes(token) || token.includes(candidate)) return true;
  if (token.length < 4 || candidate.length < 4) return false;

  const maxDistance = token.length > 7 ? 2 : 1;
  return getEditDistance(token, candidate) <= maxDistance;
};

const supplierMatchesSearch = (group: GroupRecord, keyword: string) => {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return true;

  const tokens = normalizedKeyword.split(/\s+/).filter(Boolean);
  const searchableText = getSupplierSearchText(group);

  return tokens.every((token) => searchableText.includes(token));
};

type BadgeTone =
  | "blue"
  | "green"
  | "gold"
  | "slate"
  | "orange"
  | "red"
  | "gray"
  | "yellow"
  | "pink"
  | "purple";

function Badge({ text, tone = "slate" }: { text: string; tone?: BadgeTone }) {
  const toneMap: Record<BadgeTone, string> = {
    blue: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200",
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
    gold: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
    slate:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200",
    orange:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-200",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200",
    gray: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300",
    yellow:
      "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-200",
    pink: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-400/30 dark:bg-pink-400/10 dark:text-pink-200",
    purple:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneMap[tone]}`}
    >
      {text}
    </span>
  );
}

const getStatusKey = (value: unknown) =>
  normalizeSearchText(value).replace(/\s+/g, " ").trim();

const asBadgeValue = (value: ReactNode) => String(value || "-");

const getFinancialHealthTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (key === "green") return "green";
  if (key === "to monitor") return "orange";
  if (key === "at risk") return "red";
  if (key === "requested") return "gray";

  return "slate";
};

const getGeoCoverageTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (key === "100 cov" || key === "100 coverage" || key.includes("100"))
    return "green";
  if (
    key === "50 or" ||
    key === "50 cov" ||
    key === "50 coverage" ||
    key.includes("50")
  )
    return "orange";
  if (key === "1 plant cov" || key === "1 plant coverage") return "pink";
  if (key === "none") return "red";
  if (key === "requested") return "gray";

  return "slate";
};

const getSqmaTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (key === "signed") return "green";
  if (key === "rejected") return "red";
  if (key === "signed m res") return "orange";
  if (key === "signed m res not sent") return "yellow";
  if (key === "requested") return "gray";

  return "slate";
};

const getDeliveryStatusTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (
    [
      "active",
      "approved",
      "validated",
      "ok",
      "yes",
      "open",
      "available",
    ].includes(key)
  )
    return "green";
  if (["inactive", "blocked", "rejected", "ko", "no", "closed"].includes(key))
    return "red";
  if (
    [
      "pending",
      "in progress",
      "under review",
      "to monitor",
      "watch",
      "warning",
    ].includes(key)
  )
    return "orange";
  if (
    ["requested", "not started", "draft", "n a", "na", "none", ""].includes(key)
  )
    return "gray";

  return "blue";
};

const getCertificationTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (["yes", "certified", "valid", "available", "signed"].includes(key))
    return "green";
  if (["no", "missing", "expired", "rejected"].includes(key) || key === "-")
    return "red";
  if (["requested", "pending", "in progress"].includes(key)) return "gray";
  if (["to renew", "to monitor"].includes(key)) return "orange";

  return "slate";
};

const getCoverageTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (key.includes("100") || key === "full" || key === "yes") return "green";
  if (key.includes("50") || key.includes("partial") || key.includes("medium"))
    return "orange";
  if (key.includes("1 plant") || key.includes("single")) return "pink";
  if (key === "none" || key === "no" || key === "-") return "red";
  if (key === "requested" || key === "pending") return "gray";

  return "slate";
};

const getStrategicTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (["strategic", "yes", "high", "monopolistic"].includes(key))
    return "purple";
  if (["medium", "potential"].includes(key)) return "orange";
  if (["no", "none", "-"].includes(key)) return "gray";

  return "gold";
};

const getPanelTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (key.includes("sb1") || key.includes("preferred") || key.includes("panel"))
    return "green";
  if (key.includes("sb2") || key.includes("backup")) return "blue";
  if (key.includes("blocked") || key.includes("excluded")) return "red";
  if (key.includes("candidate") || key.includes("potential")) return "orange";

  return "slate";
};

const getAgreementTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (["yes", "signed", "active", "valid", "lta"].includes(key)) return "green";
  if (["no", "rejected", "expired", "missing"].includes(key) || key === "-")
    return "red";
  if (["requested", "draft", "pending"].includes(key)) return "gray";
  if (["to monitor", "negotiation", "in progress", "partial"].includes(key))
    return "orange";

  return "gold";
};

const getOpportunityTone = (value: unknown): BadgeTone => {
  const key = getStatusKey(value);

  if (
    [
      "validated",
      "approved",
      "won",
      "active",
      "completed",
      "accepted",
    ].includes(key)
  )
    return "green";
  if (["rejected", "lost", "cancelled", "blocked"].includes(key)) return "red";
  if (
    ["in progress", "ongoing", "to monitor", "review", "under review"].includes(
      key,
    )
  )
    return "orange";
  if (["requested", "pending", "draft", "not started"].includes(key))
    return "gray";

  return "blue";
};

function StatusBadge({ value, tone }: { value: ReactNode; tone: BadgeTone }) {
  return <Badge text={asBadgeValue(value)} tone={tone} />;
}

function FinancialHealthBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getFinancialHealthTone(value)} />;
}

function GeoCoverageBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getGeoCoverageTone(value)} />;
}

function SqmaBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getSqmaTone(value)} />;
}

function DeliveryStatusBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getDeliveryStatusTone(value)} />;
}

function CertificationBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getCertificationTone(value)} />;
}

function CoverageBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getCoverageTone(value)} />;
}

function StrategicBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getStrategicTone(value)} />;
}

function PanelBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getPanelTone(value)} />;
}

function AgreementBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getAgreementTone(value)} />;
}

function OpportunityBadge({ value }: { value: ReactNode }) {
  return <StatusBadge value={value} tone={getOpportunityTone(value)} />;
}

type StatTone = "default" | "success" | "warning" | "danger" | "info";

function StatCard({
  label,
  value,
  helper,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: StatTone;
  icon?: ReactNode;
}) {
  const toneMap: Record<
    StatTone,
    {
      shell: string;
      icon: string;
      glow: string;
    }
  > = {
    default: {
      shell:
        "border-sky-100 bg-[linear-gradient(135deg,#ffffff_0%,#edf5ff_100%)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(10,18,30,0.9))]",
      icon: "bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-400/10 dark:text-sky-200 dark:ring-sky-400/20",
      glow: "bg-sky-400/12",
    },
    success: {
      shell:
        "border-emerald-100 bg-[linear-gradient(135deg,#ffffff_0%,#ecfdf5_100%)] dark:border-emerald-400/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(6,78,59,0.22))]",
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/20",
      glow: "bg-emerald-400/14",
    },
    warning: {
      shell:
        "border-amber-100 bg-[linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] dark:border-amber-400/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(120,53,15,0.22))]",
      icon: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/20",
      glow: "bg-amber-400/14",
    },
    danger: {
      shell:
        "border-rose-100 bg-[linear-gradient(135deg,#ffffff_0%,#fff1f2_100%)] dark:border-rose-400/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(127,29,29,0.22))]",
      icon: "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-400/20",
      glow: "bg-rose-400/14",
    },
    info: {
      shell:
        "border-blue-100 bg-[linear-gradient(135deg,#ffffff_0%,#eff6ff_100%)] dark:border-blue-400/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(30,64,175,0.2))]",
      icon: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-400/20",
      glow: "bg-blue-400/14",
    },
  };

  const styles = toneMap[tone];

  return (
    <div
      className={`group relative overflow-hidden rounded-[28px] border p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,23,42,0.11)] ${styles.shell}`}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl ${styles.glow}`}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {label}
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#10233f] dark:text-white">
            {value}
          </div>
        </div>

        {icon ? (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${styles.icon}`}
          >
            {icon}
          </div>
        ) : null}
      </div>

      {helper ? (
        <div className="relative mt-3 text-sm leading-5 text-slate-500 dark:text-slate-300">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 py-3 last:border-b-0 dark:border-white/10">
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-[#10233f] dark:text-white">
        {value || "-"}
      </span>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200/80 text-sm dark:divide-white/10">
          <thead className="bg-slate-50/90 dark:bg-slate-900/70">
            <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {headers.map((header) => (
                <th key={header} className="px-5 py-4 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 bg-white/90 dark:divide-white/10 dark:bg-slate-950/40">
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-sky-50/50 dark:hover:bg-white/5"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${rowIndex}-${cellIndex}`}
                      className="px-5 py-4 align-top text-slate-600 dark:text-slate-300"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No data available in this section.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const formatDate = (value: string) => {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

function renderOverviewTab(group: GroupRecord) {
  const metrics = [
    { label: "Last Eval Score", value: group.score ?? "-" },
    { label: "Last known Eval", value: group.lastEval },
    {
      label: "Financial Health",
      value: <FinancialHealthBadge value={group.financialHealth} />,
    },
    { label: "Req Date AP", value: group.nextReview },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Supplier profile"
          subtitle="Core classification and positioning"
          className="shadow-none"
        >
          <Field label="Supplier" value={group.nom} />
          <Field label="Global Supplier" value={group.GlobalSupplier} />
          <Field label="Group" value={group.groupName} />
          <Field label="Commodity" value={group.Commodity} />
          <Field label="Family" value={group.Family} />
          <Field label="Scope" value={group.scope} />
          <Field label="Area" value={group.hq} />
          <Field
            label="Del. Status"
            value={<DeliveryStatusBadge value={group.status} />}
          />
          <Field label="Cat. Pur." value={group.supplierClass} />
          <Field
            label="Strategic"
            value={<StrategicBadge value={group.strategic} />}
          />
          <Field label="Main Plants" value={group["Main Plants"]} />
        </SectionCard>

        <SectionCard
          title="Ownership & timeline"
          subtitle="Responsibility and review context"
          className="shadow-none"
        >
          <Field label="Commodity Resp" value={group.owner} />
          <Field label="Supplier Leader" value={group.supplierLeader} />
          <Field label="Plant" value={group.responsiblePlant} />
          <Field label="Created" value={formatDate(group.createdAt)} />
          <Field label="Updated" value={formatDate(group.updatedAt)} />
          <Field label="Last Known E. Period" value={group.lastKnownPeriod} />
          <Field label="SQMA" value={<SqmaBadge value={group.sqma} />} />
          <Field
            label="Competitiveness"
            value={<OpportunityBadge value={group.competitiveness} />}
          />
          <Field
            label="Family Cover."
            value={<CoverageBadge value={group.familyCoverage} />}
          />
          <Field
            label="Geo . Cover"
            value={<GeoCoverageBadge value={group.geoCoverage} />}
          />
          <Field label="Supplier Email" value={group["Supplier Email"]} />
        </SectionCard>
      </div>
    </div>
  );
}

function renderUnitsTab(group: GroupRecord) {
  const rows = UNITS.filter((unit) => unit.groupId === group.id).map((unit) => [
    <span className="font-semibold text-[#0f2744] dark:text-white">
      {unit.name}
    </span>,
    unit.city,
    <Badge text={String(unit.country)} tone="slate" />,
    unit.branchType,
    unit.productType,
    unit.productCategory,
    <DeliveryStatusBadge value={unit.status} />,
    <CertificationBadge value={unit.isoCertified ? "Yes" : "No"} />,
    <Badge text={String(unit.transitDays ?? "-")} tone="slate" />,
  ]);

  return (
    <DataTable
      headers={[
        "Plant",
        "Place Inco",
        "Area",
        "Main Plants / Type",
        "Product Lines",
        "Commodity",
        "Del. Status",
        "Cert",
        "Transit Days",
      ]}
      rows={rows}
    />
  );
}

function renderCertificationsTab(group: GroupRecord) {
  const rows = CERTIFICATIONS.filter((cert) => cert.groupId === group.id).map(
    (cert) => [
      <span className="font-semibold text-[#0f2744] dark:text-white">
        {cert.name}
      </span>,
      <Badge text={String(cert.certType)} tone="gold" />,
      cert.scope,
      <DeliveryStatusBadge value={cert.status} />,
      cert.startDate,
    ],
  );

  return (
    <DataTable
      headers={["Cert", "Type", "Family", "Status", "Start Date"]}
      rows={rows}
    />
  );
}

function renderAgreementsTab(group: GroupRecord) {
  const rows = AGREEMENTS.filter(
    (agreement) => agreement.groupId === group.id,
  ).map((agreement) => [
    <Badge text={String(agreement.type)} tone="slate" />,
    <span className="font-semibold text-[#0f2744] dark:text-white">
      {agreement.paymentTerms}
    </span>,
    <AgreementBadge value={agreement.lta} />,
    <AgreementBadge value={agreement.consignmentMode} />,
    agreement.description,
  ]);

  return (
    <DataTable
      headers={["Type", "TOP", "LTA", "Consignement", "Details"]}
      rows={rows}
    />
  );
}

function renderContactsTab(group: GroupRecord) {
  const rows = CONTACTS.filter((contact) => contact.groupId === group.id).map(
    (contact) => [
      <span className="font-semibold text-[#0f2744] dark:text-white">
        {contact.fullName}
      </span>,
      <Badge text={String(contact.roleName)} tone="slate" />,
      contact.owner,
      <span className="text-[#0f2744] dark:text-sky-300">{contact.email}</span>,
      <Badge text={String(contact.language).toUpperCase()} tone="blue" />,
    ],
  );

  return (
    <DataTable
      headers={[
        "Supplier Leader",
        "Role",
        "Commodity Resp",
        "Supplier Email",
        "Language",
      ]}
      rows={rows}
    />
  );
}

function renderOpportunitiesTab(group: GroupRecord) {
  const rows = OPPORTUNITIES.filter(
    (opportunity) => opportunity.groupId === group.id,
  ).map((opportunity) => [
    <span className="font-semibold text-[#0f2744] dark:text-white">
      {opportunity.name}
    </span>,
    <OpportunityBadge value={opportunity.status} />,
    <OpportunityBadge value={opportunity.phaseStatus} />,
    <OpportunityBadge value={opportunity.validationDecision} />,
    opportunity.assumptionsSummary,
    opportunity.comments,
  ]);

  return (
    <DataTable
      headers={[
        "Supplier",
        "Del. Status",
        "Last known Eval",
        "Competitiveness",
        "SQMA / Family Cover. / Geo . Cover",
        "Financial Health",
      ]}
      rows={rows}
    />
  );
}

function renderFinancialsTab(group: GroupRecord) {
  const rows = FINANCIALS.filter((line) => line.groupId === group.id).map(
    (line) => [
      <span className="font-semibold text-[#0f2744] dark:text-white">
        {line.name}
      </span>,
      <AgreementBadge value={line.top} />,
      <Badge text={String(line.budgetValue)} tone="slate" />,
      <Badge text={String(line.realApDays ?? "-")} tone="blue" />,
      <span className="font-semibold text-[#0f2744] dark:text-white">
        {line.forecastEOY}
      </span>,
      <FinancialHealthBadge value={line.comments} />,
    ],
  );

  return (
    <DataTable
      headers={[
        "Supplier",
        "TOP",
        "Transit Days",
        "Real AP days (Val)",
        "Last Eval Score",
        "Financial Health",
      ]}
      rows={rows}
    />
  );
}

function renderActiveTab(tab: TabKey, group: GroupRecord) {
  switch (tab) {
    case "Overview":
      return renderOverviewTab(group);
    case "Units":
      return renderUnitsTab(group);
    case "Certifications":
      return renderCertificationsTab(group);
    case "Agreements":
      return renderAgreementsTab(group);
    case "Contacts":
      return renderContactsTab(group);
    case "Opportunities":
      return renderOpportunitiesTab(group);
    case "Financials":
      return renderFinancialsTab(group);
    default:
      return null;
  }
}

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number>(GROUPS[0]?.id ?? 0);
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const [viewMode, setViewMode] = useState<ViewMode>("Group Scan");
  const [scanSort, setScanSort] = useState<ScanSort>("score-desc");
  const [scanFilter, setScanFilter] = useState<ScanFilter>("all");
  const [directoryPage, setDirectoryPage] = useState(1);
  const [scanPage, setScanPage] = useState(1);
  const groupOptions = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(GROUPS.map((group) => group.groupName || "Ungrouped")),
      ),
    ],
    [],
  );

  const filteredDirectory = useMemo(() => {
    return GROUPS.filter((group) => {
      const matchesSearch = supplierMatchesSearch(group, search);

      const matchesGroup =
        selectedGroupFilter === "all"
          ? true
          : (group.groupName || "Ungrouped") === selectedGroupFilter;

      return matchesSearch && matchesGroup;
    });
  }, [search, selectedGroupFilter]);

  const searchOnlyMatches = useMemo(() => {
    return GROUPS.filter((group) => supplierMatchesSearch(group, search));
  }, [search]);

  const groupOnlyMatches = useMemo(() => {
    if (selectedGroupFilter === "all") return GROUPS;
    return GROUPS.filter(
      (group) => (group.groupName || "Ungrouped") === selectedGroupFilter,
    );
  }, [selectedGroupFilter]);

  const suggestedSuppliers = useMemo(() => {
    if (!search.trim() || filteredDirectory.length > 0) return [];

    const normalizedKeyword = normalizeSearchText(search);
    const tokens = normalizedKeyword.split(/\s+/).filter(Boolean);

    return GROUPS.map((group) => {
      const searchableWords = getSupplierSearchText(group)
        .split(/\s+/)
        .filter(Boolean);
      const score = tokens.reduce((total, token) => {
        const exactMatch = searchableWords.some((word) => word.includes(token));
        if (exactMatch) return total + 3;

        const closeMatch = searchableWords.some((word) =>
          isCloseSearchToken(token, word),
        );
        return total + Number(closeMatch);
      }, 0);

      return { group, score };
    })
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ group }) => group);
  }, [filteredDirectory.length, search]);

  const resetSupplierSearch = () => {
    setSearch("");
    setSelectedGroupFilter("all");
    setDirectoryPage(1);
  };

  const selected =
    GROUPS.find((group) => group.id === selectedId) ?? GROUPS[0] ?? null;

  const selectedGroupSuppliers = useMemo(() => {
    if (!selected) return [];
    return GROUPS.filter((group) => group.groupName === selected.groupName);
  }, [selected]);

  const scanResults = useMemo(() => {
    const filteredSuppliers = selectedGroupSuppliers.filter((supplier) => {
      if (scanFilter === "attention") {
        return (
          supplier.status !== "Active" ||
          supplier.cert === "-" ||
          supplier.nextReview === "-" ||
          typeof supplier.score !== "number" ||
          supplier.score < 85
        );
      }
      if (scanFilter === "strategic") {
        return (
          String(supplier.strategic).toLowerCase() !== "-" &&
          String(supplier.strategic).toLowerCase() !== "none"
        );
      }
      if (scanFilter === "missing-cert") {
        return supplier.cert === "-";
      }
      return true;
    });

    return [...filteredSuppliers].sort((left, right) => {
      if (scanSort === "score-desc") {
        return (right.score ?? -1) - (left.score ?? -1);
      }
      if (scanSort === "review-asc") {
        return String(left.nextReview).localeCompare(String(right.nextReview));
      }
      if (scanSort === "strategic-first") {
        return (
          Number(Boolean(right.monopolistic || right.strategic !== "-")) -
          Number(Boolean(left.monopolistic || left.strategic !== "-"))
        );
      }
      return String(left.nom).localeCompare(String(right.nom));
    });
  }, [scanFilter, scanSort, selectedGroupSuppliers]);

  const directoryTotalPages = Math.max(
    1,
    Math.ceil(filteredDirectory.length / PAGE_SIZE),
  );
  const paginatedDirectory = filteredDirectory.slice(
    (directoryPage - 1) * PAGE_SIZE,
    directoryPage * PAGE_SIZE,
  );

  const scanTotalPages = Math.max(1, Math.ceil(scanResults.length / PAGE_SIZE));
  const paginatedScan = scanResults.slice(
    (scanPage - 1) * PAGE_SIZE,
    scanPage * PAGE_SIZE,
  );

  useEffect(() => {
    setDirectoryPage(1);
  }, [search, selectedGroupFilter]);

  useEffect(() => {
    if (filteredDirectory.length === 0) {
      return;
    }

    const hasSelectedInFilteredDirectory = filteredDirectory.some(
      (group) => group.id === selectedId,
    );

    if (!hasSelectedInFilteredDirectory && viewMode === "Group Scan") {
      setSelectedId(filteredDirectory[0].id);
      setActiveTab("Overview");
    }
  }, [filteredDirectory, selectedId, viewMode]);

  useEffect(() => {
    setScanPage(1);
  }, [scanFilter, scanSort, selected?.groupName]);

  useEffect(() => {
    if (directoryPage > directoryTotalPages) {
      setDirectoryPage(directoryTotalPages);
    }
  }, [directoryPage, directoryTotalPages]);

  if (!selected) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white/90 p-12 text-center text-slate-500 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
        No supplier data available.
      </div>
    );
  }

  const attentionCount = selectedGroupSuppliers.filter(
    (supplier) =>
      supplier.status !== "Active" ||
      supplier.cert === "-" ||
      supplier.nextReview === "-" ||
      typeof supplier.score !== "number" ||
      supplier.score < 85,
  ).length;
  const strategicCount = selectedGroupSuppliers.filter(
    (supplier) =>
      String(supplier.strategic).toLowerCase() !== "-" &&
      String(supplier.strategic).toLowerCase() !== "none",
  ).length;
  const averageScoreBase = selectedGroupSuppliers.filter(
    (supplier) => typeof supplier.score === "number",
  );
  const averageScore =
    averageScoreBase.length > 0
      ? Math.round(
          averageScoreBase.reduce(
            (sum, supplier) => sum + (supplier.score ?? 0),
            0,
          ) / averageScoreBase.length,
        )
      : "-";

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-[30px] border border-white/70 bg-[linear-gradient(180deg,#0f2744_0%,#14365f_55%,#1c4a7d_100%)] p-5 text-white shadow-[0_28px_60px_rgba(15,39,68,0.28)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/70">
            Supplier Panel SB1
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
            Browse by group
          </h2>
          <p className="mt-2 text-sm leading-6 text-sky-100/75">
            Search suppliers, narrow by group, and jump into either a full
            detail panel or a broader group scan.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-100/50" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search supplier, group, category"
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/10 pl-11 pr-4 text-sm text-white outline-none placeholder:text-sky-100/45 focus:border-sky-300/45"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
            <Filter className="h-4 w-4 text-sky-100/60" />
            <select
              value={selectedGroupFilter}
              onChange={(event) => setSelectedGroupFilter(event.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none"
            >
              {groupOptions.map((group) => (
                <option key={group} value={group} className="text-slate-900">
                  {group === "all" ? "All groups" : group}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-sky-100/75">
          <span>{filteredDirectory.length} supplier(s)</span>
          <span>
            {selectedGroupFilter === "all" ? "All groups" : selectedGroupFilter}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {paginatedDirectory.length > 0 ? (
            paginatedDirectory.map((supplier) => {
              const isSelected = supplier.id === selected.id;

              return (
                <button
                  key={supplier.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(supplier.id);
                    setViewMode("Supplier Detail");
                    setActiveTab("Overview");
                  }}
                  className={`w-full rounded-[24px] border p-4 text-left transition ${
                    isSelected
                      ? "border-sky-300/60 bg-white/18 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                      : "border-white/10 bg-white/6 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">
                        {supplier.nom}
                      </div>
                      <div className="mt-1 text-xs text-sky-100/70">
                        {supplier.groupName} • {supplier.category}
                      </div>
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 text-sky-100/55" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <DeliveryStatusBadge value={supplier.status} />
                    <PanelBadge value={supplier.panel} />
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-white/10 bg-white/8 p-4 text-sm text-sky-100/80">
              <div className="font-semibold text-white">No suppliers found</div>
              <p className="mt-2 leading-6">
                Try a supplier name, group, plant, commodity, owner, email, or
                clear the current filters.
              </p>

              <div className="mt-3 space-y-2 text-xs text-sky-100/70">
                {search.trim() &&
                searchOnlyMatches.length > 0 &&
                selectedGroupFilter !== "all" ? (
                  <p>
                    {searchOnlyMatches.length} match(es) found outside
                    {` ${selectedGroupFilter}`}. Select “All groups” to view
                    them.
                  </p>
                ) : null}
                {selectedGroupFilter !== "all" &&
                groupOnlyMatches.length > 0 ? (
                  <p>
                    {groupOnlyMatches.length} supplier(s) exist in this group.
                  </p>
                ) : null}
              </div>

              {suggestedSuppliers.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/55">
                    Did you mean
                  </div>
                  {suggestedSuppliers.map((supplier) => (
                    <button
                      key={`suggestion-${supplier.id}`}
                      type="button"
                      onClick={() => {
                        setSelectedId(supplier.id);
                        setSelectedGroupFilter("all");
                        setViewMode("Supplier Detail");
                        setActiveTab("Overview");
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-left font-semibold text-white transition hover:border-sky-200/40 hover:bg-white/15"
                    >
                      <span>{supplier.nom}</span>
                      <ChevronRight className="h-4 w-4 text-sky-100/55" />
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                onClick={resetSupplierSearch}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#0f2744] shadow-[0_14px_24px_rgba(255,255,255,0.12)] transition hover:bg-sky-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset search
              </button>
            </div>
          )}
        </div>

        {filteredDirectory.length > 0 ? (
          <div className="mt-5">
            <Pagination
              page={directoryPage}
              totalPages={directoryTotalPages}
              totalItems={filteredDirectory.length}
              pageSize={PAGE_SIZE}
              onPageChange={setDirectoryPage}
              compact
            />
          </div>
        ) : null}
      </aside>

      <main className="space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,#0f2744_0%,#15406e_55%,#2f6fed_100%)] p-6 text-white shadow-[0_28px_60px_rgba(15,39,68,0.24)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              {/* <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100/65">
                Supplier Workspace
              </p> */}
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                {selected.nom}
              </h1>
              <p className="mt-2 text-sm leading-6 text-sky-100/80">
                {selected.GlobalSupplier}
              </p>
            </div>

            <div className="flex flex-col gap-4 xl:items-end">
              <div className="inline-flex rounded-2xl bg-white/12 p-1.5">
                {(["Group Scan", "Supplier Detail"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      viewMode === mode
                        ? "bg-white text-[#0f2744] shadow-[0_14px_24px_rgba(255,255,255,0.16)]"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge text={selected.groupName} tone="slate" />
                <Badge text={`Class ${selected.supplierClass}`} tone="gold" />
                <DeliveryStatusBadge value={selected.status} />
                <PanelBadge value={selected.panel} />
              </div>
            </div>
          </div>
        </section>

        {viewMode === "Group Scan" ? (
          <SectionCard
            title="Portfolio scan"
            subtitle="Use filters and sorting to sweep the supplier family before opening details."
            contentClassName="space-y-5"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Suppliers In Group"
                value={selectedGroupSuppliers.length}
                helper="Visible in the selected supplier family"
                tone="info"
                icon={<UsersRound className="h-5 w-5" />}
              />
              <StatCard
                label="Avg Last Eval Score"
                value={averageScore}
                helper="Mean score for evaluated suppliers"
                tone="success"
                icon={<BarChart3 className="h-5 w-5" />}
              />
              <StatCard
                label="Strategic Suppliers"
                value={strategicCount}
                helper="Flagged as strategic or monitored"
                tone="warning"
                icon={<Star className="h-5 w-5" />}
              />
              <StatCard
                label="Need Attention"
                value={attentionCount}
                helper="Low score, missing data, or inactive"
                tone="danger"
                icon={<AlertTriangle className="h-5 w-5" />}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Sort
                </span>
                <select
                  value={scanSort}
                  onChange={(event) =>
                    setScanSort(event.target.value as ScanSort)
                  }
                  className="w-full bg-transparent outline-none"
                >
                  <option value="score-desc">Highest score first</option>
                  <option value="review-asc">Nearest review first</option>
                  <option value="strategic-first">Strategic first</option>
                  <option value="name-asc">Name A-Z</option>
                </select>
              </label>

              <label className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Filter
                </span>
                <select
                  value={scanFilter}
                  onChange={(event) =>
                    setScanFilter(event.target.value as ScanFilter)
                  }
                  className="w-full bg-transparent outline-none"
                >
                  <option value="all">All suppliers</option>
                  <option value="attention">Need attention</option>
                  <option value="strategic">Strategic only</option>
                  <option value="missing-cert">Missing cert only</option>
                </select>
              </label>
            </div>

            <DataTable
              headers={[
                "Supplier",
                "Plant",
                "Del. Status",
                "Last known Eval",
                "Last Eval Score",
                "Strategic",
                "Cert",
                "Req Date AP",
              ]}
              rows={paginatedScan.map((supplier) => [
                <button
                  key={`open-${supplier.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedId(supplier.id);
                    setViewMode("Supplier Detail");
                    setActiveTab("Overview");
                  }}
                  className="font-semibold text-[#0f2744] transition hover:text-[#2f6fed] dark:text-white dark:hover:text-sky-300"
                >
                  {supplier.nom}
                </button>,
                supplier.responsiblePlant,
                <DeliveryStatusBadge value={supplier.status} />,
                <Badge text={String(supplier.lastEval)} tone="slate" />,
                <span className="font-semibold text-[#10233f] dark:text-white">
                  {supplier.score ?? "-"}
                </span>,
                <StrategicBadge value={supplier.strategic} />,
                <CertificationBadge value={supplier.cert} />,
                <Badge
                  text={String(supplier.nextReview)}
                  tone={supplier.nextReview === "-" ? "gray" : "blue"}
                />,
              ])}
            />

            <Pagination
              page={scanPage}
              totalPages={scanTotalPages}
              totalItems={scanResults.length}
              pageSize={PAGE_SIZE}
              onPageChange={setScanPage}
            />
          </SectionCard>
        ) : (
          <SectionCard
            title="Supplier detail"
            subtitle={`${selected.groupName} supplier record with related operational sections.`}
            contentClassName="space-y-5"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      activeTab === tab
                        ? "bg-[#0f2744] text-white shadow-[0_16px_28px_rgba(15,39,68,0.22)]"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-[#0f2744] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {renderActiveTab(activeTab, selected)}
            <button
              type="button"
              onClick={() => setViewMode("Group Scan")}
              className="whitespace-nowrap rounded-2xl bg-[#0f2744] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,39,68,0.22)] transition hover:bg-[#15406e] dark:bg-sky-500 dark:text-[#0f2744] dark:hover:bg-sky-400"
            >
              Back to group suppliers
            </button>
          </SectionCard>
        )}
      </main>
    </div>
  );
}
