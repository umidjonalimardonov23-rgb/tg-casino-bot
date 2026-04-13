import { createContext, useContext, useState, type ReactNode } from "react";

export type Theme = "dark" | "light" | "black";

export interface ThemeStyle {
  bg: string;
  card: string;
  cardBorder: string;
  text: string;
  textSub: string;
  input: string;
  inputBorder: string;
  btnSecondary: string;
  btnSecondaryText: string;
}

export const THEMES: Record<Theme, ThemeStyle> = {
  dark: {
    bg: "linear-gradient(160deg, #0f0a1e 0%, #1a0f2e 50%, #0f0a1e 100%)",
    card: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.1)",
    text: "#ffffff",
    textSub: "rgba(255,255,255,0.45)",
    input: "rgba(255,255,255,0.08)",
    inputBorder: "rgba(255,255,255,0.15)",
    btnSecondary: "rgba(255,255,255,0.07)",
    btnSecondaryText: "#a5b4fc",
  },
  light: {
    bg: "linear-gradient(160deg, #f0f4ff 0%, #e8eeff 50%, #f0f4ff 100%)",
    card: "rgba(255,255,255,0.9)",
    cardBorder: "rgba(99,102,241,0.2)",
    text: "#1e1b4b",
    textSub: "rgba(30,27,75,0.55)",
    input: "rgba(99,102,241,0.06)",
    inputBorder: "rgba(99,102,241,0.25)",
    btnSecondary: "rgba(99,102,241,0.1)",
    btnSecondaryText: "#4338ca",
  },
  black: {
    bg: "linear-gradient(160deg, #000000 0%, #0a0a0a 50%, #000000 100%)",
    card: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.07)",
    text: "#ffffff",
    textSub: "rgba(255,255,255,0.35)",
    input: "rgba(255,255,255,0.06)",
    inputBorder: "rgba(255,255,255,0.12)",
    btnSecondary: "rgba(255,255,255,0.05)",
    btnSecondaryText: "#9ca3af",
  },
};

interface ThemeCtx { theme: Theme; ts: ThemeStyle; setTheme: (t: Theme) => void; }
const ThemeContext = createContext<ThemeCtx>({ theme: "dark", ts: THEMES.dark, setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem("theme") as Theme) || "dark"; } catch { return "dark"; }
  });
  function setTheme(t: Theme) {
    setThemeState(t);
    try { localStorage.setItem("theme", t); } catch {}
  }
  return (
    <ThemeContext.Provider value={{ theme, ts: THEMES[theme], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() { return useContext(ThemeContext); }
