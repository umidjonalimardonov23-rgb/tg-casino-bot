import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { placeBet } from "@/lib/api";

type BetType = "even" | "odd" | "small" | "big";
type GameState = "idle" | "rolling" | "result";

const BET_OPTIONS: { type: BetType; label: string; sub: string; mult: number; emoji: string; color: string; bg: string; border: string }[] = [
  { type: "even", label: "JUFT", sub: "0,2,4,6,8", mult: 2, emoji: "2️⃣", color: "#60a5fa", bg: "linear-gradient(135deg, #1e3a5f, #1e40af)", border: "#3b82f666" },
  { type: "odd",  label: "TOQ",  sub: "1,3,5,7,9", mult: 2, emoji: "1️⃣", color: "#f87171", bg: "linear-gradient(135deg, #7f1d1d, #dc2626)", border: "#f87171aa" },
  { type: "small",label: "KICHIK",sub: "0–4",       mult: 2, emoji: "⬇️", color: "#4ade80", bg: "linear-gradient(135deg, #064e3b, #059669)", border: "#10b98166" },
  { type: "big",  label: "KATTA", sub: "5–9",       mult: 2, emoji: "⬆️", color: "#fbbf24", bg: "linear-gradient(135deg, #78350f, #d97706)", border: "#f59e0b66" },
];

