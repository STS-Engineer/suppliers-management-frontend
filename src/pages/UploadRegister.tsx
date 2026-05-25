import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Database,
  Download,
  Filter,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";

type DatasetKey = "delivery_spend" | "quality_claims" | "otd_monthly";
type ValidationStatus =
  | "pending"
  | "uploaded"
  | "checked"
  | "approved"
  | "rejected";
type TimelinessFlag = "on_time" | "late" | "missing";
type QualityStatus = "ok" | "not_ok" | "warning" | "skipped";
type PlantReviewStatus = "ok" | "nok" | "na";

type UploadRegisterRow = {
  id: string;
  reportingPeriod: string;
  plant: string;
  dataset: DatasetKey;
  ownerFunction: string;
  contact: string;
  dueDate: string;
  uploadDate?: string;
  filename?: string;
  rowsLoaded: number;
  errors: number;
  warnings: number;
  validationStatus: ValidationStatus;
  plantApproval: "pending" | "go" | "no_go" | "conditional_go";
  timelinessFlag: TimelinessFlag;
  comments?: string;
};

type DataQualityCheckRow = {
  id: string;
  uploadRegisterId: string;
  dataset: DatasetKey;
  plant: string;
  supplierId?: string;
  supplierName?: string;
  rowNumber?: number;
  ruleName: string;
  formulaDescription: string;
  computedValue: string;
  target: string;
  status: QualityStatus;
  errorDetail?: string;
};

type ExtractedRow = Record<string, unknown>;

type DatasetSchema = {
  label: string;
  sheetName: string;
  requiredColumns: string[];
  optionalColumns?: string[];
};

type PlantReviewChecklistRow = {
  id: string;
  section: string;
  checkpoint: string;
  status: PlantReviewStatus;
  owner: string;
  comments?: string;
  dueDate?: string;
  plant: string;
  reportingPeriod: string;
};

const datasetSchemas: Record<DatasetKey, DatasetSchema> = {
  delivery_spend: {
    label: "Delivery Spend",
    sheetName: "Input_Delivery_Spend",
    requiredColumns: [
      "Part Reference",
      "Description",
      "Delivery Date (YYYY-MM-DD)",
      "Quantity",
      "Purchase Price at Delivery",
      "Currency",
      "Supplier ID",
      "Supplier Name",
      "Bad parts",
      "Plant",
    ],
  },
  quality_claims: {
    label: "Quality Claims",
    sheetName: "Input_Quality_Claims",
    requiredColumns: [
      "(Claimed) Part Reference",
      "Claim Number",
      "Claim Opening Date (YYYY-MM-DD)",
      "Claim Status (Open/Closed)",
      "Supplier ID",
      "Supplier Name",
    ],
    optionalColumns: [
      "Claim Closing Date (YYYY-MM-DD, if closed)",
      "Comments (optional)",
    ],
  },
  otd_monthly: {
    label: "OTD Monthly",
    sheetName: "Input_OTD_Monthly",
    requiredColumns: [
      "Supplier ID",
      "Supplier Name",
      "Month (YYYY-MM)",
      "OTD %",
      "Plant",
    ],
    optionalColumns: ["Comments (optional)"],
  },
};

const datasetLabels: Record<DatasetKey, string> = Object.fromEntries(
  Object.entries(datasetSchemas).map(([key, schema]) => [key, schema.label]),
) as Record<DatasetKey, string>;

const workbookRules = [
  "Supplier ID is mandatory",
  "Supplier Name must align with Supplier Master",
  "Dates must use ISO format",
  "OTD must stay between 0% and 100%",
  "Closed claims require a closing date",
  "Delivery spend rows require plant and positive purchase price",
];

const initialUploads: UploadRegisterRow[] = [
  {
    id: "UP-2026Q1-001",
    reportingPeriod: "2026-Q1",
    plant: "Sceet",
    dataset: "otd_monthly",
    ownerFunction: "Logistics",
    contact: "logistics.sceet@avocarbon.com",
    dueDate: "2026-04-05",
    uploadDate: "2026-04-04T09:12:00",
    filename: "OTD_Sceet_2026_Q1.xlsx",
    rowsLoaded: 128,
    errors: 0,
    warnings: 2,
    validationStatus: "checked",
    plantApproval: "pending",
    timelinessFlag: "on_time",
    comments: "Ready for plant review.",
  },
  {
    id: "UP-2026Q1-002",
    reportingPeriod: "2026-Q1",
    plant: "Kunshan",
    dataset: "quality_claims",
    ownerFunction: "Quality",
    contact: "quality.kunshan@avocarbon.com",
    dueDate: "2026-04-05",
    uploadDate: "2026-04-08T15:30:00",
    filename: "Claims_Kunshan_Q1.xlsx",
    rowsLoaded: 64,
    errors: 3,
    warnings: 1,
    validationStatus: "rejected",
    plantApproval: "pending",
    timelinessFlag: "late",
    comments: "Closed claims without closing date.",
  },
  {
    id: "UP-2026Q1-003",
    reportingPeriod: "2026-Q1",
    plant: "Monterrey",
    dataset: "delivery_spend",
    ownerFunction: "Purchasing / Logistics",
    contact: "buyer.monterrey@avocarbon.com",
    dueDate: "2026-04-05",
    rowsLoaded: 0,
    errors: 0,
    warnings: 0,
    validationStatus: "pending",
    plantApproval: "pending",
    timelinessFlag: "missing",
    comments: "Waiting for upload.",
  },
];

