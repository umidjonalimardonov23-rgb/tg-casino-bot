import { useState, useRef, useCallback } from "react";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { placeBet } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

const FRUITS = ["🍒","🍊","🍋","🍇","🍉","🍓"];
const ALL    = ["🍒","🍊","🍋","🍇","🍉","🍓","⭐","💎","7️⃣"];

// Deterministic outcome first, then generate reels to match
function spinReels(): { reels: [string,string,string]; outcome: "jackpot"|"three"|"two"|"miss" } {
  const r = Math.random();
  if (r < 0.01) {
    // 1% — Jackpot 777 = x10
    return { reels: ["7️⃣","7️⃣","7️⃣"], outcome: "jackpot" };
  } else if (r < 0.08) {
    // 7% — 3 of a kind fruit = x3
    const sym = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    return { reels: [sym, sym, sym], outcome: "three" };
  } else if (r < 0.33) {
    // 25% — 2 of a kind = x1.5
    const sym = ALL[Math.floor(Math.random() * ALL.length)];
    const others = ALL.filter(s => s !== sym);
    const diff = others[Math.floor(Math.random() * others.length)];
    const pos = Math.floor(Math.random() * 3);
    const reels: [string,string,string] = [sym, sym, sym];
    reels[pos] = diff;
    return { reels, outcome: "two" };
  } else {
    // 67% — Miss
    const s1 = ALL[Math.floor(Math.random() * ALL.length)];
    let s2 = ALL[Math.floor(Math.random() * ALL.length)];
    while (s2 === s1) s2 = ALL[Math.floor(Math.random() * ALL.length)];
    let s3 = ALL[Math.floor(Math.random() * ALL.length)];
    while (s3 === s1 || s3 === s2) s3 = ALL[Math.floor(Math.random() * ALL.length)];
    return { reels: [s1, s2, s3], outcome: "miss" };
  }
}

