import { useState, useEffect, useRef } from "react";
import { usePlayer } from "@/lib/player-context";
import { useTheme } from "@/lib/theme-context";
import GameHeader from "@/components/GameHeader";

const BASE = "/api";
const BET = 2000;

// 10 segments: 7 miss, 3 win → 30% win, 70% miss
// Each segment = 36°. Pointer at top (0° = index 0).
// Segments (index 0-9):
// 0: Miss, 1: Miss, 2: Win 1000, 3: Miss, 4: Miss, 5: Win 2000, 6: Miss, 7: Miss, 8: Win 5000, 9: Miss

const SEGMENTS = [
  { label: "💣",          prize: 0,    color: "#7f1d1d", light: "#dc2626" },
  { label: "💣",          prize: 0,    color: "#7f1d1d", light: "#dc2626" },
  { label: "🍒 1 000",   prize: 1000, color: "#78350f", light: "#d97706" },
  { label: "💣",          prize: 0,    color: "#7f1d1d", light: "#dc2626" },
  { label: "💣",          prize: 0,    color: "#7f1d1d", light: "#dc2626" },
  { label: "⭐ 2 000",   prize: 2000, color: "#064e3b", light: "#059669" },
  { label: "💣",          prize: 0,    color: "#7f1d1d", light: "#dc2626" },
  { label: "💣",          prize: 0,    color: "#7f1d1d", light: "#dc2626" },
  { label: "💎 5 000",   prize: 5000, color: "#312e81", light: "#4f46e5" },
  { label: "💣",          prize: 0,    color: "#7f1d1d", light: "#dc2626" },
];

const WIN_SEGMENTS  = [2, 5, 8]; // indices of winning segments
const LOSE_SEGMENTS = [0, 1, 3, 4, 6, 7, 9];

function getTargetAngle(segIdx: number): number {
  // Segment center angle from top (clockwise)
  return segIdx * 36 + 18;
}

