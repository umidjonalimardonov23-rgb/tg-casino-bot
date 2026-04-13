import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { PlayerProvider } from "@/lib/player-context";
import { LangProvider } from "@/lib/lang-context";
import { ThemeProvider } from "@/lib/theme-context";
import Home from "@/pages/Home";
import AppleOfFortune from "@/pages/AppleOfFortune";
import Dice from "@/pages/Dice";
import Aviator from "@/pages/Aviator";
import Blackjack from "@/pages/Blackjack";
import Slots from "@/pages/Slots";
import Parity from "@/pages/Parity";
import Deposit from "@/pages/Deposit";
import Withdraw from "@/pages/Withdraw";
import HowToPlay from "@/pages/HowToPlay";
import Leaderboard from "@/pages/Leaderboard";
import Spin from "@/pages/Spin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/apple" component={AppleOfFortune} />
      <Route path="/dice" component={Dice} />
      <Route path="/aviator" component={Aviator} />
      <Route path="/blackjack" component={Blackjack} />
      <Route path="/slots" component={Slots} />
      <Route path="/parity" component={Parity} />
      <Route path="/deposit" component={Deposit} />
      <Route path="/withdraw" component={Withdraw} />
      <Route path="/howtoplay" component={HowToPlay} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/spin" component={Spin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <ThemeProvider>
          <PlayerProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </PlayerProvider>
        </ThemeProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}

export default App;
