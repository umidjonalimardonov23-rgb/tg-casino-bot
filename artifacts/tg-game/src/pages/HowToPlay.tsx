import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

const GAMES = [
  {
    emoji: "🍎", title: "Olma Omadi (Apple Fortune)",
    steps: [
      "Tikish miqdorini kiriting (min 2 000 UZS)",
      "5×6 katakcha grid ochiladi — ularni biring keyin biri bosing",
      "Har ochilgan olmada koeffitsiyent oshib boradi (max x10)",
      "O'z vaqtida 'Chiqarish' tugmasini bosing!",
      "Agar yashirin qo'ziqorin topilsa — hammasi yo'qoladi!",
    ]
  },
  {
    emoji: "🎲", title: "Zar (Dice)",
    steps: [
      "Tikish miqdorini tanlang",
      "Bashorat turini tanlang: Ko'proq 7 (x2.3) | Teng 7 (x5.8) | Ozroq 7 (x2.3)",
      "O'YNASH tugmasini bosing",
      "2 ta zar tashlanadi — yig'indi hisoblanadi",
      "To'g'ri bashorat = tikish × koeffitsiyent!",
    ]
  },
  {
    emoji: "✈️", title: "Aviator",
    steps: [
      "Tikish kiriting va BOSHLASH bosing",
      "Samolyot ko'tariladi — koeffitsiyent tezda oshadi",
      "70% holatlarda 1.1–2.0x da qulab tushadi",
      "QULAB TUSHISHIDAN OLDIN 'OLISH' bosing!",
      "Avto olish: belgiga yetganda avtomatik naqd qiladi",
    ]
  },
  {
    emoji: "🎡", title: "Spin (Aylanadur)",
    steps: [
      "Har 24 soatda 1 ta TEKIN spin — bepul!",
      "To'lovli spin ham mavjud (2 000 UZS)",
      "G'ildirak 10 segmentdan iborat",
      "30% yutish ehtimoli: 🍒 1K | ⭐ 2K | 💎 5K",
      "70% miss (yutqazish) ehtimoli",
    ]
  },
  {
    emoji: "🃏", title: "Blackjack",
    steps: [
      "Tikish kiriting va KARTA OL bosing",
      "Maqsad: 21 ga yaqin, lekin 21 dan oshirmaslik",
      "KARTA OL = yana bitta karta olish",
      "TO'XTASH = dilerni o'ynatish",
      "Blackjack (A + 10li karta) = x2.5!",
      "Yutish = x2 | Durrang = tikish qaytadi",
    ]
  },
  {
    emoji: "🎰", title: "Slot",
    steps: [
      "Tikish kiriting va SPIN bosing",
      "3 ta g'ildirak aylanadi",
      "7️⃣7️⃣7️⃣ = x10 (Jackpot!)",
      "3 bir xil mevia/belgi = x3",
      "2 bir xil = x1.5",
      "Umumiy yutish ehtimoli ~62%",
    ]
  },
  {
    emoji: "🔢", title: "Toq-Juft (Parity)",
    steps: [
      "Bet turini tanlang: JUFT / TOQ / KICHIK / KATTA",
      "Tikish miqdorini kiriting",
      "TIKISH bosing — 1 dan 90 gacha son chiqadi",
      "JUFT: 2,4,6...90 | TOQ: 1,3,5...89",
      "KICHIK: 1-45 | KATTA: 46-90",
      "Har biri 50% ehtimol = x2 pul!",
    ]
  },
];

export default function HowToPlay() {
  const [, nav] = useLocation();

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(180deg, #090b14 0%, #0d1020 100%)" }}>

      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button onClick={() => nav("/")}
          className="w-10 h-10 flex items-center justify-center rounded-2xl"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 4px 0 rgba(0,0,0,0.2)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="text-white font-black text-lg">📖 Qanday O'ynaladi</h1>
      </div>

      <div className="px-4 pb-8 space-y-3">
        {GAMES.map((g) => (
          <div key={g.title} className="rounded-2xl p-4 relative overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 0 rgba(0,0,0,0.15)" }}>
            <div className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)" }} />
            <div className="flex items-center gap-3 mb-3 relative">
              <span className="text-3xl">{g.emoji}</span>
              <h2 className="text-white font-black text-sm">{g.title}</h2>
            </div>
            <ol className="space-y-1.5 relative">
              {g.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="font-black shrink-0" style={{ color: "#fbbf24", minWidth: 18 }}>{i + 1}.</span>
                  <span style={{ color: "rgba(255,255,255,0.6)" }}>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}

        {/* Deposit/Withdraw info */}
        <div className="rounded-2xl p-4"
          style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
          <p className="font-bold mb-2.5 flex items-center gap-2" style={{ color: "#4ade80" }}>💡 Depozit va Yechish</p>
          <ul className="space-y-2">
            {[
              ["➕", "Har depozitga", "+20% bonus", "text-white"],
              ["💸", "Yechish uchun", "depozit miqdorini 100% o'ynash kerak", "text-white"],
              ["📸", "Chek (screenshot)", "botga yuboriladi, admin tasdiqlaydi", "text-white"],
              ["🎁", "Kunlik bonus", "har kuni qaytib oling (streak bonuslari bor!)", "text-white"],
              ["🔑", "Promo kod", "maxsus balans qo'shish imkoni", "text-white"],
            ].map(([icon, text, bold], i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span>{icon}</span>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{text} <b className="text-white">{bold}</b></span>
              </li>
            ))}
          </ul>
        </div>

        {/* Daily bonus streak */}
        <div className="rounded-2xl p-4"
          style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
          <p className="font-bold mb-2.5" style={{ color: "#fbbf24" }}>🔥 Kunlik Bonus Streak</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["1-kun", "1 000 UZS"],
              ["2-kun", "2 000 UZS"],
              ["3-kun", "4 000 UZS"],
              ["5-kun", "8 000 UZS"],
              ["7-kun", "15 000 UZS"],
              ["14-kun", "30 000 UZS"],
            ].map(([day, bonus]) => (
              <div key={day} className="text-center py-2 px-1 rounded-xl"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <p className="font-black text-xs" style={{ color: "#fbbf24" }}>{day}</p>
                <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{bonus}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
