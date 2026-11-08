import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { CommandMenu } from "@/components/app-shell/command-menu";
import { UserMenu } from "@/components/app-shell/user-menu";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/session";

async function SidebarUser() {
  const user = await requireUser();
  return <UserMenu user={user} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col gap-4 border-r bg-sidebar p-3 md:flex">
        <div className="flex items-center justify-between px-1.5 pt-1">
          <Link href="/app/jobs">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <CommandMenu />
        <SidebarNav />
        <div className="mt-auto">
          <Suspense
            fallback={
              <div className="flex items-center gap-2.5 p-1.5">
                <Skeleton className="size-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
              </div>
            }
          >
            <SidebarUser />
          </Suspense>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          userSlot={
            <Suspense fallback={<Skeleton className="h-10 w-full" />}>
              <SidebarUser />
            </Suspense>
          }
        />
        {children}
      </main>
    </div>
  );
}
