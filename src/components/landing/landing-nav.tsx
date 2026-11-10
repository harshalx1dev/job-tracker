"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";

function SectionLink({ href, label }: { href: string; label: string }) {
  // A hash on this page is a plain jump; a link back to the landing page is a
  // client navigation (so the page change gets its transition, not a reload).
  return href.startsWith("#") ? (
    <a href={href}>{label}</a>
  ) : (
    <Link href={href}>{label}</Link>
  );
}

const LINKS = [
  { href: "#board", label: "Board" },
  { href: "#resumes", label: "Resumes" },
  { href: "#ai", label: "Drafts" },
  { href: "#prep", label: "Prep" },
];

/**
 * The site header. On the landing page its links jump to sections; elsewhere
 * (sign-in, sign-up) they lead back to those sections on the landing page.
 */
export function LandingNav({ onLanding = true }: { onLanding?: boolean }) {
  const base = onLanding ? "" : "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="nav lp-nav">
      <div className="wrap">
        <Link href="/" aria-label="Trackr home">
          <Logo className="text-[20px]" />
        </Link>
        <nav className="lp-nav__links" aria-label="Main">
          {LINKS.map((l) => (
            <SectionLink key={l.href} href={base + l.href} label={l.label} />
          ))}
        </nav>
        <div className="lp-nav__end">
          <Link href="/login" className="lp-nav__signin">
            Sign in
          </Link>
          <Link href="/signup" className="lp-btn lp-btn--primary">
            Create free account
          </Link>
          <button
            type="button"
            className="lp-btn lp-btn--secondary lp-menu-btn"
            style={{ width: 44, padding: 0 }}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        // Full-screen sheet; any tap on a row closes it.
        <div className="lp-sheet" onClick={() => setOpen(false)}>
          {LINKS.map((l) => (
            <SectionLink key={l.href} href={base + l.href} label={l.label} />
          ))}
          <Link href="/login">Sign in</Link>
          <Link href="/signup" className="lp-btn lp-btn--primary">
            Create free account
          </Link>
        </div>
      )}
    </header>
  );
}
