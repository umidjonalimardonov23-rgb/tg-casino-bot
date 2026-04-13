import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function HowToPlay() {
  const [, nav] = useLocation();
  const games = [
    {
      emoji: "🍄", title: "Apple of Fortune",
      steps: [
        "Tikish miqdorini kiriting",
        "5x6 katakcha grid ko'rinadi",
        "Katakchalarni bosing — mushroom topishga harakat qiling",
        "Har mushroom topilganda koeffitsiyent oshadi",
        "O'z vaqtida 'Cash Out' bosing, aks holda yutqazasiz!",
      ]
    },
    {
      emoji: "🎲", title: "Dice",
      steps: [
        "Tikish miqdorini tanlang",
        "Bashorat turini tanlang: Ko'proq 7 (x2.3), Teng 7 (x5.8), Ozroq 7 (x2.3)",
        "O'YNASH tugmasini bosing",
        "2 ta zar uloqtiriladi va yig'indisi hisoblanadi",
        "To'g'ri bashorat qilsangiz tikishingiz koeffitsiyentga ko'paytiriladi!",
      ]
    },
    {
      emoji: "✈️", title: "Aviator",
      steps: [
        "Tikish miqdorini kiriting va 'Tikish' bosing",
        "Samolyot uchib ko'tarilganda koeffitsiyent oshib boradi",
        "Samolyot istalgan vaqtda qulab tushishi mumkin",
        "Qulab tushishidan OLDIN 'Cash Out' bosing",
        "Tikishingiz x koeffitsiyent = yutganingiz!",
        "Kech qolsangiz — hammasi yo'qoladi!",
      ]
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg, #090b14 0%, #0d1020 100%)" }}>
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button onClick={() => nav("/")} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="text-white font-black text-lg">📖 Qanday O'ynaladi</h1>
      </div>

      <div className="px-4 pb-8 space-y-4">
        {games.map((g) => (
          <div key={g.title} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{g.emoji}</span>
              <h2 className="text-white font-black text-base">{g.title}</h2>
            </div>
            <ol className="space-y-2">
              {g.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-white/60">
                  <span className="text-yellow-400 font-bold shrink-0">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}

        <div className="rounded-2xl p-4" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
          <p className="text-green-400 font-bold mb-2">💡 Depozit va Chiqarish</p>
          <ul className="space-y-1.5 text-sm text-white/60">
            <li>➕ Depozitga <b className="text-white">+20% bonus</b> beriladi</li>
            <li>💸 Chiqarish uchun depozit miqdorini <b className="text-white">100%</b> o'ynash kerak</li>
            <li>📨 Chek botga yuboriladi, admin tasdiqlaydi</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
