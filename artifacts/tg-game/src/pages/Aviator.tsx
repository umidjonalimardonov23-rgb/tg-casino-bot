import { useState, useEffect, useRef } from "react";
import { usePlayer } from "@/lib/player-context";
import { useTheme } from "@/lib/theme-context";
import { placeBet } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

type Phase = "idle" | "countdown" | "flying" | "done";

// 80% small (1.1-1.7), 12% medium (1.7-3.5), 6% big (3.5-10), 2% huge (10-30)
function randomCrash(): number {
  const r = Math.random();
  if (r < 0.80) return parseFloat((1.10 + Math.random() * 0.60).toFixed(2));
  if (r < 0.92) return parseFloat((1.70 + Math.random() * 1.80).toFixed(2));
  if (r < 0.98) return parseFloat((3.50 + Math.random() * 6.50).toFixed(2));
  return parseFloat((10.0 + Math.random() * 20.0).toFixed(2));
}

export default function Aviator() {
  const { player, refresh } = usePlayer();
  const { theme, ts } = useTheme();

  const [phase, setPhase] = useState<Phase>("idle");
  const [multiplier, setMultiplier] = useState(1.00);
  const [countdown, setCountdown] = useState(3);
  const [betAmt, setBetAmt] = useState(2000);
  const [betInput, setBetInput] = useState("2000");
  const [result, setResult] = useState<{ won: boolean; mult: number; amount: number } | null>(null);
  const [history, setHistory] = useState<{ val: number; won: boolean }[]>([
    { val: 5.32, won: true }, { val: 1.84, won: false }, { val: 12.5, won: true },
    { val: 1.21, won: false }, { val: 3.01, won: true }, { val: 1.55, won: false },
  ]);
  const [autoCashOut, setAutoCashOut] = useState(false);
  const [autoCashOutAt, setAutoCashOutAt] = useState("2.00");
  const [autoBet, setAutoBet] = useState(false);

  const multRef = useRef(1.00);
  const crashRef = useRef(1.10);
  const flyingRef = useRef(false);
  const betRef = useRef(2000);
  const playerRef = useRef(player);
  const autoCashOutRef = useRef(false);
  const autoCashOutAtRef = useRef(2.00);
  const autoBetRef = useRef(false);
  const savingRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  const loopRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const countdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const autoRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isLight = theme === "light";

  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { betRef.current = betAmt; }, [betAmt]);
  useEffect(() => { autoCashOutRef.current = autoCashOut; }, [autoCashOut]);
  useEffect(() => { autoCashOutAtRef.current = parseFloat(autoCashOutAt) || 2.0; }, [autoCashOutAt]);
  useEffect(() => { autoBetRef.current = autoBet; }, [autoBet]);
  useEffect(() => () => {
    clearInterval(loopRef.current);
    clearInterval(countdownRef.current);
    clearTimeout(autoRef.current);
  }, []);

  function setPhaseSync(p: Phase) { phaseRef.current = p; setPhase(p); }

  async function doCashOut() {
    if (phaseRef.current !== "flying" || savingRef.current) return;
    clearInterval(loopRef.current);
    flyingRef.current = false;
    const m = multRef.current;
    const prize = Math.floor(betRef.current * m);
    setResult({ won: true, mult: m, amount: prize });
    setHistory(h => [{ val: m, won: true }, ...h].slice(0, 10));
    setPhaseSync("done");
    if (playerRef.current && !savingRef.current) {
      savingRef.current = true;
      await placeBet(playerRef.current.telegramId, { amount: betRef.current, game: "aviator", won: true, winAmount: prize }).catch(() => {});
      await refresh();
      savingRef.current = false;
    }
    if (autoBetRef.current) autoRef.current = setTimeout(startRound, 2500);
  }

  function startFlying() {
    const crash = crashRef.current;
    multRef.current = 1.00;
    flyingRef.current = true;
    setPhaseSync("flying");
    setMultiplier(1.00);

    loopRef.current = setInterval(async () => {
      if (!flyingRef.current) return;
      // Faster increase: ~0.012 per 80ms = ~0.15/s at 1x
      multRef.current = parseFloat((multRef.current + 0.012 + multRef.current * 0.0012).toFixed(2));
      const cur = multRef.current;
      setMultiplier(cur);

      if (autoCashOutRef.current && cur >= autoCashOutAtRef.current && !savingRef.current) {
        await doCashOut();
        return;
      }

      if (cur >= crash) {
        clearInterval(loopRef.current);
        flyingRef.current = false;
        setMultiplier(crash);
        setResult({ won: false, mult: crash, amount: 0 });
        setHistory(h => [{ val: crash, won: false }, ...h].slice(0, 10));
        setPhaseSync("done");
        if (playerRef.current) {
          placeBet(playerRef.current.telegramId, { amount: betRef.current, game: "aviator", won: false, winAmount: 0 })
            .then(() => refresh()).catch(() => {});
        }
        if (autoBetRef.current) autoRef.current = setTimeout(startRound, 2500);
      }
    }, 80);
  }

  function startRound() {
    clearInterval(loopRef.current); clearInterval(countdownRef.current); clearTimeout(autoRef.current);
    flyingRef.current = false; savingRef.current = false;
    crashRef.current = randomCrash();
    multRef.current = 1.00;
    setMultiplier(1.00); setResult(null); setCountdown(3);
    setPhaseSync("countdown");
    let cnt = 3;
    countdownRef.current = setInterval(() => {
      cnt--; setCountdown(cnt);
      if (cnt <= 0) { clearInterval(countdownRef.current); startFlying(); }
    }, 1000);
  }

  function handleReset() {
    clearInterval(loopRef.current); clearInterval(countdownRef.current); clearTimeout(autoRef.current);
    flyingRef.current = false; savingRef.current = false;
    setAutoBet(false);
    setPhaseSync("idle"); setMultiplier(1.00); setResult(null);
  }

  const multColor = multiplier >= 10 ? "#c084fc" : multiplier >= 5 ? "#34d399" : multiplier >= 2 ? "#fbbf24" : "#f87171";

  // Plane position based on multiplier
  const planeX = Math.min(80, (multiplier - 1) * 20);
  const planeY = Math.max(10, 80 - (multiplier - 1) * 15);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0) rotate(-8deg)} 50%{transform:translateY(-8px) rotate(-8deg)} }
        @keyframes twinkle { 0%,100%{opacity:0.15} 50%{opacity:0.55} }
      `}</style>

      <GameHeader title="✈️ AVIATOR" subtitle="Qulab tushishidan oldin oling!" />

      <div className="flex-1 px-4 pb-6 flex flex-col gap-3">

        {/* History */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {history.map((h, i) => (
            <span key={i} className="shrink-0 text-xs font-black px-2.5 py-1 rounded-xl"
              style={{
                background: h.won ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                color: h.won ? "#34d399" : "#f87171",
                border: `1px solid ${h.won ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
              }}>
              {h.val.toFixed(2)}x
            </span>
          ))}
        </div>

        {/* Sky screen */}
        <div className="rounded-3xl overflow-hidden relative flex items-end justify-start"
          style={{
            height: 200,
            background: isLight
              ? "linear-gradient(160deg, #dbeafe, #e0e7ff, #ede9fe)"
              : theme === "black"
                ? "linear-gradient(160deg, #000, #0a0820)"
                : "linear-gradient(160deg, #1e1b4b, #13103a, #0a0818)",
            border: `1.5px solid ${isLight ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)"}`,
            boxShadow: isLight ? "0 6px 24px rgba(99,102,241,0.15)" : "0 6px 24px rgba(79,70,229,0.15)",
          }}>

          {/* Stars (dark mode only) */}
          {theme !== "light" && [...Array(20)].map((_, i) => (
            <div key={i} className="absolute rounded-full"
              style={{ width: 2, height: 2, background: "white", opacity: 0.2,
                left: `${(i * 43 + 7) % 95}%`, top: `${(i * 31 + 9) % 75}%`,
                animation: `twinkle ${2 + (i % 3)}s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
          ))}

          {/* Flight curve */}
          {phase === "flying" && (
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200" preserveAspectRatio="none">
              <path
                d={`M 0 180 Q ${100 + planeX * 1.5} ${180 - (multiplier - 1) * 30} ${Math.min(280, 50 + planeX * 3)} ${Math.max(20, 180 - (multiplier - 1) * 30)}`}
                fill="none" stroke={multColor} strokeWidth="2.5" opacity="0.7"
                strokeDasharray="6 3"
              />
            </svg>
          )}

          {/* Plane + multiplier */}
          <div className="absolute w-full h-full flex items-center justify-center">
            {phase === "idle" && (
              <div className="text-center">
                <div className="text-5xl mb-2" style={{ animation: "float 2s ease-in-out infinite" }}>✈️</div>
                <p className="text-sm font-semibold" style={{ color: isLight ? "rgba(30,27,75,0.4)" : "rgba(255,255,255,0.3)" }}>
                  Tikish kiriting va boshlang
                </p>
              </div>
            )}
            {phase === "countdown" && (
              <div className="text-center">
                <p className="text-sm font-bold mb-2 animate-pulse" style={{ color: "#a78bfa" }}>Tayyorlanmoqda...</p>
                <p className="font-black" style={{ fontSize: 72, lineHeight: 1, color: isLight ? "#4338ca" : "white" }}>{countdown}</p>
              </div>
            )}
            {phase === "flying" && (
              <div className="text-center">
                <div className="text-4xl mb-1" style={{ animation: "float 1.5s ease-in-out infinite" }}>✈️</div>
                <p className="font-black" style={{ fontSize: 52, lineHeight: 1, color: multColor, textShadow: `0 0 30px ${multColor}99` }}>
                  {multiplier.toFixed(2)}x
                </p>
              </div>
            )}
            {phase === "done" && result?.won && (
              <div className="text-center">
                <div className="text-3xl mb-1">🎉</div>
                <p className="font-black text-3xl" style={{ color: "#34d399" }}>{result.mult.toFixed(2)}x</p>
                <p className="font-bold text-lg" style={{ color: "#4ade80" }}>+{result.amount.toLocaleString()} UZS</p>
              </div>
            )}
            {phase === "done" && !result?.won && (
              <div className="text-center">
                <div className="text-3xl mb-1">💥</div>
                <p className="font-black text-3xl" style={{ color: "#f87171" }}>{result?.mult.toFixed(2)}x</p>
                <p className="text-sm" style={{ color: "#f87171aa" }}>Qulab tushdi!</p>
              </div>
            )}
          </div>
        </div>

        {/* Cash out (while flying) */}
        {phase === "flying" && (
          <button onClick={doCashOut}
            className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg, #059669, #16a34a)", boxShadow: "0 6px 0 #064e3b, 0 8px 24px rgba(5,150,105,0.5)", color: "white" }}>
            💰 OLISH — {Math.floor(betAmt * multiplier).toLocaleString()} UZS
          </button>
        )}

        {/* Bet controls */}
        {(phase === "idle" || phase === "done") && (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              {["MIN","X2","X/2","MAX"].map(a => (
                <button key={a} onClick={() => {
                  const bal = player?.balance ?? 0;
                  let v = betAmt;
                  if (a === "MIN") v = 2000;
                  else if (a === "MAX") v = Math.min(bal, 500000);
                  else if (a === "X2") v = Math.min(betAmt * 2, bal, 500000);
                  else v = Math.max(Math.floor(betAmt / 2), 2000);
                  setBetAmt(v); setBetInput(String(v)); betRef.current = v;
                }}
                  className="py-2 rounded-xl text-xs font-bold active:scale-95"
                  style={{ background: ts.btnSecondary, color: ts.btnSecondaryText, border: `1px solid ${ts.cardBorder}` }}>
                  {a}
                </button>
              ))}
            </div>

            <input type="number" placeholder="Tikish miqdori (min 2 000)" value={betInput}
              onChange={(e) => { setBetInput(e.target.value); const v = Number(e.target.value) || 2000; setBetAmt(v); betRef.current = v; }}
              className="w-full rounded-2xl px-4 py-3.5 font-black text-lg focus:outline-none"
              style={{ background: ts.input, border: `1px solid ${ts.inputBorder}`, color: ts.text }} />

            {/* Auto cash out */}
            <div className="flex items-center gap-3 px-3 py-3 rounded-2xl"
              style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
              <button onClick={() => setAutoCashOut(v => !v)}
                className="w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-all"
                style={{ background: autoCashOut ? "#16a34a" : "rgba(255,255,255,0.15)" }}>
                <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: autoCashOut ? "translateX(20px)" : "translateX(0)" }} />
              </button>
              <span className="text-sm flex-1" style={{ color: ts.textSub }}>Avto olish</span>
              <input type="number" step="0.1" min="1.1" value={autoCashOutAt}
                onChange={(e) => setAutoCashOutAt(e.target.value)} disabled={!autoCashOut}
                className="w-20 rounded-xl px-2 py-1 text-sm text-center font-black focus:outline-none disabled:opacity-40"
                style={{ background: ts.input, border: `1px solid ${ts.inputBorder}`, color: ts.text }} />
            </div>

            {/* Auto bet */}
            <div className="flex items-center gap-3 px-3 py-3 rounded-2xl"
              style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
              <button onClick={() => { const nv = !autoBet; setAutoBet(nv); autoBetRef.current = nv; }}
                className="w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-all"
                style={{ background: autoBet ? "#4338ca" : "rgba(255,255,255,0.15)" }}>
                <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: autoBet ? "translateX(20px)" : "translateX(0)" }} />
              </button>
              <span className="text-sm flex-1" style={{ color: ts.textSub }}>Avto tikish</span>
              {autoBet && <span className="text-xs font-black" style={{ color: "#818cf8" }}>YOQILGAN</span>}
            </div>

            {phase === "idle" ? (
              <button onClick={() => { if (!player || player.balance < betAmt || betAmt < 2000) return; startRound(); }}
                disabled={!player || player.balance < betAmt || betAmt < 2000}
                className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(145deg, #4338ca, #7c3aed)", boxShadow: "0 6px 0 #2e1065, 0 8px 24px rgba(124,58,237,0.5)", color: "white" }}>
                🚀 BOSHLASH — {betAmt.toLocaleString()} UZS
              </button>
            ) : (
              <button onClick={handleReset}
                className="w-full py-4 rounded-2xl font-black text-base active:scale-95"
                style={{ background: ts.card, border: `1px solid ${ts.cardBorder}`, color: ts.textSub }}>
                🔄 QAYTA O'YNASH
              </button>
            )}
          </>
        )}

        {phase === "countdown" && (
          <div className="w-full py-4 rounded-2xl text-center font-bold"
            style={{ background: ts.card, border: `1px solid ${ts.cardBorder}`, color: ts.textSub }}>
            ✈️ Tikish: {betAmt.toLocaleString()} UZS • Tayyor bo'ling!
          </div>
        )}
      </div>
    </div>
  );
}
