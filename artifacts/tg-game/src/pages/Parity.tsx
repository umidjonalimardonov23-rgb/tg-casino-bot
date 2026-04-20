import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { placeBet } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

type BetType = "small" | "big" | "exact";
type Phase = "idle" | "spinning" | "result";

// House edge: small = 1-44, big = 47-90, 45-46 = house wins
const WIN_SMALL = (n: number) => n <= 44;
const WIN_BIG   = (n: number) => n >= 47;

function genFinal(lastResult: number | null): number {
  let n: number;
  let attempts = 0;
  do {
    n = Math.floor(Math.random() * 90) + 1;
    attempts++;
  } while (n === lastResult && attempts < 20);
  return n;
}

export default function Parity() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();
  const { t } = useLang();
  const { theme, ts } = useTheme();

  const [betInput, setBetInput] = useState("2000");
  const [betType, setBetType] = useState<BetType>("small");
  const [exactNum, setExactNum] = useState<number>(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [finalNum, setFinalNum] = useState<number | null>(null);
  const [displayNum, setDisplayNum] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [prize, setPrize] = useState(0);
  const [saving, setSaving] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedBet = useRef(0);
  const lockedType = useRef<BetType>("small");
  const lockedExact = useRef(1);
  const lastResultRef = useRef<number | null>(null);

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
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }

  function spinLoop(target: number, remaining: number, ms: number, slowAt: number, onDone: () => void) {
    if (remaining <= 0) {
      setDisplayNum(target);
      onDone();
      return;
    }
    setDisplayNum(Math.floor(Math.random() * 90) + 1);
    const nextMs = remaining > slowAt ? ms : remaining > 3 ? ms * 2 : ms * 4;
    timerRef.current = setTimeout(() => spinLoop(target, remaining - 1, ms, slowAt, onDone), nextMs);
  }

  const startGame = useCallback(() => {
    if (!player || player.balance < activeBet || phase !== "idle") return;

    lockedBet.current = activeBet;
    lockedType.current = betType;
    lockedExact.current = exactNum;

    const final = genFinal(lastResultRef.current);
    setFinalNum(final);
    setDisplayNum(null);
    setPhase("spinning");

    spinLoop(final, 28, 65, 10, () => {
      timerRef.current = setTimeout(() => {
        const type = lockedType.current;
        const picked = lockedExact.current;
        const isWin =
          type === "small"  ? WIN_SMALL(final) :
          type === "big"    ? WIN_BIG(final) :
                              final === picked;

        const mult = type === "exact" ? 20 : 2;
        const winAmt = isWin ? lockedBet.current * mult : 0;
        setWon(isWin);
        setPrize(winAmt);
        lastResultRef.current = final;
        setPhase("result");
        setSaving(true);
        placeBet(player!.telegramId, {
          amount: lockedBet.current, game: "parity", won: isWin, winAmount: winAmt,
        }).then(() => refresh()).catch(() => {}).finally(() => setSaving(false));
      }, 300);
    });
  }, [player, activeBet, betType, exactNum, phase]);

  function playAgain() {
    clearTimer();
    setPhase("idle");
    setFinalNum(null);
    setDisplayNum(null);
    setWon(false);
    setPrize(0);
  }

  useEffect(() => () => clearTimer(), []);

  const isSpinning = phase === "spinning";
  const numIsBig = finalNum !== null && finalNum >= 47;

  const numBg =
    isSpinning       ? "linear-gradient(145deg,#312e81,#4c1d95)" :
    phase === "idle" ? (isLight ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.06)") :
    numIsBig         ? "linear-gradient(145deg,#78350f,#d97706)" :
                       "linear-gradient(145deg,#064e3b,#059669)";

  const numBorder =
    isSpinning       ? "#a78bfa88" :
    phase === "idle" ? (isLight ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.1)") :
    numIsBig         ? "#fbbf24aa" : "#4ade80aa";

  const numShadow =
    isSpinning       ? "0 8px 0 #1e1b4b, 0 10px 30px rgba(139,92,246,0.5)" :
    phase === "idle" ? "0 4px 0 rgba(0,0,0,0.1)" :
    numIsBig         ? "0 8px 0 #3d1f00, 0 10px 30px rgba(217,119,6,0.6)" :
                       "0 8px 0 #022c22, 0 10px 30px rgba(5,150,105,0.6)";

  const selectedBtnStyle = (type: BetType) =>
    type === betType
      ? { boxShadow: "0 0 0 3px white", transform: "scale(1.04)" }
      : { opacity: 0.7 };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <GameHeader title={`🔢 ${t.parityTitle}`} subtitle="1-90 son | x2 | x20" hideTheme />

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">

        {/* Number display */}
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
            {phase === "idle"     ? "SON (1–90)" :
             isSpinning           ? "⏳ SON AYLANMOQDA..." :
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

          {/* Result badge */}
          {phase === "result" && finalNum !== null && (
            <span className="px-4 py-1.5 rounded-full text-sm font-black"
              style={{ background: "rgba(255,255,255,0.1)", color: numIsBig ? "#fbbf24" : "#4ade80" }}>
              {numIsBig ? "⬆️ KATTA" : "⬇️ KICHIK"} ({finalNum})
            </span>
          )}

          {/* Win/Lose */}
          {phase === "result" && (
            <div className="text-center">
              <p className="font-black text-2xl"
                style={{ color: won ? "#4ade80" : "#f87171", textShadow: won ? "0 0 24px #4ade8088" : "0 0 16px #f8717166" }}>
                {won ? "🎉 YUTDINGIZ!" : "😔 YUTQAZDINGIZ"}
              </p>
              {won && (
                <p className="font-bold text-lg mt-1" style={{ color: isLight ? "#059669" : "white" }}>
                  +{prize.toLocaleString()} UZS
                </p>
              )}
            </div>
          )}
        </div>

        {/* IDLE: Bet type selector + amount */}
        {phase === "idle" && (
          <>
            {/* Bet type selector */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setBetType("small")}
                className="rounded-2xl py-4 text-center active:scale-95 transition-all relative overflow-hidden"
                style={{ background: "linear-gradient(145deg,#064e3b,#059669)", border: "2px solid #4ade8099",
                  boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(5,150,105,0.5)", ...selectedBtnStyle("small") }}>
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 50%)" }} />
                <p className="font-black text-2xl relative">⬇️</p>
                <p className="font-black text-xs mt-1 relative" style={{ color: "#4ade80" }}>KICHIK x2</p>
                <p className="text-xs relative" style={{ color: "rgba(255,255,255,0.5)" }}>1–44</p>
              </button>

              <button onClick={() => setBetType("exact")}
                className="rounded-2xl py-4 text-center active:scale-95 transition-all relative overflow-hidden"
                style={{ background: "linear-gradient(145deg,#1a0533,#3b0764)", border: "2px solid #c084fc99",
                  boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(168,85,247,0.5)", ...selectedBtnStyle("exact") }}>
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.1) 0%,transparent 50%)" }} />
                <p className="font-black text-2xl relative">🎯</p>
                <p className="font-black text-xs mt-1 relative" style={{ color: "#c084fc" }}>ANIQ x20</p>
                <p className="text-xs relative" style={{ color: "rgba(255,255,255,0.5)" }}>={exactNum}</p>
              </button>

              <button onClick={() => setBetType("big")}
                className="rounded-2xl py-4 text-center active:scale-95 transition-all relative overflow-hidden"
                style={{ background: "linear-gradient(145deg,#78350f,#d97706)", border: "2px solid #fbbf2499",
                  boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(217,119,6,0.5)", ...selectedBtnStyle("big") }}>
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 50%)" }} />
                <p className="font-black text-2xl relative">⬆️</p>
                <p className="font-black text-xs mt-1 relative" style={{ color: "#fbbf24" }}>KATTA x2</p>
                <p className="text-xs relative" style={{ color: "rgba(255,255,255,0.5)" }}>47–90</p>
              </button>
            </div>

            {/* Exact number picker (only if exact selected) */}
            {betType === "exact" && (
              <div className="rounded-2xl p-4 relative overflow-hidden"
                style={{ background: "linear-gradient(145deg,#1a0533,#3b0764)", border: "2px solid #c084fc55" }}>
                <p className="font-black text-sm mb-3 relative" style={{ color: "#c084fc" }}>
                  🎯 Aniq son tanlang
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => setExactNum(n => Math.max(1, n - 1))}
                    className="w-12 h-12 rounded-xl font-black text-2xl active:scale-90 flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(192,132,252,0.25)", color: "#c084fc", border: "1.5px solid #c084fc55" }}>−</button>
                  <div className="flex-1 rounded-xl py-3 text-center font-black text-3xl"
                    style={{ background: "rgba(0,0,0,0.4)", color: "#c084fc", border: "1.5px solid #c084fc55" }}>
                    {exactNum}
                  </div>
                  <button onClick={() => setExactNum(n => Math.min(90, n + 1))}
                    className="w-12 h-12 rounded-xl font-black text-2xl active:scale-90 flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(192,132,252,0.25)", color: "#c084fc", border: "1.5px solid #c084fc55" }}>+</button>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {[1,10,20,30,40,50,60,70,80,90].map(n => (
                    <button key={n} onClick={() => setExactNum(n)}
                      className="rounded-lg py-1 text-xs font-bold active:scale-95"
                      style={{
                        background: exactNum === n ? "rgba(192,132,252,0.4)" : "rgba(192,132,252,0.1)",
                        color: exactNum === n ? "#c084fc" : "rgba(255,255,255,0.45)",
                        border: exactNum === n ? "1px solid #c084fc88" : "1px solid transparent",
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bet amount */}
            <div className="rounded-2xl p-4" style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
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
            </div>

            <button onClick={startGame}
              disabled={!player || player.balance < activeBet}
              className="w-full py-5 rounded-2xl font-black text-xl active:scale-95 transition-all disabled:opacity-40"
              style={{
                background: betType === "small"  ? "linear-gradient(145deg,#064e3b,#059669)" :
                             betType === "big"    ? "linear-gradient(145deg,#78350f,#d97706)" :
                                                    "linear-gradient(145deg,#312e81,#4c1d95)",
                color: betType === "small" ? "#4ade80" : betType === "big" ? "#fbbf24" : "#a78bfa",
                boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(139,92,246,0.5)",
              }}>
              🎲 AYLANISH — {activeBet.toLocaleString()} UZS
            </button>
          </>
        )}

        {/* Spinning */}
        {isSpinning && (
          <div className="text-center py-6">
            <p className="font-black text-lg animate-pulse" style={{ color: "#a78bfa" }}>
              ⏳ Son chiqmoqda...
            </p>
            <p className="text-sm mt-2" style={{ color: ts.textSub }}>
              {lockedType.current === "small" ? "⬇️ Kichik (1–44)" :
               lockedType.current === "big"   ? "⬆️ Katta (47–90)" :
               `🎯 Aniq: ${lockedExact.current}`}
            </p>
          </div>
        )}

        {/* Result */}
        {phase === "result" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-4 text-center"
              style={{
                background: won ? "rgba(5,150,105,0.12)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${won ? "rgba(74,222,128,0.3)" : "rgba(239,68,68,0.2)"}`,
              }}>
              <p className="text-sm" style={{ color: ts.textSub }}>
                Sizning taxminingiz:{" "}
                <b style={{ color: lockedType.current === "small" ? "#4ade80" : lockedType.current === "big" ? "#fbbf24" : "#c084fc" }}>
                  {lockedType.current === "small" ? `⬇️ Kichik (1–44)` :
                   lockedType.current === "big"   ? `⬆️ Katta (47–90)` :
                   `🎯 Aniq: ${lockedExact.current}`}
                </b>
              </p>
            </div>

            <button onClick={playAgain}
              className="w-full py-4 rounded-2xl font-black text-lg active:scale-95 transition-all"
              style={{
                background: "linear-gradient(145deg,#312e81,#4c1d95)",
                color: "#a78bfa",
                boxShadow: "0 5px 0 rgba(0,0,0,0.3), 0 6px 20px rgba(139,92,246,0.5)",
              }}>
              🔄 {t.playAgain}
            </button>
            <button onClick={() => nav("/")}
              className="w-full py-4 rounded-2xl font-black text-lg active:scale-95 transition-all"
              style={{
                background: isLight ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.07)",
                color: ts.textSub,
                border: `1px solid ${ts.cardBorder}`,
              }}>
              ← Botga qaytish
            </button>
          </div>
        )}

        {saving && (
          <p className="text-center text-xs" style={{ color: ts.textSub }}>{t.saving}</p>
        )}
      </div>
    </div>
  );
}
