import { useState, useRef, useCallback } from "react";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { placeBet } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

// Weighted pool — fruits appear 3x more often (easier to win)
const POOL = [
  "🍒","🍒","🍒","🍊","🍊","🍊","🍋","🍋","🍋",
  "🍇","🍇","🔔","🔔","⭐","💎","7️⃣"
];
const RARE = ["7️⃣","💎","⭐"];
const PAYOUTS: Record<string, number> = {
  "7️⃣7️⃣7️⃣": 40, "💎💎💎": 18, "⭐⭐⭐": 10, "🔔🔔🔔": 7,
  "🍇🍇🍇": 5,  "🍋🍋🍋": 4,  "🍊🍊🍊": 3,  "🍒🍒🍒": 2,
};

function randPool(pool: string[]) { return pool[Math.floor(Math.random() * pool.length)]; }

// ~40% 3-of-a-kind chance with bias
function spinReels(): [string, string, string] {
  const r1 = randPool(POOL);
  // 42% chance r2 matches r1
  const r2 = Math.random() < 0.42 ? r1 : randPool(POOL);
  // 42% chance r3 matches r2
  const r3 = Math.random() < 0.42 ? r2 : randPool(POOL);
  // Prevent jackpot (7s) from triggering too often — if all 7s, 60% re-roll
  if (r1 === "7️⃣" && r2 === "7️⃣" && r3 === "7️⃣" && Math.random() < 0.6) {
    return spinReels();
  }
  return [r1, r2, r3];
}

function getResult(reels: [string,string,string]): { mult: number; label: string; type: "jackpot"|"triple"|"pair"|"miss" } {
  const [a,b,c] = reels;
  const key = a+b+c;
  if (PAYOUTS[key]) {
    const isJackpot = RARE.includes(a);
    return { mult: PAYOUTS[key], label: `${a}${b}${c}`, type: isJackpot ? "jackpot" : "triple" };
  }
  if (a === b || b === c || a === c) return { mult: 1.5, label: "2x", type: "pair" };
  return { mult: 0, label: "", type: "miss" };
}

function Reel({ symbol, spinning, idx, theme }: { symbol: string; spinning: boolean; idx: number; theme: string }) {
  const darkStyles = [
    { bg: "linear-gradient(145deg,#1e1b4b,#312e81)", border: "#6366f166", shadow: "#6366f122" },
    { bg: "linear-gradient(145deg,#2d1b6e,#4c1d95)", border: "#a78bfa66", shadow: "#a78bfa22" },
    { bg: "linear-gradient(145deg,#1e1b4b,#1e40af)", border: "#60a5fa66", shadow: "#60a5fa22" },
  ];
  const lightStyles = [
    { bg: "linear-gradient(145deg,#e0e7ff,#c7d2fe)", border: "#818cf8aa", shadow: "#818cf833" },
    { bg: "linear-gradient(145deg,#ede9fe,#ddd6fe)", border: "#a78bfaaa", shadow: "#a78bfa33" },
    { bg: "linear-gradient(145deg,#e0e7ff,#bfdbfe)", border: "#60a5faaa", shadow: "#60a5fa33" },
  ];
  const blackStyles = [
    { bg: "linear-gradient(145deg,#0a0a14,#111128)", border: "#4f46e566", shadow: "#4f46e522" },
    { bg: "linear-gradient(145deg,#0d0a1e,#150d38)", border: "#7c3aed66", shadow: "#7c3aed22" },
    { bg: "linear-gradient(145deg,#0a0a14,#0a1433)", border: "#2563eb66", shadow: "#2563eb22" },
  ];
  const s = theme === "light" ? lightStyles[idx % 3] : theme === "black" ? blackStyles[idx % 3] : darkStyles[idx % 3];

  return (
    <div className="flex items-center justify-center rounded-2xl relative overflow-hidden"
      style={{
        width: 88, height: 88,
        background: s.bg,
        border: `2px solid ${s.border}`,
        boxShadow: `0 6px 0 rgba(0,0,0,0.4), 0 8px 20px ${s.shadow}, inset 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)`,
        fontSize: 38,
        animation: spinning ? "slotSpin 0.1s linear infinite" : "none",
      }}>
      <div className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, transparent 50%)" }} />
      <span style={{ filter: spinning ? "blur(2px)" : "none", transition: "filter 0.2s", position: "relative", zIndex: 1 }}>
        {spinning ? POOL[Math.floor(Math.random() * POOL.length)] : symbol}
      </span>
    </div>
  );
}

