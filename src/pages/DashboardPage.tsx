import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  ShieldAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pagination } from "../components/common/Pagination";
import { KPI, PageIntro, SectionCard, StatusBadge } from "../components/UI";
import {
  classDistribution,
  dashboardMetrics,
  suppliers,
  trendData,
} from "../data/mockData";

const colors = ["#1f8a5b", "#24507a", "#b7791f", "#c24141"];
const PAGE_SIZE = 4;

export function DashboardPage() {
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [page, setPage] = useState(1);

  const groups = useMemo(
    () => ["all", ...Array.from(new Set(suppliers.map((supplier) => supplier.panel)))],
    [],
  );

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) =>
      selectedGroup === "all" ? true : supplier.panel === selectedGroup,
    );
  }, [selectedGroup]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE));
  const paginatedSuppliers = filteredSuppliers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const groupLabel = selectedGroup === "all" ? "All groups" : selectedGroup;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        eyebrow="Overview"
        title="Supplier Dashboard"
        description="Portfolio health at a glance — active relations, hold counts, class distribution and supplier spotlight."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPI
          label="Total suppliers"
          value={String(dashboardMetrics.totalSuppliers)}
          helper="Across all plants and panels"
        />
        <KPI
          label="Active suppliers"
          value={String(dashboardMetrics.activeSuppliers)}
          helper="Approved for regular business"
          tone="success"
        />
        <KPI
          label="On hold"
          value={String(dashboardMetrics.onHoldSuppliers)}
          helper="Blocked for new RFQ or awards"
          tone="danger"
        />
        <KPI
          label="Pending onboarding"
          value={String(dashboardMetrics.pendingOnboarding)}
          helper="Awaiting supplier or committee action"
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <SectionCard
          title="Performance trend"
          subtitle="Quality, logistics and service trend over the last 6 cycles"
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="#d6dee8" strokeDasharray="4 4" />
                <XAxis dataKey="month" stroke="#6c7b8f" />
                <YAxis domain={[50, 100]} stroke="#6c7b8f" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="quality"
                  stroke="#1f8a5b"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="logistics"
                  stroke="#24507a"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="service"
                  stroke="#b7791f"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Class distribution"
            subtitle="Current supplier classification"
          >
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classDistribution}>
                  <CartesianGrid stroke="#d6dee8" vertical={false} />
                  <XAxis dataKey="name" stroke="#6c7b8f" />
                  <YAxis stroke="#6c7b8f" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {classDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard
            title="Priority alerts"
            subtitle="Immediate actions required this week"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/55 px-4 py-3 text-sm text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
                <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                {dashboardMetrics.strategicCOrD} strategic suppliers are currently
                Class C/D
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/55 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                {dashboardMetrics.actionPlansOverdue} action plans are overdue or
                escalated to VP
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                <AlertTriangle className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                {dashboardMetrics.overridesPending} supplier override requests are
                pending VP decision
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Supplier spotlight"
        subtitle="Quick operational snapshot of key suppliers this week"
        action={
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-900/70">
            <Filter className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <select
              value={selectedGroup}
              onChange={(event) => {
                setSelectedGroup(event.target.value);
                setPage(1);
              }}
              className="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
            >
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group === "all" ? "All groups" : group}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80 text-sm dark:divide-white/10">
              <thead className="bg-slate-50/90 dark:bg-slate-900/70">
                <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-4 font-semibold">Supplier</th>
                  <th className="px-5 py-4 font-semibold">Owner</th>
                  <th className="px-5 py-4 font-semibold">Group</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold">Next review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white/90 dark:divide-white/10 dark:bg-slate-950/40">
                {paginatedSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="transition hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#10233f] dark:text-white">
                        {supplier.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {supplier.country} - {supplier.category}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {supplier.owner}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
                        {supplier.panel}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={supplier.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {supplier.nextReview}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={filteredSuppliers.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Spotlight filtered by <span className="font-semibold text-[#10233f] dark:text-white">{groupLabel}</span>.
        </div>
      </SectionCard>
    </div>
  );
}
