import { LandingNav } from "@/components/landing/landing-nav";
import { EntryIntro } from "@/components/entry-intro";
import "../landing.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 pt-[104px] pb-12 sm:pt-[120px]">
      {/* The site header; .lp scopes the landing styles to it alone. */}
      <div className="lp contents">
        <LandingNav onLanding={false} />
      </div>
      {/* A pool of warm light under the top edge (the page's lit ground). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-14 sm:top-[72px] h-[520px]"
        style={{
          background:
            "radial-gradient(60% 420px at 50% 0, color-mix(in oklab, var(--primary) 16%, transparent), transparent)",
        }}
      />
      <EntryIntro />
      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border bg-card p-6 sm:p-7">{children}</div>
      </div>
    </div>
  );
}
