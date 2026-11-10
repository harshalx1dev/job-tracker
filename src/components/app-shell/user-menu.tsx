"use client";

import { useRouter } from "next/navigation";
import { LayoutPanelTop, LogOut, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import type { CurrentUser } from "@/server/session";

export function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-7">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {user.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-56">
        {/* Base UI requires a menu label to sit inside a group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            {user.role === "admin" ? (
              <>
                <ShieldCheck className="size-3.5 text-primary" /> Admin
              </>
            ) : (
              "Signed in"
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {user.role === "admin" && (
          <DropdownMenuItem onClick={() => router.push("/app/admin")}>
            <LayoutPanelTop /> Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
