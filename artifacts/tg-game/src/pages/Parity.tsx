import { useState, useCallback } from "react";
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
  const [drawnNumber, setDrawnNumber] = useState<number | null>(null);
  const [displayNum, setDisplayNum] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [prize, setPrize] = useState(0);
  const [saving, setSaving] = useState(false);

  const activeBet = Math.max(Number(betInput) || 2000, 2000);
  const isLight = theme === "light";

  const BET_OPTIONS: { type: BetType; label: string; sub: string; mult: number; emoji: string; activeColor: string; activeBg: string; activeShadow: string }[] = [
    { type: "even",  label: t.even,  sub: "0,2,4,6,8", mult: 2, emoji: "2️⃣",
      activeColor: "#60a5fa", activeBg: "linear-gradient(145deg, #1e3a5f, #1e40af)", activeShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(37,99,235,0.5)" },
    { type: "odd",   label: t.odd,   sub: "1,3,5,7,9", mult: 2, emoji: "1️⃣",
      activeColor: "#f87171", activeBg: "linear-gradient(145deg, #7f1d1d, #dc2626)", activeShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(220,38,38,0.5)" },
    { type: "small", label: t.small, sub: "0–4",        mult: 2, emoji: "⬇️",
      activeColor: "#4ade80", activeBg: "linear-gradient(145deg, #064e3b, #059669)", activeShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(5,150,105,0.5)" },
    { type: "big",   label: t.big,   sub: "5–9",        mult: 2, emoji: "⬆️",
      activeColor: "#fbbf24", activeBg: "linear-gradient(145deg, #78350f, #d97706)", activeShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(217,119,6,0.5)" },
  ];

  function setQuickBet(action: string) {
    const bal = player?.balance ?? 0;
    let v = activeBet;
    if (action === "MIN") v = 2000;
    else if (action === "MAX") v = Math.min(bal, 500000);
    else if (action === "X2") v = Math.min(activeBet * 2, bal, 500000);
    else if (action === "1/2") v = Math.max(2000, Math.floor(activeBet / 2));
    setBetInput(String(v));
  }

  const play = useCallback(async () => {
    if (!player || !betType || player.balance < activeBet || gameState === "rolling") return;
    setGameState("rolling");
    setDrawnNumber(null); setDisplayNum(null); setWon(false); setPrize(0);
    const final = Math.floor(Math.random() * 10);
    let ticks = 0;
    const interval = setInterval(() => {
      setDisplayNum(Math.floor(Math.random() * 10));
      ticks++;
      if (ticks >= 20) {
        clearInterval(interval);
        setDisplayNum(final);
        setDrawnNumber(final);
        const isWin =
          (betType === "even" && final % 2 === 0) ||
          (betType === "odd"  && final % 2 !== 0) ||
          (betType === "small" && final <= 4) ||
          (betType === "big"  && final >= 5);
        const winAmt = isWin ? activeBet * 2 : 0;
        setWon(isWin); setPrize(winAmt); setGameState("result");
        setSaving(true);
        placeBet(player.telegramId, { amount: activeBet, game: "parity", won: isWin, winAmount: winAmt })
          .then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
      }
    }, 80);
  }, [player, betType, activeBet, gameState]);

  const selectedOpt = BET_OPTIONS.find(b => b.type === betType);
  const numIsRed = drawnNumber !== null && drawnNumber % 2 !== 0;

  // Number box BG
  const numBg = displayNum === null
    ? (isLight ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.05)")
    : numIsRed
      ? "linear-gradient(145deg, #7f1d1d, #dc2626)"
      : "linear-gradient(145deg, #1e3a5f, #1e40af)";
  const numBorder = displayNum === null
    ? (isLight ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.1)")
    : numIsRed ? "#f87171aa" : "#60a5faaa";
  const numShadow = displayNum === null
    ? "0 4px 0 rgba(0,0,0,0.1)"
    : numIsRed
      ? "0 8px 0 #450a0a, 0 10px 30px rgba(220,38,38,0.5)"
      : "0 8px 0 #0a1a40, 0 10px 30px rgba(37,99,235,0.5)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <GameHeader title={`🔢 ${t.parityTitle}`} subtitle={`${t.even}/${t.odd} x2`} />

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

          <p className="text-xs font-black tracking-widest" style={{ color: ts.textSub }}>{t.number}</p>

          {/* Big number */}
          <div className="w-28 h-28 rounded-3xl flex items-center justify-center relative"
            style={{ background: numBg, border: `3px solid ${numBorder}`, boxShadow: numShadow, transition: "all 0.12s" }}>
            <div className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%)" }} />
            <span className="relative font-black" style={{ fontSize: 56, color: "white", textShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
              {displayNum !== null ? displayNum : "?"}
            </span>
          </div>

          {/* Labels */}
          {drawnNumber !== null && (
            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black"
                style={{ background: isLight ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.08)", color: drawnNumber % 2 === 0 ? "#60a5fa" : "#f87171" }}>
                {drawnNumber % 2 === 0 ? t.even : t.odd}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black"
                style={{ background: isLight ? "rgba(5,150,105,0.08)" : "rgba(255,255,255,0.08)", color: drawnNumber <= 4 ? "#4ade80" : "#fbbf24" }}>
                {drawnNumber <= 4 ? t.small : t.big}
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

        {/* Bet type buttons — 3D */}
        <div className="grid grid-cols-2 gap-2.5">
          {BET_OPTIONS.map(opt => {
            const isActive = betType === opt.type;
            return (
              <button key={opt.type} onClick={() => setBetType(opt.type)}
                className="rounded-2xl p-3.5 text-left active:scale-95 transition-all relative overflow-hidden"
                style={{
                  background: isActive ? opt.activeBg : (isLight ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.05)"),
                  border: `2px solid ${isActive ? `${opt.activeColor}88` : (isLight ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.08)")}`,
                  boxShadow: isActive ? opt.activeShadow : (isLight ? "0 2px 0 rgba(99,102,241,0.08)" : "0 2px 0 rgba(0,0,0,0.15)"),
                }}>
                {isActive && <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%)" }} />}
                <p className="font-black text-base relative" style={{ color: isActive ? opt.activeColor : ts.text }}>
                  {opt.emoji} {opt.label}
                </p>
                <p className="text-xs mt-0.5 relative" style={{ color: ts.textSub }}>{opt.sub}</p>
                <p className="text-xs font-black mt-1 relative" style={{ color: isActive ? opt.activeColor : ts.textSub }}>x{opt.mult}</p>
              </button>
            );
          })}
        </div>

        {/* Bet amount */}
        <div className="rounded-2xl p-4"
          style={{ background: ts.card, border: `1px solid ${ts.cardBorder}`, boxShadow: isLight ? "0 4px 16px rgba(99,102,241,0.08)" : "none" }}>
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
          {selectedOpt && (
            <p className="text-xs mt-2 text-center" style={{ color: ts.textSub }}>
              {t.potential}: <span className="font-black" style={{ color: selectedOpt.activeColor }}>{(activeBet * 2).toLocaleString()} UZS</span>
            </p>
          )}
        </div>

        {/* Play button */}
        <button onClick={play}
          disabled={!player || !betType || player.balance < activeBet || gameState === "rolling"}
          className="w-full py-4 rounded-2xl font-black text-lg active:scale-95 transition-all disabled:opacity-40 mt-auto"
          style={{
            background: selectedOpt ? selectedOpt.activeBg : (isLight ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)"),
            color: selectedOpt ? selectedOpt.activeColor : ts.textSub,
            boxShadow: selectedOpt ? selectedOpt.activeShadow : "none",
          }}>
          {gameState === "rolling" ? t.rolling : gameState === "result" ? t.playAgain : t.bet}
        </button>

        {saving && <p className="text-center text-xs" style={{ color: ts.textSub }}>{t.saving}</p>}
      </div>
    </div>
  );
}
