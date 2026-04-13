import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { placeBet } from "@/lib/api";

type BetType = "more" | "equal" | "less";
type GameState = "idle" | "rolling" | "result";

const ODDS: Record<BetType, { label: string; mult: number; emoji: string; color: string; bg: string; border: string }> = {
  less:  { label: "7 dan Kam",  mult: 2.3, emoji: "⬇️", color: "#60a5fa", bg: "linear-gradient(135deg, #1e3a5f, #1e40af)", border: "#3b82f666" },
  equal: { label: "Teng 7",     mult: 5.8, emoji: "🎯", color: "#fbbf24", bg: "linear-gradient(135deg, #78350f, #d97706)", border: "#f59e0b66" },
  more:  { label: "7 dan Ko'p", mult: 2.3, emoji: "⬆️", color: "#34d399", bg: "linear-gradient(135deg, #064e3b, #059669)", border: "#10b98166" },
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
    <div className={rolling ? "spin-fast" : ""}
      style={{ width: 90, height: 90, borderRadius: 20, position: "relative",
        background: "linear-gradient(145deg, #ffffff 0%, #e2e8f0 100%)",
        boxShadow: rolling ? "0 0 30px #fbbf24, 0 8px 24px rgba(0,0,0,0.5)" : "4px 4px 16px rgba(0,0,0,0.5), -2px -2px 8px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.5)" }}>
      {dots[v].map(([x, y], i) => (
        <div key={i} style={{ position:"absolute", width:13, height:13, borderRadius:"50%",
          left:`${x}%`, top:`${y}%`, transform:"translate(-50%,-50%)",
          background: "linear-gradient(145deg, #1e1b4b, #312e81)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.1)" }} />
      ))}
    </div>
  );
}

