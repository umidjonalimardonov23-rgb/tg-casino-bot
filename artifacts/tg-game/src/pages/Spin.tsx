import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePlayer } from "@/lib/player-context";

const BASE = "/api";
const SYMBOLS = ["🍎","🍋","🍇","🍒","💎","⭐","🎰","🍊","🍉","💰","🔥","🌟","🎯","💣","🍀"];
const PRIZES_FREE = [0,0,0,0,0,500,500,1000,2000,5000];
const PRIZES_PAID = [0,0,0,500,500,1000,1000,2000,3000,5000];
const BET = 2000;

function fmt(n: number) { return n.toLocaleString("uz-UZ"); }

function timeLeft(nextSpinAt: string): string {
  const diff = new Date(nextSpinAt).getTime() - Date.now();
  if (diff <= 0) return "";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}s ${m}d ${s}s`;
}

export default function Spin() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();

  const [spinning, setSpinning] = useState(false);
  const [symbol, setSymbol] = useState("🎰");
  const [result, setResult] = useState<{ prize: number; symbol: string } | null>(null);
  const [canFree, setCanFree] = useState(false);
  const [nextSpinAt, setNextSpinAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("");
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load spin status
  useEffect(() => {
    if (!player) return;
    fetch(`${BASE}/spin/status/${player.telegramId}`)
      .then(r => r.json())
      .then(d => {
        setCanFree(d.canSpin);
        setNextSpinAt(d.nextSpinAt);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [player]);

  // Countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!nextSpinAt) return;
    const tick = () => {
      const t = timeLeft(nextSpinAt);
      if (!t) { setCanFree(true); setNextSpinAt(null); setCountdown(""); }
      else setCountdown(t);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [nextSpinAt]);

  const doSpin = async (free: boolean) => {
    if (!player || spinning) return;
    if (!free && (player.balance < BET)) return;

    setSpinning(true);
    setResult(null);

    // Fast reel animation
    let speed = 60;
    let elapsed = 0;
    const DURATION = 5000;
    const spinLoop = () => {
      setSymbol(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      elapsed += speed;
      if (elapsed < DURATION * 0.6) speed = 60;
      else if (elapsed < DURATION * 0.8) speed = 120;
      else if (elapsed < DURATION * 0.92) speed = 220;
      else speed = 380;

      if (elapsed < DURATION) {
        intervalRef.current = setTimeout(spinLoop, speed);
      } else {
        // Call API for result
        fetch(`${BASE}/spin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegramId: player.telegramId, paid: !free, amount: free ? 0 : BET }),
        })
          .then(r => r.json())
          .then(d => {
            if (d.error && d.error !== "cooldown") throw new Error(d.error);
            const prize = d.prize ?? 0;
            const sym = d.symbol ?? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            setSymbol(sym);
            setResult({ prize, symbol: sym });
            setCanFree(false);
            setNextSpinAt(d.nextSpinAt ?? null);
            refresh();
            setSpinning(false);
          })
          .catch(() => setSpinning(false));
      }
    };
    intervalRef.current = setTimeout(spinLoop, speed);
  };

  useEffect(() => () => { if (intervalRef.current) clearTimeout(intervalRef.current); }, []);

  const canPaid = (player?.balance ?? 0) >= BET;

  return (
    <div className="h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #1a0040 0%, #2d0060 50%, #1a0040 100%)" }}>

      {/* Glow orbs */}
      <div className="fixed pointer-events-none" style={{ top: -60, left: -60, width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, #7c3aed44 0%, transparent 70%)", filter: "blur(50px)" }} />
      <div className="fixed pointer-events-none" style={{ bottom: 60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, #a855f733 0%, transparent 70%)", filter: "blur(40px)" }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0 relative z-10">
        <button onClick={() => nav("/")} className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="font-black text-sm tracking-wider text-white">🎰 KUNLIK SPIN</h1>
        <div className="px-3 py-1.5 rounded-xl" style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)" }}>
          <span className="text-sm font-black" style={{ color: "#c4b5fd" }}>{fmt(player?.balance ?? 0)} UZS</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-between px-5 pb-6 relative z-10">

        {/* Prize table */}
        <div className="w-full rounded-2xl px-4 py-3 mb-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <p className="text-center text-xs font-bold mb-2" style={{ color: "rgba(167,139,250,0.7)" }}>📊 EHTIMOLLAR</p>
          <div className="grid grid-cols-5 gap-1 text-center">
            {[
              { sym: "💣", label: "Yutqazish", pct: "50%", color: "#f87171" },
              { sym: "🍒", label: "500 UZS", pct: "20%", color: "#fbbf24" },
              { sym: "🌟", label: "1 000", pct: "10%", color: "#34d399" },
              { sym: "⭐", label: "2 000", pct: "10%", color: "#60a5fa" },
              { sym: "💎", label: "5 000", pct: "10%", color: "#c4b5fd" },
            ].map(p => (
              <div key={p.label} className="flex flex-col items-center gap-0.5">
                <span style={{ fontSize: 18 }}>{p.sym}</span>
                <span className="font-black text-xs" style={{ color: p.color }}>{p.pct}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Slot machine */}
        <div className="flex flex-col items-center">
          {/* Machine frame */}
          <div className="relative" style={{ perspective: "600px" }}>
            {/* Top decoration */}
            <div className="w-52 h-6 rounded-t-2xl flex items-center justify-center mb-0"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7, #7c3aed)", boxShadow: "0 -4px 20px #7c3aed88" }}>
              <div className="flex gap-2">
                {["#f87171","#fbbf24","#4ade80"].map(c => (
                  <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                ))}
              </div>
            </div>

            {/* Reel window */}
            <div className="w-52 h-44 flex items-center justify-center relative overflow-hidden"
              style={{
                background: "linear-gradient(180deg, #0d0020 0%, #1a0040 50%, #0d0020 100%)",
                border: "3px solid #7c3aed",
                boxShadow: spinning
                  ? "0 0 40px #a855f7, inset 0 0 30px rgba(124,58,237,0.3)"
                  : "0 0 20px #7c3aed88, inset 0 0 20px rgba(124,58,237,0.15)",
                transition: "box-shadow 0.3s",
              }}>

              {/* Top/bottom gradient overlays for depth */}
              <div className="absolute inset-x-0 top-0 h-14 pointer-events-none z-10"
                style={{ background: "linear-gradient(180deg, #0d0020 0%, transparent 100%)" }} />
              <div className="absolute inset-x-0 bottom-0 h-14 pointer-events-none z-10"
                style={{ background: "linear-gradient(0deg, #0d0020 0%, transparent 100%)" }} />

              {/* Center highlight line */}
              <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: "calc(50% - 36px)", height: 72 }}>
                <div className="w-full h-full" style={{ border: "1.5px solid rgba(167,139,250,0.5)", boxShadow: "0 0 12px rgba(167,139,250,0.3)" }} />
              </div>

              {/* Symbol */}
              <div className="relative z-5 flex items-center justify-center"
                style={{
                  fontSize: spinning ? 64 : 80,
                  filter: spinning ? "blur(2px) brightness(1.3)" : "none",
                  transition: spinning ? "none" : "font-size 0.3s, filter 0.4s",
                  textShadow: "0 0 20px rgba(255,255,255,0.3)",
                  transform: spinning ? "scaleY(0.9)" : "scaleY(1)",
                }}>
                {symbol}
              </div>
            </div>

            {/* Lever side */}
            <div className="absolute -right-5 top-4 flex flex-col items-center">
              <div className="w-3 h-20 rounded-full" style={{ background: "linear-gradient(180deg, #fbbf24, #d97706)", boxShadow: "0 0 8px #f59e0b" }} />
              <div className="w-6 h-6 rounded-full mt-0.5" style={{ background: "linear-gradient(135deg, #f87171, #dc2626)", boxShadow: "0 0 10px #ef4444" }} />
            </div>

            {/* Bottom frame */}
            <div className="w-52 h-5 rounded-b-2xl"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7, #7c3aed)", boxShadow: "0 4px 20px #7c3aed88" }} />
          </div>

          {/* Result display */}
          <div className="mt-4 h-16 flex items-center justify-center">
            {result && !spinning && (
              <div className="text-center slide-up">
                {result.prize > 0 ? (
                  <>
                    <p className="font-black text-2xl" style={{ color: "#4ade80", textShadow: "0 0 20px #4ade8088" }}>
                      +{fmt(result.prize)} UZS 🎉
                    </p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Balansingizga qo'shildi!</p>
                  </>
                ) : (
                  <>
                    <p className="font-black text-xl" style={{ color: "#f87171" }}>Omad kelmadi 😔</p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Keyingi gal albatta!</p>
                  </>
                )}
              </div>
            )}
            {spinning && (
              <p className="font-black text-lg animate-pulse" style={{ color: "#c4b5fd" }}>Aylanmoqda...</p>
            )}
            {!spinning && !result && !loading && countdown && (
              <div className="text-center">
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Tekin spin:</p>
                <p className="font-black text-xl" style={{ color: "#fbbf24" }}>⏳ {countdown}</p>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-3 mt-2">
          {/* Free spin button */}
          <button
            onClick={() => doSpin(true)}
            disabled={!canFree || spinning || loading}
            className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: canFree && !spinning
                ? "linear-gradient(135deg, #7c3aed, #a855f7)"
                : "rgba(124,58,237,0.2)",
              boxShadow: canFree && !spinning ? "0 8px 28px rgba(124,58,237,0.5)" : "none",
              border: "1px solid rgba(167,139,250,0.4)",
              color: "white",
            }}>
            {loading ? "Yuklanmoqda..." : canFree ? "🎁 TEKIN AYLANTIRISH" : `⏳ ${countdown || "Kutilmoqda..."}`}
          </button>

          {/* Paid spin button */}
          <button
            onClick={() => doSpin(false)}
            disabled={!canPaid || spinning}
            className="w-full py-3.5 rounded-2xl font-black text-base active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: canPaid && !spinning
                ? "linear-gradient(135deg, #1e1b4b, #3730a3)"
                : "rgba(55,48,163,0.2)",
              boxShadow: canPaid && !spinning ? "0 6px 20px rgba(99,102,241,0.4)" : "none",
              border: "1px solid rgba(129,140,248,0.4)",
              color: "white",
            }}>
            🎰 2 000 UZS GA AYLANTIRISH
          </button>

          <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Tekin spin har 24 soatda bir marta • To'lovli spin cheksiz
          </p>
        </div>
      </div>
    </div>
  );
}