function Reel({ symbol, spinning, idx, theme }: { symbol: string; spinning: boolean; idx: number; theme: string }) {
  const bgs = {
    dark:  ["linear-gradient(145deg,#1e1b4b,#312e81)","linear-gradient(145deg,#2d1b6e,#4c1d95)","linear-gradient(145deg,#1e1b4b,#1e40af)"],
    light: ["linear-gradient(145deg,#e0e7ff,#c7d2fe)","linear-gradient(145deg,#ede9fe,#ddd6fe)","linear-gradient(145deg,#dbeafe,#bfdbfe)"],
    black: ["linear-gradient(145deg,#0a0a14,#111128)","linear-gradient(145deg,#0d0a1e,#150d38)","linear-gradient(145deg,#0a0a14,#0a1433)"],
  };
  const borders = {
    dark:  ["#6366f166","#a78bfa66","#60a5fa66"],
    light: ["#818cf8aa","#a78bfaaa","#60a5faaa"],
    black: ["#4f46e566","#7c3aed66","#2563eb66"],
  };
  const t = theme as keyof typeof bgs;
  return (
    <div className="flex items-center justify-center rounded-2xl relative overflow-hidden"
      style={{
        width: 88, height: 88,
        background: bgs[t][idx % 3],
        border: `2px solid ${borders[t][idx % 3]}`,
        boxShadow: `0 6px 0 rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.3), inset 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)`,
        fontSize: 38,
        animation: spinning ? "slotSpin 0.1s linear infinite" : "none",
      }}>
      <div className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, transparent 50%)" }} />
      <span style={{ filter: spinning ? "blur(2px)" : "none", transition: "filter 0.2s", position: "relative", zIndex: 1 }}>
        {spinning ? ALL[Math.floor(Math.random() * ALL.length)] : symbol}
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
  const [outcome, setOutcome] = useState<"jackpot"|"three"|"two"|"miss"|null>(null);
  const [winAmt, setWinAmt] = useState(0);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeBet = Math.max(Number(betInput) || 2000, 2000);
  const isLight = theme === "light";

  function setQuickBet(a: string) {
    const bal = player?.balance ?? 0;
    let v = activeBet;
    if (a === "MIN") v = 2000;
    else if (a === "MAX") v = Math.min(bal, 500000);
    else if (a === "X2") v = Math.min(activeBet * 2, bal, 500000);
    else if (a === "1/2") v = Math.max(2000, Math.floor(activeBet / 2));
    setBetInput(String(v));
  }

  const spin = useCallback(async () => {
    if (!player || player.balance < activeBet || spinning) return;
    setSpinning(true);
    setOutcome(null);
    const { reels: finalReels, outcome: finalOutcome } = spinReels();

    intervalRef.current = setInterval(() => {
      setReels([
        ALL[Math.floor(Math.random() * ALL.length)],
        ALL[Math.floor(Math.random() * ALL.length)],
        ALL[Math.floor(Math.random() * ALL.length)],
      ]);
    }, 90);

    setTimeout(() => {
      clearInterval(intervalRef.current!);
      setReels(finalReels);
      setSpinning(false);
      setOutcome(finalOutcome);

      const mult = finalOutcome === "jackpot" ? 10 : finalOutcome === "three" ? 3 : finalOutcome === "two" ? 1.5 : 0;
      const win = mult > 0 ? Math.floor(activeBet * mult) : 0;
      setWinAmt(win);

      setSaving(true);
      placeBet(player.telegramId, { amount: activeBet, game: "slots", won: mult > 0, winAmount: win })
        .then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
    }, 2000);
  }, [player, activeBet, spinning]);

  const OUTCOME_STYLE = {
    jackpot: { color: "#fbbf24", glow: "0 0 30px #fbbf2499", label: "🏆 JACKPOT! x10" },
    three:   { color: "#4ade80", glow: "0 0 20px #4ade8055", label: `✅ 3x! x3` },
    two:     { color: isLight ? "#6366f1" : "#a5b4fc", glow: "none", label: `✌️ 2x! x1.5` },
    miss:    { color: "#f87171", glow: "none", label: t.noLuck },
  };

  const machineBg = isLight
    ? "linear-gradient(145deg, #e0e7ff, #c7d2fe)"
    : theme === "black"
      ? "linear-gradient(145deg, #0a0a14, #111128)"
      : "linear-gradient(145deg, #2d1b6e, #1a0a4a)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <style>{`@keyframes slotSpin { 0%{transform:translateY(-5px) scale(1.04)} 50%{transform:translateY(5px) scale(0.96)} 100%{transform:translateY(-5px) scale(1.04)} }`}</style>
      <GameHeader title={`🎰 ${t.slotsTitle}`} subtitle="777 · Mevaları · Kombinatsiyalar" />

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4 items-center">

        {/* Slot machine */}
        <div className="w-full rounded-3xl p-5 flex flex-col items-center gap-4 relative overflow-hidden"
          style={{
            background: machineBg,
            border: `2px solid ${isLight ? "#818cf8aa" : theme === "black" ? "#4f46e566" : "#7c3aed66"}`,
            boxShadow: isLight ? "0 8px 0 rgba(99,102,241,0.2), 0 12px 32px rgba(99,102,241,0.15), inset 0 2px 0 rgba(255,255,255,0.8)"
              : theme === "black" ? "0 8px 0 #000, 0 12px 32px rgba(79,70,229,0.15)"
              : "0 10px 0 #0d0520, 0 14px 40px #7c3aed44, inset 0 2px 0 rgba(255,255,255,0.12)",
          }}>
          <div className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)" }} />

          {/* Reels */}
          <div className="relative flex gap-3 p-3 rounded-2xl"
            style={{
              background: isLight ? "rgba(99,102,241,0.07)" : "rgba(0,0,0,0.3)",
              border: `1px solid ${isLight ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.05)"}`,
              boxShadow: "inset 0 4px 12px rgba(0,0,0,0.2)",
            }}>
            {reels.map((s, i) => <Reel key={i} symbol={s} spinning={spinning} idx={i} theme={theme} />)}
          </div>

          <div className="w-3/4 h-0.5 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${isLight ? "#818cf8" : "#7c3aed"}, transparent)` }} />

          {/* Result */}
          {outcome ? (
            <div className="text-center">
              <p className="font-black text-2xl" style={{ color: OUTCOME_STYLE[outcome].color, textShadow: OUTCOME_STYLE[outcome].glow }}>
                {OUTCOME_STYLE[outcome].label}
              </p>
              {winAmt > 0 && <p className="font-bold text-sm mt-1" style={{ color: isLight ? "#059669" : "#4ade80" }}>+{winAmt.toLocaleString()} UZS</p>}
            </div>
          ) : spinning ? (
            <p className="font-bold animate-pulse" style={{ color: isLight ? "#4338ca" : "#c4b5fd" }}>{t.spinning}</p>
          ) : (
            <p className="text-sm" style={{ color: ts.textSub }}>{t.pressToSpin}</p>
          )}
        </div>

        {/* Payout table — simple 3 rows */}
        <div className="w-full rounded-2xl p-4"
          style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
          <p className="text-xs font-black mb-3 text-center tracking-widest" style={{ color: ts.textSub }}>{t.payoutTable}</p>
          <div className="flex flex-col gap-1.5">
            {[
              { label: "7️⃣7️⃣7️⃣  JACKPOT", mult: "x10", color: "#fbbf24" },
              { label: `3x bir xil meva`, mult: "x3", color: "#4ade80" },
              { label: `2x bir xil`, mult: "x1.5", color: isLight ? "#6366f1" : "#a5b4fc" },
              { label: "Boshqa kombinatsiya", mult: "❌", color: "#f87171" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: ts.input, border: `1px solid ${ts.inputBorder}` }}>
                <span className="text-sm" style={{ color: ts.text }}>{row.label}</span>
                <span className="font-black text-sm" style={{ color: row.color }}>{row.mult}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bet */}
        <div className="w-full rounded-2xl p-4"
          style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
          <p className="text-xs font-bold mb-3 tracking-widest" style={{ color: ts.textSub }}>💰 {t.betAmount}</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {["MIN","1/2","X2","MAX"].map(a => (
              <button key={a} onClick={() => setQuickBet(a)}
                className="py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                style={{ background: ts.btnSecondary, color: ts.btnSecondaryText, border: `1px solid ${ts.cardBorder}`, boxShadow: "0 2px 0 rgba(0,0,0,0.1)" }}>
                {a}
              </button>
            ))}
          </div>
          <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)}
            className="w-full rounded-xl px-4 py-3 font-black text-center text-lg outline-none"
            style={{ background: ts.input, border: `1px solid ${ts.inputBorder}`, color: ts.text }}
            placeholder="2000" min={2000} />
        </div>

        <button onClick={spin}
          disabled={!player || player.balance < activeBet || spinning}
          className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 transition-all disabled:opacity-40"
          style={{
            background: spinning ? "rgba(124,58,237,0.3)" : (isLight ? "linear-gradient(145deg,#4f46e5,#6d28d9)" : "linear-gradient(145deg,#7c3aed,#4f46e5)"),
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
