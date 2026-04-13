import { useState } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { createDepositRequest } from "@/lib/api";

const CARD = "9860606756773093";
const HOLDER = "Xojanov Shavkat";
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
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

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
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0f0a1e 0%, #1a0f2e 50%, #0f0a1e 100%)" }}>

      {/* Orbs */}
      <div className="fixed pointer-events-none" style={{ top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, #7c3aed44 0%, transparent 70%)", filter: "blur(50px)" }} />
      <div className="fixed pointer-events-none" style={{ bottom: 60, left: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #16a34a33 0%, transparent 70%)", filter: "blur(40px)" }} />

      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Top banner */}
        <div className="px-4 pt-5 pb-3">
          <div className="rounded-2xl py-3.5 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #166534, #15803d)", boxShadow: "0 4px 24px rgba(22,163,74,0.45)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 55%)" }} />
            <p className="relative font-bold text-sm text-green-100">Har qanday to'ldirish uchun!</p>
            <p className="relative font-black text-2xl text-white">🎁 +{BONUS}% BONUS</p>
          </div>
        </div>

        <div className="px-4 flex-1 overflow-y-auto pb-6">

          {/* Card */}
          <div className="rounded-2xl p-4 mb-4 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #78350f, #92400e, #a16207)", border: "1px solid rgba(251,191,36,0.45)", boxShadow: "0 8px 28px rgba(180,83,9,0.35)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 55%)" }} />
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.15), transparent 70%)" }} />

            <div className="relative">
              <p className="text-xs font-black tracking-widest mb-3" style={{ color: "rgba(251,191,36,0.7)" }}>
                💳 TO'LOV KARTASI
              </p>
              <div className="flex items-center gap-3 mb-3">
                <p className="font-black text-lg tracking-wider text-white flex-1" style={{ fontFamily: "monospace", letterSpacing: "0.1em" }}>
                  {fmtCard(CARD)}
                </p>
                <button onClick={copyCard}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                  style={{ background: copied ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.2)", border: `1px solid ${copied ? "rgba(52,211,153,0.5)" : "rgba(251,191,36,0.4)"}` }}>
                  {copied
                    ? <Check className="w-4 h-4" style={{ color: "#34d399" }} />
                    : <Copy className="w-4 h-4" style={{ color: "#fbbf24" }} />
                  }
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <span className="text-white font-bold">{HOLDER}</span>
              </div>
              {copied && <p className="mt-2 text-xs font-semibold" style={{ color: "#34d399" }}>✅ Nusxa olindi!</p>}
            </div>
          </div>

          {/* Custom amount */}
          <p className="text-xs font-black tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>MIQDOR KIRITING</p>
          <div className="relative mb-2">
            <input type="number" placeholder="Miqdorni o'zing kiriting..."
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
              className="w-full rounded-2xl px-4 py-3.5 text-base font-bold focus:outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }} />
            {amount && amount >= 1000 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black" style={{ color: "#34d399" }}>
                +{fmtFull(bonusAmt)} bonus
              </span>
            )}
          </div>

          <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>yoki tanlang:</p>

          {/* Preset grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {PRESETS.map((p) => {
              const isSel = selected === p.base && !custom;
              return (
                <button key={p.base} onClick={() => { setSelected(p.base); setCustom(""); }}
                  className="flex flex-col items-start px-3 py-3 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: isSel ? "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(59,130,246,0.25))" : "rgba(255,255,255,0.05)",
                    border: isSel ? "1px solid rgba(167,139,250,0.55)" : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: isSel ? "0 4px 16px rgba(124,58,237,0.3)" : "none",
                  }}>
                  <span className="font-black text-base text-white">{fmtShort(p.base)}</span>
                  <span className="text-xs font-bold" style={{ color: "#34d399" }}>+{fmtShort(p.bonus)}</span>
                </button>
              );
            })}
          </div>

          {/* Summary */}
          {amount && amount >= 1000 && (
            <div className="rounded-2xl px-4 py-3.5 mb-4"
              style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}>
              <div className="flex justify-between text-sm mb-1.5">
                <span style={{ color: "rgba(255,255,255,0.5)" }}>To'lov:</span>
                <span className="text-white font-bold">{fmtFull(amount)} UZS</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Bonus (+{BONUS}%):</span>
                <span className="font-bold" style={{ color: "#34d399" }}>+{fmtFull(bonusAmt)} UZS</span>
              </div>
              <div className="flex justify-between text-sm pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="font-bold text-white">Jami balansga:</span>
                <span className="font-black text-yellow-400">{fmtFull(total)} UZS</span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="rounded-2xl p-4 mb-4"
            style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: "#a5b4fc" }}>
              📋 Qanday qilish kerak?
            </p>
            <div className="space-y-2.5">
              {[
                "Yuqoridagi kartaga pul o'tkaring",
                "To'lov cheki (screenshot) oling",
                "Botga borib chekni yuboring",
                "Admin tasdiqlagach balans to'ldiriladi",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                    style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                    {i + 1}
                  </span>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 mb-3"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <p className="text-sm font-semibold" style={{ color: "#f87171" }}>❌ {error}</p>
            </div>
          )}

          {done ? (
            <div className="rounded-2xl py-5 text-center"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", boxShadow: "0 0 30px rgba(34,197,94,0.1)" }}>
              <p className="text-3xl mb-1.5">✅</p>
              <p className="font-black text-lg" style={{ color: "#4ade80" }}>So'rov yuborildi!</p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Botga o'tyapsiz — chekni yuboring</p>
            </div>
          ) : (
            <button onClick={handleSend}
              disabled={loading || !amount || amount < 1000}
              className="w-full rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)", boxShadow: "0 8px 28px rgba(124,58,237,0.5)", color: "white", padding: "18px 0" }}>
              {loading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Yuklanmoqda...</>
                : "🤖 Botga O'tish va Chek Yuborish"
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
