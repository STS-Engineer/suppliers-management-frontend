import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileText,
  Filter,
  Search,
  ShieldAlert,
  Target,
  Truck,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RagStatus = "green" | "amber" | "red";
type KpiGroup = "Spend" | "Delivery" | "Quality" | "Action Plan";

type KpiRow = {
  id: string;
  kpiName: string;
  group: KpiGroup;
  definition: string;
  formula: string;
  dataOwner: string;
  audience: string;
  reactionPlan: string;
};

type SupplierScorecard = {
  supplier: string;
  period: string;
  plant: string;
  score: number;
  spend: number;
  otdAverage: number;
  claims: number;
  overdueActions: number;
  criticalKpis: number;
  status: RagStatus;
};

const periods = ["2026-Q1", "2025-Q4", "2025-Q3"];

const kpis: KpiRow[] = [
  {
    id: "total-spend",
    kpiName: "Total Spend (period)",
    group: "Spend",
    definition:
      "Total value of delivered purchases for the supplier during the reporting period.",
    formula: "SUM(Purchase Price at Delivery) for all deliveries in period.",
    dataOwner: "Plant Logistics / IT consolidation",
    audience: "Internal (Scorecard & Supplier Panel)",
    reactionPlan:
      "If variance > threshold vs prior period: root cause analysis + commercial review.",
  },
  {
    id: "delivered-references",
    kpiName: "Number of Delivered References",
    group: "Delivery",
    definition:
      "Number of distinct part references delivered during the period.",
    formula: "COUNT DISTINCT(Part Reference) per supplier.",
    dataOwner: "Plant Logistics",
    audience: "Internal",
    reactionPlan:
      "If strong increase: check scope change and potential quality/logistics impact.",
  },
  {
    id: "deliveries",
    kpiName: "Number of Deliveries",
    group: "Delivery",
    definition: "Total number of deliveries recorded during the period.",
    formula: "COUNT(Delivery lines/documents) per supplier.",
    dataOwner: "Plant Logistics",
    audience: "Internal",
    reactionPlan:
      "If strong decrease: assess supply risk, continuity and sourcing changes.",
  },
  {
    id: "otd-monthly",
    kpiName: "OTD Monthly (%)",
    group: "Delivery",
    definition: "On-Time Delivery performance per month.",
    formula: "Provided by Logistics: OTD% by supplier and month.",
    dataOwner: "Plant Logistics",
    audience: "Supplier + Internal",
    reactionPlan:
      "If OTD < target for 2 consecutive months: corrective action plan + escalation per category.",
  },
  {
    id: "otd-average",
    kpiName: "OTD Average (period)",
    group: "Delivery",
    definition: "Average OTD over the reporting period.",
    formula: "AVERAGE or weighted average of monthly OTD% over period.",
    dataOwner: "Plant Logistics / IT",
    audience: "Supplier + Internal",
    reactionPlan:
      "If OTD average < target: action plan; for A suppliers: review at Group level.",
  },
  {
    id: "quality-claims",
    kpiName: "Number of Quality Claims (period)",
    group: "Quality",
    definition: "Total number of quality claims opened during the period.",
    formula: "COUNT(Claim Number) where Opening Date is within period.",
    dataOwner: "Quality",
    audience: "Supplier + Internal",
    reactionPlan:
      "If above threshold: request 8D / corrective actions; analyze recurring causes.",
  },
  {
    id: "open-claims",
    kpiName: "Open Claims (backlog)",
    group: "Quality",
    definition: "Number of claims still open at end of period.",
    formula: "COUNT where Status = Open as of period end.",
    dataOwner: "Quality",
    audience: "Supplier + Internal",
    reactionPlan:
      "If backlog > target: escalate; require closure plan and deadlines.",
  },
  {
    id: "closure-rate",
    kpiName: "Closure Rate (%)",
    group: "Quality",
    definition: "Share of claims closed during the period.",
    formula: "(# Closed Claims / # Total Claims) * 100.",
    dataOwner: "Quality",
    audience: "Internal (optional Supplier)",
    reactionPlan:
      "If below target: reinforce closure management and effectiveness of actions.",
  },
  {
    id: "avg-claim-closure-time",
    kpiName: "Avg. Claim Closure Time (days)",
    group: "Quality",
    definition: "Average time to close claims.",
    formula: "AVERAGE(Closing Date - Opening Date) for closed claims.",
    dataOwner: "Quality",
    audience: "Internal (optional Supplier)",
    reactionPlan:
      "If above target: impose max closure time; escalate; audit if recurring.",
  },
  {
    id: "claims-per-spend",
    kpiName: "Claims per Spend",
    group: "Quality",
    definition: "Quality claim intensity relative to spend.",
    formula: "(# Claims / Total Spend) * 100k EUR or defined base.",
    dataOwner: "Quality + IT",
    audience: "Internal",
    reactionPlan:
      "If increasing: focus on key families/processes; targeted improvement plan.",
  },
  {
    id: "action-plan-status",
    kpiName: "Action Plan Status",
    group: "Action Plan",
    definition: "Progress of corrective actions agreed with supplier.",
    formula: "% actions closed on time or RAG status from action tracker.",
    dataOwner: "Purchasing Owner + Quality/Logistics",
    audience: "Internal",
    reactionPlan:
      "If overdue: escalate to supplier management; block new business if critical.",
  },
];

