/**
 * auth-store.ts — Zustand auth state with sessionStorage persistence.
 *
 * Token storage: in-memory only via window.__DOCUMIND_TOKEN__ (TOKEN_KEY).
 * User metadata is persisted in sessionStorage (not the token).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { setToken, clearToken } from "@/lib/http-client";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  tenant_id: string;
  roles: string[];
  is_superadmin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, token) => {
        setToken(token); // uses shared TOKEN_KEY via http-client
        set({ user, isAuthenticated: true, isLoading: false });
      },

      clearAuth: () => {
        clearToken();
        set({ user: null, isAuthenticated: false, isLoading: false });
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "documind-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : ({} as Storage)
      ),
      // Persist only non-sensitive data — token is in-memory only
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // After hydration, clear loading
        state?.setLoading(false);
      },
    }
  )
);
