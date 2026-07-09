"use client";

import Link from "next/link";
import { useTransition } from "react";
import { User, LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface UserMenuDropdownProps {
  name: string;
  email: string;
  avatarUrl: string | null;
}

function Avatar({ name, avatarUrl, className }: { name: string; avatarUrl: string | null; className?: string }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`rounded-full object-cover ${className ?? ""}`}
      />
    );
  }
  // Magic-link accounts have no picture - fall back to an initial
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium ${className ?? ""}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function UserMenuDropdown({ name, email, avatarUrl }: UserMenuDropdownProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Account menu"
        >
          <User />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {/* Identity header - links to the profile page */}
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-3 px-2 py-2">
            <Avatar name={name} avatarUrl={avatarUrl} className="size-9 text-sm" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          onSelect={() => startTransition(() => signOut())}
        >
          <LogOut />
          {isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