const supplierScorecards: SupplierScorecard[] = [
  {
    supplier: "AVX SCEET",
    period: "2026-Q1",
    plant: "Sceet",
    score: 88,
    spend: 1240000,
    otdAverage: 96.2,
    claims: 3,
    overdueActions: 0,
    criticalKpis: 0,
    status: "green",
  },
  {
    supplier: "TDK Sceet",
    period: "2026-Q1",
    plant: "Sceet",
    score: 82,
    spend: 980000,
    otdAverage: 94.6,
    claims: 4,
    overdueActions: 1,
    criticalKpis: 1,
    status: "amber",
  },
  {
    supplier: "Bourns Sceet",
    period: "2026-Q1",
    plant: "Sceet",
    score: 79,
    spend: 860000,
    otdAverage: 93.1,
    claims: 5,
    overdueActions: 1,
    criticalKpis: 1,
    status: "amber",
  },
  {
    supplier: "Kemet Electronics Corp",
    period: "2026-Q1",
    plant: "Monterrey",
    score: 74,
    spend: 1110000,
    otdAverage: 91.4,
    claims: 7,
    overdueActions: 2,
    criticalKpis: 2,
    status: "amber",
  },
  {
    supplier: "Xinjia",
    period: "2026-Q1",
    plant: "Kunshan",
    score: 61,
    spend: 640000,
    otdAverage: 88.2,
    claims: 9,
    overdueActions: 3,
    criticalKpis: 3,
    status: "red",
  },
  {
    supplier: "AVX SCEET",
    period: "2025-Q4",
    plant: "Sceet",
    score: 84,
    spend: 1170000,
    otdAverage: 95.4,
    claims: 4,
    overdueActions: 0,
    criticalKpis: 0,
    status: "green",
  },
  {
    supplier: "TDK Sceet",
    period: "2025-Q4",
    plant: "Sceet",
    score: 80,
    spend: 930000,
    otdAverage: 93.8,
    claims: 5,
    overdueActions: 1,
    criticalKpis: 1,
    status: "amber",
  },
  {
    supplier: "Bourns Sceet",
    period: "2025-Q4",
    plant: "Sceet",
    score: 77,
    spend: 810000,
    otdAverage: 92.5,
    claims: 5,
    overdueActions: 1,
    criticalKpis: 1,
    status: "amber",
  },
  {
    supplier: "Kemet Electronics Corp",
    period: "2025-Q4",
    plant: "Monterrey",
    score: 72,
    spend: 1070000,
    otdAverage: 90.8,
    claims: 8,
    overdueActions: 2,
    criticalKpis: 2,
    status: "red",
  },
  {
    supplier: "Xinjia",
    period: "2025-Q4",
    plant: "Kunshan",
    score: 65,
    spend: 690000,
    otdAverage: 89.7,
    claims: 8,
    overdueActions: 2,
    criticalKpis: 2,
    status: "red",
  },
];