const initialChecks: DataQualityCheckRow[] = [
  {
    id: "DQC-001",
    uploadRegisterId: "UP-2026Q1-001",
    dataset: "otd_monthly",
    plant: "Sceet",
    ruleName: "rows_loaded_gt_zero",
    formulaDescription: "Uploaded file must contain at least one row.",
    computedValue: "128",
    target: "> 0",
    status: "ok",
  },
  {
    id: "DQC-002",
    uploadRegisterId: "UP-2026Q1-001",
    dataset: "otd_monthly",
    plant: "Sceet",
    supplierId: "SUP-0091",
    supplierName: "TDK",
    rowNumber: 45,
    ruleName: "otd_values_between_0_and_100",
    formulaDescription: "OTD percent must be between 0 and 100.",
    computedValue: "100.4",
    target: "0..100",
    status: "warning",
    errorDetail: "Value will require business confirmation.",
  },
  {
    id: "DQC-003",
    uploadRegisterId: "UP-2026Q1-002",
    dataset: "quality_claims",
    plant: "Kunshan",
    supplierId: "SUP-0310",
    supplierName: "Xinjia",
    rowNumber: 12,
    ruleName: "closed_claims_have_closing_date",
    formulaDescription:
      "If claim_status = Closed, claim_closing_date is mandatory.",
    computedValue: "Closed / empty closing date",
    target: "closing date not empty",
    status: "not_ok",
    errorDetail: "Claim is closed but no closing date is provided.",
  },
  {
    id: "DQC-004",
    uploadRegisterId: "UP-2026Q1-002",
    dataset: "quality_claims",
    plant: "Kunshan",
    rowNumber: 18,
    ruleName: "all_rows_have_supplier_id",
    formulaDescription:
      "Every uploaded row must have a supplier_id matching Supplier Master.",
    computedValue: "empty",
    target: "not empty",
    status: "not_ok",
    errorDetail: "Supplier ID is missing.",
  },
];

const initialPlantReviewChecklist: PlantReviewChecklistRow[] = [
  {
    id: "PR-001",
    section: "General",
    checkpoint: "Reporting period identified and supplier list attached",
    status: "ok",
    owner: "Plant",
    comments: "2026-Q1 scope confirmed and supplier list attached.",
    dueDate: "2026-04-05",
    plant: "Sceet",
    reportingPeriod: "2026-Q1",
  },
  {
    id: "PR-002",
    section: "General",
    checkpoint: "Scorecard Owner identified (Group/Local buyer)",
    status: "ok",
    owner: "Purchasing",
    comments: "Owner assigned for scorecard release.",
    dueDate: "2026-04-05",
    plant: "Sceet",
    reportingPeriod: "2026-Q1",
  },
  {
    id: "PR-003",
    section: "Delivery/Spend",
    checkpoint: "Dataset complete for the period (no gaps)",
    status: "nok",
    owner: "Logistics",
    comments: "Monterrey delivery-spend file still missing.",
    dueDate: "2026-04-05",
    plant: "Monterrey",
    reportingPeriod: "2026-Q1",
  },
  {
    id: "PR-004",
    section: "Delivery/Spend",
    checkpoint: "Mandatory columns present and format compliant",
    status: "ok",
    owner: "IT / Data Management",
    comments: "Format checked against template.",
    dueDate: "2026-04-05",
    plant: "Sceet",
    reportingPeriod: "2026-Q1",
  },
  {
    id: "PR-005",
    section: "Quality Claims",
    checkpoint: "Closed claims have closing dates",
    status: "nok",
    owner: "Quality",
    comments: "One supplier file contains closed claims without closing date.",
    dueDate: "2026-04-08",
    plant: "Kunshan",
    reportingPeriod: "2026-Q1",
  },
  {
    id: "PR-006",
    section: "OTD",
    checkpoint: "OTD values within 0-100%",
    status: "ok",
    owner: "Logistics",
    comments: "Range checks completed successfully.",
    dueDate: "2026-04-05",
    plant: "Sceet",
    reportingPeriod: "2026-Q1",
  },
  {
    id: "PR-007",
    section: "Final",
    checkpoint: "Data validated for scorecard generation (GO / NO GO)",
    status: "na",
    owner: "Plant Manager",
    comments: "Waiting on final Monterrey submission.",
    dueDate: "2026-04-09",
    plant: "Monterrey",
    reportingPeriod: "2026-Q1",
  },
];

