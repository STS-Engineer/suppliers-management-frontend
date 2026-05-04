type PaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  compact?: boolean;
};

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  compact = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (value) =>
      value === 1 ||
      value === totalPages ||
      Math.abs(value - page) <= 1,
  );

  const visiblePages: Array<number | "ellipsis"> = [];
  for (const value of pages) {
    const previous = visiblePages[visiblePages.length - 1];
    if (typeof previous === "number" && value - previous > 1) {
      visiblePages.push("ellipsis");
    }
    visiblePages.push(value);
  }

  return (
    <div
      className={`border-t border-slate-200/70 pt-4 dark:border-white/10 ${
        compact
          ? "space-y-4"
          : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      }`}
    >
      <p className={`text-slate-500 dark:text-slate-300 ${compact ? "text-sm leading-7" : "text-sm"}`}>
        Showing {start}-{end} of {totalItems}
      </p>

      <div
        className={`flex items-center gap-2 ${
          compact ? "flex-wrap" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`inline-flex items-center rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-[#0f2744] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 ${
            compact ? "h-9 px-3.5" : "h-10 px-4"
          }`}
        >
          Previous
        </button>

        <div className={`flex items-center gap-2 ${compact ? "min-w-0 flex-wrap" : ""}`}>
          {visiblePages.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className={`text-slate-400 dark:text-slate-500 ${compact ? "px-0.5 text-xs" : "px-1 text-sm"}`}
              >
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`inline-flex items-center justify-center rounded-2xl border font-semibold transition ${
                  item === page
                    ? "border-[#0f2744] bg-[#0f2744] text-white shadow-[0_14px_24px_rgba(15,39,68,0.24)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-[#0f2744] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200"
                } ${compact ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm"}`}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`inline-flex items-center rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-[#0f2744] disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200 ${
            compact ? "h-9 px-3.5" : "h-10 px-4"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
