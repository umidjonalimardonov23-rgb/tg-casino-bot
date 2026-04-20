import { useState, useCallback } from "react";
import { usePlayer } from "@/lib/player-context";
import { useTheme } from "@/lib/theme-context";
import { placeBet } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

type BetType = "more" | "equal" | "less";
type GameState = "idle" | "rolling" | "result";

const ODDS: Record<BetType, { label: string; mult: number; emoji: string; color: string; glow: string }> = {
  less:  { label: "7 dan Kam",  mult: 2.3, emoji: "⬇️", color: "#60a5fa", glow: "#3b82f633" },
  equal: { label: "Teng 7",     mult: 5.8, emoji: "🎯", color: "#fbbf24", glow: "#f59e0b33" },
  more:  { label: "7 dan Ko'p", mult: 2.3, emoji: "⬆️", color: "#34d399", glow: "#10b98133" },
};

function DiceFace({ value, rolling }: { value: number; rolling: boolean }) {
  const dots: Record<number, [number, number][]> = {
    1: [[50,50]],
    2: [[30,30],[70,70]],
    3: [[30,30],[50,50],[70,70]],
    4: [[30,30],[70,30],[30,70],[70,70]],
    5: [[30,30],[70,30],[50,50],[30,70],[70,70]],
    6: [[30,22],[70,22],[30,50],[70,50],[30,78],[70,78]],
  };
  const v = Math.max(1, Math.min(6, value));
  return (
    <div className={rolling ? "animate-spin" : ""}
      style={{
        width: 90, height: 90, borderRadius: 20, position: "relative",
        background: "linear-gradient(145deg, #ffffff 0%, #e2e8f0 100%)",
        boxShadow: rolling
          ? "0 0 30px #a78bfa99, 0 8px 24px rgba(0,0,0,0.5)"
          : "4px 4px 16px rgba(0,0,0,0.5), -2px -2px 8px rgba(255,255,255,0.05), inset 0 2px 0 rgba(255,255,255,0.7)",
        transition: "box-shadow 0.2s",
      }}>
      {dots[v].map(([x, y], i) => (
        <div key={i} style={{
          position: "absolute", width: 13, height: 13, borderRadius: "50%",
          left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)",
          background: "linear-gradient(145deg, #1e1b4b, #312e81)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
        }} />
      ))}
    </div>
  );
}

