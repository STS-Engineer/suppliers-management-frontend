import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle, KeyRound } from "lucide-react";
import supplierAPI, { SupplierApiError } from "../services/supplierOnboardingAPI";

const INPUT_CLS =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100";

const BTN_CLS =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f2744,#1b5d92)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,39,68,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_40px_rgba(15,39,68,0.28)] disabled:cursor-not-allowed disabled:opacity-65";

const LABEL_CLS =
  "mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400";

export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <PageShell>
        <InvalidLink />
      </PageShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await supplierAPI.activateAccount({ token, new_password: newPassword });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof SupplierApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell>
      {success ? (
        <SuccessState />
      ) : (
        <>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100">
              <KeyRound className="h-6 w-6 text-sky-600" />
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.3em] text-[#6d89a4]">
              Account Activation
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#10233f]">
              Set your password
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Your account has been approved. Choose a password to complete your
              registration.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className={LABEL_CLS}>Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={INPUT_CLS}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </div>

            <div>
              <label className={LABEL_CLS}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INPUT_CLS}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {error}
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className={BTN_CLS}>
              {isSubmitting ? "Activating…" : "Activate account"}
            </button>
          </form>
        </>
      )}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7fbff_0,#e8f0f8_40%,#dbe7f3_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center">
        <div className="w-full rounded-[30px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function InvalidLink() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-[#10233f]">
        Invalid link
      </h2>
      <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
        This activation link is missing or invalid. Please check your email for
        the correct link, or contact an administrator if the issue persists.
      </p>
      <Link
        to="/signin"
        className="mt-8 text-sm font-semibold text-[#1b5d92] hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}

function SuccessState() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-[#10233f]">
        Account activated!
      </h2>
      <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
        Your account is now active. Sign in with your email and the password you
        just set.
      </p>
      <Link
        to="/signin"
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f2744,#1b5d92)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,39,68,0.24)] transition hover:translate-y-[-1px]"
      >
        Sign in
      </Link>
    </div>
  );
}
