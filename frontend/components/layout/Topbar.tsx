"use client";

import { Bell, LogOut, Settings, User, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useLogout } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// Breadcrumb from pathname
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const crumbs = useBreadcrumb();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm shrink-0">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <li key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-700">/</span>}
              {crumb.isLast ? (
                <span className="text-slate-300 font-medium">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Right: Notifications + User menu */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          aria-label="Notifications"
          className="relative w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
        >
          <Bell className="w-4 h-4" />
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-sky-400" />
        </button>

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all",
              "hover:bg-slate-800/60 text-slate-300 hover:text-white",
              menuOpen && "bg-slate-800/60"
            )}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400/30 to-indigo-500/30 border border-sky-500/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-sky-400">
                {user?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
              </span>
            </div>
            <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">
              {user?.full_name}
            </span>
            <ChevronDown
              className={cn(
                "w-3 h-3 text-slate-500 transition-transform duration-200",
                menuOpen && "rotate-180"
              )}
            />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-11 w-52 glass rounded-xl border border-slate-700 shadow-2xl shadow-black/40 py-1.5 z-50 fade-in">
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-xs font-medium text-slate-300 truncate">
                  {user?.full_name}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
              <Link
                href="/settings/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <User className="w-3.5 h-3.5" /> Profile
              </Link>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" /> Settings
              </Link>
              <div className="border-t border-slate-800 mt-1 pt-1">
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
