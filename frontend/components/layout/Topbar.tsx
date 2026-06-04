"use client";

import { Bell, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { DropdownMenu } from "@/components/ui/DropdownMenu";

function useBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));
}

export function Topbar() {
  const { user } = useAuth();
  const { mutate: logout } = useLogout();
  const crumbs = useBreadcrumb();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-6 backdrop-blur-md"
      style={{ background: "color-mix(in srgb, var(--canvas) 80%, transparent)" }}>
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <li key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-subtle">/</span>}
              {crumb.isLast ? (
                <span className="font-medium text-fg">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="text-subtle transition-colors hover:text-muted">{crumb.label}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <button
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-fg"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>

        <DropdownMenu
          align="right"
          header={
            <>
              <p className="truncate text-[13px] font-medium text-fg">{user?.full_name}</p>
              <p className="truncate text-[11px] text-subtle">{user?.email}</p>
            </>
          }
          items={[
            { label: "Profile", icon: <User className="h-4 w-4" />, href: "/settings/profile" },
            { label: "Settings", icon: <Settings className="h-4 w-4" />, href: "/settings" },
            { label: "Sign out", icon: <LogOut className="h-4 w-4" />, onSelect: () => logout(), danger: true },
          ]}
          trigger={
            <span className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-subtle text-accent">
                <span className="text-[11px] font-semibold">{user?.full_name?.charAt(0)?.toUpperCase() ?? "?"}</span>
              </span>
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-muted sm:block">{user?.full_name}</span>
            </span>
          }
        />
      </div>
    </header>
  );
}
