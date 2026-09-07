import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setToken } from "./api";
import type { User } from "./types";

export type ViewMode = "officer" | "resident";

type AppState = {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  online: boolean;
  setOnline: (v: boolean) => void;
  language: string;
  setLanguage: (v: string) => void;
  role: string;
  user: User | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    email: string;
    password: string;
    name: string;
    role?: string;
    districtId?: string | null;
  }) => Promise<User>;
  logout: () => void;
};

const Ctx = createContext<AppState | null>(null);

const ROLE_LABEL: Record<string, string> = {
  officer: "District Officer",
  admin: "NDRF Admin",
  resident: "Resident",
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewMode>("officer");
  const [online, setOnline] = useState(true);
  const [language, setLanguage] = useState("English");
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const applyUser = useCallback((u: User | null) => {
    setUser(u);
    if (u) {
      setView(u.role === "resident" ? "resident" : "officer");
      if (u.language) setLanguage(u.language);
    }
  }, []);

  // Restore session from a stored token on first load.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((res) => {
        if (!cancelled) applyUser(res.user);
      })
      .catch(() => {})
      .finally(() => !cancelled && setAuthReady(true));
    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await api.login(email, password);
      setToken(token);
      applyUser(u);
      return u;
    },
    [applyUser],
  );

  const register = useCallback(
    async (payload: Parameters<AppState["register"]>[0]) => {
      const { token, user: u } = await api.register(payload);
      setToken(token);
      applyUser(u);
      return u;
    },
    [applyUser],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      view,
      setView,
      online,
      setOnline,
      language,
      setLanguage,
      user,
      authReady,
      login,
      register,
      logout,
      role: user
        ? (ROLE_LABEL[user.role] ?? user.role)
        : view === "officer"
          ? "District Officer"
          : "Resident",
    }),
    [view, online, language, user, authReady, login, register, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
