import { useState } from "react";
import { useLocation } from "wouter";
import { usePlayer } from "@/lib/player-context";
import { Trophy, Wallet, Zap, Plus, ArrowDownCircle, Gift } from "lucide-react";

const BASE = "/api";

async function claimDailyBonus(telegramId: string) {
  const res = await fetch(`${BASE}/players/${telegramId}/daily-bonus`, { method: "POST" });
  return res.json();
}

async function redeemPromo(telegramId: string, code: string) {
  const res = await fetch(`${BASE}/promo/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId, code }),
  });
  return res.json();
}

const GAMES = [
  {
    path: "/apple", emoji: "🍎", title: "Apple of Fortune", desc: "10x gacha",
    bg: "linear-gradient(145deg, #064e3b, #065f46, #047857)",
    border: "#10b98155", glow: "#10b98133", tag: "HOT 🔥", tagColor: "#34d399",
  },
  {
    path: "/dice", emoji: "🎲", title: "Dice", desc: "x5.8 gacha",
    bg: "linear-gradient(145deg, #78350f, #92400e, #b45309)",
    border: "#f59e0b55", glow: "#f59e0b33", tag: "x5.8 ⚡", tagColor: "#fbbf24",
  },
  {
    path: "/aviator", emoji: "✈️", title: "Aviator", desc: "∞x gacha",
    bg: "linear-gradient(145deg, #1e1b4b, #312e81, #3730a3)",
    border: "#818cf855", glow: "#818cf833", tag: "∞x 🚀", tagColor: "#a5b4fc",
  },
  {
    path: "/spin", emoji: "🎰", title: "Spin", desc: "Tekin o'yin",
    bg: "linear-gradient(145deg, #4a1d96, #5b21b6, #6d28d9)",
    border: "#a78bfa55", glow: "#a78bfa33", tag: "TEKIN 🎁", tagColor: "#c4b5fd",
  },
  {
    path: "/blackjack", emoji: "🃏", title: "Blackjack", desc: "21 ga yaqin",
    bg: "linear-gradient(145deg, #064e3b, #065f46, #0a6650)",
    border: "#34d39955", glow: "#34d39933", tag: "x2.5 🃏", tagColor: "#6ee7b7",
  },
  {
    path: "/slots", emoji: "🎰", title: "Slots", desc: "7️⃣7️⃣7️⃣ = x50",
    bg: "linear-gradient(145deg, #4c1d95, #6d28d9, #7c3aed)",
    border: "#c4b5fd55", glow: "#c4b5fd33", tag: "x50 💎", tagColor: "#e9d5ff",
  },
  {
    path: "/parity", emoji: "🔢", title: "Parity", desc: "Juft/Toq x2",
    bg: "linear-gradient(145deg, #0c1445, #1e3a8a, #1d4ed8)",
    border: "#60a5fa55", glow: "#60a5fa33", tag: "x2 🎯", tagColor: "#93c5fd",
  },
];

export default function Home() {
  const [, nav] = useLocation();
  const { player, loading, refresh } = usePlayer();
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");

  const wagerLeft = player ? Math.max(0, player.wagerRequirement - player.totalWagered) : 0;
  const wagerProgress = player?.wagerRequirement
    ? Math.min(100, (player.totalWagered / player.wagerRequirement) * 100) : 0;

  const handleDailyBonus = async () => {
    if (!player || claiming) return;
    setClaiming(true);
    setClaimMsg("");
    try {
      const res = await claimDailyBonus(player.telegramId);
      if (res.success) {
        setClaimMsg(`🎁 +${res.amount.toLocaleString()} UZS qo'shildi!`);
        await refresh();
      } else {
        setClaimMsg(res.error || "Kunlik bonus allaqachon olindi");
      }
    } catch {
      setClaimMsg("Xato yuz berdi");
    }
    setClaiming(false);
    setTimeout(() => setClaimMsg(""), 3000);
  };

  const handlePromo = async () => {
    if (!player || !promoCode.trim()) return;
    setPromoMsg("");
    try {
      const res = await redeemPromo(player.telegramId, promoCode.trim().toUpperCase());
      if (res.success) {
        setPromoMsg(`✅ +${res.amount.toLocaleString()} UZS qo'shildi!`);
        await refresh();
        setPromoCode("");
        setTimeout(() => { setPromoMsg(""); setShowPromo(false); }, 2000);
      } else {
        setPromoMsg(`❌ ${res.error || "Noto'g'ri kod"}`);
      }
    } catch {
      setPromoMsg("❌ Xato yuz berdi");
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #1a0533 0%, #0f0528 40%, #150a3a 100%)" }}>

      {/* Background glows */}
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
            <button onClick={() => nav("/howtoplay")}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold"
              style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: "#c4b5fd" }}>
              📖 Qoidalar
            </button>
          </div>

          {/* Balance Card */}
          <div className="rounded-3xl p-5 mb-3 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #4c1d95ee, #1e40afee)", border: "1px solid #7c3aed55", boxShadow: "0 12px 40px #4c1d9555, inset 0 1px 0 rgba(255,255,255,0.12)" }}>
            <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full" style={{ background: "radial-gradient(circle, #7c3aed44 0%, transparent 70%)" }} />
            <div className="absolute -left-6 -bottom-6 w-32 h-32 rounded-full" style={{ background: "radial-gradient(circle, #2563eb33 0%, transparent 70%)" }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <Wallet className="w-3.5 h-3.5" style={{ color: "#c4b5fd" }} />
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#c4b5fdaa" }}>Balansingiz</span>
              </div>
              {loading ? (
                <div className="h-10 w-48 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
              ) : (
                <p className="font-black leading-none" style={{ fontSize: 38, color: "white" }}>
                  {(player?.balance ?? 0).toLocaleString()}
                  <span className="text-xl ml-2" style={{ color: "#c4b5fd" }}>UZS</span>
                </p>
              )}
              <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Yutgan: <b className="text-white">{(player?.totalWon ?? 0).toLocaleString()}</b>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    O'yin: <b className="text-white">{player?.gamesPlayed ?? 0}</b>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Wager progress */}
          {wagerLeft > 0 && (
            <div className="rounded-2xl p-3 mb-3" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs font-bold text-yellow-300">Chiqarish sharti</span>
                </div>
                <span className="text-xs font-black text-yellow-400">{wagerProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-2 rounded-full" style={{ width: `${wagerProgress}%`, background: "linear-gradient(90deg, #eab308, #fbbf24)", transition: "width 0.5s" }} />
              </div>
              <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                Yana <b className="text-yellow-400">{wagerLeft.toLocaleString()} UZS</b> o'ynash kerak
              </p>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <button onClick={() => nav("/deposit")}
              className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #166534aa, #15803daa)", border: "1px solid #22c55e44", color: "#4ade80", boxShadow: "0 4px 16px #22c55e22" }}>
              <Plus className="w-4 h-4" /> To'ldirish
            </button>
            <button onClick={() => nav("/withdraw")}
              className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #1e1b4baa, #312e81aa)", border: "1px solid #818cf844", color: "#a5b4fc", boxShadow: "0 4px 16px #818cf822" }}>
              <ArrowDownCircle className="w-4 h-4" /> Yechish
            </button>
          </div>

          {/* Daily Bonus + Promo row */}
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <button onClick={handleDailyBonus} disabled={claiming}
              className="py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #78350faa, #d9770688)", border: "1px solid #f59e0b44", color: "#fbbf24" }}>
              <Gift className="w-4 h-4" />
              {claiming ? "..." : "Kunlik Bonus"}
            </button>
            <button onClick={() => setShowPromo(v => !v)}
              className="py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #064e3baa, #059669aa)", border: "1px solid #10b98144", color: "#34d399" }}>
              🎫 Promo Kod
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
              <p className="text-xs font-bold mb-2" style={{ color: "#34d399" }}>🎫 Promo Kod Kiriting</p>
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
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black tracking-widest" style={{ color: "rgba(167,139,250,0.6)" }}>🎮 O'YINLAR</p>
            <button onClick={() => nav("/leaderboard")}
              className="text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1"
              style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
              🏆 Reyting
            </button>
          </div>

          {/* 2×N grid */}
          <div className="grid grid-cols-2 gap-3">
            {GAMES.map((g) => (
              <button key={g.path} onClick={() => nav(g.path)}
                className="relative overflow-hidden active:scale-[0.95] transition-all"
                style={{
                  background: g.bg,
                  border: `1px solid ${g.border}`,
                  boxShadow: `0 8px 24px ${g.glow}`,
                  borderRadius: 24,
                  aspectRatio: "1 / 1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px 12px",
                  textAlign: "center",
                }}>
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, transparent 60%)", borderRadius: 24 }} />
                <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${g.glow}, transparent 70%)` }} />
                <div className="absolute top-3 right-3">
                  <span className="font-black px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(0,0,0,0.3)", color: g.tagColor, fontSize: 10 }}>
                    {g.tag}
                  </span>
                </div>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
                  style={{ fontSize: 34, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(10px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)" }}>
                  {g.emoji}
                </div>
                <p className="text-white font-black leading-tight" style={{ fontSize: 13 }}>{g.title}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{g.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
