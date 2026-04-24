import { useState } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { createDepositRequest } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

const CARD = "5614683518277611";
const HOLDER = "Alimardonov Umidjon";
const BONUS = 20;

const PRESETS = [
  { base: 10_000,  bonus: 2_000   },
  { base: 25_000,  bonus: 5_000   },
  { base: 50_000,  bonus: 10_000  },
  { base: 100_000, bonus: 20_000  },
  { base: 250_000, bonus: 50_000  },
  { base: 500_000, bonus: 100_000 },
];

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
function fmtFull(n: number) { return n.toLocaleString(); }
function fmtCard(c: string) { return c.replace(/(\d{4})(?=\d)/g, "$1  "); }

export default function Deposit() {
  const { player } = usePlayer();
  const { t } = useLang();
  const { theme, ts } = useTheme();
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const isLight = theme === "light";
  const amount = custom ? Number(custom) : selected;
  const bonusAmt = amount ? Math.floor(amount * BONUS / 100) : 0;
  const total = amount ? amount + bonusAmt : 0;

  const copyCard = () => {
    navigator.clipboard.writeText(CARD).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSend = async () => {
    if (!player) { setError("Foydalanuvchi topilmadi"); return; }
    if (!amount || amount < 1000) { setError("Kamida 1 000 UZS kiriting"); return; }
    setError(""); setLoading(true);
    try {
      await createDepositRequest(player.telegramId, amount);
      setDone(true);
      setTimeout(() => {
        try {
          const tg = (window as any).Telegram?.WebApp;
          if (tg) tg.close(); else window.history.back();
        } catch { window.history.back(); }
      }, 1600);
    } catch {
      setError("Xato yuz berdi. Qaytadan urinib ko'ring.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <GameHeader title={`💳 ${t.depositTitle}`} subtitle={t.depositDesc} />

      <div className="px-4 pb-6 flex-1 overflow-y-auto flex flex-col gap-3">

        {/* Bonus banner */}
        <div className="rounded-2xl py-3.5 text-center relative overflow-hidden"
          style={{
            background: isLight ? "linear-gradient(145deg, #065f46, #059669)" : "linear-gradient(145deg, #166534, #15803d)",
            boxShadow: isLight ? "0 6px 0 #064e3b, 0 8px 20px rgba(5,150,105,0.4), inset 0 1px 0 rgba(255,255,255,0.25)" : "0 6px 0 #0d3d1e, 0 8px 24px rgba(22,163,74,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 55%)" }} />
          <p className="relative font-bold text-sm text-green-100">{t.bonusNote}</p>
          <p className="relative font-black text-2xl text-white">🎁 +{BONUS}% BONUS</p>
        </div>

        {/* Card — 3D */}
        <div className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: isLight ? "linear-gradient(145deg, #92400e, #b45309)" : "linear-gradient(145deg, #78350f, #92400e, #a16207)",
            border: `1px solid ${isLight ? "rgba(251,191,36,0.6)" : "rgba(251,191,36,0.45)"}`,
            boxShadow: isLight ? "0 8px 0 #451a03, 0 12px 32px rgba(180,83,9,0.5), inset 0 1px 0 rgba(255,255,255,0.25)" : "0 8px 0 #451a03, 0 12px 32px rgba(180,83,9,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 55%)" }} />
          <div className="relative">
            <p className="text-xs font-black tracking-widest mb-2.5" style={{ color: "rgba(251,191,36,0.75)" }}>💳 {t.cardNumber}</p>
            <div className="flex items-center gap-3 mb-3">
              <p className="font-black text-lg text-white flex-1" style={{ fontFamily: "monospace", letterSpacing: "0.12em" }}>
                {fmtCard(CARD)}
              </p>
              <button onClick={copyCard}
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                style={{
                  background: copied ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.2)",
                  border: `1px solid ${copied ? "rgba(52,211,153,0.5)" : "rgba(251,191,36,0.4)"}`,
                  boxShadow: "0 3px 0 rgba(0,0,0,0.2)",
                }}>
                {copied
                  ? <Check className="w-4 h-4" style={{ color: "#34d399" }} />
                  : <Copy className="w-4 h-4" style={{ color: "#fbbf24" }} />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span>👤</span>
              <span className="text-white font-bold">{HOLDER}</span>
            </div>
            {copied && <p className="mt-1.5 text-xs font-semibold" style={{ color: "#34d399" }}>✅ {t.copied}</p>}
          </div>
        </div>

        {/* Custom amount */}
        <div>
          <p className="text-xs font-black tracking-widest mb-2" style={{ color: ts.textSub }}>{t.manualAmount}</p>
          <div className="relative">
            <input type="number" placeholder="100 000 UZS..."
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
              className="w-full rounded-2xl px-4 py-3.5 text-base font-bold focus:outline-none"
              style={{ background: ts.input, border: `1px solid ${ts.inputBorder}`, color: ts.text }} />
            {amount && amount >= 1000 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black" style={{ color: "#34d399" }}>
                +{fmtFull(bonusAmt)} bonus
              </span>
            )}
          </div>
        </div>

        <p className="text-xs" style={{ color: ts.textSub }}>{t.chooseAmount}:</p>

        {/* Presets */}
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const isSel = selected === p.base && !custom;
            return (
              <button key={p.base} onClick={() => { setSelected(p.base); setCustom(""); }}
                className="flex flex-col items-start px-3 py-3 rounded-2xl active:scale-95 transition-all"
                style={{
                  background: isSel
                    ? "linear-gradient(145deg, rgba(124,58,237,0.5), rgba(59,130,246,0.4))"
                    : ts.card,
                  border: `1px solid ${isSel ? "rgba(167,139,250,0.6)" : ts.cardBorder}`,
                  boxShadow: isSel ? "0 4px 0 rgba(0,0,0,0.2), 0 6px 16px rgba(124,58,237,0.3)" : "0 2px 0 rgba(0,0,0,0.1)",
                }}>
                <span className="font-black text-base" style={{ color: ts.text }}>{fmtShort(p.base)}</span>
                <span className="text-xs font-bold" style={{ color: "#34d399" }}>+{fmtShort(p.bonus)}</span>
              </button>
            );
          })}
        </div>

        {/* Summary */}
        {amount && amount >= 1000 && (
          <div className="rounded-2xl px-4 py-3.5"
            style={{ background: isLight ? "rgba(124,58,237,0.08)" : "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}>
            <div className="flex justify-between text-sm mb-1.5">
              <span style={{ color: ts.textSub }}>To'lov:</span>
              <span className="font-bold" style={{ color: ts.text }}>{fmtFull(amount)} UZS</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: ts.textSub }}>Bonus (+{BONUS}%):</span>
              <span className="font-bold" style={{ color: "#34d399" }}>+{fmtFull(bonusAmt)} UZS</span>
            </div>
            <div className="flex justify-between text-sm pt-2.5" style={{ borderTop: `1px solid ${ts.cardBorder}` }}>
              <span className="font-bold" style={{ color: ts.text }}>Jami balansga:</span>
              <span className="font-black text-yellow-400">{fmtFull(total)} UZS</span>
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="rounded-2xl p-4"
          style={{ background: isLight ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.07)", border: `1px solid ${isLight ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.2)"}` }}>
          <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: isLight ? "#4338ca" : "#a5b4fc" }}>
            📋 Qanday qilish kerak?
          </p>
          {["Yuqoridagi kartaga pul o'tkaring","To'lov cheki (screenshot) oling","Botga borib chekni yuboring","Admin tasdiqlagach balans to'ldiriladi"].map((step, i) => (
            <div key={i} className="flex items-start gap-3 mb-2.5 last:mb-0">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                style={{ background: isLight ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.3)", color: isLight ? "#4338ca" : "#a5b4fc" }}>
                {i + 1}
              </span>
              <span className="text-sm" style={{ color: ts.textSub }}>{step}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <p className="text-sm font-semibold" style={{ color: "#f87171" }}>❌ {error}</p>
          </div>
        )}

        {done ? (
          <div className="rounded-2xl py-5 text-center"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)" }}>
            <p className="text-3xl mb-1.5">✅</p>
            <p className="font-black text-lg" style={{ color: "#4ade80" }}>So'rov yuborildi!</p>
            <p className="text-sm mt-1" style={{ color: ts.textSub }}>Botga o'tyapsiz — chekni yuboring</p>
          </div>
        ) : (
          <button onClick={handleSend}
            disabled={loading || !amount || amount < 1000}
            className="w-full rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(145deg, #2563eb, #7c3aed)",
              boxShadow: "0 8px 0 #1e3a8a, 0 10px 28px rgba(124,58,237,0.5)",
              color: "white", padding: "18px 0",
            }}>
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Yuklanmoqda...</>
              : "🤖 Botga O'tish va Chek Yuborish"
            }
          </button>
        )}
      </div>
    </div>
  );
}
