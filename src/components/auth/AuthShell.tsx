import type { InputHTMLAttributes, ReactNode } from "react";
import logoAvocarbon from "../../assets/logo/logo-avocarbon.png";

type Highlight = { icon: ReactNode; title: string; text: string };

// Shared shell for the sign-in / sign-up screens. Same visual family as the rest
// of the app (AvoCarbon brand, navy/teal enterprise palette) but its own layout:
// a brand + highlights column on the left and a clean light card on the right.
export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  highlights,
  cardHeading,
  cardSubtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  highlights: Highlight[];
  cardHeading: string;
  cardSubtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08182c] text-white">
      {/* Backdrop: soft glows + faint grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(37,99,235,0.30),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(13,148,136,0.28),transparent_45%),linear-gradient(150deg,#08182c,#0b2035_55%,#0a2130)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="auth-orb auth-orb--a" />
        <div className="auth-orb auth-orb--b" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center px-5 py-10">
        <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Brand / value column */}
          <section className="hidden flex-col lg:flex">
            <img
              src={logoAvocarbon}
              alt="AvoCarbon Group"
              className="h-11 w-auto object-contain"
            />

            <div className="mt-12 flex items-center gap-3">
              <span className="h-px w-8 bg-gradient-to-r from-sky-400 to-transparent" />
              <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-sky-300/80">
                {eyebrow}
              </span>
            </div>

            <h1 className="mt-5 max-w-md text-[2.6rem] font-bold leading-[1.08] tracking-tight text-white">
              {title}
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-slate-300/80">
              {subtitle}
            </p>

            <ul className="mt-11 space-y-5">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-sky-300 ring-1 ring-inset ring-white/10">
                    {h.icon}
                  </span>
                  <div className="pt-0.5">
                    <p className="text-[14px] font-semibold text-white">
                      {h.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-6 text-slate-300/70">
                      {h.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Auth card column */}
          <section className="flex items-center justify-center">
            <div className="w-full max-w-sm">
              {/* Mobile brand */}
              <div className="mb-8 flex justify-center lg:hidden">
                <img
                  src={logoAvocarbon}
                  alt="AvoCarbon Group"
                  className="h-9 w-auto object-contain"
                />
              </div>

              <div className="rounded-3xl border border-white/60 bg-white/95 p-7 text-slate-900 shadow-[0_40px_90px_-30px_rgba(2,10,25,0.7)] sm:p-8">
                <h2 className="text-2xl font-bold tracking-tight text-[#0f2744]">
                  {cardHeading}
                </h2>
                <span className="mt-2 block h-1 w-9 rounded-full bg-gradient-to-r from-sky-500 to-teal-400" />
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {cardSubtitle}
                </p>

                <div className="mt-7">{children}</div>
              </div>

              <p className="mt-5 text-center text-[11.5px] text-slate-400/70">
                © AvoCarbon Group · Supplier Management
              </p>
            </div>
          </section>
        </div>
      </div>

      <style>{AUTH_STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form primitives (styled for the light auth card)
// ---------------------------------------------------------------------------
export function AuthField({
  label,
  icon,
  rightSlot,
  ...inputProps
}: {
  label: string;
  icon: ReactNode;
  rightSlot?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-sky-500">
          {icon}
        </span>
        <input
          {...inputProps}
          className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 ${
            rightSlot ? "pr-11" : "pr-4"
          } text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100`}
        />
        {rightSlot && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            {rightSlot}
          </span>
        )}
      </div>
    </label>
  );
}

export const authSelectClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100";

export const authButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0f2744,#1b5d92,#0891b2)] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:brightness-[1.06] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

const AUTH_STYLES = `
.auth-orb{position:absolute;border-radius:9999px;filter:blur(84px);opacity:.38;will-change:transform}
.auth-orb--a{top:-9rem;left:-7rem;height:25rem;width:25rem;background:radial-gradient(circle at 30% 30%,#3b82f6,#2563eb 45%,transparent 70%);animation:auth-drift-a 21s ease-in-out infinite}
.auth-orb--b{bottom:-11rem;right:-5rem;height:29rem;width:29rem;background:radial-gradient(circle at 60% 40%,#22d3ee,#0d9488 45%,transparent 70%);animation:auth-drift-b 25s ease-in-out infinite}
@keyframes auth-drift-a{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(2.5rem,1.5rem) scale(1.07)}}
@keyframes auth-drift-b{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-2.5rem,-1.5rem) scale(1.05)}}
@media (prefers-reduced-motion: reduce){.auth-orb{animation:none}}
`;
