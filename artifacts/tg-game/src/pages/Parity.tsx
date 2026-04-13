import { useState, useCallback, useRef, useEffect } from "react";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { placeBet } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

type BetType = "even" | "odd" | "small" | "big";
// idle   → enter bet & press PLAY
// spin   → number animates then reveals final number
// pick   → final number visible, player picks JUFT/TOQ/KICHIK/KATTA (5s timer)
// result → win/lose shown
type Phase = "idle" | "spin" | "pick" | "result";

export default function Parity() {
  const { player, refresh } = usePlayer();
  const { t } = useLang();
  const { theme, ts } = useTheme();
  const [betInput, setBetInput] = useState("2000");
  const [betType, setBetType] = useState<BetType | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [finalNum, setFinalNum] = useState<number | null>(null);
  const [displayNum, setDisplayNum] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [prize, setPrize] = useState(0);
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockedBet = useRef(0);

  const activeBet = Math.max(Number(betInput) || 2000, 2000);
  const isLight = theme === "light";

  const BET_OPTIONS: {
    type: BetType; label: string; sub: string; emoji: string;
    color: string; bg: string; shadow: string;
  }[] = [
    { type: "even",  label: t.even,  sub: "2,4,6...90", emoji: "2️⃣",
      color: "#60a5fa", bg: "linear-gradient(145deg,#1e3a5f,#1e40af)",
      shadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(37,99,235,0.5)" },
    { type: "odd",   label: t.odd,   sub: "1,3,5...89", emoji: "1️⃣",
      color: "#f87171", bg: "linear-gradient(145deg,#7f1d1d,#dc2626)",
      shadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(220,38,38,0.5)" },
    { type: "small", label: t.small, sub: "1–45",       emoji: "⬇️",
      color: "#4ade80", bg: "linear-gradient(145deg,#064e3b,#059669)",
      shadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(5,150,105,0.5)" },
    { type: "big",   label: t.big,   sub: "46–90",      emoji: "⬆️",
      color: "#fbbf24", bg: "linear-gradient(145deg,#78350f,#d97706)",
      shadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(217,119,6,0.5)" },
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

  function clearAll() {
    if (spinRef.current) { clearInterval(spinRef.current); spinRef.current = null; }
    if (pickRef.current) { clearInterval(pickRef.current); pickRef.current = null; }
  }

  // Phase idle → spin: lock bet, start animation
  const startGame = useCallback(() => {
    if (!player || player.balance < activeBet || phase !== "idle") return;
    lockedBet.current = activeBet;
    const final = Math.floor(Math.random() * 90) + 1;
    setFinalNum(final);
    setDisplayNum(null);
    setBetType(null);
    setPhase("spin");

    // Fast random numbers for 2s, then slow down and land
    let ticks = 0;
    const TOTAL = 28;
    spinRef.current = setInterval(() => {
      ticks++;
      const delay = ticks < 18 ? 70 : ticks < 24 ? 140 : 220; // not used for delay but for feel
      if (ticks < TOTAL) {
        setDisplayNum(Math.floor(Math.random() * 90) + 1);
      } else {
        clearInterval(spinRef.current!); spinRef.current = null;
        setDisplayNum(final);
        // Brief pause then switch to pick phase
        setTimeout(() => {
          setPhase("pick");
          setCountdown(5);
          let secs = 5;
          pickRef.current = setInterval(() => {
            secs--;
            setCountdown(secs);
            if (secs <= 0) {
              clearInterval(pickRef.current!); pickRef.current = null;
              // Time's up — auto-random pick (player loses edge)
              const opts: BetType[] = ["even","odd","small","big"];
              const auto = opts[Math.floor(Math.random() * 4)];
              resolveGame(final, auto);
            }
          }, 1000);
        }, 400);
      }
    }, 80);
  }, [player, activeBet, phase]);

  // Phase pick: player taps their prediction
  function pickBet(type: BetType) {
    if (phase !== "pick") return;
    clearAll();
    setBetType(type);
    resolveGame(finalNum!, type);
  }

  // Resolve win/lose and call API
  function resolveGame(final: number, picked: BetType) {
    const isWin =
      (picked === "even"  && final % 2 === 0) ||
      (picked === "odd"   && final % 2 !== 0) ||
      (picked === "small" && final <= 45) ||
      (picked === "big"   && final >= 46);
    const winAmt = isWin ? lockedBet.current * 2 : 0;
    setWon(isWin);
    setPrize(winAmt);
    setPhase("result");
    setSaving(true);
    placeBet(player!.telegramId, {
      amount: lockedBet.current, game: "parity", won: isWin, winAmount: winAmt,
    }).then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
  }

  function playAgain() {
    clearAll();
    setPhase("idle");
    setFinalNum(null);
    setDisplayNum(null);
    setBetType(null);
    setWon(false);
    setPrize(0);
  }

  useEffect(() => () => clearAll(), []);

  const numIsEven = finalNum !== null && finalNum % 2 === 0;
  const numIsBig  = finalNum !== null && finalNum >= 46;

  // Number box style
  const numBg =
    phase === "idle"   ? (isLight ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.06)") :
    phase === "spin"   ? "linear-gradient(145deg,#312e81,#4c1d95)" :
    phase === "pick"   ? (numIsEven ? "linear-gradient(145deg,#1e3a5f,#1e40af)" : "linear-gradient(145deg,#7f1d1d,#dc2626)") :
    /* result */         (numIsEven ? "linear-gradient(145deg,#1e3a5f,#1e40af)" : "linear-gradient(145deg,#7f1d1d,#dc2626)");

  const numBorder =
    phase === "idle"   ? (isLight ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.1)") :
    phase === "spin"   ? "#a78bfa88" :
    /* pick/result */    (numIsEven ? "#60a5faaa" : "#f87171aa");

  const numShadow =
    phase === "idle"   ? "0 4px 0 rgba(0,0,0,0.1)" :
    phase === "spin"   ? "0 8px 0 #1e1b4b, 0 10px 30px rgba(139,92,246,0.5)" :
    numIsEven          ? "0 8px 0 #0a1a40, 0 10px 30px rgba(37,99,235,0.6)" :
                         "0 8px 0 #450a0a, 0 10px 30px rgba(220,38,38,0.6)";

  const selectedOpt = BET_OPTIONS.find(b => b.type === betType);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <GameHeader title={`🔢 ${t.parityTitle}`} subtitle="1-90 son | 50/50 | x2" />

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">

        {/* ── Number display box ── */}
        <div className="rounded-3xl p-5 flex flex-col items-center gap-3 relative overflow-hidden"
          style={{
            background: isLight
              ? "linear-gradient(145deg,#e0e7ff,#c7d2fe)"
              : theme === "black" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
            border: `1.5px solid ${isLight ? "rgba(99,102,241,0.3)" : ts.cardBorder}`,
          }}>
          <div className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.06) 0%,transparent 50%)" }} />

          {/* Phase label */}
          <p className="text-xs font-black tracking-widest" style={{ color: ts.textSub }}>
            {phase === "idle"   ? `${t.number} (1-90)` :
             phase === "spin"   ? "⏳ SON CHIQMOQDA..." :
             phase === "pick"   ? `✅ SON CHIQDI — TAXMIN QILING! (${countdown}s)` :
                                  `✅ ${t.number} (1-90)`}
          </p>

          {/* Countdown ring (pick phase) */}
          {phase === "pick" && (
            <div className="relative flex items-center justify-center" style={{ width: 144, height: 144 }}>
              <svg width="160" height="160" style={{ position: "absolute", top: -8, left: -8, transform: "rotate(-90deg)" }}>
                <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="5" />
                <circle cx="80" cy="80" r="72" fill="none" stroke={numIsEven ? "#60a5fa" : "#f87171"}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 72}`}
                  strokeDashoffset={`${2 * Math.PI * 72 * (1 - countdown / 5)}`}
                  style={{ transition: "stroke-dashoffset 0.9s linear" }} />
              </svg>
              <div className="w-36 h-36 rounded-3xl flex items-center justify-center relative"
                style={{ background: numBg, border: `3px solid ${numBorder}`, boxShadow: numShadow }}>
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 50%)" }} />
                <span className="relative font-black" style={{
                  fontSize: displayNum !== null && displayNum >= 10 ? 48 : 60,
                  color: "white", textShadow: "0 4px 12px rgba(0,0,0,0.5)", lineHeight: 1
                }}>
                  {displayNum !== null ? displayNum : "?"}
                </span>
              </div>
            </div>
          )}

          {/* Normal number box (idle / spin / result) */}
          {phase !== "pick" && (
            <div className="w-36 h-36 rounded-3xl flex items-center justify-center relative"
              style={{ background: numBg, border: `3px solid ${numBorder}`, boxShadow: numShadow, transition: "all 0.15s" }}>
              <div className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 50%)" }} />
              <span className="relative font-black" style={{
                fontSize: displayNum !== null && displayNum >= 10 ? 48 : 60,
                color: "white", textShadow: "0 4px 12px rgba(0,0,0,0.5)", lineHeight: 1
              }}>
                {displayNum !== null ? displayNum : "?"}
              </span>
            </div>
          )}

          {/* Even/Odd + Small/Big labels after reveal */}
          {(phase === "pick" || phase === "result") && finalNum !== null && (
            <div className="flex gap-2 flex-wrap justify-center">
              <span className="px-3 py-1 rounded-full text-sm font-black"
                style={{ background: "rgba(255,255,255,0.1)", color: numIsEven ? "#60a5fa" : "#f87171" }}>
                {numIsEven ? t.even : t.odd}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-black"
                style={{ background: "rgba(255,255,255,0.1)", color: numIsBig ? "#fbbf24" : "#4ade80" }}>
                {numIsBig ? t.big : t.small} ({finalNum <= 45 ? "1-45" : "46-90"})
              </span>
            </div>
          )}

          {/* Win/Lose result */}
          {phase === "result" && (
            <div className="text-center">
              <p className="font-black text-2xl"
                style={{ color: won ? "#4ade80" : "#f87171", textShadow: won ? "0 0 24px #4ade8088" : "0 0 16px #f8717166" }}>
                {won ? t.parityWin : t.parityLose}
              </p>
              {selectedOpt && (
                <p className="text-xs mt-1" style={{ color: ts.textSub }}>
                  Tanlov: {selectedOpt.emoji} {selectedOpt.label}
                </p>
              )}
              {won && (
                <p className="font-bold text-sm mt-1" style={{ color: isLight ? "#059669" : "white" }}>
                  +{prize.toLocaleString()} UZS
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── PICK PHASE: big prediction buttons ── */}
        {phase === "pick" && (
          <div>
            <p className="text-center text-sm font-black mb-3" style={{ color: "#a78bfa" }}>
              👇 Son qaysi turkumga kiradi? Tanlang!
            </p>
            <div className="grid grid-cols-2 gap-3">
              {BET_OPTIONS.map(opt => (
                <button key={opt.type} onClick={() => pickBet(opt.type)}
                  className="rounded-2xl py-5 text-center active:scale-95 transition-all relative overflow-hidden"
                  style={{ background: opt.bg, border: `2px solid ${opt.color}99`, boxShadow: opt.shadow }}>
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 50%)" }} />
                  <p className="font-black text-xl relative" style={{ color: opt.color }}>
                    {opt.emoji} {opt.label}
                  </p>
                  <p className="text-xs mt-1 relative" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {opt.sub}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── IDLE PHASE: bet input + play button ── */}
        {phase === "idle" && (
          <>
            {/* Bet type info cards */}
            <div className="grid grid-cols-2 gap-2">
              {BET_OPTIONS.map(opt => (
                <div key={opt.type} className="rounded-2xl p-3 relative"
                  style={{
                    background: isLight ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${isLight ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.07)"}`,
                  }}>
                  <p className="font-black text-sm" style={{ color: ts.text }}>
                    {opt.emoji} {opt.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: ts.textSub }}>{opt.sub}</p>
                  <p className="text-xs font-black mt-1" style={{ color: opt.color }}>50% • x2</p>
                </div>
              ))}
            </div>

            {/* Bet amount */}
            <div className="rounded-2xl p-4"
              style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
              <p className="text-xs font-bold mb-3 tracking-widest" style={{ color: ts.textSub }}>
                💰 {t.betAmount}
              </p>
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
              <p className="text-xs mt-2 text-center" style={{ color: ts.textSub }}>
                {t.potential}:{" "}
                <span className="font-black" style={{ color: "#a78bfa" }}>
                  {(activeBet * 2).toLocaleString()} UZS
                </span>
              </p>
            </div>

            <button onClick={startGame}
              disabled={!player || player.balance < activeBet}
              className="w-full py-5 rounded-2xl font-black text-xl active:scale-95 transition-all disabled:opacity-40"
              style={{
                background: "linear-gradient(145deg,#312e81,#4c1d95)",
                color: "#a78bfa",
                boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(139,92,246,0.5)",
              }}>
              🎲 {t.bet} — {activeBet.toLocaleString()} UZS
            </button>
          </>
        )}

        {/* ── SPIN PHASE: waiting message ── */}
        {phase === "spin" && (
          <div className="text-center py-6">
            <p className="font-black text-lg animate-pulse" style={{ color: "#a78bfa" }}>
              ⏳ Son chiqmoqda, kuting...
            </p>
          </div>
        )}

        {/* ── RESULT PHASE: play again ── */}
        {phase === "result" && (
          <button onClick={playAgain}
            className="w-full py-5 rounded-2xl font-black text-xl active:scale-95 transition-all"
            style={{
              background: "linear-gradient(145deg,#312e81,#4c1d95)",
              color: "#a78bfa",
              boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(139,92,246,0.5)",
            }}>
            🔄 {t.playAgain}
          </button>
        )}

        {saving && (
          <p className="text-center text-xs" style={{ color: ts.textSub }}>
            {t.saving}
          </p>
        )}
      </div>
    </div>
  );
}
