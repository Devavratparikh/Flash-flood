import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ViewMode = "officer" | "resident";

type AppState = {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  online: boolean;
  setOnline: (v: boolean) => void;
  language: string;
  setLanguage: (v: string) => void;
  role: string;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewMode>("officer");
  const [online, setOnline] = useState(true);
  const [language, setLanguage] = useState("English");

  const value = useMemo<AppState>(
    () => ({
      view,
      setView,
      online,
      setOnline,
      language,
      setLanguage,
      role: view === "officer" ? "District Officer" : "Resident",
    }),
    [view, online, language],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
