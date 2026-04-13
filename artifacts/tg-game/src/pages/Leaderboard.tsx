import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { getLeaderboard } from "@/lib/api";

type Entry = { rank: number; firstName: string; username: string | null; amount: number; gamesPlayed?: number };

const medals = ["🥇","🥈","🥉"];

function rankStyle(rank: number) {
  if (rank === 1) return { bg: "linear-gradient(135deg, rgba(251,191,36,0.14), rgba(245,158,11,0.07))", border: "1px solid rgba(251,191,36,0.4)", glow: "0 4px 20px rgba(251,191,36,0.1)" };
  if (rank === 2) return { bg: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.2)", glow: "none" };
  if (rank === 3) return { bg: "rgba(180,120,60,0.06)", border: "1px solid rgba(180,120,60,0.2)", glow: "none" };
  return { bg: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", glow: "none" };
}

// Always show firstName (real name), not @username
function getName(e: Entry) { return e.firstName || "O'yinchi"; }

function List({ data, field }: { data: Entry[]; field: "deposit" | "win" }) {
  if (!data.length) return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-5xl mb-3">🏆</div>
      <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>Hali ma'lumot yo'q</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      {data.map((e) => {
        const style = rankStyle(e.rank);
        return (
          <div key={e.rank} className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{ background: style.bg, border: style.border, boxShadow: style.glow }}>
            <div className="w-8 text-center shrink-0">
              {e.rank <= 3
                ? <span className="text-xl">{medals[e.rank - 1]}</span>
                : <span className="text-sm font-black" style={{ color: "rgba(255,255,255,0.25)" }}>#{e.rank}</span>
              }
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0"
              style={{ background: e.rank === 1 ? "linear-gradient(135deg, #d97706, #fbbf24)" : e.rank === 2 ? "rgba(148,163,184,0.2)" : e.rank === 3 ? "rgba(180,120,60,0.2)" : "rgba(255,255,255,0.06)", color: "white" }}>
              {getName(e).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate">{getName(e)}</p>
              {field === "win" && e.gamesPlayed !== undefined && (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{e.gamesPlayed} o'yin</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-sm" style={{ color: field === "deposit" ? "#34d399" : "#fbbf24" }}>
                {e.amount >= 1_000_000 ? `${(e.amount / 1_000_000).toFixed(1)}M` : e.amount >= 1000 ? `${(e.amount / 1000).toFixed(0)}K` : String(e.amount)}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>UZS</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Leaderboard() {
  const [, nav] = useLocation();
  const [tab, setTab] = useState<"win" | "deposit">("win");
  const [data, setData] = useState<{ topWinners: Entry[]; topDepositors: Entry[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard().then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #050816 0%, #0a0a20 100%)" }}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button onClick={() => nav("/")}
          className="w-10 h-10 flex items-center justify-center rounded-2xl"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 4px 0 rgba(0,0,0,0.2)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="text-white font-black text-lg">🏆 Reyting</h1>
      </div>

      <div className="px-4">
        <div className="p-1 rounded-2xl mb-5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="grid grid-cols-2 gap-1">
            {([
              { key: "win",     label: "🏆 Ko'p Yutganlar",   color: "#fbbf24", glow: "rgba(251,191,36,0.15)" },
              { key: "deposit", label: "💰 Ko'p Tashlaganlar", color: "#34d399", glow: "rgba(52,211,153,0.15)" },
            ] as const).map(({ key, label, color, glow }) => (
              <button key={key} onClick={() => setTab(key)}
                className="py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={{
                  background: tab === key ? glow : "transparent",
                  border: tab === key ? `1px solid ${color}33` : "1px solid transparent",
                  color: tab === key ? color : "rgba(255,255,255,0.3)",
                  boxShadow: tab === key ? `0 0 20px ${glow}` : "none",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array(7).fill(0).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse"
                style={{ background: "rgba(255,255,255,0.03)", animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : (
          <List data={tab === "win" ? (data?.topWinners ?? []) : (data?.topDepositors ?? [])} field={tab} />
        )}
      </div>
    </div>
  );
}
