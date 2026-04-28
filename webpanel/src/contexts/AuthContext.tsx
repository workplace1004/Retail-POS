import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, getApiBaseUrl, getWebpanelToken, setWebpanelToken } from "@/lib/api";

export type WebpanelAuthUser = { id: string; email: string; name: string; avatarDataUrl: string | null };

type AuthContextValue = {
  user: WebpanelAuthUser | null;
  token: string | null;
  ready: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUserFromServer: (u: WebpanelAuthUser) => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type LoginResponse = { token: string; user: WebpanelAuthUser };
type MeResponse = { user: WebpanelAuthUser };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getWebpanelToken());
  const [user, setUser] = useState<WebpanelAuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = getWebpanelToken();
      if (!t) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const { user: u } = await apiRequest<MeResponse>("/api/webpanel/auth/me");
        if (!cancelled) {
          setUser({
            id: u.id,
            email: u.email,
            name: u.name,
            avatarDataUrl: u.avatarDataUrl ?? null,
          });
          setTokenState(t);
        }
      } catch {
        setWebpanelToken(null);
        if (!cancelled) {
          setUser(null);
          setTokenState(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const body = { email: email.trim(), password };
    const res = await fetch(`${getApiBaseUrl()}/api/webpanel/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: LoginResponse | { error?: string };
    try {
      data = JSON.parse(text) as LoginResponse | { error?: string };
    } catch {
      throw new Error(text || `Login failed (${res.status})`);
    }
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || text || `Login failed (${res.status})`);
    }
    const ok = data as LoginResponse;
    setWebpanelToken(ok.token);
    setTokenState(ok.token);
    setUser({
      id: ok.user.id,
      email: ok.user.email,
      name: ok.user.name,
      avatarDataUrl: ok.user.avatarDataUrl ?? null,
    });
  }, []);

  const logout = useCallback(() => {
    setWebpanelToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const setUserFromServer = useCallback((u: WebpanelAuthUser) => {
    setUser({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarDataUrl: u.avatarDataUrl ?? null,
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const t = getWebpanelToken();
    if (!t) return;
    const { user: u } = await apiRequest<MeResponse>("/api/webpanel/auth/me");
    setUserFromServer(u);
  }, [setUserFromServer]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      ready,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
      setUserFromServer,
      refreshUser,
    }),
    [user, token, ready, login, logout, setUserFromServer, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
