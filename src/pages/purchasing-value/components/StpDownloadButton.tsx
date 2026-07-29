import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";

export function StpDownloadButton({
  opportunityId,
  oppName,
  phase,
}: {
  opportunityId: number;
  oppName?: string;
  phase: 0 | 1;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(false);
    try {
      await supplierAPI.downloadStpPdf(
        opportunityId,
        phase,
        oppName ?? undefined,
      );
    } catch {
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={`Download STP Phase ${phase} PDF`}
      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-semibold transition-colors disabled:opacity-60 ${
        error
          ? "border-red-300 bg-red-50 text-red-600"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
      }`}
    >
      {loading ? (
        <RefreshCw size={11} className="animate-spin" />
      ) : (
        <Download size={11} />
      )}
      STP P{phase}
    </button>
  );
}