export default function Dice() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();
  const [betInput, setBetInput] = useState("2000");
  const [betType, setBetType] = useState<BetType | null>(null);
  const [dice, setDice] = useState<[number, number]>([1, 1]);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [won, setWon] = useState(false);
  const [prize, setPrize] = useState(0);
  const [saving, setSaving] = useState(false);

  const activeBet = Math.max(Number(betInput) || 2000, 0);
  const potential = betType ? Math.floor(activeBet * ODDS[betType].mult) : 0;

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
        const sum = d1 + d2;
        setDice([d1, d2]);
        const win = (betType === "more" && sum > 7) || (betType === "equal" && sum === 7) || (betType === "less" && sum < 7);
        const winPrize = win ? Math.floor(activeBet * ODDS[betType].mult) : 0;
        setWon(win); setPrize(winPrize); setGameState("result");
        setSaving(true);
        await placeBet(player.telegramId, { amount: activeBet, game: "dice", won: win, winAmount: winPrize }).catch(() => {});
        await refresh(); setSaving(false);
      }
    }, 70);
  }, [betType, activeBet, player, refresh]);

  const sum = dice[0] + dice[1];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #1c0a00 0%, #2d1200 50%, #1a0a00 100%)" }}>

      {/* Glowing orbs */}
      <div className="fixed pointer-events-none" style={{ top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #d9770655 0%, transparent 70%)", filter: "blur(40px)" }} />
      <div className="fixed pointer-events-none" style={{ bottom: 60, left: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, #b4530933 0%, transparent 70%)", filter: "blur(50px)" }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <button onClick={() => nav("/")} className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="font-black text-base tracking-wider text-white">🎲 DICE</h1>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)" }}>
            <span className="text-yellow-400 text-sm font-black">{(player?.balance ?? 0).toLocaleString()} UZS</span>
          </div>
        </div>

        {/* Dice display */}
        <div className="mx-4 mb-4 rounded-3xl overflow-hidden relative"
          style={{ background: "linear-gradient(160deg, #3d1a00, #2d1200)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 8px 32px rgba(217,119,6,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(217,119,6,0.15) 0%, transparent 60%)" }} />

          <div className="relative py-10 flex flex-col items-center">
            <div className="flex items-center gap-5 mb-4">
              <DiceFace value={dice[0]} rolling={gameState === "rolling"} />
              <div className="flex flex-col items-center gap-2">
                <span className="font-black text-3xl" style={{ color: "rgba(255,255,255,0.2)" }}>+</span>
                {gameState !== "idle" && (
                  <div className="px-4 py-1.5 rounded-xl"
                    style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(245,158,11,0.4)" }}>
                    <span className="font-black text-2xl text-yellow-400">{sum}</span>
                  </div>
                )}
              </div>
              <DiceFace value={dice[1]} rolling={gameState === "rolling"} />
            </div>

            {gameState === "rolling" && (
              <p className="text-sm font-semibold animate-pulse" style={{ color: "rgba(251,191,36,0.6)" }}>🎲 Aylanmoqda...</p>
            )}

            {gameState === "result" && (
              <div className="text-center slide-up">
                <p className="text-3xl mb-1">{won ? "🎉" : "💔"}</p>
                <p className="font-black text-2xl" style={{ color: won ? "#34d399" : "#f87171" }}>
                  {won ? `+${prize.toLocaleString()} UZS` : "Yutqazdingiz!"}
                </p>
                {won && <p className="text-xs mt-1" style={{ color: "#34d39988" }}>{ODDS[betType!].mult}x koeffitsiyent</p>}
              </div>
            )}

            {gameState === "idle" && (
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Taxmin tanlang va o'ynang</p>
            )}
          </div>
        </div>

        {/* Bet type cards */}
        <div className="px-4 mb-3">
          <p className="text-xs font-black mb-2.5 tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>TAXMIN TANLANG</p>
          <div className="grid grid-cols-3 gap-2.5">
            {(["less", "equal", "more"] as BetType[]).map((type) => {
              const o = ODDS[type];
              const sel = betType === type;
              return (
                <button key={type} onClick={() => setBetType(type)} disabled={gameState === "rolling"}
                  className="flex flex-col items-center py-4 rounded-2xl transition-all active:scale-95"
                  style={{
                    background: sel ? o.bg : "rgba(255,255,255,0.04)",
                    border: sel ? `1px solid ${o.color}88` : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: sel ? `0 4px 20px ${o.color}33` : "none",
                  }}>
                  <span className="text-xl mb-1.5">{o.emoji}</span>
                  <span className="text-xs font-semibold mb-0.5" style={{ color: sel ? o.color : "rgba(255,255,255,0.4)" }}>{o.label}</span>
                  <span className="font-black text-xl" style={{ color: sel ? o.color : "white" }}>x{o.mult}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bet controls */}
        <div className="px-4 pb-6">
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {["MIN","X2","X/2","MAX"].map((a) => (
              <button key={a} disabled={gameState === "rolling"} onClick={() => setQuickBet(a)}
                className="py-2 rounded-xl text-xs font-bold active:scale-95"
                style={a === "MAX"
                  ? { background: "rgba(217,119,6,0.25)", border: "1px solid rgba(251,191,36,0.55)", color: "#fbbf24" }
                  : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                {a}
              </button>
            ))}
          </div>
          <div className="relative mb-3">
            <input type="number" placeholder="Tikish miqdori (min 2 000)" value={betInput}
              disabled={gameState === "rolling"}
              onChange={(e) => setBetInput(e.target.value)}
              className="w-full rounded-2xl px-4 py-3.5 font-black text-lg focus:outline-none pr-36"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }} />
            {betType && activeBet >= 2000 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black" style={{ color: "#34d399" }}>
                → {potential.toLocaleString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            <button onClick={() => { setGameState("idle"); setPrize(0); }} disabled={gameState === "rolling"}
              className="py-4 rounded-2xl flex items-center justify-center text-xl active:scale-95"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              🔄
            </button>
            <button onClick={roll}
              disabled={gameState === "rolling" || !betType || !player || player.balance < activeBet || activeBet < 2000 || saving}
              className="col-span-3 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", boxShadow: "0 8px 24px rgba(217,119,6,0.5)", color: "#1c0a00" }}>
              {gameState === "rolling" ? "🎲 Aylanmoqda..." : "🎲 ZAR TASHLASH"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