export default function Slots() {
  const { player, refresh } = usePlayer();
  const { t } = useLang();
  const { theme, ts } = useTheme();
  const [betInput, setBetInput] = useState("2000");
  const [reels, setReels] = useState<[string,string,string]>(["🍒","🍒","🍒"]);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<ReturnType<typeof getResult> | null>(null);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeBet = Math.max(Number(betInput) || 2000, 2000);
  const isLight = theme === "light";

  function setQuickBet(action: string) {
    const bal = player?.balance ?? 0;
    let v = activeBet;
    if (action === "MIN") v = 2000;
    else if (action === "MAX") v = Math.min(bal, 500000);
    else if (action === "X2") v = Math.min(activeBet * 2, bal, 500000);
    else if (action === "1/2") v = Math.max(2000, Math.floor(activeBet / 2));
    setBetInput(String(v));
  }

  const spin = useCallback(async () => {
    if (!player || player.balance < activeBet || spinning) return;
    setSpinning(true);
    setSpinResult(null);
    const finalReels = spinReels();

    intervalRef.current = setInterval(() => {
      setReels([
        POOL[Math.floor(Math.random() * POOL.length)],
        POOL[Math.floor(Math.random() * POOL.length)],
        POOL[Math.floor(Math.random() * POOL.length)],
      ]);
    }, 90);

    setTimeout(() => {
      clearInterval(intervalRef.current!);
      setReels(finalReels);
      setSpinning(false);
      const res = getResult(finalReels);
      setSpinResult(res);
      const winAmt = res.mult > 0 ? Math.floor(activeBet * res.mult) : 0;
      setSaving(true);
      placeBet(player.telegramId, { amount: activeBet, game: "slots", won: res.mult > 0, winAmount: winAmt })
        .then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
    }, 2000);
  }, [player, activeBet, spinning]);

  const resultColors: Record<string, { text: string; glow: string; label: string }> = {
    jackpot: { text: "#fbbf24", glow: "0 0 30px #fbbf2499", label: "🏆 JACKPOT!" },
    triple:  { text: "#4ade80", glow: "0 0 20px #4ade8055", label: "✅ 3x!" },
    pair:    { text: "#a5b4fc", glow: "0 0 16px #a5b4fc44", label: "✌️ 2x!" },
    miss:    { text: "#f87171", glow: "none",                label: t.noLuck },
  };
  const rc = spinResult ? resultColors[spinResult.type] : null;
  const winAmt = spinResult && spinResult.mult > 0 ? Math.floor(activeBet * spinResult.mult) : 0;

  // Machine frame BG based on theme
  const machineBg = isLight
    ? "linear-gradient(145deg, #e0e7ff, #c7d2fe)"
    : theme === "black"
      ? "linear-gradient(145deg, #0a0a14, #111128)"
      : "linear-gradient(145deg, #2d1b6e, #1a0a4a)";
  const machineBorder = isLight ? "#818cf8aa" : theme === "black" ? "#4f46e566" : "#7c3aed66";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <style>{`@keyframes slotSpin { 0%{transform:translateY(-6px) scale(1.05)} 50%{transform:translateY(6px) scale(0.95)} 100%{transform:translateY(-6px) scale(1.05)} }`}</style>

      <GameHeader title={`🎰 ${t.slotsTitle}`} subtitle="7️⃣7️⃣7️⃣ = x40 💎💎💎 = x18" />

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4 items-center">

        {/* Slot machine */}
        <div className="w-full rounded-3xl p-5 flex flex-col items-center gap-4 relative overflow-hidden"
          style={{
            background: machineBg,
            border: `2px solid ${machineBorder}`,
            boxShadow: isLight
              ? "0 8px 0 rgba(99,102,241,0.2), 0 12px 32px rgba(99,102,241,0.15), inset 0 2px 0 rgba(255,255,255,0.8)"
              : theme === "black"
                ? "0 8px 0 #000, 0 12px 32px rgba(79,70,229,0.2), inset 0 2px 0 rgba(255,255,255,0.05)"
                : "0 10px 0 #0d0520, 0 14px 40px #7c3aed44, inset 0 2px 0 rgba(255,255,255,0.15)",
          }}>
          <div className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)" }} />

          {/* Reels container */}
          <div className="relative flex gap-3 p-3 rounded-2xl"
            style={{
              background: isLight ? "rgba(99,102,241,0.06)" : "rgba(0,0,0,0.35)",
              border: `1px solid ${isLight ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)"}`,
              boxShadow: "inset 0 4px 12px rgba(0,0,0,0.2)",
            }}>
            {reels.map((s, i) => <Reel key={i} symbol={s} spinning={spinning} idx={i} theme={theme} />)}
          </div>

          {/* Divider */}
          <div className="w-3/4 h-0.5 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${isLight ? "#818cf8" : "#7c3aed"}, transparent)` }} />

          {/* Result display */}
          {spinResult ? (
            <div className="text-center">
              <p className="font-black text-2xl" style={{ color: rc!.text, textShadow: rc!.glow }}>
                {rc!.label} {spinResult.label}
              </p>
              {winAmt > 0 && (
                <p className="font-black text-base mt-1" style={{ color: isLight ? "#059669" : "#4ade80" }}>
                  +{winAmt.toLocaleString()} UZS
                </p>
              )}
            </div>
          ) : spinning ? (
            <p className="font-bold animate-pulse" style={{ color: isLight ? "#4338ca" : "#c4b5fd" }}>{t.spinning}</p>
          ) : (
            <p className="text-sm" style={{ color: ts.textSub }}>{t.pressToSpin}</p>
          )}
        </div>

        {/* Payout table — compact */}
        <div className="w-full rounded-2xl p-4"
          style={{ background: ts.card, border: `1px solid ${ts.cardBorder}`, boxShadow: isLight ? "0 4px 16px rgba(99,102,241,0.08)" : "none" }}>
          <p className="text-xs font-black mb-3 text-center tracking-widest" style={{ color: ts.textSub }}>{t.payoutTable}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(PAYOUTS).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 rounded-xl"
                style={{ background: ts.input, border: `1px solid ${ts.inputBorder}` }}>
                <span style={{ fontSize: 12 }}>{k}</span>
                <span className="font-black text-xs"
                  style={{ color: v >= 18 ? "#fbbf24" : v >= 10 ? "#4ade80" : isLight ? "#6366f1" : "#a5b4fc" }}>
                  x{v}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl"
              style={{ background: ts.input, border: `1px solid ${ts.inputBorder}` }}>
              <span className="text-xs" style={{ color: ts.textSub }}>2x {t.twoSame}</span>
              <span className="font-black text-xs" style={{ color: isLight ? "#6366f1" : "#a5b4fc" }}>x1.5</span>
            </div>
          </div>
        </div>

        {/* Bet */}
        <div className="w-full rounded-2xl p-4"
          style={{ background: ts.card, border: `1px solid ${ts.cardBorder}`, boxShadow: isLight ? "0 4px 16px rgba(99,102,241,0.08)" : "none" }}>
          <p className="text-xs font-bold mb-3 tracking-widest" style={{ color: ts.textSub }}>💰 {t.betAmount}</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {["MIN","1/2","X2","MAX"].map(a => (
              <button key={a} onClick={() => setQuickBet(a)}
                className="py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                style={{ background: ts.btnSecondary, color: ts.btnSecondaryText, border: `1px solid ${ts.cardBorder}`, boxShadow: "0 2px 0 rgba(0,0,0,0.15)" }}>
                {a}
              </button>
            ))}
          </div>
          <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)}
            className="w-full rounded-xl px-4 py-3 font-black text-center text-lg outline-none"
            style={{ background: ts.input, border: `1px solid ${ts.inputBorder}`, color: ts.text }}
            placeholder="2000" min={2000} />
        </div>

        {/* Spin button */}
        <button onClick={spin}
          disabled={!player || player.balance < activeBet || spinning}
          className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 transition-all disabled:opacity-40"
          style={{
            background: spinning
              ? (isLight ? "rgba(99,102,241,0.3)" : "rgba(124,58,237,0.35)")
              : (isLight ? "linear-gradient(145deg, #4f46e5, #6d28d9)" : "linear-gradient(145deg, #7c3aed, #4f46e5)"),
            boxShadow: spinning ? "none" : (isLight ? "0 6px 0 #312e81, 0 8px 24px rgba(79,70,229,0.4)" : "0 7px 0 #3b1278, 0 10px 28px #7c3aed55"),
            color: spinning ? (isLight ? "#6d28d9" : "#c4b5fd") : "white",
          }}>
          {spinning ? t.spinning : `🎰 ${t.spinBtn}`}
        </button>

        {saving && <p className="text-xs text-center" style={{ color: ts.textSub }}>{t.saving}</p>}
      </div>
    </div>
  );
}
