import { useState, useCallback, useRef } from "react";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { placeBet } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

type BetType = "even" | "odd" | "small" | "big";
type GameState = "idle" | "rolling" | "result";

export default function Parity() {
  const { player, refresh } = usePlayer();
  const { t } = useLang();
  const { theme, ts } = useTheme();
  const [betInput, setBetInput] = useState("2000");
  const [betType, setBetType] = useState<BetType | null>(null);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [drawnNum, setDrawnNum] = useState<number | null>(null);
  const [displayNum, setDisplayNum] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [prize, setPrize] = useState(0);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeBet = Math.max(Number(betInput) || 2000, 2000);
  const isLight = theme === "light";

  // Number drawn from 1-90 for true 50/50:
  // Even numbers in 1-90: 2,4...90 = 45 numbers (50%)
  // Odd: 1,3...89 = 45 numbers (50%)
  // Small: 1-45 = 45 numbers (50%)
  // Big: 46-90 = 45 numbers (50%)

  const BET_OPTIONS: { type: BetType; label: string; sub: string; emoji: string; color: string; bg: string; shadow: string }[] = [
    { type: "even",  label: t.even,  sub: "2,4,6...90", emoji: "2️⃣",
      color: "#60a5fa", bg: "linear-gradient(145deg,#1e3a5f,#1e40af)", shadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(37,99,235,0.5)" },
    { type: "odd",   label: t.odd,   sub: "1,3,5...89", emoji: "1️⃣",
      color: "#f87171", bg: "linear-gradient(145deg,#7f1d1d,#dc2626)", shadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(220,38,38,0.5)" },
    { type: "small", label: t.small, sub: "1–45",       emoji: "⬇️",
      color: "#4ade80", bg: "linear-gradient(145deg,#064e3b,#059669)", shadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(5,150,105,0.5)" },
    { type: "big",   label: t.big,   sub: "46–90",      emoji: "⬆️",
      color: "#fbbf24", bg: "linear-gradient(145deg,#78350f,#d97706)", shadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(217,119,6,0.5)" },
  ];

  function setQuickBet(a: string) {
    const bal = player?.balance ?? 0;
    let v = activeBet;
    if (a === "MIN") v = 2000;
    else if (a === "MAX") v = Math.min(bal, 500000);
    else if (a === "X2") v = Math.min(activeBet * 2, bal, 500000);
    else if (a === "1/2") v = Math.max(2000, Math.floor(activeBet / 2));
    setBetInput(String(v));
  }

  const play = useCallback(async () => {
    if (!player || !betType || player.balance < activeBet || gameState === "rolling") return;
    setGameState("rolling");
    setDrawnNum(null); setDisplayNum(null); setWon(false); setPrize(0);

    const final = Math.floor(Math.random() * 90) + 1; // 1-90

    let ticks = 0;
    intervalRef.current = setInterval(() => {
      setDisplayNum(Math.floor(Math.random() * 90) + 1);
      ticks++;
      if (ticks >= 22) {
        clearInterval(intervalRef.current!);
        setDisplayNum(final);
        setDrawnNum(final);

        const isWin =
          (betType === "even"  && final % 2 === 0) ||
          (betType === "odd"   && final % 2 !== 0) ||
          (betType === "small" && final <= 45) ||
          (betType === "big"   && final >= 46);

        const winAmt = isWin ? activeBet * 2 : 0;
        setWon(isWin); setPrize(winAmt); setGameState("result");
        setSaving(true);
        placeBet(player.telegramId, { amount: activeBet, game: "parity", won: isWin, winAmount: winAmt })
          .then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
      }
    }, 80);
  }, [player, betType, activeBet, gameState]);

  const selectedOpt = BET_OPTIONS.find(b => b.type === betType);
  const numIsEven = drawnNum !== null && drawnNum % 2 === 0;
  const numIsBig = drawnNum !== null && drawnNum >= 46;

  // Number display color based on odd/even
  const numBg = displayNum === null
    ? (isLight ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.06)")
    : displayNum % 2 === 0
      ? "linear-gradient(145deg, #1e3a5f, #1e40af)"
      : "linear-gradient(145deg, #7f1d1d, #dc2626)";
  const numBorder = displayNum === null
    ? (isLight ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.1)")
    : displayNum % 2 === 0 ? "#60a5faaa" : "#f87171aa";
  const numShadow = displayNum === null
    ? "0 4px 0 rgba(0,0,0,0.1)"
    : displayNum % 2 === 0
      ? "0 8px 0 #0a1a40, 0 10px 30px rgba(37,99,235,0.6)"
      : "0 8px 0 #450a0a, 0 10px 30px rgba(220,38,38,0.6)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <GameHeader title={`🔢 ${t.parityTitle}`} subtitle="1-90 son | 50/50 | x2" />

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">

        {/* Number display */}
        <div className="rounded-3xl p-5 flex flex-col items-center gap-3 relative overflow-hidden"
          style={{
            background: isLight ? "linear-gradient(145deg, #e0e7ff, #c7d2fe)" : theme === "black" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
            border: `1.5px solid ${isLight ? "rgba(99,102,241,0.3)" : ts.cardBorder}`,
            boxShadow: isLight ? "0 8px 0 rgba(99,102,241,0.12), 0 12px 32px rgba(99,102,241,0.1), inset 0 2px 0 rgba(255,255,255,0.9)" : "none",
          }}>
          <div className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)" }} />

          <p className="text-xs font-black tracking-widest" style={{ color: ts.textSub }}>{t.number} (1-90)</p>

          {/* Big number */}
          <div className="w-36 h-36 rounded-3xl flex items-center justify-center relative"
            style={{ background: numBg, border: `3px solid ${numBorder}`, boxShadow: numShadow, transition: "all 0.12s" }}>
            <div className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%)" }} />
            <span className="relative font-black" style={{ fontSize: displayNum !== null && displayNum >= 10 ? 48 : 60, color: "white", textShadow: "0 4px 12px rgba(0,0,0,0.5)", lineHeight: 1 }}>
              {displayNum !== null ? displayNum : "?"}
            </span>
          </div>

          {/* Labels */}
          {drawnNum !== null && (
            <div className="flex gap-2 flex-wrap justify-center">
              <span className="px-3 py-1 rounded-full text-sm font-black"
                style={{ background: "rgba(255,255,255,0.1)", color: numIsEven ? "#60a5fa" : "#f87171" }}>
                {numIsEven ? t.even : t.odd}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-black"
                style={{ background: "rgba(255,255,255,0.1)", color: numIsBig ? "#fbbf24" : "#4ade80" }}>
                {numIsBig ? t.big : t.small} ({drawnNum <= 45 ? "1-45" : "46-90"})
              </span>
            </div>
          )}

          {/* Win/Lose */}
          {gameState === "result" && (
            <div className="text-center">
              <p className="font-black text-2xl"
                style={{ color: won ? "#4ade80" : "#f87171", textShadow: won ? "0 0 24px #4ade8088" : "0 0 16px #f8717166" }}>
                {won ? t.parityWin : t.parityLose}
              </p>
              {won && <p className="font-bold text-sm mt-1" style={{ color: isLight ? "#059669" : "white" }}>+{prize.toLocaleString()} UZS</p>}
            </div>
          )}
        </div>

        {/* Bet type */}
        <div className="grid grid-cols-2 gap-2.5">
          {BET_OPTIONS.map(opt => {
            const isActive = betType === opt.type;
            return (
              <button key={opt.type} onClick={() => setBetType(opt.type)}
                className="rounded-2xl p-3.5 text-left active:scale-95 transition-all relative overflow-hidden"
                style={{
                  background: isActive ? opt.bg : (isLight ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.04)"),
                  border: `2px solid ${isActive ? `${opt.color}99` : (isLight ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.07)")}`,
                  boxShadow: isActive ? opt.shadow : "0 2px 0 rgba(0,0,0,0.1)",
                }}>
                {isActive && <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%)" }} />}
                <p className="font-black text-base relative" style={{ color: isActive ? opt.color : ts.text }}>
                  {opt.emoji} {opt.label}
                </p>
                <p className="text-xs mt-0.5 relative" style={{ color: ts.textSub }}>{opt.sub}</p>
                <p className="text-xs font-black mt-1 relative" style={{ color: isActive ? opt.color : ts.textSub }}>
                  50% chance • x2
                </p>
              </button>
            );
          })}
        </div>

        {/* Bet amount */}
        <div className="rounded-2xl p-4"
          style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
          <p className="text-xs font-bold mb-3 tracking-widest" style={{ color: ts.textSub }}>💰 {t.betAmount}</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {["MIN","1/2","X2","MAX"].map(a => (
              <button key={a} onClick={() => setQuickBet(a)}
                className="py-2 rounded-xl text-xs font-bold active:scale-95"
                style={{ background: ts.btnSecondary, color: ts.btnSecondaryText, border: `1px solid ${ts.cardBorder}` }}>
                {a}
              </button>
            ))}
          </div>
          <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)}
            className="w-full rounded-xl px-4 py-3 font-black text-center text-lg outline-none"
            style={{ background: ts.input, border: `1px solid ${ts.inputBorder}`, color: ts.text }}
            placeholder="2000" min={2000} />
          {selectedOpt && (
            <p className="text-xs mt-2 text-center" style={{ color: ts.textSub }}>
              {t.potential}: <span className="font-black" style={{ color: selectedOpt.color }}>{(activeBet * 2).toLocaleString()} UZS</span>
            </p>
          )}
        </div>

        {/* Play button */}
        <button onClick={play}
          disabled={!player || !betType || player.balance < activeBet || gameState === "rolling"}
          className="w-full py-5 rounded-2xl font-black text-xl active:scale-95 transition-all disabled:opacity-40 mt-auto"
          style={{
            background: selectedOpt
              ? selectedOpt.bg
              : (isLight ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.05)"),
            color: selectedOpt ? selectedOpt.color : ts.textSub,
            boxShadow: selectedOpt ? selectedOpt.shadow : "none",
          }}>
          {gameState === "rolling" ? t.rolling : gameState === "result" ? `🔄 ${t.playAgain}` : t.bet}
        </button>

        {saving && <p className="text-center text-xs" style={{ color: ts.textSub }}>{t.saving}</p>}
      </div>
    </div>
  );
}
