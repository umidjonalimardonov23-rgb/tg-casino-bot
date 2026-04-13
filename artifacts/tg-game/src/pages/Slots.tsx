import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { placeBet } from "@/lib/api";

const SYMBOLS = ["🍒","🍊","🍋","🍇","💎","7️⃣","⭐","🔔"];
const PAYOUTS: Record<string, number> = {
  "7️⃣7️⃣7️⃣": 50,
  "💎💎💎": 20,
  "⭐⭐⭐": 10,
  "🔔🔔🔔": 7,
  "🍇🍇🍇": 5,
  "🍋🍋🍋": 4,
  "🍊🍊🍊": 3,
  "🍒🍒🍒": 2,
};

function getResult(reels: string[]): { mult: number; label: string } {
  const key = reels.join("");
  if (PAYOUTS[key]) return { mult: PAYOUTS[key], label: `${reels[0]}${reels[1]}${reels[2]} x${PAYOUTS[key]}!` };
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) return { mult: 1.5, label: "Ikki bir xil! x1.5" };
  return { mult: 0, label: "Omad yo'q 😔" };
}

function Reel({ symbol, spinning }: { symbol: string; spinning: boolean }) {
  return (
    <div className="flex items-center justify-center rounded-2xl"
      style={{
        width: 88, height: 88,
        background: "linear-gradient(145deg, #1e1b4b, #2e2b5b)",
        border: "2px solid rgba(255,255,255,0.12)",
        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
        fontSize: 40,
        transition: spinning ? "none" : "all 0.3s",
        animation: spinning ? "spinReel 0.1s linear infinite" : "none",
        overflow: "hidden",
      }}>
      <span style={{ filter: spinning ? "blur(3px)" : "none", transition: "filter 0.3s" }}>
        {spinning ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : symbol}
      </span>
    </div>
  );
}

export default function Slots() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();
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

    // Pick final result
    const finalReels = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    ];

    // Spin animation
    let tick = 0;
    const animate = () => {
      setReels(prev => prev.map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]));
      tick++;
    };
    intervalRef.current = setInterval(animate, 80);

    setTimeout(() => {
      clearInterval(intervalRef.current!);
      setReels(finalReels);
      setSpinning(false);
      const res = getResult(finalReels);
      setSpinResult(res);

      const winAmt = Math.floor(activeBet * res.mult);
      setSaving(true);
      placeBet(player.telegramId, {
        amount: activeBet,
        game: "slots",
        won: res.mult > 0,
        winAmount: winAmt,
      }).then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
    }, 1800);
  }, [player, activeBet, spinning]);

  const isWin = spinResult && spinResult.mult > 0;
  const winAmt = spinResult ? Math.floor(activeBet * spinResult.mult) : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #1a0533 0%, #0f0528 50%, #1a0533 100%)" }}>
      <style>{`@keyframes spinReel { 0%{transform:translateY(-4px)} 50%{transform:translateY(4px)} 100%{transform:translateY(-4px)} }`}</style>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={() => nav("/")} className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div>
          <p className="text-white font-black text-lg">🎰 Slots</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>7️⃣7️⃣7️⃣ = x50!</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Balans</p>
          <p className="text-white font-black text-sm">{(player?.balance ?? 0).toLocaleString()} UZS</p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4 items-center">

        {/* Slot machine */}
        <div className="w-full rounded-3xl p-6 flex flex-col items-center gap-5 mt-4"
          style={{ background: "linear-gradient(145deg, #2d1b6e, #1a0a4a)", border: "2px solid #7c3aed55", boxShadow: "0 16px 48px #7c3aed33" }}>

          {/* Reels */}
          <div className="flex gap-3">
            {reels.map((s, i) => <Reel key={i} symbol={s} spinning={spinning} />)}
          </div>

          {/* Divider lines */}
          <div className="w-full h-0.5 rounded-full" style={{ background: "linear-gradient(90deg, transparent, #7c3aed66, transparent)" }} />

          {/* Result */}
          {spinResult ? (
            <div className="text-center">
              <p className="font-black text-lg" style={{ color: isWin ? "#fbbf24" : "#f87171" }}>{spinResult.label}</p>
              {isWin && <p className="text-white font-bold text-sm mt-1">+{winAmt.toLocaleString()} UZS</p>}
            </div>
          ) : spinning ? (
            <p className="text-white font-bold animate-pulse">🎰 Aylanmoqda...</p>
          ) : (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Spin tugmasini bosing!</p>
          )}
        </div>

        {/* Payout table */}
        <div className="w-full rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-black mb-3 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>💰 TO'LOV JADVALI</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PAYOUTS).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 13 }}>{k}</span>
                <span className="font-black text-xs" style={{ color: v >= 20 ? "#fbbf24" : v >= 10 ? "#4ade80" : "#a5b4fc" }}>x{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 13 }}>2 bir xil</span>
              <span className="font-black text-xs" style={{ color: "#a5b4fc" }}>x1.5</span>
            </div>
          </div>
        </div>

        {/* Bet */}
        <div className="w-full rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>💰 TIKISH MIQDORI</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {["MIN","1/2","X2","MAX"].map(a => (
              <button key={a} onClick={() => setQuickBet(a)}
                className="py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.07)", color: "#a5b4fc", border: "1px solid rgba(255,255,255,0.1)" }}>
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
          className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 transition-transform disabled:opacity-40"
          style={{ background: spinning ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 8px 24px #7c3aed55", color: "white" }}>
          {spinning ? "🎰 Aylanmoqda..." : "🎰 SPIN!"}
        </button>

        {saving && <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Saqlanmoqda...</p>}
      </div>
    </div>
  );
}
