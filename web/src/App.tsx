import { Link, NavLink, Route, Routes } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Home from "./pages/Home";
import Create from "./pages/Create";
import TokenPage from "./pages/TokenPage";
import Portfolio from "./pages/Portfolio";
import { FaucetBar } from "./components/FaucetBar";
import { Stars, Ticker } from "./components/Fx";
import { Crewmate } from "./components/Crewmate";

const TICKS = [
  "🚀 40% OF EVERY FEE GOES TO HOLDERS", "🛡️ NO LIQUIDITY POOL = NOTHING TO RUG", "⏳ CREATOR TOKENS VEST — NO DAY-ONE DUMPS",
  "🎁 10% OF SUPPLY RESERVED FOR SUBSCRIBERS", "💸 EARLY FLIPPERS PAY THE CREW", "🌉 LIVE ON ETH SEPOLIA + BASE SEPOLIA",
];

export default function App() {
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? "on" : "");
  return (
    <>
      <Stars />
      <header className="nav">
        <Link to="/" className="logo"><Crewmate size={34} color="#ef4444" /><span className="t">CreatorCoin</span></Link>
        <nav>
          <NavLink to="/" end className={cls}>🪐 Explore</NavLink>
          <NavLink to="/create" className={cls}>🛠️ Launch</NavLink>
          <NavLink to="/stash" className={cls}>💰 My Stash</NavLink>
        </nav>
        <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
      </header>
      <Ticker items={TICKS} />
      <FaucetBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<Create />} />
          <Route path="/stash" element={<Portfolio />} />
          <Route path="/token/:chainId/:address" element={<TokenPage />} />
        </Routes>
      </main>
      <footer>Testnet only · unaudited · play with fake ETH 🧪</footer>
    </>
  );
}
