"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";

/**
 * The pathname is request data on dynamic routes, so it's read inside Suspense;
 * the fallback is the same nav without the active highlight (no layout shift).
 */
export function SidebarNav() {
  return (
    <Suspense fallback={<NavList active={undefined} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  const pathname = usePathname();
  const active = [...NAV_ITEMS]
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return <NavList active={active} />;
}

function NavList({ active }: { active: string | undefined }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === active;
        const Icon = item.icon;
        const inner = (
          <>
            {isActive && (
              <motion.span
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-lg border border-sidebar-border bg-sidebar-accent"
              />
            )}
            <Icon
              className={cn(
                "relative size-4 transition-colors",
                isActive
                  ? "text-brand"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span className="relative">{item.label}</span>
            {item.soon && (
              <span className="relative ml-auto font-mono text-[11px] text-muted-foreground/70">
                soon
              </span>
            )}
          </>
        );
        const cls = cn(
          "group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150",
          isActive
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground",
          item.soon && "pointer-events-none opacity-55",
        );
        return item.soon ? (
          <span key={item.href} className={cls} aria-disabled>
            {inner}
          </span>
        ) : (
          <Link key={item.href} href={item.href} className={cls}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
