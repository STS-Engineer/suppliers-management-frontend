import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { getReadableAuthError, useAuth } from "../context/AuthContext";

type RedirectState = {
  from?: {
    pathname?: string;
  };
};

export default function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [email, setEmail] = useState("purchasing.manager@avocarbon.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = location.state as RedirectState | null;
  const redirectTo = state?.from?.pathname || "/suppliers";

  if (!isLoading && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(getReadableAuthError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f7fbff_0,#e8f0f8_40%,#dbe7f3_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#08203a,#0c3158_46%,#155489)] px-6 py-8 text-white shadow-[0_30px_90px_rgba(8,31,58,0.24)] sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.20),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.14),transparent_28%)]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-sky-100/75">
                Enterprise Workspace
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-bold tracking-[-0.05em] sm:text-5xl">
                Supplier lifecycle governance built for operational teams.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200/92 sm:text-base">
                Sign in to review supplier panels, manage onboarding workflows,
                and maintain relation scorecards through a shared enterprise
                workspace for purchasing managers and supplier owners.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <ShieldCheck className="h-5 w-5 text-sky-200" />
                <p className="mt-3 text-sm font-semibold">
                  Secure session access
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-200/80">
                  Protected supplier workflows with authenticated enterprise
                  sessions.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <LockKeyhole className="h-5 w-5 text-emerald-200" />
                <p className="mt-3 text-sm font-semibold">Protected data</p>
                <p className="mt-1 text-xs leading-6 text-slate-200/80">
                  Supplier intelligence and evaluations stay inside
                  authenticated sessions.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-white/10 p-4 backdrop-blur">
                <ArrowRight className="h-5 w-5 text-amber-200" />
                <p className="mt-3 text-sm font-semibold">Fast handoff</p>
                <p className="mt-1 text-xs leading-6 text-slate-200/80">
                  Move from onboarding to active site review without leaving the
                  workspace.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[30px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-8">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#6d89a4]">
                Sign In
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-[#10233f]">
                Access Supplier Management
              </h2>
              {/* <p className="mt-2 text-sm leading-6 text-slate-500">
                Use your enterprise credentials to open the supplier lifecycle workspace.
              </p> */}
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f2744,#1b5d92)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,39,68,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_40px_rgba(15,39,68,0.28)] disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isSubmitting ? "Signing in..." : "Enter workspace"}
              </button>
            </form>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Starter Accounts
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {/* <p>
                  Purchasing manager:{" "}
                  <span className="font-semibold">
                    purchasing.manager@avocarbon.local
                  </span>
                </p> */}
                <p>
                  Supplier owner:{" "}
                  <span className="font-semibold">
                    supplier.owner@avocarbon.com
                  </span>
                </p>
                <p>
                  Temporary password:{" "}
                  <span className="font-semibold">ChangeMe123!</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
