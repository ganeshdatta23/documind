"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Client-side route guard for the dashboard. While the persisted auth state
 * rehydrates we show a splash; unauthenticated users are bounced to /login.
 * (API calls are additionally protected server-side; this is for UX.)
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-7 w-7 text-accent" />
          <p className="text-xs text-subtle">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Spinner className="h-7 w-7 text-accent" />
      </div>
    );
  }

  return <>{children}</>;
}
