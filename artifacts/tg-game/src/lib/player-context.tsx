import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getTelegramUser, initTelegramApp } from "./telegram";
import { syncPlayer, getPlayer } from "./api";

export interface Player {
  id: number;
  telegramId: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
  photoUrl?: string | null;
  balance: number;
  totalWon: number;
  totalLost: number;
  gamesPlayed: number;
  totalDeposited: number;
  wagerRequirement: number;
  totalWagered: number;
}

interface PlayerContextType {
  player: Player | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setPlayer: (p: Player) => void;
}

const PlayerContext = createContext<PlayerContextType>({
  player: null,
  loading: true,
  refresh: async () => {},
  setPlayer: () => {},
});

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const tgUser = getTelegramUser();
    if (tgUser) {
      try {
        const p = await syncPlayer({
          telegramId: String(tgUser.id),
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          photoUrl: tgUser.photo_url,
        });
        setPlayer(p);
        return;
      } catch {}
    }
    const demoId = "demo_user";
    try {
      let p = await getPlayer(demoId);
      if (!p) {
        p = await syncPlayer({ telegramId: demoId, firstName: "Demo O'yinchi" });
      }
      setPlayer(p);
    } catch {
      setPlayer({
        id: 0, telegramId: "demo", firstName: "Demo O'yinchi",
        balance: 0, totalWon: 0, totalLost: 0, gamesPlayed: 0,
        totalDeposited: 0, wagerRequirement: 0, totalWagered: 0,
      });
    }
  }, []);

  useEffect(() => {
    initTelegramApp();
    refresh().finally(() => setLoading(false));
    const interval = setInterval(() => {
      refresh().catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <PlayerContext.Provider value={{ player, loading, refresh, setPlayer }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