function timeLeft(nextSpinAt: string): string {
  const diff = new Date(nextSpinAt).getTime() - Date.now();
  if (diff <= 0) return "";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}s ${m}d ${s}s`;
}

export default function Spin() {
  const { player, refresh } = usePlayer();
  const { theme, ts } = useTheme();

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<{ prize: number; segIdx: number } | null>(null);
  const [canFree, setCanFree] = useState(false);
  const [nextSpinAt, setNextSpinAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState("");
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rotRef = useRef(0);

  const isLight = theme === "light";
  const canPaid = (player?.balance ?? 0) >= BET;

  useEffect(() => {
    if (!player) return;
    fetch(`${BASE}/spin/status/${player.telegramId}`)
      .then(r => r.json())
      .then(d => { setCanFree(d.canSpin); setNextSpinAt(d.nextSpinAt); setLoading(false); })
      .catch(() => setLoading(false));
  }, [player]);

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
    if (!free && player.balance < BET) return;
    setSpinning(true);
    setResult(null);

    // Pre-determine result from API
    let prizeFromApi = 0;
    let nextSpinAtFromApi: string | null = null;
    try {
      const resp = await fetch(`${BASE}/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: player.telegramId, paid: !free, amount: free ? 0 : BET }),
      });
      const d = await resp.json();
      prizeFromApi = d.prize ?? 0;
      nextSpinAtFromApi = d.nextSpinAt ?? null;
    } catch {}

    // Pick segment based on result
    const isWin = prizeFromApi > 0;
    let segIdx: number;
    if (isWin) {
      // Find closest win segment by prize
      if (prizeFromApi >= 5000) segIdx = 8;
      else if (prizeFromApi >= 2000) segIdx = 5;
      else segIdx = 2;
    } else {
      segIdx = LOSE_SEGMENTS[Math.floor(Math.random() * LOSE_SEGMENTS.length)];
    }

    // Calculate rotation: spin many full turns then land on segment
    const targetAngle = getTargetAngle(segIdx);
    const fullTurns = 5 * 360; // 5 full rotations
    // To land segment at top (0°): rotate by (360 - targetAngle) + full turns
    const landAngle = (360 - targetAngle + 360) % 360;
    const totalRotation = rotRef.current + fullTurns + landAngle;
    rotRef.current = totalRotation;
    setRotation(totalRotation);

    // After animation ends (3.5s)
    setTimeout(() => {
      setResult({ prize: prizeFromApi, segIdx });
      setSpinning(false);
      if (free) {
        setCanFree(false);
        setNextSpinAt(nextSpinAtFromApi);
      }
      refresh();
    }, 3500);
  };

  // Wheel SVG (10 segments, conic gradient)
  const wheelSize = 260;
  const cx = wheelSize / 2;
  const cy = wheelSize / 2;
  const r = 115;

  // Build SVG path segments
  function polarToXY(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function segmentPath(startAngle: number, endAngle: number): string {
    const s = polarToXY(startAngle, r);
    const e = polarToXY(endAngle, r);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y} Z`;
  }

  const wheelBg = isLight ? "#e0e7ff" : theme === "black" ? "#0a0a14" : "#1e1b4b";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <GameHeader title="🎡 KUNLIK SPIN" subtitle="Har kuni bepul aylantirish!" />

      <div className="flex-1 flex flex-col items-center px-4 pb-6 gap-4">

        {/* Wheel */}
        <div className="flex flex-col items-center relative">
          {/* Pointer (triangle at top) */}
          <div className="z-20 mb-1" style={{
            width: 0, height: 0,
            borderLeft: "14px solid transparent",
            borderRight: "14px solid transparent",
            borderTop: "22px solid #fbbf24",
            filter: "drop-shadow(0 4px 8px rgba(251,191,36,0.6))",
          }} />

          {/* Wheel container */}
          <div style={{
            width: wheelSize, height: wheelSize,
            transition: spinning ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 1.0)" : "none",
            transform: `rotate(${rotation}deg)`,
          }}>
            <svg width={wheelSize} height={wheelSize} viewBox={`0 0 ${wheelSize} ${wheelSize}`}>
              {/* Background */}
              <circle cx={cx} cy={cy} r={r + 8} fill={wheelBg} />
              {/* Segments */}
              {SEGMENTS.map((seg, i) => (
                <g key={i}>
                  <path d={segmentPath(i * 36, (i + 1) * 36)}
                    fill={isLight ? seg.light : seg.color}
                    stroke={isLight ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.15)"}
                    strokeWidth="1.5" />
                  {/* Segment label */}
                  {(() => {
                    const mid = polarToXY(i * 36 + 18, r * 0.65);
                    return (
                      <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: 10, fontWeight: 900, fill: "white", textShadow: "none", userSelect: "none" }}>
                        {seg.prize > 0 ? `+${seg.prize >= 1000 ? `${seg.prize/1000}K` : seg.prize}` : "✗"}
                      </text>
                    );
                  })()}
                </g>
              ))}
              {/* Center circle */}
              <circle cx={cx} cy={cy} r={22}
                fill={isLight ? "#4f46e5" : "#7c3aed"}
                stroke={isLight ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)"}
                strokeWidth="3" />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 18, fill: "white", fontWeight: 900 }}>🎡</text>
              {/* Outer ring */}
              <circle cx={cx} cy={cy} r={r + 6}
                fill="none"
                stroke={isLight ? "#6366f1" : "#7c3aed"}
                strokeWidth="4" opacity="0.5" />
              {/* Dots at segment borders */}
              {SEGMENTS.map((_, i) => {
                const p = polarToXY(i * 36, r + 6);
                return <circle key={i} cx={p.x} cy={p.y} r={4} fill={isLight ? "#fbbf24" : "#fbbf24"} />;
              })}
            </svg>
          </div>
        </div>

        {/* Result */}
        {result && !spinning && (
          <div className="text-center py-3 px-6 rounded-2xl"
            style={{
              background: result.prize > 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${result.prize > 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)"}`,
            }}>
            {result.prize > 0 ? (
              <>
                <p className="font-black text-2xl" style={{ color: "#4ade80" }}>+{result.prize.toLocaleString()} UZS 🎉</p>
                <p className="text-sm mt-1" style={{ color: ts.textSub }}>Balansingizga qo'shildi!</p>
              </>
            ) : (
              <>
                <p className="font-black text-xl" style={{ color: "#f87171" }}>Omad kelmadi 😔</p>
                <p className="text-sm mt-1" style={{ color: ts.textSub }}>Keyingi gal albatta!</p>
              </>
            )}
          </div>
        )}

        {spinning && (
          <p className="font-black text-lg animate-pulse" style={{ color: isLight ? "#4338ca" : "#c4b5fd" }}>Aylanmoqda...</p>
        )}

        {!spinning && !result && !loading && countdown && (
          <div className="text-center">
            <p className="text-sm" style={{ color: ts.textSub }}>Tekin spin:</p>
            <p className="font-black text-xl" style={{ color: "#fbbf24" }}>⏳ {countdown}</p>
          </div>
        )}

        {/* Prize breakdown */}
        <div className="w-full rounded-2xl p-3"
          style={{ background: ts.card, border: `1px solid ${ts.cardBorder}` }}>
          <p className="text-xs font-black mb-2 text-center tracking-widest" style={{ color: ts.textSub }}>🏆 MUKOFOTLAR</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "💣 Omadsiz",  prize: "—",    color: "#f87171" },
              { label: "🍒 Birinchi", prize: "1 000", color: "#d97706" },
              { label: "⭐ Ikkinchi", prize: "2 000", color: "#34d399" },
              { label: "💎 Katta",    prize: "5 000", color: "#a78bfa" },
            ].map(p => (
              <div key={p.label}>
                <p className="text-xs font-black" style={{ color: p.color }}>{p.prize}</p>
                <p style={{ fontSize: 10, color: ts.textSub }}>{p.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button onClick={() => doSpin(true)}
            disabled={!canFree || spinning || loading}
            className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: canFree && !spinning ? "linear-gradient(145deg, #7c3aed, #a855f7)" : (isLight ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.15)"),
              boxShadow: canFree && !spinning ? "0 6px 0 #4c1d95, 0 8px 24px rgba(124,58,237,0.5)" : "none",
              color: canFree && !spinning ? "white" : ts.textSub,
            }}>
            {loading ? "Yuklanmoqda..." : canFree ? "🎁 TEKIN AYLANTIRISH" : `⏳ ${countdown || "Kutilmoqda..."}`}
          </button>

          <button onClick={() => doSpin(false)}
            disabled={!canPaid || spinning}
            className="w-full py-4 rounded-2xl font-black text-base active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: canPaid && !spinning ? "linear-gradient(145deg, #1e40af, #2563eb)" : (isLight ? "rgba(37,99,235,0.1)" : "rgba(37,99,235,0.15)"),
              boxShadow: canPaid && !spinning ? "0 5px 0 #1e3a8a, 0 6px 16px rgba(37,99,235,0.4)" : "none",
              color: canPaid && !spinning ? "white" : ts.textSub,
            }}>
            🎰 {BET.toLocaleString()} UZS GA AYLANTIRISH
          </button>

          <p className="text-center text-xs" style={{ color: ts.textSub }}>
            Tekin spin har 24 soatda bir marta • To'lovli spin cheksiz
          </p>
        </div>
      </div>
    </div>
  );
}