const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const datasetColumnKeys: Record<
  DatasetKey,
  { required: Array<{ label: string; key: string }>; optional: Array<{ label: string; key: string }> }
> = Object.fromEntries(
  Object.entries(datasetSchemas).map(([datasetKey, schema]) => [
    datasetKey,
    {
      required: schema.requiredColumns.map((label) => ({
        label,
        key: normalizeKey(label),
      })),
      optional: (schema.optionalColumns ?? []).map((label) => ({
        label,
        key: normalizeKey(label),
      })),
    },
  ]),
) as Record<
  DatasetKey,
  { required: Array<{ label: string; key: string }>; optional: Array<{ label: string; key: string }> }
>;

const isIsoDate = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

const isIsoMonth = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}$/.test(value.trim());

const readSpreadsheetFile = async (file: File): Promise<ExtractedRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeKey(key), value]),
    ),
  );
};

const getStatusTone = (
  status: ValidationStatus | QualityStatus | TimelinessFlag,
) => {
  if (["approved", "checked", "ok", "on_time"].includes(status)) return "green";
  if (["uploaded", "warning", "late"].includes(status)) return "amber";
  if (["rejected", "not_ok", "missing"].includes(status)) return "red";
  return "slate";
};

const surfaceClass =
  "rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(245,249,253,0.96))] shadow-[0_22px_50px_rgba(15,23,42,.08)] backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.74),rgba(10,18,30,.84))]";

const tableShellClass =
  "overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-[0_22px_50px_rgba(15,23,42,.08)] dark:border-white/10 dark:bg-slate-950/50";

const inputClass =
  "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-sky-500/60 dark:focus:ring-sky-500/10";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f2744] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,39,68,.22)] transition hover:-translate-y-0.5 hover:bg-[#15406e] dark:bg-sky-500 dark:text-[#08111d] dark:hover:bg-sky-400";

const secondaryButtonClass =
  "inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-[#0f2744] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-sky-500/40 dark:hover:text-sky-200";

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "red" | "blue" | "slate";
}) {
  const map = {
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
        map[tone],
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
  const shell = {
    blue: "border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fa_100%)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.82),rgba(10,18,30,.9))]",
    green:
      "border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f1f8f4_100%)] dark:border-emerald-400/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.82),rgba(6,78,59,.22))]",
    amber:
      "border-amber-100 bg-[linear-gradient(180deg,#ffffff_0%,#faf4eb_100%)] dark:border-amber-400/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.82),rgba(120,53,15,.22))]",
    red: "border-rose-100 bg-[linear-gradient(180deg,#ffffff_0%,#faf0f0_100%)] dark:border-rose-400/20 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.82),rgba(127,29,29,.22))]",
  } as const;

  const accent = {
    blue: "bg-[#173a5c]",
    green: "bg-[#1f8a5b]",
    amber: "bg-[#b7791f]",
    red: "bg-[#c24141]",
  } as const;

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[20px] border px-5 py-4 shadow-[0_14px_30px_rgba(15,23,42,.05)]",
        shell[tone],
      )}
    >
      <div className={cx("mb-4 h-1.5 w-14 rounded-full", accent[tone])} />
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
        <p className="mt-4 border-t border-slate-200/80 pt-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function PageShell({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-sky-200/50 bg-[linear-gradient(135deg,#0f2744_0%,#15406e_55%,#2f6fed_100%)] p-6 text-white shadow-[0_28px_60px_rgba(15,39,68,.24)] dark:border-sky-500/20 dark:bg-[linear-gradient(135deg,#08111d_0%,#0f2744_48%,#1f5fbf_100%)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100/65">
              Supplier Performance Workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-100/80">
              {subtitle}
            </p>
          </div>
          {action}
        </div>
      </section>
      {children}
    </div>
  );
}

