const BASE = "/api";

export async function syncPlayer(data: {
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
}) {
  const res = await fetch(`${BASE}/players/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Sync failed");
  return res.json();
}

export async function getPlayer(telegramId: string) {
  const res = await fetch(`${BASE}/players/${telegramId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createDepositRequest(telegramId: string, amount: number) {
  const res = await fetch(`${BASE}/players/${telegramId}/deposit-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error("Deposit request failed");
  return res.json();
}

export async function deposit(telegramId: string, amount: number) {
  const res = await fetch(`${BASE}/players/${telegramId}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error("Deposit failed");
  return res.json();
}

export async function withdraw(telegramId: string, amount: number, cardNumber: string, cardHolder: string) {
  const res = await fetch(`${BASE}/players/${telegramId}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, cardNumber, cardHolder }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Withdraw failed");
  }
  return res.json();
}

export async function placeBet(telegramId: string, data: {
  amount: number;
  game: string;
  won: boolean;
  winAmount: number;
}) {
  const res = await fetch(`${BASE}/players/${telegramId}/bet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Bet failed");
  }
  return res.json();
}

export async function getTransactions(telegramId: string) {
  const res = await fetch(`${BASE}/players/${telegramId}/transactions`);
  if (!res.ok) return [];
  return res.json();
}

export async function getLeaderboard() {
  const res = await fetch(`${BASE}/game/leaderboard`);
  if (!res.ok) return [];
  return res.json();
}

export async function getGameStats() {
  const res = await fetch(`${BASE}/game/stats`);
  if (!res.ok) return null;
  return res.json();
}
