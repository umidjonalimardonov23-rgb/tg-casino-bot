import { useLocation } from "wouter";
import { usePlayer } from "@/lib/player-context";
import { Trophy, TrendingUp, Wallet, Zap } from "lucide-react";

export default function Home() {
  const [, nav] = useLocation();
  const { player, loading } = usePlayer();

  const wagerLeft = player ? Math.max(0, player.wagerRequirement - player.totalWagered) : 0;
  const wagerProgress = player?.wagerRequirement
    ? Math.min(100, (player.totalWagered / player.wagerRequirement) * 100) : 0;

  const games = [
    {
      path: "/apple", emoji: "🍎", title: "Apple of Fortune",
      desc: "Olma toping • 10x gacha",
      bg: "linear-gradient(135deg, #166534, #15803d, #16a34a)",
      border: "#22c55e55", glow: "#22c55e33",
      tag: "HOT 🔥", tagBg: "#22c55e22", tagColor: "#4ade80",
    },
    {
      path: "/dice", emoji: "🎲", title: "Dice",
      desc: "Zar uloqtiring • x5.8 gacha",
      bg: "linear-gradient(135deg, #92400e, #b45309, #d97706)",
      border: "#f59e0b55", glow: "#f59e0b33",
      tag: "x5.8 ⚡", tagBg: "#f59e0b22", tagColor: "#fbbf24",
    },
    {
      path: "/aviator", emoji: "✈️", title: "Aviator",
      desc: "Uchishdan oldin ol • ∞x",
      bg: "linear-gradient(135deg, #1e1b4b, #3730a3, #4338ca)",
      border: "#818cf855", glow: "#818cf833",
      tag: "∞x 🚀", tagBg: "#818cf822", tagColor: "#a5b4fc",
    },
    {
      path: "/spin", emoji: "🎰", title: "Kunlik Spin",
      desc: "Tekin o'yin • 5 000 UZS gacha",
      bg: "linear-gradient(135deg, #4a1d96, #6d28d9, #7c3aed)",
      border: "#a78bfa55", glow: "#a78bfa33",
      tag: "TEKIN 🎁", tagBg: "#a78bfa22", tagColor: "#c4b5fd",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #1a0533 0%, #0f0528 40%, #150a3a 100%)" }}>

      {/* Decorative glowing orbs */}
      <div className="fixed pointer-events-none" style={{ top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, #7c3aed55 0%, transparent 70%)", filter: "blur(40px)" }} />
      <div className="fixed pointer-events-none" style={{ top: 180, left: -80, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #2563eb44 0%, transparent 70%)", filter: "blur(50px)" }} />
      <div className="fixed pointer-events-none" style={{ bottom: 80, right: -40, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, #9333ea33 0%, transparent 70%)", filter: "blur(40px)" }} />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl font-bold"
                style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 4px 16px #7c3aed55" }}>
                🎮
              </div>
              <div>
                <p className="text-white font-black text-sm">
                  {loading ? "..." : player?.firstName ?? "O'yinchi"}
                </p>
                <p className="text-xs" style={{ color: "#a78bfa99" }}>Casino Platform</p>
              </div>
            </div>
            <button onClick={() => nav("/howtoplay")}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold"
              style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: "#c4b5fd" }}>
              📖 Qoidalar
            </button>
          </div>

          {/* Balance card */}
          <div className="rounded-3xl p-5 mb-3 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #4c1d95cc, #1e40afcc)", border: "1px solid #7c3aed55", boxShadow: "0 8px 32px #4c1d9544, inset 0 1px 0 rgba(255,255,255,0.1)" }}>
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full" style={{ background: "radial-gradient(circle, #7c3aed44 0%, transparent 70%)" }} />
            <div className="absolute -left-6 -bottom-6 w-28 h-28 rounded-full" style={{ background: "radial-gradient(circle, #2563eb33 0%, transparent 70%)" }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-3.5 h-3.5" style={{ color: "#c4b5fd" }} />
                <span className="text-xs font-bold tracking-widest" style={{ color: "#c4b5fdaa" }}>BALANSINGIZ</span>
              </div>
              {loading ? (
                <div className="h-10 w-48 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
              ) : (
                <p className="font-black leading-none" style={{ fontSize: 36, color: "white" }}>
                  {(player?.balance ?? 0).toLocaleString()}
                  <span className="text-xl ml-2" style={{ color: "#c4b5fd" }}>UZS</span>
                </p>
              )}
              {player && (
                <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-yellow-400" />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Yutgan: <b className="text-white">{player.totalWon.toLocaleString()}</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                      O'yin: <b className="text-white">{player.gamesPlayed}</b>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Wager progress */}
          {wagerLeft > 0 && (
            <div className="rounded-2xl p-3 mb-3"
              style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}>
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
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <button onClick={() => nav("/leaderboard")}
              className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #78350f88, #92400e66)", border: "1px solid #f59e0b44", color: "#fbbf24", boxShadow: "0 4px 16px #f59e0b22" }}>
              🏆 Reyting
            </button>
            <button onClick={() => nav("/withdraw")}
              className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: "linear-gradient(135deg, #1e1b4b88, #312e8166)", border: "1px solid #818cf844", color: "#a5b4fc", boxShadow: "0 4px 16px #818cf822" }}>
              💸 Yechish
            </button>
          </div>
        </div>

        {/* Games */}
        <div className="px-4 pb-8">
          <p className="text-xs font-black mb-3 tracking-widest" style={{ color: "rgba(167,139,250,0.5)" }}>🎮 O'YINLAR</p>
          <div className="flex flex-col gap-3">
            {games.map((g) => (
              <button key={g.path} onClick={() => nav(g.path)}
                className="w-full rounded-3xl p-4 text-left active:scale-[0.97] transition-all relative overflow-hidden"
                style={{ background: g.bg, border: `1px solid ${g.border}`, boxShadow: `0 8px 24px ${g.glow}` }}>
                <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%)" }} />
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ background: `radial-gradient(circle, ${g.glow}, transparent 70%)` }} />
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                    style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(10px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)" }}>
                    {g.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-black text-base">{g.title}</p>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ background: g.tagBg, color: g.tagColor, border: `1px solid ${g.border}` }}>
                        {g.tag}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{g.desc}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-lg font-black"
                    style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>›</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