export default function Parity() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();
  const [betInput, setBetInput] = useState("2000");
  const [betType, setBetType] = useState<BetType | null>(null);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [drawnNumber, setDrawnNumber] = useState<number | null>(null);
  const [displayNum, setDisplayNum] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [prize, setPrize] = useState(0);
  const [saving, setSaving] = useState(false);

  const activeBet = Math.max(Number(betInput) || 2000, 2000);
  const selectedOpt = BET_OPTIONS.find(b => b.type === betType);

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
    setDrawnNumber(null);
    setDisplayNum(null);
    setWon(false);
    setPrize(0);

    const final = Math.floor(Math.random() * 10);

    // Animate number
    let ticks = 0;
    const maxTicks = 16;
    const interval = setInterval(() => {
      setDisplayNum(Math.floor(Math.random() * 10));
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(interval);
        setDisplayNum(final);
        setDrawnNumber(final);

        const isEven = final % 2 === 0;
        const isSmall = final <= 4;
        let isWin = false;
        if (betType === "even" && isEven) isWin = true;
        if (betType === "odd" && !isEven) isWin = true;
        if (betType === "small" && isSmall) isWin = true;
        if (betType === "big" && !isSmall) isWin = true;

        const winAmt = isWin ? activeBet * 2 : 0;
        setWon(isWin);
        setPrize(winAmt);
        setGameState("result");

        setSaving(true);
        placeBet(player.telegramId, { amount: activeBet, game: "parity", won: isWin, winAmount: winAmt })
          .then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
      }
    }, 80);
  }, [player, betType, activeBet, gameState]);

  const isRed = (n: number | null) => n !== null && n % 2 !== 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #0a0a1a 0%, #0f0a2a 50%, #0a0a1a 100%)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={() => nav("/")} className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div>
          <p className="text-white font-black text-lg">🔢 Parity</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Juft yoki toq? x2 yutish!</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Balans</p>
          <p className="text-white font-black text-sm">{(player?.balance ?? 0).toLocaleString()} UZS</p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">

        {/* Number display */}
        <div className="rounded-3xl p-8 flex flex-col items-center gap-2 mt-2"
          style={{ background: "linear-gradient(145deg, #1a1a3a, #0f0f2a)", border: "2px solid rgba(255,255,255,0.08)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
          <p className="text-xs font-bold tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>SON</p>
          <div className="w-32 h-32 rounded-3xl flex items-center justify-center"
            style={{
              background: displayNum !== null
                ? (isRed(displayNum) ? "linear-gradient(135deg, #7f1d1d, #dc2626)" : "linear-gradient(135deg, #1e3a5f, #2563eb)")
                : "rgba(255,255,255,0.05)",
              border: displayNum !== null
                ? (isRed(displayNum) ? "3px solid #f87171aa" : "3px solid #60a5faaa")
                : "2px solid rgba(255,255,255,0.1)",
              boxShadow: displayNum !== null
                ? (isRed(displayNum) ? "0 0 40px #dc262655" : "0 0 40px #2563eb55")
                : "none",
              transition: "all 0.15s",
            }}>
            <span className="font-black" style={{ fontSize: 64, color: "white" }}>
              {displayNum !== null ? displayNum : "?"}
            </span>
          </div>

          {drawnNumber !== null && (
            <div className="flex gap-3 mt-3">
              <span className="px-3 py-1 rounded-full text-xs font-black"
                style={{ background: "rgba(255,255,255,0.08)", color: drawnNumber % 2 === 0 ? "#60a5fa" : "#f87171" }}>
                {drawnNumber % 2 === 0 ? "JUFT" : "TOQ"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-black"
                style={{ background: "rgba(255,255,255,0.08)", color: drawnNumber <= 4 ? "#4ade80" : "#fbbf24" }}>
                {drawnNumber <= 4 ? "KICHIK" : "KATTA"}
              </span>
            </div>
          )}

          {gameState === "result" && (
            <div className="mt-3 text-center">
              <p className="font-black text-xl" style={{ color: won ? "#4ade80" : "#f87171" }}>
                {won ? "YUTDINGIZ! 🎉" : "YUTQAZDINGIZ 😞"}
              </p>
              {won && <p className="text-white font-bold text-sm mt-1">+{prize.toLocaleString()} UZS</p>}
            </div>
          )}
        </div>

        {/* Bet type selection */}
        <div className="grid grid-cols-2 gap-2.5">
          {BET_OPTIONS.map(opt => (
            <button key={opt.type} onClick={() => setBetType(opt.type)}
              className="rounded-2xl p-3.5 text-left active:scale-95 transition-all relative overflow-hidden"
              style={{
                background: betType === opt.type ? opt.bg : "rgba(255,255,255,0.04)",
                border: `2px solid ${betType === opt.type ? opt.border : "rgba(255,255,255,0.08)"}`,
                boxShadow: betType === opt.type ? `0 4px 20px ${opt.border}` : "none",
              }}>
              <p className="font-black text-base" style={{ color: betType === opt.type ? opt.color : "rgba(255,255,255,0.7)" }}>
                {opt.emoji} {opt.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{opt.sub}</p>
              <p className="text-xs font-black mt-1" style={{ color: betType === opt.type ? opt.color : "rgba(255,255,255,0.3)" }}>x{opt.mult}</p>
            </button>
          ))}
        </div>

        {/* Bet amount */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
          {selectedOpt && (
            <p className="text-xs mt-2 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
              Potensial: <b style={{ color: selectedOpt.color }}>{(activeBet * selectedOpt.mult).toLocaleString()} UZS</b>
            </p>
          )}
        </div>

        {/* Play button */}
        <button onClick={play}
          disabled={!player || !betType || player.balance < activeBet || gameState === "rolling"}
          className="w-full py-4 rounded-2xl font-black text-lg active:scale-95 transition-transform disabled:opacity-40 mt-auto"
          style={{
            background: betType
              ? (BET_OPTIONS.find(b => b.type === betType)?.bg ?? "linear-gradient(135deg, #4c1d95, #6d28d9)")
              : "rgba(255,255,255,0.08)",
            color: "white",
            boxShadow: betType ? "0 8px 24px rgba(124,58,237,0.4)" : "none",
          }}>
          {gameState === "rolling" ? "🎲 Aylanmoqda..." : gameState === "result" ? "🔄 QAYTA" : "🎲 TIKISH"}
        </button>

        {saving && <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Saqlanmoqda...</p>}
      </div>
    </div>
  );
}
