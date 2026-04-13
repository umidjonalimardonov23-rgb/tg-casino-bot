import { useState, useCallback, useRef, useEffect } from "react";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { placeBet } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

type BetType = "small" | "big" | "exact";
type Phase = "idle" | "spin1" | "pick" | "spin2" | "result";

export default function Parity() {
  const { player, refresh } = usePlayer();
  const { t } = useLang();
  const { theme, ts } = useTheme();
  const [betInput, setBetInput] = useState("2000");
  const [betType, setBetType] = useState<BetType | null>(null);
  const [exactNum, setExactNum] = useState<number>(1);   // number chosen for TENG
  const [phase, setPhase] = useState<Phase>("idle");
  const [finalNum, setFinalNum] = useState<number | null>(null);
  const [displayNum, setDisplayNum] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [prize, setPrize] = useState(0);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockedBet = useRef(0);

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

  function clearTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function runSpin(target: number, totalTicks: number, ms: number, slowAt: number, onDone: () => void) {
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      if (i < totalTicks) {
        setDisplayNum(Math.floor(Math.random() * 90) + 1);
      } else {
        clearTimer();
        setDisplayNum(target);
        onDone();
      }
    }, i < slowAt ? ms : ms * 2);
  }

  const startGame = useCallback(() => {
    if (!player || player.balance < activeBet || phase !== "idle") return;
    lockedBet.current = activeBet;
    const final = Math.floor(Math.random() * 90) + 1;
    setFinalNum(final);
    setDisplayNum(null);
    setBetType(null);
    setPhase("spin1");

    // First spin: fast random numbers → stop at final
    let i = 0;
    const TOTAL = 28;
    timerRef.current = setInterval(() => {
      i++;
      if (i < TOTAL) {
        setDisplayNum(Math.floor(Math.random() * 90) + 1);
      } else {
        clearTimer();
        setDisplayNum(final);
        setTimeout(() => setPhase("pick"), 350);
      }
    }, i < 20 ? 75 : 140);
  }, [player, activeBet, phase]);

  function pickBet(type: BetType, chosenExact?: number) {
    if (phase !== "pick") return;
    setBetType(type);
    setPhase("spin2");

    // Second spin: shorter
    let i = 0;
    const TOTAL = 18;
    timerRef.current = setInterval(() => {
      i++;
      if (i < TOTAL) {
        setDisplayNum(Math.floor(Math.random() * 90) + 1);
      } else {
        clearTimer();
        const fn = finalNum!;
        setDisplayNum(fn);

        setTimeout(() => {
          let isWin = false;
          if (type === "small") isWin = fn <= 45;
          else if (type === "big") isWin = fn >= 46;
          else if (type === "exact") isWin = fn === (chosenExact ?? exactNum);

          const mult = type === "exact" ? 20 : 2;
          const winAmt = isWin ? lockedBet.current * mult : 0;
          setWon(isWin);
          setPrize(winAmt);
          setPhase("result");
          setSaving(true);
          placeBet(player!.telegramId, {
            amount: lockedBet.current, game: "parity", won: isWin, winAmount: winAmt,
          }).then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
        }, 200);
      }
    }, 85);
  }

  function playAgain() {
    clearTimer();
    setPhase("idle");
    setFinalNum(null);
    setDisplayNum(null);
    setBetType(null);
    setWon(false);
    setPrize(0);
  }

  useEffect(() => () => clearTimer(), []);

  const numIsBig = finalNum !== null && finalNum >= 46;
  const selectedLabel =
    betType === "small" ? `⬇️ ${t.small}` :
    betType === "big"   ? `⬆️ ${t.big}` :
    betType === "exact" ? `🎯 TENG (${exactNum})` : "";

  // Number box color
  const isSpinning = phase === "spin1" || phase === "spin2";
  const numBg =
    isSpinning       ? "linear-gradient(145deg,#312e81,#4c1d95)" :
    phase === "idle" ? (isLight ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.06)") :
    phase === "result" && finalNum !== null
      ? (betType === "exact"
          ? (won ? "linear-gradient(145deg,#064e3b,#059669)" : "linear-gradient(145deg,#7f1d1d,#dc2626)")
          : (numIsBig ? "linear-gradient(145deg,#78350f,#d97706)" : "linear-gradient(145deg,#064e3b,#059669)"))
      : (numIsBig ? "linear-gradient(145deg,#78350f,#d97706)" : "linear-gradient(145deg,#064e3b,#059669)");
  const numBorder =
    isSpinning       ? "#a78bfa88" :
    phase === "idle" ? (isLight ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.1)") :
    numIsBig ? "#fbbf24aa" : "#4ade80aa";
  const numShadow =
    isSpinning       ? "0 8px 0 #1e1b4b, 0 10px 30px rgba(139,92,246,0.5)" :
    phase === "idle" ? "0 4px 0 rgba(0,0,0,0.1)" :
    numIsBig ? "0 8px 0 #3d1f00, 0 10px 30px rgba(217,119,6,0.6)" :
               "0 8px 0 #022c22, 0 10px 30px rgba(5,150,105,0.6)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <GameHeader title={`🔢 ${t.parityTitle}`} subtitle="1-90 son | KICHIK/KATTA x2 | TENG x20" />

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">

        {/* ── Number display ── */}
        <div className="rounded-3xl p-5 flex flex-col items-center gap-3 relative overflow-hidden"
          style={{
            background: isLight
              ? "linear-gradient(145deg,#e0e7ff,#c7d2fe)"
              : theme === "black" ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
            border: `1.5px solid ${isLight ? "rgba(99,102,241,0.3)" : ts.cardBorder}`,
          }}>
          <div className="absolute inset-0 pointer-events-none rounded-3xl"
            style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.06) 0%,transparent 50%)" }} />

          <p className="text-xs font-black tracking-widest" style={{ color: ts.textSub }}>
            {phase === "idle"   ? "SON (1–90)" :
             isSpinning         ? "⏳ SON AYLANMOQDA..." :
             phase === "pick"   ? "👇 TAXMIN QILING" :
                                  "✅ NATIJA"}
          </p>

          <div className="w-36 h-36 rounded-3xl flex items-center justify-center relative"
            style={{ background: numBg, border: `3px solid ${numBorder}`, boxShadow: numShadow, transition: "background 0.2s, border-color 0.2s" }}>
            <div className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 50%)" }} />
            <span className="relative font-black" style={{
              fontSize: displayNum !== null && displayNum >= 10 ? 48 : 60,
              color: "white", textShadow: "0 4px 12px rgba(0,0,0,0.5)", lineHeight: 1,
            }}>
              {displayNum !== null ? displayNum : "?"}
            </span>
          </div>

          {/* KICHIK / KATTA label after first spin */}
          {(phase === "pick" || phase === "result") && finalNum !== null && (
            <div className="flex gap-2">
              <span className="px-4 py-1.5 rounded-full text-sm font-black"
                style={{ background: "rgba(255,255,255,0.1)", color: numIsBig ? "#fbbf24" : "#4ade80" }}>
                {numIsBig ? `⬆️ ${t.big}` : `⬇️ ${t.small}`} ({finalNum})
              </span>
            </div>
          )}

          {/* Win / Lose */}
          {phase === "result" && (
            <div className="text-center">
              <p className="font-black text-2xl"
                style={{ color: won ? "#4ade80" : "#f87171", textShadow: won ? "0 0 24px #4ade8088" : "0 0 16px #f8717166" }}>
                {won ? "🎉 YUTDINGIZ!" : "😔 YUTQAZDINGIZ"}
              </p>
              <p className="text-xs mt-1" style={{ color: ts.textSub }}>Tanlov: {selectedLabel}</p>
              {won && (
                <p className="font-bold text-sm mt-1" style={{ color: isLight ? "#059669" : "white" }}>
                  +{prize.toLocaleString()} UZS
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── PICK phase: 3 buttons ── */}
        {phase === "pick" && (
          <div className="flex flex-col gap-3">
            {/* KICHIK + KATTA side by side */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => pickBet("small")}
                className="rounded-2xl py-6 text-center active:scale-95 transition-all relative overflow-hidden"
                style={{ background: "linear-gradient(145deg,#064e3b,#059669)", border: "2px solid #4ade8099", boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(5,150,105,0.5)" }}>
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 50%)" }} />
                <p className="font-black text-2xl relative">⬇️</p>
                <p className="font-black text-xl mt-1 relative" style={{ color: "#4ade80" }}>{t.small}</p>
                <p className="text-sm mt-1 relative" style={{ color: "rgba(255,255,255,0.6)" }}>1–45 • x2</p>
              </button>

              <button onClick={() => pickBet("big")}
                className="rounded-2xl py-6 text-center active:scale-95 transition-all relative overflow-hidden"
                style={{ background: "linear-gradient(145deg,#78350f,#d97706)", border: "2px solid #fbbf2499", boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(217,119,6,0.5)" }}>
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 50%)" }} />
                <p className="font-black text-2xl relative">⬆️</p>
                <p className="font-black text-xl mt-1 relative" style={{ color: "#fbbf24" }}>{t.big}</p>
                <p className="text-sm mt-1 relative" style={{ color: "rgba(255,255,255,0.6)" }}>46–90 • x2</p>
              </button>
            </div>

            {/* TENG — full width with number picker */}
            <div className="rounded-2xl p-4 relative overflow-hidden"
              style={{ background: "linear-gradient(145deg,#1a0533,#3b0764)", border: "2px solid #c084fc99", boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(168,85,247,0.5)" }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.1) 0%,transparent 50%)" }} />
              <div className="relative flex items-center justify-between mb-3">
                <div>
                  <p className="font-black text-xl" style={{ color: "#c084fc" }}>🎯 TENG</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Aniq son • x20</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Yutish:</p>
                  <p className="font-black text-lg" style={{ color: "#c084fc" }}>
                    {(lockedBet.current * 20).toLocaleString()} UZS
                  </p>
                </div>
              </div>

              {/* Number picker 1-90 */}
              <div className="relative flex items-center gap-3 mb-3">
                <button onClick={() => setExactNum(n => Math.max(1, n - 1))}
                  className="w-10 h-10 rounded-xl font-black text-xl active:scale-90 flex-shrink-0"
                  style={{ background: "rgba(192,132,252,0.2)", color: "#c084fc", border: "1px solid #c084fc55" }}>
                  −
                </button>
                <div className="flex-1 rounded-xl py-3 text-center font-black text-2xl relative"
                  style={{ background: "rgba(0,0,0,0.3)", color: "#c084fc", border: "1px solid #c084fc55" }}>
                  {exactNum}
                </div>
                <button onClick={() => setExactNum(n => Math.min(90, n + 1))}
                  className="w-10 h-10 rounded-xl font-black text-xl active:scale-90 flex-shrink-0"
                  style={{ background: "rgba(192,132,252,0.2)", color: "#c084fc", border: "1px solid #c084fc55" }}>
                  +
                </button>
              </div>

              {/* Quick numbers */}
              <div className="grid grid-cols-9 gap-1 mb-3">
                {[1,10,20,30,40,50,60,70,80,90].map(n => (
                  <button key={n} onClick={() => setExactNum(n)}
                    className="rounded-lg py-1 text-xs font-bold active:scale-95"
                    style={{
                      background: exactNum === n ? "rgba(192,132,252,0.4)" : "rgba(192,132,252,0.1)",
                      color: exactNum === n ? "#c084fc" : "rgba(255,255,255,0.5)",
                      border: exactNum === n ? "1px solid #c084fc88" : "1px solid transparent",
                    }}>
                    {n}
                  </button>
                ))}
              </div>

              <button onClick={() => pickBet("exact", exactNum)}
                className="w-full py-3 rounded-xl font-black text-base active:scale-95"
                style={{ background: "linear-gradient(145deg,#7e22ce,#9333ea)", color: "#f3e8ff", boxShadow: "0 3px 0 #3b0764" }}>
                🎯 TENG TANLASH ({exactNum})
              </button>
            </div>
          </div>
        )}

        {/* ── IDLE phase ── */}
        {phase === "idle" && (
          <>
            {/* Info cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl p-3 flex flex-col items-center gap-1"
                style={{ background: "rgba(5,150,105,0.1)", border: "1.5px solid rgba(74,222,128,0.2)" }}>
                <span className="text-2xl">⬇️</span>
                <p className="font-black text-sm text-center" style={{ color: "#4ade80" }}>{t.small}</p>
                <p className="text-xs font-bold" style={{ color: ts.textSub }}>1–45</p>
                <p className="text-xs font-black" style={{ color: "#4ade80" }}>x2</p>
              </div>
              <div className="rounded-2xl p-3 flex flex-col items-center gap-1"
                style={{ background: "rgba(217,119,6,0.1)", border: "1.5px solid rgba(251,191,36,0.2)" }}>
                <span className="text-2xl">⬆️</span>
                <p className="font-black text-sm text-center" style={{ color: "#fbbf24" }}>{t.big}</p>
                <p className="text-xs font-bold" style={{ color: ts.textSub }}>46–90</p>
                <p className="text-xs font-black" style={{ color: "#fbbf24" }}>x2</p>
              </div>
              <div className="rounded-2xl p-3 flex flex-col items-center gap-1"
                style={{ background: "rgba(168,85,247,0.1)", border: "1.5px solid rgba(192,132,252,0.2)" }}>
                <span className="text-2xl">🎯</span>
                <p className="font-black text-sm text-center" style={{ color: "#c084fc" }}>TENG</p>
                <p className="text-xs font-bold" style={{ color: ts.textSub }}>Aniq son</p>
                <p className="text-xs font-black" style={{ color: "#c084fc" }}>x20</p>
              </div>
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
                KICHIK/KATTA: <span className="font-black" style={{ color: "#4ade80" }}>x2</span>
                {"  "}|{"  "}
                TENG: <span className="font-black" style={{ color: "#c084fc" }}>x20</span>
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

        {/* ── Spinning message ── */}
        {isSpinning && (
          <div className="text-center py-4">
            <p className="font-black text-base animate-pulse" style={{ color: "#a78bfa" }}>
              {phase === "spin1" ? "⏳ Son chiqmoqda..." : "🎲 Natija aniqlanmoqda..."}
            </p>
          </div>
        )}

        {/* ── Result: play again ── */}
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
          <p className="text-center text-xs" style={{ color: ts.textSub }}>{t.saving}</p>
        )}
      </div>
    </div>
  );
}