export default function Dice() {
  const { player, refresh } = usePlayer();
  const { theme, ts } = useTheme();
  const [betInput, setBetInput] = useState("2000");
  const [betType, setBetType] = useState<BetType | null>(null);
  const [dice, setDice] = useState<[number, number]>([1, 1]);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [won, setWon] = useState(false);
  const [prize, setPrize] = useState(0);
  const [saving, setSaving] = useState(false);

  const isLight = theme === "light";
  const activeBet = Math.max(Number(betInput) || 2000, 0);
  const potential = betType ? Math.floor(activeBet * ODDS[betType].mult) : 0;
  const sum = dice[0] + dice[1];

  function setQuickBet(action: string) {
    const bal = player?.balance ?? 0;
    let v = activeBet;
    if (action === "MIN") v = 2000;
    else if (action === "MAX") v = Math.min(bal, 500000);
    else if (action === "X2") v = Math.min(activeBet * 2, bal, 500000);
    else if (action === "X/2") v = Math.max(Math.floor(activeBet / 2), 2000);
    setBetInput(String(v));
  }

  const roll = useCallback(async () => {
    if (!betType || !player || player.balance < activeBet || activeBet < 2000) return;
    setGameState("rolling");
    let frame = 0;
    const interval = setInterval(async () => {
      setDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
      frame++;
      if (frame >= 18) {
        clearInterval(interval);
        const d1 = Math.ceil(Math.random() * 6);
        const d2 = Math.ceil(Math.random() * 6);
        const s = d1 + d2;
        setDice([d1, d2]);
        const win = (betType === "more" && s > 7) || (betType === "equal" && s === 7) || (betType === "less" && s < 7);
        const winPrize = win ? Math.floor(activeBet * ODDS[betType].mult) : 0;
        setWon(win); setPrize(winPrize); setGameState("result");
        setSaving(true);
        await placeBet(player.telegramId, { amount: activeBet, game: "dice", won: win, winAmount: winPrize }).catch(() => {});
        await refresh(); setSaving(false);
      }
    }, 70);
  }, [betType, activeBet, player, refresh]);

  const accentGradient = isLight
    ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
    : "linear-gradient(135deg, #7c3aed, #a855f7)";
  const accentShadow = isLight
    ? "0 8px 0 #312e81, 0 10px 30px rgba(79,70,229,0.45)"
    : "0 8px 0 #3b1278, 0 10px 30px rgba(124,58,237,0.5)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <GameHeader title="🎲 DICE" subtitle="7 dan Kam · Teng · 7 dan Ko'p" />

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">

        {/* Dice display */}
        <div className="rounded-3xl p-6 relative overflow-hidden flex flex-col items-center gap-4"
          style={{
            background: ts.card,
            border: `1px solid ${ts.cardBorder}`,
            boxShadow: isLight
              ? "0 8px 32px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.9)"
              : "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}>

          {/* Glow behind dice */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: gameState === "rolling"
              ? "radial-gradient(ellipse at 50% 30%, rgba(167,139,250,0.18) 0%, transparent 65%)"
              : "radial-gradient(ellipse at 50% 30%, rgba(124,58,237,0.08) 0%, transparent 65%)",
            transition: "background 0.4s",
          }} />

          <div className="relative flex items-center gap-6">
            <DiceFace value={dice[0]} rolling={gameState === "rolling"} />
            <div className="flex flex-col items-center gap-2">
              <span className="font-black text-3xl" style={{ color: isLight ? "#c4b5fd" : "rgba(196,181,253,0.35)" }}>+</span>
              {gameState !== "idle" && (
                <div className="px-4 py-1.5 rounded-2xl"
                  style={{ background: isLight ? "rgba(99,102,241,0.12)" : "rgba(167,139,250,0.15)", border: `1px solid ${isLight ? "rgba(99,102,241,0.25)" : "rgba(167,139,250,0.3)"}` }}>
                  <span className="font-black text-2xl" style={{ color: isLight ? "#4338ca" : "#c4b5fd" }}>{sum}</span>
                </div>
              )}
            </div>
            <DiceFace value={dice[1]} rolling={gameState === "rolling"} />
          </div>

          {gameState === "rolling" && (
            <p className="text-sm font-bold animate-pulse" style={{ color: isLight ? "#7c3aed" : "#c4b5fd" }}>🎲 Aylanmoqda...</p>
          )}
          {gameState === "result" && (
            <div className="text-center">
              <p className="text-3xl mb-1">{won ? "🎉" : "💔"}</p>
              <p className="font-black text-2xl" style={{ color: won ? "#4ade80" : "#f87171" }}>
                {won ? `+${prize.toLocaleString()} UZS` : "Yutqazdingiz!"}
              </p>
              {won && (
                <p className="text-xs mt-1" style={{ color: "#4ade8088" }}>x{ODDS[betType!].mult} koeffitsiyent</p>
              )}
            </div>
          )}
          {gameState === "idle" && (
            <p className="text-sm" style={{ color: ts.textSub }}>Taxmin tanlang va o'ynang</p>
          )}
        </div>

        {/* Bet type cards */}
        <div className="rounded-2xl p-4" style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
          <p className="text-xs font-black mb-3 tracking-widest" style={{ color: ts.textSub }}>TAXMIN TANLANG</p>
          <div className="grid grid-cols-3 gap-2">
            {(["less", "equal", "more"] as BetType[]).map((type) => {
              const o = ODDS[type];
              const sel = betType === type;
              return (
                <button key={type} onClick={() => setBetType(type)} disabled={gameState === "rolling"}
                  className="flex flex-col items-center py-4 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: sel
                      ? (isLight ? `${o.color}20` : `${o.color}15`)
                      : ts.input,
                    border: sel ? `1.5px solid ${o.color}88` : `1px solid ${ts.inputBorder}`,
                    boxShadow: sel ? `0 4px 20px ${o.glow}, 0 2px 0 rgba(0,0,0,0.15)` : "0 2px 0 rgba(0,0,0,0.1)",
                  }}>
                  <span className="text-xl mb-1.5">{o.emoji}</span>
                  <span className="text-xs font-semibold mb-1" style={{ color: sel ? o.color : ts.textSub }}>{o.label}</span>
                  <span className="font-black text-xl" style={{ color: sel ? o.color : ts.text }}>x{o.mult}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bet controls */}
        <div className="rounded-2xl p-4" style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
          <p className="text-xs font-bold mb-3 tracking-widest" style={{ color: ts.textSub }}>💰 TIKISH MIQDORI</p>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {["MIN","X2","X/2","MAX"].map((a) => (
              <button key={a} disabled={gameState === "rolling"} onClick={() => setQuickBet(a)}
                className="py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                style={{ background: ts.btnSecondary, color: ts.btnSecondaryText, border: `1px solid ${ts.cardBorder}`, boxShadow: "0 2px 0 rgba(0,0,0,0.1)" }}>
                {a}
              </button>
            ))}
          </div>
          <div className="relative mb-1">
            <input type="number" placeholder="min 2 000" value={betInput}
              disabled={gameState === "rolling"}
              onChange={(e) => setBetInput(e.target.value)}
              className="w-full rounded-xl px-4 py-3 font-black text-lg outline-none"
              style={{ background: ts.input, border: `1px solid ${ts.inputBorder}`, color: ts.text }} />
            {betType && activeBet >= 2000 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black" style={{ color: "#4ade80" }}>
                → {potential.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Roll buttons */}
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => { setGameState("idle"); setPrize(0); }} disabled={gameState === "rolling"}
            className="py-4 rounded-2xl flex items-center justify-center text-xl active:scale-95 transition-transform"
            style={{ background: ts.btnSecondary, border: `1px solid ${ts.cardBorder}`, boxShadow: "0 4px 0 rgba(0,0,0,0.2)" }}>
            🔄
          </button>
          <button onClick={roll}
            disabled={gameState === "rolling" || !betType || !player || player.balance < activeBet || activeBet < 2000 || saving}
            className="col-span-3 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
            style={{ background: accentGradient, boxShadow: accentShadow, color: "white" }}>
            {gameState === "rolling" ? "🎲 Aylanmoqda..." : "🎲 ZAR TASHLASH"}
          </button>
        </div>

        {saving && <p className="text-xs text-center" style={{ color: ts.textSub }}>Saqlanmoqda...</p>}
      </div>
    </div>
  );
}
