import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { placeBet } from "@/lib/api";

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = { suit: Suit; value: string; num: number };
type GameState = "idle" | "playing" | "dealer" | "result";
type Result = "blackjack" | "win" | "push" | "bust" | "lose" | null;

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const VALUES = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const v of VALUES) {
      const num = v === "A" ? 11 : ["J","Q","K"].includes(v) ? 10 : Number(v);
      deck.push({ suit, value: v, num });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function calcHand(cards: Card[]): number {
  let total = cards.reduce((s, c) => s + c.num, 0);
  let aces = cards.filter(c => c.value === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function CardUI({ card, hidden }: { card: Card; hidden?: boolean }) {
  const red = card.suit === "♥" || card.suit === "♦";
  if (hidden) return (
    <div className="flex items-center justify-center rounded-xl font-black"
      style={{ width: 56, height: 80, background: "linear-gradient(145deg, #312e81, #4338ca)", border: "2px solid #6366f1", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
      <span style={{ fontSize: 28, opacity: 0.4 }}>🂠</span>
    </div>
  );
  return (
    <div className="flex flex-col justify-between p-1.5 rounded-xl font-black"
      style={{ width: 56, height: 80, background: "linear-gradient(145deg, #ffffff, #f1f5f9)", border: "2px solid rgba(255,255,255,0.3)", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
      <div style={{ fontSize: 13, color: red ? "#dc2626" : "#1e1b4b", lineHeight: 1 }}>
        {card.value}<br />{card.suit}
      </div>
      <div style={{ fontSize: 13, color: red ? "#dc2626" : "#1e1b4b", lineHeight: 1, textAlign: "right", transform: "rotate(180deg)" }}>
        {card.value}<br />{card.suit}
      </div>
    </div>
  );
}

export default function Blackjack() {
  const [, nav] = useLocation();
  const { player, refresh } = usePlayer();
  const [betInput, setBetInput] = useState("2000");
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [result, setResult] = useState<Result>(null);
  const [prize, setPrize] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dealerRevealed, setDealerRevealed] = useState(false);

  const activeBet = Math.max(Number(betInput) || 2000, 2000);
  const playerTotal = calcHand(playerCards);
  const dealerTotal = calcHand(dealerCards);

  function setQuickBet(action: string) {
    const bal = player?.balance ?? 0;
    let v = activeBet;
    if (action === "MIN") v = 2000;
    else if (action === "MAX") v = Math.min(bal, 500000);
    else if (action === "X2") v = Math.min(activeBet * 2, bal, 500000);
    else if (action === "1/2") v = Math.max(2000, Math.floor(activeBet / 2));
    setBetInput(String(v));
  }

  const deal = useCallback(() => {
    if (!player || player.balance < activeBet) return;
    const d = buildDeck();
    const p = [d[0], d[2]];
    const dealer = [d[1], d[3]];
    setDeck(d.slice(4));
    setPlayerCards(p);
    setDealerCards(dealer);
    setDealerRevealed(false);
    setResult(null);
    setPrize(0);
    setGameState("playing");

    if (calcHand(p) === 21) {
      setTimeout(() => endGame(p, dealer, d.slice(4), "blackjack"), 600);
    }
  }, [player, activeBet]);

  const hit = useCallback(() => {
    if (gameState !== "playing") return;
    const newCard = deck[0];
    const newDeck = deck.slice(1);
    const newP = [...playerCards, newCard];
    setDeck(newDeck);
    setPlayerCards(newP);
    if (calcHand(newP) > 21) {
      setTimeout(() => endGame(newP, dealerCards, newDeck, "bust"), 400);
    }
  }, [gameState, deck, playerCards, dealerCards]);

  const stand = useCallback(() => {
    if (gameState !== "playing") return;
    setDealerRevealed(true);
    setGameState("dealer");
    let d = [...dealerCards];
    let dk = [...deck];
    while (calcHand(d) < 17) { d.push(dk.shift()!); }
    setTimeout(() => {
      setDealerCards(d);
      const pt = calcHand(playerCards);
      const dt = calcHand(d);
      let res: Result;
      if (dt > 21 || pt > dt) res = "win";
      else if (pt === dt) res = "push";
      else res = "lose";
      endGame(playerCards, d, dk, res);
    }, 800);
  }, [gameState, dealerCards, deck, playerCards]);

  const endGame = async (pCards: Card[], dCards: Card[], _dk: Card[], res: Result) => {
    setDealerRevealed(true);
    setDealerCards(dCards);
    setResult(res);
    setGameState("result");

    let winAmt = 0;
    let won = false;
    if (res === "blackjack") { winAmt = Math.floor(activeBet * 2.5); won = true; }
    else if (res === "win") { winAmt = activeBet * 2; won = true; }
    else if (res === "push") { winAmt = activeBet; won = false; }
    else { winAmt = 0; won = false; }
    setPrize(winAmt);

    setSaving(true);
    try {
      await placeBet(player!.telegramId, { amount: activeBet, game: "blackjack", won: won || res === "push", winAmount: winAmt });
      await refresh();
    } catch {}
    setSaving(false);
  };

  const RESULT_CONFIG: Record<NonNullable<Result>, { label: string; color: string; bg: string }> = {
    blackjack: { label: "BLACKJACK! 🎉", color: "#fbbf24", bg: "linear-gradient(135deg, #78350f, #d97706)" },
    win: { label: "YUTDINGIZ! 🏆", color: "#4ade80", bg: "linear-gradient(135deg, #064e3b, #059669)" },
    push: { label: "DURRANG ✊", color: "#93c5fd", bg: "linear-gradient(135deg, #1e3a5f, #1e40af)" },
    bust: { label: "YUTQAZDINGIZ 💥", color: "#f87171", bg: "linear-gradient(135deg, #7f1d1d, #dc2626)" },
    lose: { label: "YUTQAZDINGIZ 😞", color: "#f87171", bg: "linear-gradient(135deg, #7f1d1d, #dc2626)" },
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #0f1a0f 0%, #0a2010 50%, #0f1a0f 100%)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={() => nav("/")} className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div>
          <p className="text-white font-black text-lg">🃏 Blackjack</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>21 ga yaqin bo'ling!</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Balans</p>
          <p className="text-white font-black text-sm">{(player?.balance ?? 0).toLocaleString()} UZS</p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 flex flex-col gap-4">

        {/* Dealer */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>🤵 DILER</p>
            {gameState !== "idle" && (
              <span className="text-sm font-black text-white">{dealerRevealed ? dealerTotal : "?"}</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap min-h-[80px] items-center">
            {dealerCards.map((c, i) => (
              <CardUI key={i} card={c} hidden={i === 1 && !dealerRevealed} />
            ))}
            {gameState === "idle" && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Kartalar keladi...</span>}
          </div>
        </div>

        {/* Result banner */}
        {result && (
          <div className="rounded-2xl p-4 text-center" style={{ background: RESULT_CONFIG[result].bg }}>
            <p className="font-black text-xl" style={{ color: RESULT_CONFIG[result].color }}>{RESULT_CONFIG[result].label}</p>
            {prize > 0 && <p className="text-white font-bold text-sm mt-1">+{prize.toLocaleString()} UZS</p>}
          </div>
        )}

        {/* Player */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>👤 SIZNING QOLINGIZ</p>
            {gameState !== "idle" && (
              <span className="text-sm font-black" style={{ color: playerTotal > 21 ? "#f87171" : "white" }}>{playerTotal}</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap min-h-[80px] items-center">
            {playerCards.map((c, i) => <CardUI key={i} card={c} />)}
            {gameState === "idle" && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Kartalar keladi...</span>}
          </div>
        </div>

        {/* Bet input */}
        {gameState === "idle" || gameState === "result" ? (
          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs font-bold mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>💰 TIKISH MIQDORI</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {["MIN","1/2","X2","MAX"].map(a => (
                <button key={a} onClick={() => setQuickBet(a)}
                  className="py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.07)", color: "#a5b4fc", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {a}
                </button>
              ))}
            </div>
            <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-white font-black text-center text-lg outline-none"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
              placeholder="2000" min={2000} />
            <p className="text-xs mt-2 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
              Blackjack = x2.5 | Yutish = x2 | Durrang = x1
            </p>
          </div>
        ) : null}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mt-auto">
          {gameState === "idle" || gameState === "result" ? (
            <button onClick={deal}
              disabled={!player || player.balance < activeBet}
              className="w-full py-4 rounded-2xl font-black text-lg active:scale-95 transition-transform disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #166534, #16a34a)", boxShadow: "0 8px 24px #16a34a44", color: "white" }}>
              🃏 {gameState === "result" ? "QAYTA O'YNASH" : "KARTA OL"}
            </button>
          ) : gameState === "playing" ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={hit}
                className="py-4 rounded-2xl font-black text-base active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #1e40af, #2563eb)", color: "white" }}>
                ➕ HIT
              </button>
              <button onClick={stand}
                className="py-4 rounded-2xl font-black text-base active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #92400e, #d97706)", color: "white" }}>
                ✋ STAND
              </button>
            </div>
          ) : null}
        </div>

        {saving && <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Saqlanmoqda...</p>}
      </div>
    </div>
  );
}
