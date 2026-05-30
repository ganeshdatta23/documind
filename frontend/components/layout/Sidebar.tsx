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
  Brain,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/search", label: "Search", icon: Search },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV = [{ href: "/admin", label: "Admin", icon: Shield }];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();

  return (
    <aside
      className={cn(
        "relative flex flex-col shrink-0 h-full",
        "bg-slate-950 border-r border-slate-800/60",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800/60">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
          <Brain className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-sm tracking-tight">
            DocuMind
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group",
                active
                  ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                  : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  active ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"
                )}
              />
              {!collapsed && <span className="truncate font-medium">{label}</span>}
              {!collapsed && active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />
              )}
            </Link>
          );
        })}

        {/* Admin section */}
        {user?.is_superadmin && (
          <>
            <div className={cn("pt-4 pb-1", !collapsed && "px-3")}>
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  Admin
                </p>
              )}
            </div>
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group",
                    active
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate font-medium">{label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute -right-3 top-20",
          "w-6 h-6 rounded-full bg-slate-800 border border-slate-700",
          "flex items-center justify-center",
          "text-slate-400 hover:text-white hover:bg-slate-700",
          "transition-all duration-200 shadow-lg z-10"
        )}
      >
        <ChevronLeft
          className={cn(
            "w-3 h-3 transition-transform duration-300",
            collapsed && "rotate-180"
          )}
        />
      </button>

      {/* User avatar at bottom */}
      <div className="p-3 border-t border-slate-800/60">
        <div
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-xl",
            "hover:bg-slate-800/60 transition-colors cursor-pointer"
          )}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400/30 to-indigo-500/30 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-sky-400">
              {user?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">
                {user?.full_name}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
