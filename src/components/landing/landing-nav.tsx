"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "#board", label: "Board" },
  { href: "#resumes", label: "Resumes" },
  { href: "#ai", label: "Drafts" },
  { href: "#prep", label: "Prep" },
];

export function LandingNav() {
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
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
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
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
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
