import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  // Actions
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
        // Store token in-memory (not localStorage — XSS protection)
        if (typeof window !== "undefined") {
          (window as any).__AUTH_TOKEN__ = token;
        }
        set({ user, isAuthenticated: true, isLoading: false });
      },

      clearAuth: () => {
        if (typeof window !== "undefined") {
          (window as any).__AUTH_TOKEN__ = undefined;
        }
        set({ user: null, isAuthenticated: false, isLoading: false });
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "documind-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : ({} as Storage)
      ),
      // Only persist non-sensitive user data (NOT the access token)
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
