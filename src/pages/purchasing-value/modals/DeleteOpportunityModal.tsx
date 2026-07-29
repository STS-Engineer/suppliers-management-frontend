import { createPortal } from "react-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function DeleteOpportunityModal({
  oppName,
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  oppName: string;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-white/[0.08] dark:bg-[#0f1e30]"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Delete opportunity?
            </h3>
            <p className="mt-1 text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {oppName}
              </span>{" "}
              will be permanently removed from all views. This cannot be undone.
            </p>
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading && <RefreshCw size={12} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Reminder confirmation modal — confirm → send → clear result, no double-send
// ---------------------------------------------------------------------------
