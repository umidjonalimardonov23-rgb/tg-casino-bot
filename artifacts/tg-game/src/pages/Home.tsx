import { useState } from "react";
import { useLocation } from "wouter";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { Trophy, Wallet, Zap, Plus, ArrowDownCircle, Gift } from "lucide-react";

const BASE = "/api";

async function claimDailyBonus(telegramId: string) {
  const res = await fetch(`${BASE}/players/${telegramId}/daily-bonus`, { method: "POST" });
  return res.json();
}
async function redeemPromo(telegramId: string, code: string) {
  const res = await fetch(`${BASE}/promo/redeem`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, code }),
  });
  return res.json();
}

const FLAG: Record<string, string> = { uz: "🇺🇿 UZ", ru: "🇷🇺 RU", en: "🇬🇧 EN" };

export default function Home() {
  const [, nav] = useLocation();
  const { player, loading, refresh } = usePlayer();
  const { lang, t, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");
  const [showLang, setShowLang] = useState(false);

  const wagerLeft = player ? Math.max(0, player.wagerRequirement - player.totalWagered) : 0;
  const wagerProgress = player?.wagerRequirement
    ? Math.min(100, (player.totalWagered / player.wagerRequirement) * 100) : 0;

  const GAMES = [
    { path: "/apple", emoji: "🍎", title: t.appleTitle, desc: t.appleDesc, tag: "HOT 🔥", tagColor: "#6ee7b7",
      bg: "linear-gradient(145deg,#059669,#10b981,#34d399)", border: "#34d39966", glow: "#10b98144",
      light: "rgba(52,211,153,0.3)", shine: "rgba(110,231,183,0.55)" },
    { path: "/dice", emoji: "🎲", title: t.diceTitle, desc: t.diceDesc, tag: "x5.8 ⚡", tagColor: "#fde68a",
      bg: "linear-gradient(145deg,#d97706,#f59e0b,#fbbf24)", border: "#fbbf2466", glow: "#f59e0b44",
      light: "rgba(251,191,36,0.3)", shine: "rgba(253,230,138,0.55)" },
    { path: "/aviator", emoji: "✈️", title: t.aviatorTitle, desc: t.aviatorDesc, tag: "∞x 🚀", tagColor: "#c7d2fe",
      bg: "linear-gradient(145deg,#4f46e5,#6366f1,#818cf8)", border: "#818cf866", glow: "#6366f144",
      light: "rgba(129,140,248,0.3)", shine: "rgba(199,210,254,0.55)" },
    { path: "/spin", emoji: "🎡", title: t.spinTitle, desc: t.spinDesc, tag: "TEKIN 🎁", tagColor: "#e9d5ff",
      bg: "linear-gradient(145deg,#7c3aed,#8b5cf6,#a78bfa)", border: "#a78bfa66", glow: "#8b5cf644",
      light: "rgba(167,139,250,0.3)", shine: "rgba(233,213,255,0.55)" },
    { path: "/blackjack", emoji: "🃏", title: t.blackjackTitle, desc: t.blackjackDesc, tag: "x2.5 🃏", tagColor: "#99f6e4",
      bg: "linear-gradient(145deg,#0d9488,#14b8a6,#2dd4bf)", border: "#2dd4bf66", glow: "#14b8a644",
      light: "rgba(45,212,191,0.3)", shine: "rgba(153,246,228,0.55)" },
    { path: "/slots", emoji: "🎰", title: t.slotsTitle, desc: t.slotsDesc, tag: "x10 💎", tagColor: "#fbcfe8",
      bg: "linear-gradient(145deg,#9333ea,#a855f7,#c084fc)", border: "#c084fc66", glow: "#a855f744",
      light: "rgba(192,132,252,0.3)", shine: "rgba(251,207,232,0.55)" },
    { path: "/parity", emoji: "🔢", title: t.parityTitle, desc: t.parityDesc, tag: "x2 🎯", tagColor: "#bae6fd",
      bg: "linear-gradient(145deg,#0284c7,#0ea5e9,#38bdf8)", border: "#38bdf866", glow: "#0ea5e944",
      light: "rgba(56,189,248,0.3)", shine: "rgba(186,230,253,0.55)" },
  ];

  const handleDailyBonus = async () => {
    if (!player || claiming) return;
    setClaiming(true); setClaimMsg("");
    try {
      const res = await claimDailyBonus(player.telegramId);
      if (res.success) { setClaimMsg(t.claimSuccess(res.amount)); await refresh(); }
      else { setClaimMsg(res.error || t.claimSuccess(0)); }
    } catch { setClaimMsg(t.error); }
    setClaiming(false);
    setTimeout(() => setClaimMsg(""), 3500);
  };

  const handlePromo = async () => {
    if (!player || !promoCode.trim()) return;
    setPromoMsg("");
    try {
      const res = await redeemPromo(player.telegramId, promoCode.trim().toUpperCase());
      if (res.success) {
        setPromoMsg(t.promoSuccess(res.amount)); await refresh(); setPromoCode("");
        setTimeout(() => { setPromoMsg(""); setShowPromo(false); }, 2000);
      } else { setPromoMsg(`❌ ${res.error || t.promoError}`); }
    } catch { setPromoMsg(`❌ ${t.error}`); }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #1a0533 0%, #0f0528 40%, #150a3a 100%)" }}>

      {/* BG glows */}
      <div className="fixed pointer-events-none" style={{ top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, #7c3aed55 0%, transparent 70%)", filter: "blur(40px)" }} />
      <div className="fixed pointer-events-none" style={{ top: 180, left: -80, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #2563eb44 0%, transparent 70%)", filter: "blur(50px)" }} />
      <div className="fixed pointer-events-none" style={{ bottom: 80, right: -40, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, #9333ea33 0%, transparent 70%)", filter: "blur(40px)" }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="px-4 pt-5 pb-0">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 4px 16px #7c3aed66" }}>
                🎮
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight">
                  {loading ? "..." : player?.firstName ?? "O'yinchi"}
                </p>
                <p className="text-xs" style={{ color: "#a78bfa88" }}>1X Casino</p>
              </div>
            </div>

            {/* Right side: theme + lang + rules */}
            <div className="flex items-center gap-2 relative">
              {/* Theme toggle */}
              <div className="flex gap-1">
                {(["dark","light","black"] as const).map(th => (
                  <button key={th} onClick={() => setTheme(th)}
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-sm active:scale-90 transition-transform"
                    style={{
                      background: theme === th ? "rgba(167,139,250,0.35)" : "rgba(167,139,250,0.1)",
                      border: `1px solid ${theme === th ? "rgba(167,139,250,0.6)" : "rgba(167,139,250,0.2)"}`,
                      fontSize: 13,
                    }}>
                    {th === "light" ? "☀️" : th === "black" ? "⬛" : "🌙"}
                  </button>
                ))}
              </div>
              {/* Language switcher */}
              {showLang && <div className="fixed inset-0 z-40" onClick={() => setShowLang(false)} />}
              <div className="relative">
                <button onClick={() => setShowLang(v => !v)}
                  className="text-sm px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 active:scale-95 transition-transform"
                  style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", color: "#c4b5fd" }}>
                  {FLAG[lang]}
                </button>
                {showLang && (
                  <div className="absolute right-0 top-10 z-50 rounded-2xl overflow-hidden shadow-2xl"
                    style={{ background: "#1a0a3a", border: "1px solid rgba(167,139,250,0.35)", minWidth: 110, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
                    {(["uz","ru","en"] as const).map(l => (
                      <button key={l} onClick={() => { setLang(l); setShowLang(false); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold transition-colors active:bg-purple-900"
                        style={{ color: lang === l ? "#c4b5fd" : "rgba(255,255,255,0.65)", background: lang === l ? "rgba(124,58,237,0.25)" : "transparent" }}>
                        <span style={{ fontSize: 16 }}>{FLAG[l]}</span>
                        <span>{l.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => nav("/howtoplay")}
                className="text-xs px-2.5 py-1.5 rounded-xl font-semibold"
                style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: "#c4b5fd" }}>
                📖 {t.rules}
              </button>
            </div>
          </div>

          {/* Balance Card — 3D effect */}
          <div className="rounded-3xl p-5 mb-3 relative overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #5b21b6ee, #1e40afee, #4c1d95ee)",
              border: "1px solid rgba(167,139,250,0.4)",
              boxShadow: "0 20px 60px #4c1d9566, 0 4px 0 #2d1b6e, inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.3)",
            }}>
            {/* 3D top shine */}
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }} />
            <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, #a78bfa33 0%, transparent 70%)" }} />
            <div className="absolute -left-6 -bottom-6 w-32 h-32 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, #2563eb22 0%, transparent 70%)" }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <Wallet className="w-3.5 h-3.5" style={{ color: "#c4b5fd" }} />
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#c4b5fdaa" }}>{t.balance}</span>
              </div>
              {loading ? (
                <div className="h-10 w-48 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
              ) : (
                <p className="font-black leading-none" style={{ fontSize: 36, color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                  {(player?.balance ?? 0).toLocaleString()}
                  <span className="text-xl ml-2" style={{ color: "#c4b5fd" }}>UZS</span>
                </p>
              )}
              <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {t.won}: <b className="text-white">{(player?.totalWon ?? 0).toLocaleString()}</b>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {t.games_played}: <b className="text-white">{player?.gamesPlayed ?? 0}</b>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Wager progress */}
          {wagerLeft > 0 && (
            <div className="rounded-2xl p-3 mb-3" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", boxShadow: "0 4px 16px rgba(234,179,8,0.1)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs font-bold text-yellow-300">{t.wagerTitle}</span>
                </div>
                <span className="text-xs font-black text-yellow-400">{wagerProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-2.5 rounded-full" style={{ width: `${wagerProgress}%`, background: "linear-gradient(90deg, #eab308, #fbbf24)", transition: "width 0.5s", boxShadow: "0 0 8px #eab30888" }} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                {t.wagerLeft} <b className="text-yellow-400">{wagerLeft.toLocaleString()} UZS</b> {t.wagerLeftSuffix}
              </p>
            </div>
          )}

          {/* Quick actions — 3D buttons */}
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            <button onClick={() => nav("/deposit")}
              className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{
                background: "linear-gradient(145deg, #166534cc, #15803dcc)",
                border: "1px solid #22c55e55",
                color: "#4ade80",
                boxShadow: "0 6px 0 #14532d, 0 8px 20px #22c55e22, inset 0 1px 0 rgba(255,255,255,0.15)",
              }}>
              <Plus className="w-4 h-4" /> {t.deposit}
            </button>
            <button onClick={() => nav("/withdraw")}
              className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{
                background: "linear-gradient(145deg, #1e1b4bcc, #312e81cc)",
                border: "1px solid #818cf855",
                color: "#a5b4fc",
                boxShadow: "0 6px 0 #13103a, 0 8px 20px #818cf822, inset 0 1px 0 rgba(255,255,255,0.1)",
              }}>
              <ArrowDownCircle className="w-4 h-4" /> {t.withdraw}
            </button>
          </div>

          {/* Daily Bonus + Promo row */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <button onClick={handleDailyBonus} disabled={claiming}
              className="py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
              style={{
                background: "linear-gradient(145deg, #78350fcc, #d9770688)",
                border: "1px solid #f59e0b44",
                color: "#fbbf24",
                boxShadow: "0 5px 0 #451a03, 0 6px 16px #f59e0b22, inset 0 1px 0 rgba(255,255,255,0.1)",
              }}>
              <Gift className="w-4 h-4" />
              {claiming ? t.claiming : t.dailyBonus}
            </button>
            <button onClick={() => setShowPromo(v => !v)}
              className="py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{
                background: "linear-gradient(145deg, #064e3bcc, #059669aa)",
                border: "1px solid #10b98144",
                color: "#34d399",
                boxShadow: "0 5px 0 #022c22, 0 6px 16px #10b98122, inset 0 1px 0 rgba(255,255,255,0.1)",
              }}>
              🎫 {t.promoCode}
            </button>
          </div>

          {/* Claim message */}
          {claimMsg && (
            <div className="rounded-xl px-4 py-2.5 mb-3 text-center text-sm font-bold"
              style={{ background: claimMsg.startsWith("🎁") ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: claimMsg.startsWith("🎁") ? "#4ade80" : "#f87171", border: `1px solid ${claimMsg.startsWith("🎁") ? "#22c55e33" : "#ef444433"}` }}>
              {claimMsg}
            </div>
          )}

          {/* Promo input */}
          {showPromo && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
              <p className="text-xs font-bold mb-2" style={{ color: "#34d399" }}>🎫 {t.enterPromo}</p>
              <div className="flex gap-2">
                <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="PROMO123" maxLength={20}
                  className="flex-1 rounded-xl px-3 py-2.5 text-white font-black text-sm outline-none uppercase"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }} />
                <button onClick={handlePromo}
                  className="px-4 py-2.5 rounded-xl font-black text-sm active:scale-95"
                  style={{ background: "linear-gradient(135deg, #059669, #10b981)", color: "white" }}>
                  ✅
                </button>
              </div>
              {promoMsg && <p className="text-xs mt-2 font-bold" style={{ color: promoMsg.startsWith("✅") ? "#4ade80" : "#f87171" }}>{promoMsg}</p>}
            </div>
          )}
        </div>

        {/* Games section */}
        <div className="px-4 pb-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black tracking-widest" style={{ color: "rgba(167,139,250,0.7)" }}>🎮 {t.games}</p>
            <button onClick={() => nav("/leaderboard")}
              className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1"
              style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
              🏆 {t.leaderboard}
            </button>
          </div>

          {/* 3D Game Cards */}
          <div className="grid grid-cols-2 gap-3">
            {GAMES.map((g) => (
              <button key={g.path} onClick={() => nav(g.path)}
                className="relative overflow-hidden active:scale-[0.94] transition-all"
                style={{
                  background: g.bg,
                  border: `1px solid ${g.border}`,
                  borderRadius: 22,
                  aspectRatio: "1 / 1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "14px 10px",
                  textAlign: "center",
                  boxShadow: `0 8px 0 rgba(0,0,0,0.4), 0 12px 30px ${g.glow}, inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.3)`,
                  position: "relative",
                }}>
                {/* Top shine bar */}
                <div className="absolute inset-x-0 top-0 h-px pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${g.shine}, transparent)` }} />
                {/* Corner glow */}
                <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${g.light}, transparent 70%)` }} />
                {/* Diagonal shine */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)", borderRadius: 22 }} />
                {/* Tag */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="font-black px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(0,0,0,0.35)", color: g.tagColor, fontSize: 9, letterSpacing: 0.3 }}>
                    {g.tag}
                  </span>
                </div>
                {/* Emoji icon — 3D box */}
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2.5"
                  style={{
                    fontSize: 32,
                    background: "rgba(0,0,0,0.3)",
                    backdropFilter: "blur(10px)",
                    boxShadow: `0 4px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2), 0 0 16px ${g.light}`,
                    border: `1px solid rgba(255,255,255,0.15)`,
                  }}>
                  {g.emoji}
                </div>
                <p className="text-white font-black leading-tight" style={{ fontSize: 12, textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{g.title}</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{g.desc}</p>
                {/* Bottom shadow line (depth illusion) */}
                <div className="absolute inset-x-2 bottom-0 h-0.5 rounded-full pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${g.shine}, transparent)`, opacity: 0.5 }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lang dropdown backdrop */}
      {showLang && (
        <div className="fixed inset-0 z-40" onClick={() => setShowLang(false)} />
      )}
    </div>
  );
}
