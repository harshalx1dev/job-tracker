import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      {/* A pool of warm light under the top edge (the page's lit ground). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            "radial-gradient(60% 420px at 50% 0, color-mix(in oklab, var(--primary) 16%, transparent), transparent)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo className="text-lg" />
        </Link>
        <div className="rounded-2xl border bg-card p-6 sm:p-7">{children}</div>
      </div>
    </div>
  );
}
