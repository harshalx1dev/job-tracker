"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";

/** Top bar + slide-out navigation for small screens (the sidebar is md+). */
export function MobileNav({ userSlot }: { userSlot: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>
      <Logo />
      <div className="ml-auto">
        <ThemeToggle />
      </div>
      <Suspense>
        <CloseOnNavigate onNavigate={() => setOpen(false)} />
      </Suspense>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="flex w-72 flex-col gap-4 bg-sidebar p-3"
        >
          <SheetTitle className="px-1.5 pt-1">
            <Logo />
          </SheetTitle>
          <SidebarNav />
          <div className="mt-auto">{userSlot}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Closes the menu after a route change. Reads the pathname, so it lives inside Suspense. */
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onNavigate();
    // Only a route change should close the menu; onNavigate is a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}
