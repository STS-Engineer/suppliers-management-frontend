/**
 * CommitteeProgressModal — shows CommitteeReviewPanel in a standalone modal.
 * Opened when clicking "Under Committee Revision" badge in the table.
 */
import CommitteeReviewPanel from "./CommitteeReviewPanel";

export default function CommitteeProgressModal({
  relationId,
  supplierName,
  supplierCode,
  siteName,
  isVpConversion,
  onClose,
  onReviewChange,
}: {
  relationId: number;
  supplierName: string;
  supplierCode: string;
  siteName: string;
  isVpConversion: boolean;
  onClose: () => void;
  onReviewChange?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-[0_20px_80px_rgba(2,6,23,0.4)] dark:bg-[#0d1929]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-[#0f2744] px-6 py-4 text-white">
          <div>
            <p className="text-sm font-bold">Committee Validation</p>
            <p className="text-xs text-slate-300">
              {supplierName} · {supplierCode} · {siteName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel */}
        <div className="p-5">
          <CommitteeReviewPanel
            relationId={relationId}
            isVpConversion={isVpConversion}
            onReviewChange={() => { onReviewChange?.(); }}
          />
        </div>
      </div>
    </div>
  );
}
