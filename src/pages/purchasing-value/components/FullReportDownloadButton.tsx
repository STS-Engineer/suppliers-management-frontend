import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import supplierAPI from "../../../services/supplierOnboardingAPI";

export function FullReportDownloadButton({
  opportunityId,
  oppName,
}: {
  opportunityId: number;
  oppName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(false);
    try {
      await supplierAPI.downloadFullReportPdf(
        opportunityId,
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
      title="Download Full Opportunity Report PDF"
      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-semibold transition-colors disabled:opacity-60 ${
        error
          ? "border-red-300 bg-red-50 text-red-600"
          : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
      }`}
    >
      {loading ? (
        <RefreshCw size={11} className="animate-spin" />
      ) : (
        <Download size={11} />
      )}
      Full Report
    </button>
  );
}
