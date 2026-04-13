import { useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { placeBet } from "@/lib/api";

const ROWS = 10;
const COLS = 5;
const MULTIPLIERS = [1.3, 1.6, 2, 2.8, 3.5, 5, 6.5, 8, 9, 10];

// Progressive difficulty: bombs per row (bottom → top)
// Row 0 (1x) = easiest, Row 9 (10x) = hardest
const BOMBS_PER_ROW = [1, 2, 2, 2, 3, 3, 3, 4, 4, 4];
const DIFF_LABELS = ["Oson","Oson","O'rta","O'rta","O'rta","Qiyin","Qiyin","Qiyin","Juda Qiyin","Juda Qiyin"];
const DIFF_COLORS = ["#4ade80","#4ade80","#fbbf24","#fbbf24","#fbbf24","#f97316","#f97316","#f97316","#f87171","#f87171"];

type Cell = "apple" | "bomb";
type GameState = "idle" | "playing" | "won" | "lost";

function generateGrid(): Cell[][] {
  return Array.from({ length: ROWS }, (_, rowIdx) => {
    const bombCount = BOMBS_PER_ROW[rowIdx];
    const cells: Cell[] = Array(COLS).fill("apple") as Cell[];
    const positions = new Set<number>();
    while (positions.size < bombCount) positions.add(Math.floor(Math.random() * COLS));
    positions.forEach(p => { cells[p] = "bomb"; });
    return cells;
  });
}

export default function AppleOfFortune() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();

  const [bet, setBet] = useState(2000);
  const [customBet, setCustomBet] = useState("");
  const [gameState, setGameState] = useState<GameState>("idle");
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [revealed, setRevealed] = useState<boolean[][]>([]);
  const [activeRow, setActiveRow] = useState(0);
  const [cashOutAmount, setCashOutAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const activeBet = customBet ? Math.max(2000, Number(customBet)) : bet;
  const currentMult = activeRow > 0 ? MULTIPLIERS[activeRow - 1] : null;
  const potential = Math.floor(activeBet * (currentMult ?? MULTIPLIERS[0]));

  // Show result overlay after short delay so animation is visible
  useEffect(() => {
    if (gameState === "won" || gameState === "lost") {
      const t = setTimeout(() => setShowResult(true), 600);
      return () => clearTimeout(t);
    } else {
      setShowResult(false);
    }
  }, [gameState]);

  const start = () => {
    if (!player || player.balance < activeBet || activeBet < 2000) return;
    setGrid(generateGrid());
    setRevealed(Array.from({ length: ROWS }, () => Array(COLS).fill(false)));
    setActiveRow(0); setCashOutAmount(0); setShowResult(false); setGameState("playing");
  };

  const pickCell = async (row: number, col: number) => {
    if (gameState !== "playing" || row !== activeRow || revealed[row]?.[col]) return;
    const newRev = revealed.map(r => [...r]);
    newRev[row][col] = true;
    setRevealed(newRev);

    if (grid[row][col] === "bomb") {
      setTimeout(() => {
        setRevealed(newRev.map((r, ri) => ri <= row ? Array(COLS).fill(true) : r));
        setGameState("lost");
      }, 400);
      setSaving(true);
      if (player) { await placeBet(player.telegramId, { amount: activeBet, game: "apple", won: false, winAmount: 0 }).catch(() => {}); await refresh(); }
      setSaving(false);
      return;
    }

    const newActive = row + 1;
    setActiveRow(newActive);
    if (newActive === ROWS) {
      const prize = Math.floor(activeBet * MULTIPLIERS[ROWS - 1]);
      setCashOutAmount(prize); setGameState("won");
      setSaving(true);
      if (player) { await placeBet(player.telegramId, { amount: activeBet, game: "apple", won: true, winAmount: prize }).catch(() => {}); await refresh(); }
      setSaving(false);
    }
  };

  const doCashOut = async () => {
    if (activeRow === 0 || gameState !== "playing") return;
    const prize = Math.floor(activeBet * MULTIPLIERS[activeRow - 1]);
    setCashOutAmount(prize);
    setRevealed(grid.map((_, ri) => ri < activeRow ? Array(COLS).fill(true) : Array(COLS).fill(false)));
    setGameState("won");
    setSaving(true);
    if (player) { await placeBet(player.telegramId, { amount: activeBet, game: "apple", won: true, winAmount: prize }).catch(() => {}); await refresh(); }
    setSaving(false);
  };

  const reset = () => { setGameState("idle"); setGrid([]); setRevealed([]); setActiveRow(0); setShowResult(false); };

  const rows = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i);

  return (
    <div className="h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #022c1a 0%, #052e16 50%, #041a0f 100%)" }}>

      <div className="fixed pointer-events-none" style={{ top: -50, left: -50, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #16a34a33 0%, transparent 70%)", filter: "blur(50px)" }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 z-10">
        <button onClick={() => nav("/")} className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="font-black text-sm tracking-wider text-white">🍎 APPLE OF FORTUNE</h1>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}>
          <span className="text-green-400 text-sm font-black">{(player?.balance ?? 0).toLocaleString()} UZS</span>
        </div>
      </div>

      {/* Progress bar (playing) */}
      {gameState === "playing" && (
        <div className="px-4 pb-1 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{activeRow}/{ROWS} qator</span>
            <span className="text-xs font-black text-green-400">{MULTIPLIERS[Math.min(activeRow, ROWS - 1)]}x</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-1 rounded-full transition-all"
              style={{ width: `${(activeRow / ROWS) * 100}%`, background: "linear-gradient(90deg, #16a34a, #4ade80)" }} />
          </div>
        </div>
      )}

      {/* IDLE screen */}
      {gameState === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-4 float-anim"
            style={{ background: "radial-gradient(circle, #16a34a33, #052e1688)", border: "2px solid #22c55e44", boxShadow: "0 0 40px #22c55e33" }}>
            <span style={{ fontSize: 48 }}>🍎</span>
          </div>
          <p className="text-white font-black text-xl mb-1">Apple of Fortune</p>
          <p className="text-sm mb-0.5 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Har qatorda 4 ta olma, 1 ta bomba</p>
          <p className="font-black text-base" style={{ color: "#4ade80" }}>1.2x → 1.5x → 2x → ... → 10x</p>
        </div>
      )}

      {/* GAME GRID */}
      {(gameState === "playing" || gameState === "won" || gameState === "lost") && (
        <div className="flex-1 overflow-hidden px-2 py-1">
          <div className="h-full flex flex-col gap-1">
            {rows.map((rowIdx) => {
              const isActive = rowIdx === activeRow && gameState === "playing";
              const isPast = rowIdx < activeRow;
              const mult = MULTIPLIERS[rowIdx];

              return (
                <div key={rowIdx} className="flex items-center gap-1.5 flex-1 min-h-0">
                  {/* Multiplier */}
                  <div className="w-8 text-right shrink-0">
                    <span className="font-black" style={{
                      fontSize: 10,
                      color: rowIdx === activeRow - 1 ? "#4ade80" : isActive ? "#fbbf24" : isPast ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.2)"
                    }}>
                      {mult}x
                    </span>
                  </div>

                  {/* 5 cells */}
                  <div className="flex-1 grid grid-cols-5 gap-1 h-full">
                    {Array.from({ length: COLS }, (_, c) => {
                      const isRev = revealed[rowIdx]?.[c];
                      const cell = grid[rowIdx]?.[c];

                      let bg = "rgba(255,255,255,0.04)";
                      let border = "1px solid rgba(255,255,255,0.08)";
                      let shadow = "none";
                      let content: ReactNode = null;
                      let extraClass = "";

                      if (isActive) {
                        bg = "linear-gradient(135deg, rgba(21,128,61,0.4), rgba(5,46,22,0.6))";
                        border = "1px solid rgba(34,197,94,0.6)";
                        shadow = "0 0 10px rgba(34,197,94,0.25)";
                        content = <div className="w-3 h-3 rounded-full pulse-ring" style={{ background: "radial-gradient(circle, #4ade80, #16a34a)" }} />;
                      }

                      if (isRev && cell === "apple") {
                        bg = "linear-gradient(135deg, #16a34a, #15803d)";
                        border = "1px solid #4ade8066";
                        shadow = "0 0 12px rgba(74,222,128,0.4)";
                        extraClass = "pop-in";
                        content = <span style={{ fontSize: 18 }}>🍎</span>;
                      }

                      if (isRev && cell === "bomb") {
                        bg = "linear-gradient(135deg, #991b1b, #7f1d1d)";
                        border = "1px solid #ef444466";
                        shadow = "0 0 14px rgba(239,68,68,0.6)";
                        extraClass = "shake-anim";
                        content = <span style={{ fontSize: 18 }}>💣</span>;
                      }

                      if (!isRev && isPast && cell === "apple") {
                        content = <span style={{ fontSize: 14, opacity: 0.2 }}>🍎</span>;
                      }

                      return (
                        <button key={c} onClick={() => pickCell(rowIdx, c)} disabled={!isActive}
                          className={`flex items-center justify-center rounded-xl transition-all w-full h-full ${isActive ? "active:scale-90" : ""} ${extraClass}`}
                          style={{ background: bg, border, boxShadow: shadow }}>
                          {content}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cash out bar (playing) */}
      {gameState === "playing" && activeRow > 0 && (
        <div className="px-4 pb-2 shrink-0">
          <button onClick={doCashOut} disabled={saving}
            className="w-full py-3 rounded-2xl font-black text-sm active:scale-95 transition-transform glow-green"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white" }}>
            💰 OLISH — {potential.toLocaleString()} UZS ({currentMult}x)
          </button>
        </div>
      )}

      {/* Controls (idle) */}
      {gameState === "idle" && (
        <div className="px-4 pb-5 shrink-0">
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {["MIN", "X2", "X/2", "MAX"].map((a) => (
              <button key={a} onClick={() => {
                const bal = player?.balance ?? 0;
                let v = activeBet;
                if (a === "MIN") v = 2000;
                else if (a === "MAX") v = Math.min(bal, 500000);
                else if (a === "X2") v = Math.min(activeBet * 2, bal, 500000);
                else v = Math.max(Math.floor(activeBet / 2), 2000);
                setCustomBet(String(v)); setBet(v);
              }} className="py-2 rounded-xl text-xs font-bold active:scale-95"
                style={a === "MAX"
                  ? { background: "rgba(22,163,74,0.25)", border: "1px solid rgba(74,222,128,0.55)", color: "#4ade80" }
                  : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                {a}
              </button>
            ))}
          </div>
          <input type="number" placeholder="Miqdor (min 2 000)" value={customBet}
            onChange={(e) => setCustomBet(e.target.value)}
            className="w-full rounded-2xl px-4 py-3 font-black text-base focus:outline-none mb-2"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }} />
          <button onClick={start}
            disabled={!player || player.balance < activeBet || activeBet < 2000}
            className="w-full py-3.5 rounded-2xl font-black text-base active:scale-95 transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 8px 28px rgba(22,163,74,0.5)", color: "white" }}>
            🍎 O'YINNI BOSHLASH
          </button>
        </div>
      )}

      {/* RESULT OVERLAY — appears over grid when game ends */}
      {showResult && (gameState === "won" || gameState === "lost") && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}>

          <div className="w-full rounded-3xl px-6 py-8 text-center slide-up"
            style={{
              background: gameState === "won"
                ? "linear-gradient(135deg, rgba(22,163,74,0.3), rgba(21,128,61,0.2))"
                : "linear-gradient(135deg, rgba(153,27,27,0.35), rgba(127,29,29,0.2))",
              border: `1px solid ${gameState === "won" ? "rgba(74,222,128,0.5)" : "rgba(239,68,68,0.5)"}`,
              boxShadow: gameState === "won" ? "0 0 60px rgba(74,222,128,0.2)" : "0 0 60px rgba(239,68,68,0.2)"
            }}>

            <div className="text-6xl mb-3">{gameState === "won" ? "🎉" : "💥"}</div>

            <p className="font-black text-3xl mb-1" style={{ color: gameState === "won" ? "#4ade80" : "#f87171" }}>
              {gameState === "won" ? `+${cashOutAmount.toLocaleString()} UZS` : "Bomba chiqdi!"}
            </p>
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>
              {gameState === "won"
                ? `${activeRow} qator — ${MULTIPLIERS[activeRow - 1]}x`
                : `${activeRow} qator o'tdingiz`}
            </p>

            {/* Controls inside overlay */}
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {["MIN", "X2", "X/2", "MAX"].map((a) => (
                <button key={a} onClick={() => {
                  const bal = player?.balance ?? 0;
                  let v = activeBet;
                  if (a === "MIN") v = 2000;
                  else if (a === "MAX") v = Math.min(bal, 500000);
                  else if (a === "X2") v = Math.min(activeBet * 2, bal, 500000);
                  else v = Math.max(Math.floor(activeBet / 2), 2000);
                  setCustomBet(String(v)); setBet(v);
                }} className="py-2 rounded-xl text-xs font-bold active:scale-95"
                  style={a === "MAX"
                    ? { background: "rgba(22,163,74,0.25)", border: "1px solid rgba(74,222,128,0.55)", color: "#4ade80" }
                    : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
                  {a}
                </button>
              ))}
            </div>
            <input type="number" placeholder="Miqdor (min 2 000)" value={customBet}
              onChange={(e) => setCustomBet(e.target.value)}
              className="w-full rounded-2xl px-4 py-3 font-black text-base focus:outline-none mb-3"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }} />

            <button onClick={start}
              disabled={!player || player.balance < activeBet || activeBet < 2000}
              className="w-full py-3.5 rounded-2xl font-black text-base active:scale-95 transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 8px 28px rgba(22,163,74,0.4)", color: "white" }}>
              🔄 QAYTA O'YNASH
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
