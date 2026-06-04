"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Search,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip } from "@/components/ui/Tooltip";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/search", label: "Search", icon: Search },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV = [{ href: "/admin", label: "Admin", icon: Shield }];

function NavLink({
  href, label, icon: Icon, active, collapsed,
}: {
  href: string; label: string; icon: React.ElementType; active: boolean; collapsed: boolean;
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-accent-subtle text-fg" : "text-muted hover:bg-sunken hover:text-fg",
        collapsed && "justify-center"
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
      <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", active ? "text-accent" : "text-subtle group-hover:text-muted")} />
      {!collapsed && <span className={cn("truncate", active && "font-medium")}>{label}</span>}
    </Link>
  );
  return collapsed ? <Tooltip label={label} side="right">{link}</Tooltip> : link;
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-line bg-canvas transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[248px]"
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-line px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fg text-canvas">
          <span className="text-[15px] font-bold leading-none">D</span>
        </div>
        {!collapsed && <span className="text-[17px] font-semibold tracking-tight text-fg">DocuMind</span>}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-5">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} collapsed={collapsed}
            active={pathname === href || pathname.startsWith(href + "/")} />
        ))}

        {user?.is_superadmin && (
          <>
            <div className={cn("pb-1 pt-5", !collapsed && "px-3")}>{!collapsed && <p className="eyebrow">Admin</p>}</div>
            {ADMIN_NAV.map(({ href, label, icon }) => (
              <NavLink key={href} href={href} label={label} icon={icon} collapsed={collapsed} active={pathname.startsWith(href)} />
            ))}
          </>
        )}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-surface text-subtle shadow-[var(--shadow-sm)] transition-colors hover:text-fg"
      >
        <ChevronLeft className={cn("h-3 w-3 transition-transform duration-300", collapsed && "rotate-180")} />
      </button>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
            <span className="text-xs font-semibold">{user?.full_name?.charAt(0)?.toUpperCase() ?? "?"}</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-fg">{user?.full_name}</p>
              <p className="truncate text-[11px] text-subtle">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
