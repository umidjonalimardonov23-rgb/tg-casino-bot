import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { placeBet } from "@/lib/api";

const SYMBOLS = ["🍒","🍊","🍋","🍇","💎","7️⃣","⭐","🔔"];
const PAYOUTS: Record<string, number> = {
  "7️⃣7️⃣7️⃣": 50, "💎💎💎": 20, "⭐⭐⭐": 10, "🔔🔔🔔": 7,
  "🍇🍇🍇": 5,  "🍋🍋🍋": 4,  "🍊🍊🍊": 3,  "🍒🍒🍒": 2,
};

function getResult(reels: string[]): { mult: number; label: string } {
  const key = reels.join("");
  if (PAYOUTS[key]) return { mult: PAYOUTS[key], label: `${reels[0]}${reels[1]}${reels[2]} x${PAYOUTS[key]}!` };
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) return { mult: 1.5, label: "2x x1.5" };
  return { mult: 0, label: "" };
}

function Reel({ symbol, spinning, idx }: { symbol: string; spinning: boolean; idx: number }) {
  const colors = [
    { bg: "linear-gradient(145deg,#1e1b4b,#312e81)", border: "#6366f155", glow: "#6366f133" },
    { bg: "linear-gradient(145deg,#2d1b6e,#4c1d95)", border: "#a78bfa55", glow: "#a78bfa33" },
    { bg: "linear-gradient(145deg,#1e1b4b,#312e81)", border: "#818cf855", glow: "#818cf833" },
  ];
  const c = colors[idx % 3];
  return (
    <div className="flex items-center justify-center rounded-2xl relative overflow-hidden"
      style={{
        width: 90, height: 90,
        background: c.bg,
        border: `2px solid ${c.border}`,
        boxShadow: `0 6px 0 rgba(0,0,0,0.5), 0 8px 20px ${c.glow}, inset 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
        fontSize: 40,
        transition: "all 0.3s",
        animation: spinning ? "spinReel 0.08s linear infinite" : "none",
      }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, transparent 50%)" }} />
      <span style={{ filter: spinning ? "blur(3px)" : "none", transition: "filter 0.3s", position: "relative" }}>
        {spinning ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : symbol}
      </span>
    </div>
  );
}

export default function Slots() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();
  const { t } = useLang();
  const [betInput, setBetInput] = useState("2000");
  const [reels, setReels] = useState(["🎰","🎰","🎰"]);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<{ mult: number; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeBet = Math.max(Number(betInput) || 2000, 2000);

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
    const finalReels = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    ];
    intervalRef.current = setInterval(() => {
      setReels(prev => prev.map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]));
    }, 80);
    setTimeout(() => {
      clearInterval(intervalRef.current!);
      setReels(finalReels);
      setSpinning(false);
      const res = getResult(finalReels);
      if (res.mult === 1.5) res.label = `2x ${t.twoSame} x1.5`;
      else if (res.mult === 0) res.label = t.noLuck;
      setSpinResult(res);
      const winAmt = Math.floor(activeBet * res.mult);
      setSaving(true);
      placeBet(player.telegramId, { amount: activeBet, game: "slots", won: res.mult > 0, winAmount: winAmt })
        .then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
    }, 1800);
  }, [player, activeBet, spinning]);

  const isWin = spinResult && spinResult.mult > 0;
  const winAmt = spinResult ? Math.floor(activeBet * spinResult.mult) : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #1a0533 0%, #0f0528 50%, #1a0533 100%)" }}>
      <style>{`@keyframes spinReel { 0%{transform:translateY(-5px)} 50%{transform:translateY(5px)} 100%{transform:translateY(-5px)} }`}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={() => nav("/")}
          className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 4px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div>
          <p className="text-white font-black text-lg">🎰 {t.slotsTitle}</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>7️⃣7️⃣7️⃣ = x50!</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{t.balanceLabel}</p>
          <p className="text-white font-black text-sm">{(player?.balance ?? 0).toLocaleString()} UZS</p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4 items-center">

        {/* Slot machine — 3D */}
        <div className="w-full rounded-3xl p-6 flex flex-col items-center gap-5 mt-2 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #2d1b6e, #1a0a4a)",
            border: "2px solid #7c3aed55",
            boxShadow: "0 10px 0 #0d0520, 0 14px 40px #7c3aed33, inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.4)",
          }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)" }} />
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.6), transparent)" }} />

          {/* Slot border/frame */}
          <div className="relative flex gap-3 p-3 rounded-2xl"
            style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "inset 0 4px 12px rgba(0,0,0,0.6)" }}>
            {reels.map((s, i) => <Reel key={i} symbol={s} spinning={spinning} idx={i} />)}
          </div>

          <div className="w-full h-0.5 rounded-full" style={{ background: "linear-gradient(90deg, transparent, #7c3aed88, transparent)" }} />

          {/* Result */}
          {spinResult ? (
            <div className="text-center">
              <p className="font-black text-xl" style={{ color: isWin ? "#fbbf24" : "#f87171", textShadow: isWin ? "0 0 20px #fbbf2488" : "none" }}>
                {spinResult.label}
              </p>
              {isWin && (
                <p className="text-white font-bold text-sm mt-1">
                  +{winAmt.toLocaleString()} UZS
                </p>
              )}
            </div>
          ) : spinning ? (
            <p className="text-white font-bold animate-pulse">{t.spinning}</p>
          ) : (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>{t.pressToSpin}</p>
          )}
        </div>

        {/* Payout table */}
        <div className="w-full rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-black mb-3 text-center tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>💰 {t.payoutTable}</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PAYOUTS).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 13 }}>{k}</span>
                <span className="font-black text-xs" style={{ color: v >= 20 ? "#fbbf24" : v >= 10 ? "#4ade80" : "#a5b4fc" }}>x{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 13 }}>2 {t.twoSame}</span>
              <span className="font-black text-xs" style={{ color: "#a5b4fc" }}>x1.5</span>
            </div>
          </div>
        </div>

        {/* Bet */}
        <div className="w-full rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-bold mb-3 tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>💰 {t.betAmount}</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {["MIN","1/2","X2","MAX"].map(a => (
              <button key={a} onClick={() => setQuickBet(a)}
                className="py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.07)", color: "#a5b4fc", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 2px 0 rgba(0,0,0,0.3)" }}>
                {a}
              </button>
            ))}
          </div>
          <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-white font-black text-center text-lg outline-none"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            placeholder="2000" min={2000} />
        </div>

        <button onClick={spin}
          disabled={!player || player.balance < activeBet || spinning}
          className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 transition-all disabled:opacity-40"
          style={{
            background: spinning ? "rgba(124,58,237,0.4)" : "linear-gradient(145deg, #7c3aed, #6d28d9)",
            boxShadow: spinning ? "none" : "0 7px 0 #3b1278, 0 10px 28px #7c3aed55",
            color: "white",
          }}>
          {spinning ? t.spinning : `🎰 ${t.spinBtn}`}
        </button>

        {saving && <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{t.saving}</p>}
      </div>
    </div>
  );
}
