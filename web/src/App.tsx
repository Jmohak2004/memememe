import { Link, Route, Routes } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Home from "./pages/Home";
import Create from "./pages/Create";
import TokenPage from "./pages/TokenPage";
import { FaucetBar } from "./components/FaucetBar";

export default function App() {
  return (
    <>
      <header className="nav">
        <Link to="/" className="logo">CreatorCoin</Link>
        <nav><Link to="/">Explore</Link><Link to="/create">Launch</Link></nav>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </header>
      <FaucetBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<Create />} />
          <Route path="/token/:chainId/:address" element={<TokenPage />} />
        </Routes>
      </main>
    </>
  );
}