function Toolbar({
  search,
  setSearch,
  dataset,
  setDataset,
  plant,
  setPlant,
}: {
  search: string;
  setSearch: (value: string) => void;
  dataset: "all" | DatasetKey;
  setDataset: (value: "all" | DatasetKey) => void;
  plant: string;
  setPlant: (value: string) => void;
}) {
  return (
    <div className={`${surfaceClass} flex flex-col gap-3 p-4 lg:flex-row lg:items-center`}>
      <label className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <Search className="h-4 w-4" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by plant, dataset, owner, supplier, rule..."
          className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
      </label>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
        <Filter className="h-4 w-4" />
        <select
          value={dataset}
          onChange={(event) =>
            setDataset(event.target.value as "all" | DatasetKey)
          }
          className="bg-transparent text-slate-700 outline-none dark:text-slate-100"
        >
          <option value="all">All datasets</option>
          {Object.entries(datasetLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <select
        value={plant}
        onChange={(event) => setPlant(event.target.value)}
        className={inputClass}
      >
        <option value="all">All plants</option>
        <option value="Sceet">Sceet</option>
        <option value="Kunshan">Kunshan</option>
        <option value="Monterrey">Monterrey</option>
      </select>
    </div>
  );
}

function UploadSimulationPanel({
  onUpload,
}: {
  onUpload: (payload: {
    file: File;
    dataset: DatasetKey;
    plant: string;
    rows: ExtractedRow[];
    checks: DataQualityCheckRow[];
  }) => void;
}) {
  const [dataset, setDataset] = useState<DatasetKey>("otd_monthly");
  const [plant, setPlant] = useState("Sceet");
  const [isReading, setIsReading] = useState(false);
  const [preview, setPreview] = useState<ExtractedRow[]>([]);
  const [fileName, setFileName] = useState<string>();

  const validateRows = (
    rows: ExtractedRow[],
    uploadId: string,
  ): DataQualityCheckRow[] => {
    const checks: DataQualityCheckRow[] = [];
    const schema = datasetColumnKeys[dataset];
    checks.push({
      id: `${uploadId}-rows-loaded`,
      uploadRegisterId: uploadId,
      dataset,
      plant,
      ruleName: "rows_loaded_gt_zero",
      formulaDescription: "Uploaded file must contain at least one row.",
      computedValue: String(rows.length),
      target: "> 0",
      status: rows.length > 0 ? "ok" : "not_ok",
      errorDetail: rows.length > 0 ? undefined : "The uploaded file is empty.",
    });

    rows.forEach((row, index) => {
      schema.required.forEach((column) => {
        if (
          row[column.key] === undefined ||
          row[column.key] === null ||
          String(row[column.key]).trim() === ""
        ) {
          checks.push({
            id: `${uploadId}-${index}-${column.key}`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: `required_${column.key}`,
            formulaDescription: `${column.label} is mandatory for ${datasetLabels[dataset]}.`,
            computedValue: "empty",
            target: "not empty",
            status: "not_ok",
            errorDetail: `Missing mandatory column value: ${column.label}.`,
          });
        }
      });

      if (
        dataset !== "otd_monthly" &&
        row.supplier_id !== undefined &&
        String(row.supplier_id).trim() === ""
      ) {
        checks.push({
          id: `${uploadId}-${index}-supplier-id-empty`,
          uploadRegisterId: uploadId,
          dataset,
          plant,
          supplierId: "",
          supplierName: String(row.supplier_name ?? ""),
          rowNumber: index + 2,
          ruleName: "rows_without_supplier_id",
          formulaDescription: "Supplier ID is mandatory in all source files.",
          computedValue: "empty",
          target: "0 missing rows",
          status: "not_ok",
          errorDetail: "Workbook rule: Supplier ID is required.",
        });
      }

      if (dataset === "delivery_spend") {
        const deliveryDate = String(row.delivery_date_yyyy_mm_dd ?? "").trim();
        const purchasePrice = Number(row.purchase_price_at_delivery ?? "");
        const hasPlant = String(row.plant ?? "").trim() !== "";

        if (!hasPlant) {
          checks.push({
            id: `${uploadId}-${index}-plant-required`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: "rows_without_plant",
            formulaDescription: "Delivery spend rows must contain a plant value.",
            computedValue: "empty",
            target: "0 missing rows",
            status: "not_ok",
            errorDetail: "Plant is required in Input_Delivery_Spend.",
          });
        }

        if (deliveryDate && !isIsoDate(deliveryDate)) {
          checks.push({
            id: `${uploadId}-${index}-delivery-date-format`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: "delivery_date_iso_format",
            formulaDescription: "Delivery Date must use YYYY-MM-DD format.",
            computedValue: deliveryDate,
            target: "YYYY-MM-DD",
            status: "not_ok",
            errorDetail: "Workbook rule: dates must use ISO format.",
          });
        }

        if (!Number.isNaN(purchasePrice) && purchasePrice <= 0) {
          checks.push({
            id: `${uploadId}-${index}-purchase-price-positive`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: "purchase_price_positive",
            formulaDescription:
              "Purchase prices must be positive and non-zero.",
            computedValue: String(row.purchase_price_at_delivery ?? ""),
            target: "> 0",
            status: "not_ok",
            errorDetail: "Workbook checklist requires valid purchase prices.",
          });
        }
      }

      if (dataset === "otd_monthly") {
        const month = String(row.month_yyyy_mm ?? "").trim();
        const value = Number(row.otd_percent);

        if (month && !isIsoMonth(month)) {
          checks.push({
            id: `${uploadId}-${index}-otd-month-format`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: "month_iso_format",
            formulaDescription: "Month must use YYYY-MM format.",
            computedValue: month,
            target: "YYYY-MM",
            status: "not_ok",
            errorDetail: "Workbook rule: month must be provided in ISO month format.",
          });
        }

        if (!Number.isNaN(value) && (value < 0 || value > 100)) {
          checks.push({
            id: `${uploadId}-${index}-otd-range`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: "otd_values_between_0_and_100",
            formulaDescription: "OTD percent must be between 0 and 100.",
            computedValue: String(row.otd_percent),
            target: "0..100",
            status: "not_ok",
            errorDetail: "OTD value is outside accepted range.",
          });
        }
      }

      if (dataset === "quality_claims") {
        const openingDate = String(
          row.claim_opening_date_yyyy_mm_dd ?? "",
        ).trim();
        const closingDate = String(
          row.claim_closing_date_yyyy_mm_dd_if_closed ?? "",
        ).trim();
        const isClosed =
          String(row.claim_status ?? "").toLowerCase() === "closed";
        const hasClosingDate = closingDate !== "";

        if (openingDate && !isIsoDate(openingDate)) {
          checks.push({
            id: `${uploadId}-${index}-claim-opening-date-format`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: "claim_opening_date_iso_format",
            formulaDescription: "Claim opening date must use YYYY-MM-DD format.",
            computedValue: openingDate,
            target: "YYYY-MM-DD",
            status: "not_ok",
            errorDetail: "Workbook rule: dates must use ISO format.",
          });
        }

        if (closingDate && !isIsoDate(closingDate)) {
          checks.push({
            id: `${uploadId}-${index}-claim-closing-date-format`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: "claim_closing_date_iso_format",
            formulaDescription: "Claim closing date must use YYYY-MM-DD format.",
            computedValue: closingDate,
            target: "YYYY-MM-DD",
            status: "not_ok",
            errorDetail: "Workbook rule: dates must use ISO format.",
          });
        }

        if (isClosed && !hasClosingDate) {
          checks.push({
            id: `${uploadId}-${index}-claim-closing-date`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: "closed_claims_have_closing_date",
            formulaDescription: "Closed claims must have a closing date.",
            computedValue: "Closed / empty closing date",
            target: "closing date not empty",
            status: "not_ok",
            errorDetail: "Claim is closed but no closing date is provided.",
          });
        }

        if (
          String(row.claim_number ?? "").trim() !== "" &&
          rows.filter(
            (candidate) =>
              String(candidate.claim_number ?? "").trim() ===
              String(row.claim_number ?? "").trim(),
          ).length > 1
        ) {
          checks.push({
            id: `${uploadId}-${index}-duplicate-claim-number`,
            uploadRegisterId: uploadId,
            dataset,
            plant,
            supplierId: String(row.supplier_id ?? ""),
            supplierName: String(row.supplier_name ?? ""),
            rowNumber: index + 2,
            ruleName: "unique_claim_numbers",
            formulaDescription: "Claim numbers should be unique within the file.",
            computedValue: String(row.claim_number ?? ""),
            target: "unique",
            status: "warning",
            errorDetail: "Plant review checklist requests duplicate claim number verification.",
          });
        }
      }
    });

    return checks;
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setIsReading(true);
    setFileName(file.name);
    try {
      const rows = await readSpreadsheetFile(file);
      setPreview(rows.slice(0, 5));
      const uploadId = `UP-MOCK-${Date.now()}`;
      const checks = validateRows(rows, uploadId);
      const expectedDatasetName = datasetSchemas[dataset].label.replace(/\s+/g, "");
      const namingRule =
        /^\d{4}_(Q[1-4]|H[12]|YTD)_[A-Za-z0-9]+_[A-Za-z0-9]+\.xlsx$/i;

      if (!namingRule.test(file.name)) {
        checks.push({
          id: `${uploadId}-file-naming`,
          uploadRegisterId: uploadId,
          dataset,
          plant,
          ruleName: "file_naming_convention",
          formulaDescription:
            "Workbook convention: YYYY_Period_Plant_Dataset.xlsx",
          computedValue: file.name,
          target: `2026_Q1_${plant}_${expectedDatasetName}.xlsx`,
          status: "warning",
          errorDetail:
            "File name does not follow the workbook naming convention from the ReadMe sheet.",
        });
      }

      onUpload({ file, dataset, plant, rows, checks });
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className={`${surfaceClass} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#10233f] dark:text-white">
            Plant submission intake
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Use the workbook-aligned template for one plant and one dataset at a
            time. Files are parsed locally for structure and rule compliance.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <select
          value={dataset}
          onChange={(event) => setDataset(event.target.value as DatasetKey)}
          className={inputClass}
        >
          {Object.entries(datasetLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={plant}
          onChange={(event) => setPlant(event.target.value)}
          className={inputClass}
        >
          <option>Sceet</option>
          <option>Kunshan</option>
          <option>Monterrey</option>
        </select>
        <label className={`${primaryButtonClass} cursor-pointer`}>
          <Upload className="h-4 w-4" />
          {isReading ? "Reading..." : "Choose Excel / CSV"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>
      </div>

      <div className="mt-5 rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,#f8fbfd,#eef4f8)] p-4 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,.58),rgba(15,23,42,.32))]">
        <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
          <span>
            Expected columns: {datasetSchemas[dataset].requiredColumns.join(", ")}
          </span>
          <span className="font-semibold text-[#10233f] dark:text-slate-100">
            {fileName ?? "No file selected"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {workbookRules.map((rule) => (
            <Badge key={rule} tone="slate">
              {rule}
            </Badge>
          ))}
        </div>
      </div>

      {preview.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-[26px] border border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-slate-950/40">
          <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
            First extracted rows
          </div>
          <pre className="max-h-60 overflow-auto bg-white/80 p-4 text-xs text-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export function DataCollectionCenterPage() {
  const [uploads, setUploads] = useState(initialUploads);
  const [qualityChecks, setQualityChecks] = useState(initialChecks);
  const [search, setSearch] = useState("");
  const [dataset, setDataset] = useState<"all" | DatasetKey>("all");
  const [plant, setPlant] = useState("all");

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return uploads.filter((row) => {
      const matchesDataset = dataset === "all" || row.dataset === dataset;
      const matchesPlant = plant === "all" || row.plant === plant;
      const haystack = [
        row.reportingPeriod,
        row.plant,
        datasetLabels[row.dataset],
        row.ownerFunction,
        row.contact,
        row.filename,
        row.validationStatus,
        row.comments,
      ]
        .join(" ")
        .toLowerCase();
      return (
        matchesDataset && matchesPlant && (!text || haystack.includes(text))
      );
    });
  }, [uploads, search, dataset, plant]);

  const stats = useMemo(() => {
    const total = uploads.length;
    const received = uploads.filter(
      (row) => row.validationStatus !== "pending",
    ).length;
    const late = uploads.filter(
      (row) =>
        row.timelinessFlag === "late" || row.timelinessFlag === "missing",
    ).length;
    const errors = uploads.reduce((sum, row) => sum + row.errors, 0);
    return { total, received, late, errors };
  }, [uploads]);

  const plantSummary =
    plant === "all"
      ? "Compare submission readiness across all plants, identify missing files, and confirm which owner function is accountable before scorecard consolidation."
      : `${plant} view highlights the upload status, accountable function, and submission timing for that plant before validation and plant review.`;

  const handleUpload = ({
    file,
    dataset,
    plant,
    rows,
    checks,
  }: {
    file: File;
    dataset: DatasetKey;
    plant: string;
    rows: ExtractedRow[];
    checks: DataQualityCheckRow[];
  }) => {
    const errorCount = checks.filter(
      (check) => check.status === "not_ok",
    ).length;
    const warningCount = checks.filter(
      (check) => check.status === "warning",
    ).length;
    const uploadId = checks[0]?.uploadRegisterId ?? `UP-MOCK-${Date.now()}`;

    setUploads((current) => [
      {
        id: uploadId,
        reportingPeriod: "2026-Q1",
        plant,
        dataset,
        ownerFunction:
          dataset === "quality_claims"
            ? "Quality"
            : dataset === "otd_monthly"
              ? "Logistics"
              : "Purchasing / Logistics",
        contact: "front.demo@avocarbon.com",
        dueDate: "2026-04-05",
        uploadDate: new Date().toISOString(),
        filename: file.name,
        rowsLoaded: rows.length,
        errors: errorCount,
        warnings: warningCount,
        validationStatus: errorCount > 0 ? "rejected" : "checked",
        plantApproval: "pending",
        timelinessFlag: "on_time",
        comments:
          errorCount > 0
            ? "Rejected by local validation rules."
            : "Extracted and checked locally.",
      },
      ...current,
    ]);
    setQualityChecks((current) => [...checks, ...current]);
  };

  return (
    <PageShell
      title="Data Collection Center"
      subtitle="Register incoming workbook files by plant, confirm dataset ownership, and control submission completeness before technical validation starts."
      action={
        <Link
          to="/data-quality"
          className={primaryButtonClass}
        >
          <ShieldCheck className="h-4 w-4" /> Open Data Quality
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <ResponsibilityCard
          title="Page Responsibility"
          tone="blue"
          body="This page is for collection control. Plant teams and functional owners use it to submit the expected files, confirm contact ownership, and make missing or late datasets visible early."
        />
        <PlantFocusPanel plant={plant} summary={plantSummary} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Expected uploads"
          value={stats.total}
          helper="Generated per period / plant / dataset"
          detail="Submission scope"
        />
        <StatCard
          label="Received"
          value={`${Math.round((stats.received / Math.max(stats.total, 1)) * 100)}%`}
          helper={`${stats.received}/${stats.total} datasets uploaded`}
          tone="green"
          detail="Collection progress"
        />
        <StatCard
          label="Late or missing"
          value={stats.late}
          helper="Requires follow-up"
          tone="amber"
          detail="Escalation queue"
        />
        <StatCard
          label="Open errors"
          value={stats.errors}
          helper="Blocking checks"
          tone={stats.errors > 0 ? "red" : "green"}
          detail="Validation control"
        />
      </div>

      <UploadSimulationPanel onUpload={handleUpload} />
      <Toolbar
        search={search}
        setSearch={setSearch}
        dataset={dataset}
        setDataset={setDataset}
        plant={plant}
        setPlant={setPlant}
      />

      <div className={tableShellClass}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-[#10233f] dark:text-white">
              Plant submission register
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              One line per reporting period, plant, and dataset submission.
            </p>
          </div>
          <button className={secondaryButtonClass}>
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <tr>
                {[
                  "Period",
                  "Plant",
                  "Dataset",
                  "Owner",
                  "Due date",
                  "Upload",
                  "Rows",
                  "Errors",
                  "Status",
                  "Timing",
                  "Approval",
                ].map((header) => (
                  <th key={header} className="px-5 py-4">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-white/5"
                >
                  <td className="px-5 py-4 font-semibold text-[#10233f] dark:text-white">
                    {row.reportingPeriod}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.plant}
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone="blue">{datasetLabels[row.dataset]}</Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.ownerFunction}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.dueDate}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.filename ?? "-"}
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#10233f] dark:text-white">
                    {row.rowsLoaded}
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#10233f] dark:text-white">
                    {row.errors}
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={getStatusTone(row.validationStatus)}>
                      {row.validationStatus}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={getStatusTone(row.timelinessFlag)}>
                      {row.timelinessFlag}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      tone={
                        row.plantApproval === "go"
                          ? "green"
                          : row.plantApproval === "no_go"
                            ? "red"
                            : "slate"
                      }
                    >
                      {row.plantApproval}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}

export function DataQualityCenterPage() {
  const [checks] = useState(initialChecks);
  const [search, setSearch] = useState("");
  const [dataset, setDataset] = useState<"all" | DatasetKey>("all");
  const [plant, setPlant] = useState("all");
  const [status, setStatus] = useState<"all" | QualityStatus>("all");

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return checks.filter((row) => {
      const matchesDataset = dataset === "all" || row.dataset === dataset;
      const matchesPlant = plant === "all" || row.plant === plant;
      const matchesStatus = status === "all" || row.status === status;
      const haystack = [
        datasetLabels[row.dataset],
        row.plant,
        row.supplierId,
        row.supplierName,
        row.ruleName,
        row.formulaDescription,
        row.errorDetail,
      ]
        .join(" ")
        .toLowerCase();
      return (
        matchesDataset &&
        matchesPlant &&
        matchesStatus &&
        (!text || haystack.includes(text))
      );
    });
  }, [checks, search, dataset, plant, status]);

  const totals = useMemo(
    () => ({
      ok: checks.filter((row) => row.status === "ok").length,
      warning: checks.filter((row) => row.status === "warning").length,
      notOk: checks.filter((row) => row.status === "not_ok").length,
      skipped: checks.filter((row) => row.status === "skipped").length,
    }),
    [checks],
  );

  return (
    <PageShell
      title="Data Quality Center"
      subtitle="Review blocking errors, warnings, rule results, and row-level details before accepting data into the future database tables."
      action={
        <Link
          to="/data-collection"
          className={primaryButtonClass}
        >
          <Database className="h-4 w-4" /> Data Collection
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Checks OK"
          value={totals.ok}
          helper="Rules passed"
          tone="green"
          detail="Accepted results"
        />
        <StatCard
          label="Warnings"
          value={totals.warning}
          helper="Need confirmation"
          tone="amber"
          detail="Review required"
        />
        <StatCard
          label="Blocking errors"
          value={totals.notOk}
          helper="Must be corrected"
          tone="red"
          detail="Correction backlog"
        />
        <StatCard
          label="Skipped"
          value={totals.skipped}
          helper="Not applicable rules"
          detail="Rule coverage"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex-1">
          <Toolbar
            search={search}
            setSearch={setSearch}
            dataset={dataset}
            setDataset={setDataset}
            plant={plant}
            setPlant={setPlant}
          />
        </div>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as "all" | QualityStatus)
          }
          className={inputClass}
        >
          <option value="all">All statuses</option>
          <option value="ok">OK</option>
          <option value="warning">Warning</option>
          <option value="not_ok">Not OK</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      <div className={tableShellClass}>
        <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-[#10233f] dark:text-white">
            Rule results
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Row-level validation results generated from local extraction or mock
            data.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <tr>
                {[
                  "Status",
                  "Dataset",
                  "Plant",
                  "Row",
                  "Supplier",
                  "Rule",
                  "Computed",
                  "Target",
                  "Detail",
                ].map((header) => (
                  <th key={header} className="px-5 py-4">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-white/5"
                >
                  <td className="px-5 py-4">
                    <Badge tone={getStatusTone(row.status)}>{row.status}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone="blue">{datasetLabels[row.dataset]}</Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.plant}
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#10233f] dark:text-white">
                    {row.rowNumber ?? "-"}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.supplierId
                      ? `${row.supplierId} - ${row.supplierName ?? ""}`
                      : "-"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-[#10233f] dark:text-white">
                      {row.ruleName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {row.formulaDescription}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.computedValue}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.target}
                  </td>
                  <td className="max-w-xs px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.errorDetail ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}

function ResponsibilityCard({
  title,
  body,
  tone = "slate",
}: {
  title: string;
  body: string;
  tone?: "blue" | "green" | "amber" | "slate";
}) {
  const toneMap = {
    blue: "border-sky-200/70 bg-sky-50/70 dark:border-sky-400/20 dark:bg-sky-400/10",
    green:
      "border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-400/20 dark:bg-emerald-400/10",
    amber:
      "border-amber-200/70 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-400/10",
    slate:
      "border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/5",
  } as const;

  return (
    <div className={cx("rounded-[22px] border p-4", toneMap[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {body}
      </p>
    </div>
  );
}

function PlantFocusPanel({
  plant,
  summary,
}: {
  plant: string;
  summary: string;
}) {
  return (
    <div className={`${surfaceClass} p-4`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Plant Focus
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[#10233f] dark:text-white">
            {plant === "all" ? "Cross-plant monitoring" : `${plant} operational view`}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {summary}
          </p>
        </div>
        <Badge tone={plant === "all" ? "slate" : "blue"}>
          {plant === "all" ? "All plants" : plant}
        </Badge>
      </div>
    </div>
  );
}

export function PlantReviewChecklistPage() {
  const [checklist] = useState(initialPlantReviewChecklist);
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("all");
  const [status, setStatus] = useState<"all" | PlantReviewStatus>("all");

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return checklist.filter((row) => {
      const matchesPlant = plant === "all" || row.plant === plant;
      const matchesStatus = status === "all" || row.status === status;
      const haystack = [
        row.section,
        row.checkpoint,
        row.owner,
        row.comments,
        row.reportingPeriod,
      ]
        .join(" ")
        .toLowerCase();
      return matchesPlant && matchesStatus && (!text || haystack.includes(text));
    });
  }, [checklist, plant, status, search]);

  const totals = useMemo(
    () => ({
      ok: checklist.filter((row) => row.status === "ok").length,
      nok: checklist.filter((row) => row.status === "nok").length,
      na: checklist.filter((row) => row.status === "na").length,
    }),
    [checklist],
  );

  return (
    <PageShell
      title="Plant Review Checklist"
      subtitle="Track plant-level review checkpoints from the workbook before scorecard generation and approval."
      action={
        <Link to="/data-collection" className={primaryButtonClass}>
          <Database className="h-4 w-4" /> Back To Data Collection
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Checklist items"
          value={checklist.length}
          helper="Standard workbook review scope"
          detail="Plant control set"
        />
        <StatCard
          label="Checks OK"
          value={totals.ok}
          helper="Validated checkpoints"
          tone="green"
          detail="Ready state"
        />
        <StatCard
          label="Checks NOK"
          value={totals.nok}
          helper="Blocking issues to resolve"
          tone="red"
          detail="Action required"
        />
        <StatCard
          label="N/A"
          value={totals.na}
          helper="Not applicable checkpoints"
          tone="amber"
          detail="Scope exceptions"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <Search className="h-4 w-4" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search section, checkpoint, owner or evidence..."
            className="w-full bg-transparent outline-none"
          />
        </label>
        <select
          value={plant}
          onChange={(event) => setPlant(event.target.value)}
          className={inputClass}
        >
          <option value="all">All plants</option>
          <option value="Sceet">Sceet</option>
          <option value="Kunshan">Kunshan</option>
          <option value="Monterrey">Monterrey</option>
        </select>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as "all" | PlantReviewStatus)
          }
          className={inputClass}
        >
          <option value="all">All statuses</option>
          <option value="ok">OK</option>
          <option value="nok">NOK</option>
          <option value="na">N/A</option>
        </select>
      </div>

      <div className={tableShellClass}>
        <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <h2 className="text-lg font-semibold text-[#10233f] dark:text-white">
            Plant review checklist
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Based on the workbook checklist sections: General, Delivery/Spend,
            Quality Claims, OTD, and Final approval.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
              <tr>
                {[
                  "Section",
                  "Checkpoint",
                  "Status",
                  "Owner",
                  "Plant",
                  "Period",
                  "Due date",
                  "Comments / Evidence",
                ].map((header) => (
                  <th key={header} className="px-5 py-4">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5">
                  <td className="px-5 py-4">
                    <Badge tone="blue">{row.section}</Badge>
                  </td>
                  <td className="max-w-md px-5 py-4 font-semibold text-[#10233f] dark:text-white">
                    {row.checkpoint}
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      tone={
                        row.status === "ok"
                          ? "green"
                          : row.status === "nok"
                            ? "red"
                            : "slate"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.owner}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.plant}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.reportingPeriod}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.dueDate ?? "-"}
                  </td>
                  <td className="max-w-md px-5 py-4 text-slate-600 dark:text-slate-300">
                    {row.comments ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}

export default function SupplierDataRoutesDemo() {
  return <DataCollectionCenterPage />;
}
