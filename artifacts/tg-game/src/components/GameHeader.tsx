import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import type { Lang } from "@/lib/i18n";

interface Props {
  title: string;
  subtitle?: string;
  hideTheme?: boolean;
}

const FLAG: Record<Lang, string> = { uz: "🇺🇿", ru: "🇷🇺", en: "🇬🇧" };

export default function GameHeader({ title, subtitle, hideTheme }: Props) {
  const [, nav] = useLocation();
  const { player } = usePlayer();
  const { lang, setLang } = useLang();
  const { theme, setTheme, ts } = useTheme();
  const [showLang, setShowLang] = useState(false);

  const isLight = theme === "light";

  return (
    <>
      {/* Backdrop for lang dropdown */}
      {showLang && (
        <div className="fixed inset-0 z-40" onClick={() => setShowLang(false)} />
      )}

      <div className="flex items-center gap-2 px-4 pt-5 pb-3 relative z-50">
        {/* Back */}
        <button onClick={() => nav("/")}
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          style={{
            background: isLight ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.1)",
            border: `1px solid ${isLight ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.15)"}`,
            boxShadow: "0 4px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}>
          <ArrowLeft className="w-4 h-4" style={{ color: isLight ? "#4338ca" : "white" }} />
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-base leading-tight truncate" style={{ color: ts.text }}>{title}</p>
          {subtitle && <p className="text-xs truncate" style={{ color: ts.textSub }}>{subtitle}</p>}
        </div>

        {/* Balance */}
        <div className="text-right shrink-0 mr-1">
          <p className="text-xs" style={{ color: ts.textSub }}>💰</p>
          <p className="font-black text-xs" style={{ color: ts.text }}>{(player?.balance ?? 0).toLocaleString()}</p>
        </div>

        {/* Theme toggle */}
        {!hideTheme && (
          <div className="flex gap-1 shrink-0">
            {(["dark","light","black"] as const).map(th => (
              <button key={th} onClick={() => setTheme(th)}
                className="w-7 h-7 rounded-xl flex items-center justify-center text-sm active:scale-90 transition-transform"
                style={{
                  background: theme === th
                    ? (th === "light" ? "#f0f4ff" : th === "black" ? "#000" : "#7c3aed")
                    : (isLight ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.07)"),
                  border: `1px solid ${theme === th ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                  fontSize: 12,
                }}>
                {th === "light" ? "☀️" : th === "black" ? "⬛" : "🌙"}
              </button>
            ))}
          </div>
        )}

        {/* Lang switcher */}
        <div className="relative shrink-0">
          <button onClick={() => setShowLang(v => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base active:scale-90 transition-transform"
            style={{
              background: isLight ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.08)",
              border: `1px solid ${isLight ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.12)"}`,
            }}>
            {FLAG[lang]}
          </button>
          {showLang && (
            <div className="absolute right-0 top-10 z-50 rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: isLight ? "white" : "#1a0a3a",
                border: `1px solid ${isLight ? "rgba(99,102,241,0.25)" : "rgba(167,139,250,0.3)"}`,
                minWidth: 90,
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              }}>
              {(["uz","ru","en"] as const).map(l => (
                <button key={l} onClick={() => { setLang(l); setShowLang(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold transition-colors"
                  style={{
                    color: lang === l
                      ? (isLight ? "#4338ca" : "#c4b5fd")
                      : (isLight ? "#374151" : "rgba(255,255,255,0.6)"),
                    background: lang === l
                      ? (isLight ? "rgba(99,102,241,0.08)" : "rgba(124,58,237,0.25)")
                      : "transparent",
                  }}>
                  <span style={{ fontSize: 16 }}>{FLAG[l]}</span>
                  <span>{l.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
