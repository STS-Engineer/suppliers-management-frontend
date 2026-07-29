import { useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCircle2, RefreshCw } from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";

export function RemindModal({
  oppName,
  opportunityId,
  onClose,
  onSent,
}: {
  oppName: string;
  opportunityId: number;
  onClose: () => void;
  onSent?: (count: number) => void;
}) {
  const [phase, setPhase] = useState<"confirm" | "sending" | "sent" | "error">(
    "confirm",
  );
  const [count, setCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sending = phase === "sending";

  async function send() {
    setPhase("sending");
    setErrorMsg(null);
    try {
      const res = await supplierAPI.remindGateApproval(opportunityId);
      const n = (res?.count as number) ?? 0;
      setCount(n);
      setPhase("sent");
      onSent?.(n);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to send reminder.",
      );
      setPhase("error");
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={sending ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-white/[0.08] dark:bg-[#0f1e30]"
      >
        {phase === "sent" ? (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Reminder sent
                </h3>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">
                  {count > 0
                    ? `A reminder email was sent to ${count} pending approver${
                        count === 1 ? "" : "s"
                      }.`
                    : "Everyone has already recorded their decision — no reminders were sent."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                <Bell size={18} />
              </div>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Send reminder?
                </h3>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-500 dark:text-slate-400">
                  Re-send the approval link to approvers on{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {oppName}
                  </span>{" "}
                  who haven't voted yet. Anyone who already decided is skipped.
                </p>
              </div>
            </div>
            {phase === "error" && errorMsg && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
                {errorMsg}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={sending}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {sending && <RefreshCw size={12} className="animate-spin" />}
                {phase === "error"
                  ? "Retry"
                  : sending
                    ? "Sending…"
                    : "Send reminder"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Opportunity Card
// ---------------------------------------------------------------------------