const portfolioTrend = [
  { month: "Jan", otd: 94.1, target: 95, claims: 18 },
  { month: "Feb", otd: 92.9, target: 95, claims: 22 },
  { month: "Mar", otd: 91.7, target: 95, claims: 28 },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "red" | "blue" | "slate";
}) {
  const toneMap = {
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
    red: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200",
    blue: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200",
    slate:
      "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        toneMap[tone],
      )}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  helper,
  detail,
  tone = "blue",
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
  detail?: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const shellMap = {
    blue: "border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fa_100%)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.82),rgba(10,18,30,.9))]",
    green:
      "border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f1f8f4_100%)] dark:border-emerald-400/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.82),rgba(6,78,59,.22))]",
    amber:
      "border-amber-100 bg-[linear-gradient(180deg,#ffffff_0%,#faf4eb_100%)] dark:border-amber-400/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.82),rgba(120,53,15,.22))]",
    red: "border-rose-100 bg-[linear-gradient(180deg,#ffffff_0%,#faf0f0_100%)] dark:border-rose-400/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.82),rgba(127,29,29,.22))]",
  } as const;

  const accentMap = {
    blue: "bg-[#173a5c]",
    green: "bg-[#1f8a5b]",
    amber: "bg-[#b7791f]",
    red: "bg-[#c24141]",
  } as const;

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[20px] border px-5 py-4 shadow-[0_14px_30px_rgba(15,23,42,.05)]",
        shellMap[tone],
      )}
    >
      <div
        className={cx(
          "mb-4 h-1.5 w-14 rounded-full",
          accentMap[tone],
        )}
      />
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <div className="mt-2 text-[2rem] font-semibold tracking-[-0.06em] text-[#10233f] dark:text-white">
            {value}
          </div>
        </div>
        {detail ? (
          <div className="inline-flex rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            {detail}
          </div>
        ) : null}
      </div>
      {helper ? (
        <p className="mt-4 border-t border-slate-200/80 pt-3 text-sm leading-5 text-slate-500 dark:border-white/10 dark:text-slate-300">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))] p-5 shadow-[0_16px_36px_rgba(15,23,42,.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.78),rgba(10,18,30,.84))]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-[#10233f] dark:text-white">
          {title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="h-72">{children}</div>
    </div>
  );
}

function getStatusTone(status: RagStatus) {
  if (status === "green") return "green";
  if (status === "amber") return "amber";
  return "red";
}

