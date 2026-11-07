import { Link } from "react-router-dom";
import { useChainId, useReadContract, useReadContracts } from "wagmi";
import { FACTORIES } from "../lib/config";
import { factoryAbi, tokenAbi } from "../lib/abi";
import { fmtEth, fmtTok } from "../lib/format";
import { Crewmate } from "../components/Crewmate";
import { CoinAvatar } from "../components/CoinAvatar";
import { Meter } from "../components/Fx";

function CoinCard({ address, chainId }: { address: `0x${string}`; chainId: number }) {
  const c = { address, abi: tokenAbi, chainId } as const;
  const { data } = useReadContracts({ contracts: [
    { ...c, functionName: "name" }, { ...c, functionName: "symbol" }, { ...c, functionName: "spotPrice" },
    { ...c, functionName: "totalDividendsDistributed" }, { ...c, functionName: "tokensSold" }, { ...c, functionName: "curveSupply" } ] });
  const [n, s, p, d, sold, curve] = (data?.map((x) => x.result) ?? []) as any[];
  const pct = curve ? Number((sold * 10000n) / curve) / 100 : 0;
  return (
    <Link className="card coin" to={`/token/${chainId}/${address}`}>
      {d > 0n && <div className="payout">PAYING</div>}
      <div className="top"><CoinAvatar address={address} /><div><h3>{n ?? "…"}</h3><span className="sym">${s ?? ""}</span></div></div>
      <div className="kv"><div>PRICE<b>{fmtEth(p, 8)} Ξ</b></div><div>PAID TO CREW<b>{fmtEth(d)} Ξ</b></div></div>
      <Meter value={pct} label={`⛽ ${pct.toFixed(1)}% launched`} />
    </Link>
  );
}

const STEPS = [
  { ic: "🛠️", t: "Build your coin", p: "Pick a name, a look and ANY supply. Takes a minute. No code." },
  { ic: "🎪", t: "Fans hop aboard", p: "A bonding curve is the market: always liquid, no LP to rug." },
  { ic: "💸", t: "Everyone earns", p: "40% of every fee streams to ALL holders. Claim any time." },
  { ic: "🎁", t: "Reward your crew", p: "Airdrop 10% of supply to real subscribers. Creator tokens vest." },
];

export default function Home() {
  const chainId = useChainId();
  const factory = FACTORIES[chainId];
  const { data: len } = useReadContract({ address: factory, abi: factoryAbi, functionName: "allTokensLength", chainId, query: { enabled: !!factory } });
  const n = Number(len ?? 0n);
  const { data: list } = useReadContract({ address: factory, abi: factoryAbi, functionName: "getTokens", args: [BigInt(Math.max(0, n - 24)), 24n], chainId, query: { enabled: !!factory && n > 0 } });
  return (
    <>
      <section className="hero">
        <div>
          <h1>Meme coins where <em>the whole crew</em> gets paid.</h1>
          <p>Launch a coin for your community. Every trade shares fees with every holder, creators vest, and dumpers fund the people who stay. Pump &amp; dump? Not on this ship.</p>
          <div className="row"><Link className="btn xl" to="/create">🚀 Launch a coin</Link><a className="btn xl pink" href="#coins">👀 Explore</a></div>
        </div>
        <div className="stage">
          <div className="planet" /><div className="planet b" />
          <div className="crew-main"><Crewmate size={190} color="#ef4444" hat="crown" wave /></div>
          <div className="sticker s1">Not a rug 🛡️</div><div className="sticker s2">Holders earn 💸</div><div className="sticker s3">Any supply ✨</div>
        </div>
      </section>

      <section className="strip">
        <div className="card"><b>40%</b><span>of fees to holders</span></div>
        <div className="card"><b>0</b><span>pools to rug</span></div>
        <div className="card"><b>10%</b><span>for subscribers</span></div>
        <div className="card"><b>{n}</b><span>coins launched here</span></div>
      </section>

      <h2 className="section-title">🎮 How it works</h2>
      <section className="steps">
        {STEPS.map((s, i) => (
          <div className="card step" key={s.t}><div className="n">{i + 1}</div><div className="ic">{s.ic}</div><h3>{s.t}</h3><p>{s.p}</p></div>
        ))}
      </section>

      <h2 className="section-title" id="coins">🪐 Fresh coins <small>tap a card to play</small></h2>
      {!factory && <p className="warn">Factory address not set for this chain yet. Add VITE_FACTORY_* in web/.env.</p>}
      <div className="grid">{[...(list ?? [])].reverse().map((a) => <CoinCard key={a} address={a} chainId={chainId} />)}</div>
      {factory && n === 0 && (
        <div className="empty-state"><Crewmate size={90} color="#3b82f6" wave /><h3>It's quiet in space…</h3><p>Be the first to launch a coin on this chain.</p><Link className="btn" to="/create">Launch the first one</Link></div>
      )}
    </>
  );
}
