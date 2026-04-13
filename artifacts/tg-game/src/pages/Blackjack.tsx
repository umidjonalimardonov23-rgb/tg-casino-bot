import { useState, useCallback } from "react";
import { usePlayer } from "@/lib/player-context";
import { useLang } from "@/lib/lang-context";
import { useTheme } from "@/lib/theme-context";
import { placeBet } from "@/lib/api";
import GameHeader from "@/components/GameHeader";

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = { suit: Suit; value: string; num: number };
type GameState = "idle" | "playing" | "dealer" | "result";
type Result = "blackjack" | "win" | "push" | "bust" | "lose" | null;

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const VALUES = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS)
    for (const v of VALUES) {
      const num = v === "A" ? 11 : ["J","Q","K"].includes(v) ? 10 : Number(v);
      deck.push({ suit, value: v, num });
    }
  return deck.sort(() => Math.random() - 0.5);
}
function calcHand(cards: Card[]): number {
  let total = cards.reduce((s, c) => s + c.num, 0);
  let aces = cards.filter(c => c.value === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function CardUI({ card, hidden, theme }: { card: Card; hidden?: boolean; theme: string }) {
  const isLight = theme === "light";
  if (hidden) return (
    <div className="flex items-center justify-center rounded-xl relative overflow-hidden"
      style={{
        width: 56, height: 80, borderRadius: 12,
        background: isLight ? "linear-gradient(145deg, #4f46e5, #6d28d9)" : "linear-gradient(145deg, #312e81, #4338ca)",
        border: `2px solid ${isLight ? "#818cf8" : "#6366f1"}`,
        boxShadow: "0 4px 0 rgba(0,0,0,0.25), 0 6px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
      }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%)" }} />
      <span style={{ fontSize: 26, opacity: 0.5 }}>🂠</span>
    </div>
  );
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div className="flex flex-col justify-between p-1.5 rounded-xl relative overflow-hidden"
      style={{
        width: 56, height: 80, borderRadius: 12,
        background: isLight ? "linear-gradient(145deg, #ffffff, #f8faff)" : "linear-gradient(145deg, #ffffff, #f1f5f9)",
        border: "2px solid rgba(255,255,255,0.6)",
        boxShadow: "0 4px 0 rgba(0,0,0,0.2), 0 6px 14px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,1)",
      }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 60%)" }} />
      <div className="relative" style={{ fontSize: 12, color: isRed ? "#dc2626" : "#1e1b4b", lineHeight: 1.1, fontWeight: 900 }}>
        {card.value}<br />{card.suit}
      </div>
      <div className="relative" style={{ fontSize: 12, color: isRed ? "#dc2626" : "#1e1b4b", lineHeight: 1.1, fontWeight: 900, textAlign: "right", transform: "rotate(180deg)" }}>
        {card.value}<br />{card.suit}
      </div>
    </div>
  );
}

export default function Blackjack() {
  const { player, refresh } = usePlayer();
  const { t } = useLang();
  const { theme, ts } = useTheme();
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
  const isLight = theme === "light";
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
    if (calcHand(p) === 21) setTimeout(() => endGame(p, dealer, d.slice(4), "blackjack"), 600);
  }, [player, activeBet]);

  const hit = useCallback(() => {
    if (gameState !== "playing") return;
    const newCard = deck[0];
    const newDeck = deck.slice(1);
    const newP = [...playerCards, newCard];
    setDeck(newDeck);
    setPlayerCards(newP);
    if (calcHand(newP) > 21) setTimeout(() => endGame(newP, dealerCards, newDeck, "bust"), 400);
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
    }, 700);
  }, [gameState, dealerCards, deck, playerCards]);

  const endGame = async (pCards: Card[], dCards: Card[], _dk: Card[], res: Result) => {
    setDealerRevealed(true);
    setDealerCards(dCards);
    setResult(res);
    setGameState("result");
    let winAmt = 0, won = false;
    if (res === "blackjack") { winAmt = Math.floor(activeBet * 2.5); won = true; }
    else if (res === "win") { winAmt = activeBet * 2; won = true; }
    else if (res === "push") { winAmt = activeBet; }
    setPrize(winAmt);
    setSaving(true);
    try {
      await placeBet(player!.telegramId, { amount: activeBet, game: "blackjack", won: won || res === "push", winAmount: winAmt });
      await refresh();
    } catch {}
    setSaving(false);
  };

  const RESULT_CONFIG: Record<NonNullable<Result>, { label: string; color: string; bg: string; shadow: string }> = {
    blackjack: { label: t.bjBlackjack, color: "#fbbf24", bg: "linear-gradient(145deg, #92400e, #d97706)", shadow: "0 6px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(217,119,6,0.5)" },
    win:       { label: t.bjWin,       color: "#4ade80", bg: "linear-gradient(145deg, #064e3b, #059669)", shadow: "0 6px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(5,150,105,0.5)" },
    push:      { label: t.bjPush,      color: "#93c5fd", bg: "linear-gradient(145deg, #1e3a5f, #1e40af)", shadow: "0 6px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(30,64,175,0.5)" },
    bust:      { label: t.bjBust,      color: "#f87171", bg: "linear-gradient(145deg, #7f1d1d, #dc2626)", shadow: "0 6px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(220,38,38,0.5)" },
    lose:      { label: t.bjLose,      color: "#f87171", bg: "linear-gradient(145deg, #7f1d1d, #dc2626)", shadow: "0 6px 0 rgba(0,0,0,0.3), 0 8px 24px rgba(220,38,38,0.5)" },
  };

  const cardBg = isLight
    ? "linear-gradient(145deg, #e0e7ff, #c7d2fe)"
    : theme === "black"
      ? "rgba(255,255,255,0.03)"
      : "rgba(255,255,255,0.06)";
  const cardBorder = isLight ? "rgba(99,102,241,0.25)" : ts.cardBorder;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ts.bg }}>
      <GameHeader title={`🃏 ${t.blackjackTitle}`} subtitle={t.bjPayout} />

      <div className="flex-1 px-4 pb-6 flex flex-col gap-3">

        {/* Dealer */}
        <div className="rounded-2xl p-4"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: isLight ? "0 4px 0 rgba(99,102,241,0.1), 0 6px 20px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.8)" : "0 4px 0 rgba(0,0,0,0.2)",
          }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold tracking-widest" style={{ color: ts.textSub }}>🤵 {t.dealer}</p>
            {gameState !== "idle" && (
              <span className="text-sm font-black px-2.5 py-1 rounded-xl"
                style={{ background: isLight ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.1)", color: ts.text }}>
                {dealerRevealed ? dealerTotal : "?"}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap min-h-[80px] items-center">
            {dealerCards.map((c, i) => <CardUI key={i} card={c} hidden={i === 1 && !dealerRevealed} theme={theme} />)}
            {gameState === "idle" && <span className="text-sm" style={{ color: ts.textSub }}>{t.cardsLoading}</span>}
          </div>
        </div>

        {/* Result banner */}
        {result && RESULT_CONFIG[result] && (
          <div className="rounded-2xl p-4 text-center relative overflow-hidden"
            style={{ background: RESULT_CONFIG[result].bg, boxShadow: RESULT_CONFIG[result].shadow }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)" }} />
            <p className="relative font-black text-2xl" style={{ color: RESULT_CONFIG[result].color, textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              {RESULT_CONFIG[result].label}
            </p>
            {prize > 0 && <p className="relative text-white font-bold text-sm mt-1">+{prize.toLocaleString()} UZS</p>}
          </div>
        )}

        {/* Player hand */}
        <div className="rounded-2xl p-4"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: isLight ? "0 4px 0 rgba(99,102,241,0.1), 0 6px 20px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.8)" : "0 4px 0 rgba(0,0,0,0.2)",
          }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold tracking-widest" style={{ color: ts.textSub }}>👤 {t.yourHand}</p>
            {gameState !== "idle" && (
              <span className="text-sm font-black px-2.5 py-1 rounded-xl"
                style={{ background: isLight ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.1)", color: playerTotal > 21 ? "#f87171" : ts.text }}>
                {playerTotal}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap min-h-[80px] items-center">
            {playerCards.map((c, i) => <CardUI key={i} card={c} theme={theme} />)}
            {gameState === "idle" && <span className="text-sm" style={{ color: ts.textSub }}>{t.cardsLoading}</span>}
          </div>
        </div>

        {/* Bet input */}
        {(gameState === "idle" || gameState === "result") && (
          <div className="rounded-2xl p-4"
            style={{ background: ts.card, border: `1px solid ${ts.cardBorder}`, boxShadow: isLight ? "0 4px 16px rgba(99,102,241,0.08)" : "none" }}>
            <p className="text-xs font-bold mb-3 tracking-widest" style={{ color: ts.textSub }}>💰 {t.betAmount}</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {["MIN","1/2","X2","MAX"].map(a => (
                <button key={a} onClick={() => setQuickBet(a)}
                  className="py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                  style={{ background: ts.btnSecondary, color: ts.btnSecondaryText, border: `1px solid ${ts.cardBorder}`, boxShadow: "0 2px 0 rgba(0,0,0,0.1)" }}>
                  {a}
                </button>
              ))}
            </div>
            <input type="number" value={betInput} onChange={e => setBetInput(e.target.value)}
              className="w-full rounded-xl px-4 py-3 font-black text-center text-lg outline-none"
              style={{ background: ts.input, border: `1px solid ${ts.inputBorder}`, color: ts.text }}
              placeholder="2000" min={2000} />
            <p className="text-xs mt-2 text-center" style={{ color: ts.textSub }}>{t.bjPayout}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mt-auto">
          {(gameState === "idle" || gameState === "result") ? (
            <button onClick={deal} disabled={!player || player.balance < activeBet}
              className="w-full py-4 rounded-2xl font-black text-lg active:scale-95 transition-all disabled:opacity-40"
              style={{
                background: "linear-gradient(145deg, #059669, #10b981)",
                boxShadow: "0 6px 0 #064e3b, 0 8px 24px rgba(16,185,129,0.4)",
                color: "white",
              }}>
              🃏 {gameState === "result" ? t.bjPlayAgain : t.bjDeal}
            </button>
          ) : gameState === "playing" ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={hit}
                className="py-4 rounded-2xl font-black text-lg active:scale-95 transition-all"
                style={{ background: "linear-gradient(145deg, #2563eb, #3b82f6)", boxShadow: "0 5px 0 #1e3a8a, 0 6px 16px rgba(59,130,246,0.5)", color: "white" }}>
                ➕ {t.bjHit}
              </button>
              <button onClick={stand}
                className="py-4 rounded-2xl font-black text-lg active:scale-95 transition-all"
                style={{ background: "linear-gradient(145deg, #d97706, #f59e0b)", boxShadow: "0 5px 0 #78350f, 0 6px 16px rgba(245,158,11,0.5)", color: "white" }}>
                ✋ {t.bjStand}
              </button>
            </div>
          ) : null}
        </div>

        {saving && <p className="text-center text-xs" style={{ color: ts.textSub }}>{t.saving}</p>}
      </div>
    </div>
  );
}
