import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Gauge,
  Lock,
  Mail,
  Network,
  ShieldCheck,
} from "lucide-react";
import { getReadableAuthError, useAuth } from "../context/AuthContext";
import AuthShell, {
  AuthField,
  authButtonClass,
} from "../components/auth/AuthShell";

type RedirectState = {
  from?: {
    pathname?: string;
  };
};

const HIGHLIGHTS = [
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: "Role-based access",
    text: "Every workflow is scoped to your role and permissions.",
  },
  {
    icon: <Network className="h-5 w-5" />,
    title: "Cross-site visibility",
    text: "Supplier panels and scorecards, unified across plants.",
  },
  {
    icon: <Gauge className="h-5 w-5" />,
    title: "Fast handoff",
    text: "Move from onboarding to active site review without breaking flow.",
  },
];

export default function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const [email, setEmail] = useState("purchasing.manager@avocarbon.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthShell
      eyebrow="Supplier Management Application"
      title="Supplier lifecycle governance, built for operational teams."
      subtitle="Review supplier panels, manage onboarding workflows, and maintain relation scorecards in one shared enterprise workspace."
      highlights={HIGHLIGHTS}
      cardHeading="Secure workspace access"
      cardSubtitle="Sign in with your email and password to continue to your operations workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="Work email"
          icon={<Mail className="h-4 w-4" />}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@avocarbon.com"
          autoComplete="email"
          required
        />

        <AuthField
          label="Password"
          icon={<Lock className="h-4 w-4" />}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
        />

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-xs font-semibold text-sky-700 transition hover:text-sky-900 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          className={authButtonClass}
        >
          {isSubmitting ? (
            "Signing in…"
          ) : (
            <>
              Enter workspace
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don't have an account?{" "}
        <Link
          to="/signup"
          className="font-semibold text-sky-700 transition hover:underline"
        >
          Request access
        </Link>
      </p>
    </AuthShell>
  );
}
