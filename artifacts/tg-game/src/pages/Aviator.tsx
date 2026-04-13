import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { placeBet } from "@/lib/api";

type Phase = "idle" | "countdown" | "flying" | "done";

function randomCrash(): number {
  const r = Math.random();
  if (r < 0.20) return 1.00;
  if (r < 0.60) return parseFloat((1.0 + Math.random() * 0.6).toFixed(2));
  if (r < 0.78) return parseFloat((1.6 + Math.random() * 1.0).toFixed(2));
  if (r < 0.90) return parseFloat((2.6 + Math.random() * 2.5).toFixed(2));
  if (r < 0.97) return parseFloat((5.0 + Math.random() * 5.0).toFixed(2));
  return parseFloat((10.0 + Math.random() * 10).toFixed(2));
}

export default function Aviator() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();

  const [phase, setPhase] = useState<Phase>("idle");
  const [multiplier, setMultiplier] = useState(1.00);
  const [countdown, setCountdown] = useState(3);
  const [betAmt, setBetAmt] = useState(2000);
  const [betInput, setBetInput] = useState("2000");
  const [result, setResult] = useState<{ won: boolean; mult: number; amount: number } | null>(null);
  const [history, setHistory] = useState<{ val: number; won: boolean }[]>([
    { val: 5.32, won: true }, { val: 1.24, won: false }, { val: 12.5, won: true },
    { val: 2.01, won: true }, { val: 1.08, won: false }, { val: 8.9, won: true },
  ]);
  const [autoBet, setAutoBet] = useState(false);
  const [autoCashOut, setAutoCashOut] = useState(false);
  const [autoCashOutAt, setAutoCashOutAt] = useState("2.00");

  const multRef = useRef(1.00);
  const crashRef = useRef(1.00);
  const flyingRef = useRef(false);
  const betRef = useRef(2000);
  const playerRef = useRef(player);
  const autoBetRef = useRef(false);
  const autoCashOutRef = useRef(false);
  const autoCashOutAtRef = useRef(2.00);
  const loopRef = useRef<ReturnType<typeof setInterval>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const autoRef = useRef<ReturnType<typeof setTimeout>>();
  const savingRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");

  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { betRef.current = betAmt; }, [betAmt]);
  useEffect(() => { autoBetRef.current = autoBet; }, [autoBet]);
  useEffect(() => { autoCashOutRef.current = autoCashOut; }, [autoCashOut]);
  useEffect(() => { autoCashOutAtRef.current = parseFloat(autoCashOutAt) || 2.0; }, [autoCashOutAt]);
  useEffect(() => () => {
    clearInterval(loopRef.current); clearInterval(countdownRef.current); clearTimeout(autoRef.current);
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
      await refresh(); savingRef.current = false;
    }
    if (autoBetRef.current) autoRef.current = setTimeout(startRound, 2500);
  }

  function startFlying() {
    const crash = crashRef.current;
    multRef.current = 1.00; flyingRef.current = true;
    setPhaseSync("flying"); setMultiplier(1.00);
    loopRef.current = setInterval(async () => {
      if (!flyingRef.current) return;
      multRef.current = parseFloat((multRef.current + 0.006 + multRef.current * 0.0008).toFixed(2));
      const cur = multRef.current;
      setMultiplier(cur);
      if (autoCashOutRef.current && cur >= autoCashOutAtRef.current && !savingRef.current) { await doCashOut(); return; }
      if (cur >= crash) {
        clearInterval(loopRef.current); flyingRef.current = false;
        setMultiplier(crash); setResult({ won: false, mult: crash, amount: 0 });
        setHistory(h => [{ val: crash, won: false }, ...h].slice(0, 10));
        setPhaseSync("done");
        if (playerRef.current) placeBet(playerRef.current.telegramId, { amount: betRef.current, game: "aviator", won: false, winAmount: 0 }).then(() => refresh()).catch(() => {});
        if (autoBetRef.current) autoRef.current = setTimeout(startRound, 2500);
      }
    }, 80);
  }

  function startRound() {
    clearInterval(loopRef.current); clearInterval(countdownRef.current); clearTimeout(autoRef.current);
    flyingRef.current = false; savingRef.current = false;
    crashRef.current = randomCrash(); multRef.current = 1.00;
    setMultiplier(1.00); setResult(null); setCountdown(3); setPhaseSync("countdown");
    let cnt = 3;
    countdownRef.current = setInterval(() => {
      cnt--; setCountdown(cnt);
      if (cnt <= 0) { clearInterval(countdownRef.current); startFlying(); }
    }, 1000);
  }

  function handleReset() {
    clearInterval(loopRef.current); clearInterval(countdownRef.current); clearTimeout(autoRef.current);
    flyingRef.current = false; savingRef.current = false; autoBetRef.current = false;
    setAutoBet(false); setPhaseSync("idle"); setMultiplier(1.00); setResult(null);
  }

  const multColor = multiplier >= 10 ? "#c084fc" : multiplier >= 5 ? "#34d399" : multiplier >= 2 ? "#fbbf24" : "#f87171";
  const isWon = result?.won === true;
  const isCrashed = result?.won === false;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0c0a1e 0%, #13103a 50%, #0a0818 100%)" }}>

      {/* Orbs */}
      <div className="fixed pointer-events-none" style={{ top: -60, right: -30, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, #4338ca44 0%, transparent 70%)", filter: "blur(50px)" }} />
      <div className="fixed pointer-events-none" style={{ top: 160, left: -70, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #7c3aed33 0%, transparent 70%)", filter: "blur(40px)" }} />
      <div className="fixed pointer-events-none" style={{ bottom: 100, right: -50, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #3730a333 0%, transparent 70%)", filter: "blur(40px)" }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <button onClick={() => nav("/")} className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="font-black text-base tracking-wider text-white">✈️ AVIATOR</h1>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)" }}>
            <span className="text-purple-300 text-sm font-black">{(player?.balance ?? 0).toLocaleString()} UZS</span>
          </div>
        </div>

        {/* History */}
        <div className="px-4 mb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
          {history.map((h, i) => (
            <span key={i} className="shrink-0 text-xs font-black px-2.5 py-1 rounded-lg"
              style={{
                background: h.won ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                color: h.won ? "#34d399" : "#f87171",
                border: `1px solid ${h.won ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`
              }}>
              {h.val.toFixed(2)}x
            </span>
          ))}
        </div>

        {/* Sky */}
        <div className="mx-4 mb-3 rounded-3xl overflow-hidden relative flex items-center justify-center"
          style={{ height: 210, background: "linear-gradient(160deg, #1e1b4b, #13103a, #0a0818)", border: "1px solid rgba(99,102,241,0.3)", boxShadow: "0 8px 32px rgba(79,70,229,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

          {/* Stars */}
          {[...Array(28)].map((_, i) => (
            <div key={i} className="absolute rounded-full"
              style={{
                width: i % 4 === 0 ? 2.5 : 1.5, height: i % 4 === 0 ? 2.5 : 1.5,
                background: "white",
                left: `${(i * 43 + 7) % 95}%`, top: `${(i * 31 + 9) % 85}%`,
                opacity: 0.15 + (i % 5) * 0.08,
                animation: `twinkle ${2 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`
              }} />
          ))}

          {/* Curve */}
          {phase === "flying" && (
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 210" preserveAspectRatio="none">
              <defs>
                <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="100%" stopColor={multColor} stopOpacity="0.8" />
                </linearGradient>
              </defs>
              <path d={`M 0 200 Q ${150} ${200 - multiplier * 18} ${Math.min(290, multiplier * 30)} ${Math.max(10, 200 - multiplier * 18)}`}
                fill="none" stroke="url(#curveGrad)" strokeWidth="3" />
            </svg>
          )}

          <div className="relative z-10 text-center">
            {phase === "idle" && (
              <>
                <div className="text-5xl mb-2 float-anim">✈️</div>
                <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>Tikish kiriting va boshlang</p>
              </>
            )}
            {phase === "countdown" && (
              <>
                <p className="text-sm font-semibold mb-2 animate-pulse" style={{ color: "rgba(167,139,250,0.7)" }}>Tayyorlanmoqda...</p>
                <p className="font-black" style={{ fontSize: 80, lineHeight: 1, color: "white", textShadow: "0 0 30px rgba(167,139,250,0.8)" }}>{countdown}</p>
              </>
            )}
            {phase === "flying" && (
              <>
                <div className="text-5xl mb-2 float-anim">✈️</div>
                <p className="font-black transition-all"
                  style={{ fontSize: 54, lineHeight: 1, color: multColor, textShadow: `0 0 30px ${multColor}` }}>
                  {multiplier.toFixed(2)}x
                </p>
              </>
            )}
            {phase === "done" && isWon && (
              <div className="slide-up text-center">
                <div className="text-4xl mb-2">🎉</div>
                <p className="font-black text-3xl" style={{ color: "#34d399" }}>{result!.mult.toFixed(2)}x</p>
                <p className="font-bold text-lg mt-1" style={{ color: "#34d399" }}>+{result!.amount.toLocaleString()} UZS</p>
              </div>
            )}
            {phase === "done" && isCrashed && (
              <div className="slide-up text-center">
                <div className="text-4xl mb-2">💥</div>
                <p className="font-black text-3xl" style={{ color: "#f87171" }}>{result!.mult.toFixed(2)}x</p>
                <p className="text-sm mt-1" style={{ color: "rgba(248,113,113,0.6)" }}>Qulab tushdi!</p>
              </div>
            )}
          </div>
        </div>

        {/* Cash out */}
        {phase === "flying" && (
          <div className="mx-4 mb-3">
            <button onClick={doCashOut}
              className="w-full py-5 rounded-2xl font-black text-xl active:scale-95 transition-transform glow-green"
              style={{ background: "linear-gradient(135deg, #16a34a, #059669)", color: "white" }}>
              💰 OLISH — {Math.floor(betAmt * multiplier).toLocaleString()} UZS
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="px-4 pb-6 space-y-2.5">
          {(phase === "idle" || phase === "done") && (
            <>
              <div className="grid grid-cols-4 gap-1.5">
                {(["MIN","X2","X/2","MAX"] as const).map((a) => (
                  <button key={a} onClick={() => {
                    const bal = player?.balance ?? 0;
                    let v = betAmt;
                    if (a === "MIN") v = 2000;
                    else if (a === "MAX") v = Math.min(bal, 500000);
                    else if (a === "X2") v = Math.min(betAmt * 2, bal, 500000);
                    else v = Math.max(Math.floor(betAmt / 2), 2000);
                    setBetAmt(v); setBetInput(String(v)); betRef.current = v;
                  }} className="py-2 rounded-xl text-xs font-bold active:scale-95"
                    style={a === "MAX"
                      ? { background: "rgba(99,102,241,0.25)", border: "1px solid rgba(167,139,250,0.55)", color: "#a78bfa" }
                      : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                    {a}
                  </button>
                ))}
              </div>
              <input type="number" placeholder="Tikish miqdori (min 2 000)" value={betInput}
                onChange={(e) => { setBetInput(e.target.value); const v = Number(e.target.value)||2000; setBetAmt(v); betRef.current = v; }}
                className="w-full rounded-2xl px-4 py-3.5 font-black text-lg focus:outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,102,241,0.3)", color: "#c4b5fd" }} />

              {/* Auto cash out */}
              <div className="flex items-center gap-3 px-3 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <button onClick={() => setAutoCashOut(v => !v)}
                  className="w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-all"
                  style={{ background: autoCashOut ? "#16a34a" : "rgba(255,255,255,0.15)" }}>
                  <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: autoCashOut ? "translateX(20px)" : "translateX(0)" }} />
                </button>
                <span className="text-sm flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>Avto olish</span>
                <input type="number" step="0.1" min="1.1" value={autoCashOutAt}
                  onChange={(e) => setAutoCashOutAt(e.target.value)} disabled={!autoCashOut}
                  className="w-20 rounded-xl px-2 py-1 text-sm text-center font-black focus:outline-none disabled:opacity-40"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#c4b5fd" }} />
              </div>

              {/* Auto bet */}
              <div className="flex items-center gap-3 px-3 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <button onClick={() => { const nv = !autoBet; setAutoBet(nv); autoBetRef.current = nv; }}
                  className="w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-all"
                  style={{ background: autoBet ? "#4338ca" : "rgba(255,255,255,0.15)" }}>
                  <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: autoBet ? "translateX(20px)" : "translateX(0)" }} />
                </button>
                <span className="text-sm flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>Avto tikish</span>
                {autoBet && <span className="text-xs font-black" style={{ color: "#818cf8" }}>YOQILGAN</span>}
              </div>

              {phase === "idle" ? (
                <button onClick={() => { if (!player || player.balance < betAmt || betAmt < 2000) return; startRound(); }}
                  disabled={!player || player.balance < betAmt || betAmt < 2000}
                  className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #4338ca, #7c3aed)", boxShadow: "0 8px 28px rgba(124,58,237,0.5)", color: "white" }}>
                  🚀 BOSHLASH — {betAmt.toLocaleString()} UZS
                </button>
              ) : (
                <button onClick={handleReset}
                  className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all"
                  style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" }}>
                  🔄 QAYTA O'YNASH
                </button>
              )}
            </>
          )}
          {phase === "countdown" && (
            <div className="w-full py-4 rounded-2xl text-center font-bold"
              style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", color: "#c4b5fd" }}>
              ✈️ Tikish: {betAmt.toLocaleString()} UZS • Tayyor bo'ling!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
