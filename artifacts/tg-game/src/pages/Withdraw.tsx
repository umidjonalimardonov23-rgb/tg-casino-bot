import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle, AlertTriangle, Wallet } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { withdraw } from "@/lib/api";

const MIN_WITHDRAW_AMOUNT = 10000;

export default function Withdraw() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();
  const [customAmount, setCustomAmount] = useState("");
  const [card, setCard] = useState("");
  const [holder, setHolder] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const wagerLeft = player ? Math.max(0, player.wagerRequirement - player.totalWagered) : 0;
  const hasDeposited = (player?.totalDeposited ?? 0) > 0;
  const canWithdraw = hasDeposited && wagerLeft === 0;
  const amount = customAmount ? Number(customAmount) : 0;
  const balance = player?.balance ?? 0;
  const wagerProgress = player?.wagerRequirement
    ? Math.min(100, (player.totalWagered / player.wagerRequirement) * 100) : 0;

  const submit = async () => {
    if (!hasDeposited) { setErr("Pul yechish uchun avval depozit qilishingiz kerak"); return; }
    if (!amount || amount < MIN_WITHDRAW_AMOUNT) { setErr("Minimal miqdor 10 000 UZS"); return; }
    if (amount > balance) { setErr("Balans yetarli emas!"); return; }
    if (!card || card.length < 4) { setErr("Karta raqamini kiriting"); return; }
    if (!holder) { setErr("Karta egasini kiriting"); return; }
    if (!player) return;
    setLoading(true); setErr("");
    try {
      await withdraw(player.telegramId, amount, card, holder);
      await refresh();
      setDone(true);
    } catch (e: any) {
      setErr(e.message || "Xato yuz berdi");
    } finally { setLoading(false); }
  };

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #050816 0%, #0a0a20 100%)" }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)", boxShadow: "0 0 40px rgba(16,185,129,0.2)" }}>
        <CheckCircle className="w-10 h-10" style={{ color: "#10b981" }} />
      </div>
      <h2 className="text-white font-black text-2xl mb-2">So'rov Yuborildi!</h2>
      <p className="text-center text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
        Admin tekshirib, tez orada kartangizga o'tkazadi.
      </p>
      <button onClick={() => nav("/")}
        className="px-10 py-4 rounded-2xl font-black text-white active:scale-95"
        style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)", boxShadow: "0 8px 24px rgba(124,58,237,0.4)" }}>
        🏠 Bosh Sahifa
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #050816 0%, #0a0a20 100%)" }}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button onClick={() => nav("/")} className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="text-white font-black text-lg">💸 Pul Yechish</h1>
      </div>

      <div className="px-4 flex-1">
        {/* Balance */}
        <div className="rounded-2xl p-4 mb-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.1))", border: "1px solid rgba(124,58,237,0.3)" }}>
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(124,58,237,0.2), transparent 70%)" }} />
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-3.5 h-3.5" style={{ color: "rgba(167,139,250,0.6)" }} />
            <span className="text-xs font-semibold" style={{ color: "rgba(167,139,250,0.6)" }}>BALANS</span>
          </div>
          <p className="text-white font-black text-2xl">
            {balance.toLocaleString()} <span className="text-lg" style={{ color: "#a78bfa" }}>UZS</span>
          </p>
        </div>

        {!hasDeposited ? (
          <>
            <div className="rounded-2xl p-4 mb-4"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
                <p className="text-sm font-bold" style={{ color: "#f87171" }}>Depozit qilinmagan!</p>
              </div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                Pul yechish uchun avval kamida bitta depozit qilishingiz kerak.
              </p>
            </div>
            <button onClick={() => nav("/deposit")}
              className="w-full py-4 rounded-2xl font-black text-base mb-6 active:scale-95"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 8px 24px rgba(16,185,129,0.3)", color: "white" }}>
              ➕ Hisob To'ldirish
            </button>
          </>
        ) : !canWithdraw ? (
          <>
            <div className="rounded-2xl p-4 mb-4"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
                <p className="text-sm font-bold" style={{ color: "#f87171" }}>Shart bajarilmagan!</p>
              </div>
              <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
                Pul yechish uchun depozit miqdorini 100% o'ynashingiz kerak.
              </p>
              <div className="space-y-2 mb-3">
                {[
                  { label: "Kerakli", val: player?.wagerRequirement ?? 0 },
                  { label: "O'ynaldi", val: player?.totalWagered ?? 0 },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>{label}:</span>
                    <span className="text-white font-bold">{val.toLocaleString()} UZS</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ color: "#f87171" }}>Qolgan:</span>
                  <span className="font-black" style={{ color: "#f87171" }}>{wagerLeft.toLocaleString()} UZS</span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-2 rounded-full transition-all"
                  style={{ width: `${wagerProgress}%`, background: "linear-gradient(90deg, #ef4444, #f97316, #eab308)" }} />
              </div>
              <p className="text-xs text-right mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{wagerProgress.toFixed(0)}%</p>
            </div>
            <button onClick={() => nav("/")}
              className="w-full py-4 rounded-2xl font-black text-base mb-6 active:scale-95"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 8px 24px rgba(16,185,129,0.3)", color: "white" }}>
              🎮 O'ynashni Davom Ettirish
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 mb-4"
              style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
              <p className="text-sm font-semibold" style={{ color: "#34d399" }}>Shart bajarildi! Pul yechi olasiz.</p>
            </div>

            <p className="text-xs font-bold mb-2 tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>MIQDOR (UZS)</p>
            <input type="number" placeholder={`Min: ${MIN_WITHDRAW_AMOUNT.toLocaleString()} UZS`} value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full rounded-xl px-4 py-3 font-black text-lg focus:outline-none mb-2"
              style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${amount > balance && amount > 0 ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`, color: "#fbbf24" }} />

            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} onClick={() => setCustomAmount(String(Math.floor(balance * pct / 100)))}
                  className="py-2 rounded-xl text-xs font-bold active:scale-95"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                  {pct}%
                </button>
              ))}
            </div>

            <p className="text-xs font-bold mb-2 tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>KARTA MA'LUMOTLARI</p>
            <div className="space-y-2 mb-4">
              <input value={card} onChange={(e) => setCard(e.target.value.replace(/\D/g, ""))}
                placeholder="Karta raqami"
                className="w-full rounded-xl px-4 py-3 font-mono text-base focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }} />
              <input value={holder} onChange={(e) => setHolder(e.target.value)}
                placeholder="Karta egasi (Ism Familiya)"
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }} />
            </div>

            {err && (
              <div className="rounded-xl px-4 py-3 mb-3"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <p className="text-sm font-semibold" style={{ color: "#f87171" }}>❌ {err}</p>
              </div>
            )}

            <button onClick={submit}
              disabled={!amount || amount < MIN_WITHDRAW_AMOUNT || amount > balance || !card || !holder || loading}
              className="w-full py-4 rounded-2xl font-black text-base mb-6 active:scale-95 transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)", boxShadow: "0 8px 24px rgba(124,58,237,0.4)", color: "white" }}>
              {loading ? "Yuborilmoqda..." : "💸 So'rov Yuborish"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