export default function SupplierKpiDashboard() {
  const [period, setPeriod] = useState("2026-Q1");
  const [group, setGroup] = useState<"all" | KpiGroup>("all");
  const [search, setSearch] = useState("");

  const periodScorecards = useMemo(
    () => supplierScorecards.filter((row) => row.period === period),
    [period],
  );

  const filteredScorecards = useMemo(() => {
    const text = search.trim().toLowerCase();
    return periodScorecards.filter((row) => {
      const searchMatch =
        !text ||
        [row.supplier, row.plant, row.status].join(" ").toLowerCase().includes(text);
      return searchMatch;
    });
  }, [periodScorecards, search]);

  const filteredKpis = useMemo(() => {
    const text = search.trim().toLowerCase();
    return kpis.filter((kpi) => {
      const groupMatch = group === "all" || kpi.group === group;
      const searchMatch =
        !text ||
        [
          kpi.kpiName,
          kpi.definition,
          kpi.formula,
          kpi.dataOwner,
          kpi.audience,
          kpi.reactionPlan,
          kpi.group,
        ]
          .join(" ")
          .toLowerCase()
          .includes(text);
      return groupMatch && searchMatch;
    });
  }, [group, search]);

  const summary = useMemo(() => {
    const suppliersCount = filteredScorecards.length;
    const avgScore = suppliersCount
      ? Math.round(
          filteredScorecards.reduce((sum, row) => sum + row.score, 0) / suppliersCount,
        )
      : 0;
    const avgOtd = suppliersCount
      ? (
          filteredScorecards.reduce((sum, row) => sum + row.otdAverage, 0) /
          suppliersCount
        ).toFixed(1)
      : "0.0";
    const totalSpend = filteredScorecards.reduce((sum, row) => sum + row.spend, 0);
    const totalClaims = filteredScorecards.reduce((sum, row) => sum + row.claims, 0);
    const red = filteredScorecards.filter((row) => row.status === "red").length;
    const amber = filteredScorecards.filter((row) => row.status === "amber").length;
    const green = filteredScorecards.filter((row) => row.status === "green").length;
    return {
      suppliersCount,
      avgScore,
      avgOtd,
      totalSpend,
      totalClaims,
      red,
      amber,
      green,
    };
  }, [filteredScorecards]);

  const otdBySupplier = filteredScorecards.map((row) => ({
    supplier: row.supplier,
    otd: row.otdAverage,
    target: 95,
  }));

  const claimsBySupplier = filteredScorecards.map((row) => ({
    supplier: row.supplier,
    claims: row.claims,
    overdueActions: row.overdueActions,
  }));

  const spendBySupplier = filteredScorecards.map((row) => ({
    supplier: row.supplier,
    spend: Math.round(row.spend / 1000),
  }));

  const ragData = [
    { name: "Green", value: summary.green, color: "#1f8a5b" },
    { name: "Amber", value: summary.amber, color: "#b7791f" },
    { name: "Red", value: summary.red, color: "#c24141" },
  ];

  return (
    <div className="min-h-screen bg-transparent p-3 text-slate-900 dark:text-white sm:p-4 lg:p-5">
      <div className="w-full max-w-none space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-slate-200/70 bg-[linear-gradient(135deg,#112033_0%,#1a304b_58%,#24507a_100%)] p-6 text-white shadow-[0_24px_56px_rgba(15,23,42,.16)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#08111d_0%,#10233f_55%,#173a5c_100%)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200/65">
                Supplier Performance Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                Supplier KPI Portfolio
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100/78">
                Portfolio view of supplier KPI performance across spend,
                delivery, quality, and action plan execution for the selected
                reporting period.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none backdrop-blur [&_option]:text-slate-900"
              >
                {periods.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#112033] shadow-[0_16px_28px_rgba(255,255,255,.12)]">
                <Download className="h-4 w-4" /> Export portfolio
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Suppliers in view"
            value={summary.suppliersCount}
            helper={`Reporting period ${period}`}
            tone="blue"
            detail="Portfolio scope"
          />
          <StatCard
            label="Average score"
            value={`${summary.avgScore}/100`}
            helper="Portfolio KPI health"
            tone={
              summary.avgScore >= 85
                ? "green"
                : summary.avgScore >= 70
                  ? "amber"
                  : "red"
            }
            detail="Weighted composite result"
          />
          <StatCard
            label="Portfolio spend"
            value={formatCurrency(summary.totalSpend)}
            helper="Delivered purchases in period"
            tone="green"
            detail="Commercial exposure"
          />
          <StatCard
            label="Average OTD"
            value={`${summary.avgOtd}%`}
            helper="Target >= 95%"
            tone="amber"
            detail="Service reliability"
          />
          <StatCard
            label="Quality claims"
            value={summary.totalClaims}
            helper="Across visible suppliers"
            tone="red"
            detail="Issue volume"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="OTD portfolio trend"
            subtitle="Monthly delivery performance against target"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={portfolioTrend}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid stroke="#d6dee8" strokeDasharray="4 4" />
                <XAxis dataKey="month" stroke="#6c7b8f" />
                <YAxis domain={[80, 100]} stroke="#6c7b8f" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #d6dde7",
                    boxShadow: "0 12px 28px rgba(15,23,42,.10)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Target"
                  stroke="#8b98aa"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="otd"
                  name="Portfolio OTD"
                  stroke="#24507a"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#24507a" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Status distribution"
            subtitle="Supplier scorecard outcome by RAG status"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ragData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={4}
                >
                  {ragData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #d6dde7",
                    boxShadow: "0 12px 28px rgba(15,23,42,.10)",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <ChartCard
            title="OTD by supplier"
            subtitle="Average on-time delivery for each supplier"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={otdBySupplier}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
              >
                <CartesianGrid stroke="#d6dee8" strokeDasharray="4 4" horizontal={false} />
                <XAxis type="number" domain={[80, 100]} stroke="#6c7b8f" />
                <YAxis
                  type="category"
                  dataKey="supplier"
                  stroke="#6c7b8f"
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #d6dde7",
                    boxShadow: "0 12px 28px rgba(15,23,42,.10)",
                  }}
                />
                <Bar dataKey="otd" fill="#24507a" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Claims and overdue actions"
            subtitle="Quality pressure and execution backlog"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={claimsBySupplier}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid stroke="#d6dee8" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="supplier" stroke="#6c7b8f" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} stroke="#6c7b8f" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #d6dde7",
                    boxShadow: "0 12px 28px rgba(15,23,42,.10)",
                  }}
                />
                <Legend />
                <Bar dataKey="claims" name="Claims" fill="#c24141" radius={[10, 10, 0, 0]} />
                <Bar
                  dataKey="overdueActions"
                  name="Overdue actions"
                  fill="#b7791f"
                  radius={[10, 10, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Spend by supplier"
            subtitle="Delivered purchase value in thousands of euros"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={spendBySupplier}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid stroke="#d6dee8" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="supplier" stroke="#6c7b8f" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6c7b8f" />
                <Tooltip
                  formatter={(value: number) => [`${value} kEUR`, "Spend"]}
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #d6dde7",
                    boxShadow: "0 12px 28px rgba(15,23,42,.10)",
                  }}
                />
                <Bar dataKey="spend" fill="#173a5c" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))] p-5 shadow-[0_16px_36px_rgba(15,23,42,.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.78),rgba(10,18,30,.84))]">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto] lg:items-center">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Search className="h-4 w-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search supplier, plant, KPI, owner, reaction plan..."
                className="w-full bg-transparent outline-none"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Filter className="h-4 w-4" />
              <select
                value={group}
                onChange={(event) =>
                  setGroup(event.target.value as "all" | KpiGroup)
                }
                className="w-full bg-transparent font-semibold outline-none"
              >
                <option value="all">All KPI groups</option>
                <option value="Spend">Spend</option>
                <option value="Delivery">Delivery</option>
                <option value="Quality">Quality</option>
                <option value="Action Plan">Action Plan</option>
              </select>
            </label>
            <div className="flex gap-2">
              <Badge tone="green">{summary.green} green</Badge>
              <Badge tone="amber">{summary.amber} amber</Badge>
              <Badge tone="red">{summary.red} red</Badge>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))] shadow-[0_16px_36px_rgba(15,23,42,.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.78),rgba(10,18,30,.84))]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#10233f] dark:text-white">
                Supplier portfolio scorecards
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Cross-supplier KPI outcome for the selected reporting period.
              </p>
            </div>
            <Badge tone="blue">{filteredScorecards.length} suppliers displayed</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] divide-y divide-slate-200 text-sm dark:divide-white/10">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Supplier</th>
                  <th className="px-5 py-4">Plant</th>
                  <th className="px-5 py-4">Score</th>
                  <th className="px-5 py-4">Spend</th>
                  <th className="px-5 py-4">OTD Avg</th>
                  <th className="px-5 py-4">Claims</th>
                  <th className="px-5 py-4">Overdue Actions</th>
                  <th className="px-5 py-4">Critical KPIs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {filteredScorecards.map((row) => (
                  <tr
                    key={`${row.supplier}-${row.period}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-white/5"
                  >
                    <td className="px-5 py-4">
                      <Badge tone={getStatusTone(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#10233f] dark:text-white">
                      {row.supplier}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {row.plant}
                    </td>
                    <td className="px-5 py-4 text-lg font-semibold tracking-[-0.04em] text-[#10233f] dark:text-white">
                      {row.score}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {formatCurrency(row.spend)}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {row.otdAverage.toFixed(1)}%
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {row.claims}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {row.overdueActions}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {row.criticalKpis}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.96))] shadow-[0_16px_36px_rgba(15,23,42,.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.78),rgba(10,18,30,.84))]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#10233f] dark:text-white">
                KPI dictionary and governance reference
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Reference model used across all supplier scorecards.
              </p>
            </div>
            <Badge tone="blue">{filteredKpis.length} KPI definitions displayed</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1420px] divide-y divide-slate-200 text-sm dark:divide-white/10">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-4">KPI Name</th>
                  <th className="px-5 py-4">Group</th>
                  <th className="px-5 py-4">Definition</th>
                  <th className="px-5 py-4">Calculation Formula</th>
                  <th className="px-5 py-4">Data Owner</th>
                  <th className="px-5 py-4">Audience / Distribution</th>
                  <th className="px-5 py-4">Reaction Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {filteredKpis.map((kpi) => (
                  <tr
                    key={kpi.id}
                    className="align-top hover:bg-slate-50/70 dark:hover:bg-white/5"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#10233f] dark:text-white">
                        {kpi.kpiName}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <FileText className="h-3.5 w-3.5" /> {kpi.group}
                      </div>
                    </td>
                    <td className="max-w-xs px-5 py-4 leading-6 text-slate-600 dark:text-slate-300">
                      {kpi.definition}
                    </td>
                    <td className="max-w-sm px-5 py-4 font-mono text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {kpi.formula}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {kpi.dataOwner}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {kpi.audience}
                    </td>
                    <td className="max-w-md px-5 py-4 leading-6 text-slate-600 dark:text-slate-300">
                      {kpi.reactionPlan}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[20px] border border-emerald-200/80 bg-emerald-50/80 p-5 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
            <div className="flex items-center gap-3 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-300" />
              Within target
            </div>
            <p className="mt-2 text-sm leading-6">
              KPI portfolio is on target and operating within expected control
              thresholds.
            </p>
          </div>
          <div className="rounded-[20px] border border-amber-200/80 bg-amber-50/75 p-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="flex items-center gap-3 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-600 dark:bg-amber-300" />
              Watchlist
            </div>
            <p className="mt-2 text-sm leading-6">
              KPI portfolio is below target or trending negatively and should be
              followed with corrective action.
            </p>
          </div>
          <div className="rounded-[20px] border border-rose-200/80 bg-rose-50/75 p-5 text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
            <div className="flex items-center gap-3 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-600 dark:bg-rose-300" />
              Escalation
            </div>
            <p className="mt-2 text-sm leading-6">
              Critical KPI outcome requiring escalation, supplier review, or
              business restriction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
