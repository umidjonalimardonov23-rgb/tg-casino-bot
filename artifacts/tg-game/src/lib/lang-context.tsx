import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { TRANSLATIONS, type Lang, type T } from "./i18n";

interface LangCtx { lang: Lang; t: T; setLang: (l: Lang) => void; }
const LangContext = createContext<LangCtx>({ lang: "uz", t: TRANSLATIONS.uz, setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem("lang") as Lang) || "uz"; } catch { return "uz"; }
  });

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch {}
  }

  return (
    <LangContext.Provider value={{ lang, t: TRANSLATIONS[lang] as T, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() { return useContext(LangContext); }
