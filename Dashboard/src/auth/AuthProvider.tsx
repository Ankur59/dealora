import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, apiPostJson } from "../lib/api";
import { AuthContext } from "./auth-context";
import type { AuthContextValue, DashboardUser } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<{ user: DashboardUser }>("/api/v1/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ user: DashboardUser }>("/api/v1/auth/me");
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const data = await apiPostJson<{ user: DashboardUser }>(
      "/api/v1/auth/login",
      { email, password },
    );
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await apiPostJson("/api/v1/auth/logout", {});
    } catch {
      // still clear local session
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      refreshSession,
      login,
      logout,
    }),
    [user, loading, error, refreshSession, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
