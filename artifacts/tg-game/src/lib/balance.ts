import { useState, useCallback } from "react";

const STORAGE_KEY = "tg_game_balance";
const DEFAULT_BALANCE = 0;

export function getBalance(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) {
    localStorage.setItem(STORAGE_KEY, String(DEFAULT_BALANCE));
    return DEFAULT_BALANCE;
  }
  return Number(stored);
}

export function setBalance(amount: number): void {
  localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.round(amount))));
}

export function useBalance() {
  const [balance, setBalanceState] = useState<number>(getBalance);

  const updateBalance = useCallback((amount: number) => {
    setBalance(amount);
    setBalanceState(amount);
  }, []);

  const addBalance = useCallback((amount: number) => {
    const newBal = getBalance() + amount;
    setBalance(newBal);
    setBalanceState(newBal);
    return newBal;
  }, []);

  const deductBalance = useCallback((amount: number): boolean => {
    const current = getBalance();
    if (current < amount) return false;
    const newBal = current - amount;
    setBalance(newBal);
    setBalanceState(newBal);
    return true;
  }, []);

  return { balance, updateBalance, addBalance, deductBalance };
}
