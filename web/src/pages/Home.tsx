import { useState } from "react";
import { Link } from "react-router-dom";
import { useChainId, useReadContract, useReadContracts } from "wagmi";
import { FACTORIES } from "../lib/config";
import { factoryAbi, tokenAbi } from "../lib/abi";
import { fmtEth, fmtTok } from "../lib/format";
import { Crewmate } from "../components/Crewmate";
import { CoinAvatar } from "../components/CoinAvatar";
import { Meter } from "../components/Fx";

type Coin = { address: `0x${string}`; idx: number; name?: string; symbol?: string; price: bigint; paid: bigint; pct: number };
type SortKey = "new" | "price" | "paid" | "launched";
const SORTS: { k: SortKey; label: string }[] = [
  { k: "new", label: "🆕 Newest" }, { k: "paid", label: "💸 Most paid out" },
  { k: "launched", label: "⛽ Most launched" }, { k: "price", label: "💎 Highest price" },
];

function CoinCard({ coin, chainId }: { coin: Coin; chainId: number }) {
  return (
    <Link className="card coin" to={`/token/${chainId}/${coin.address}`}>
      {coin.paid > 0n && <div className="payout">PAYING</div>}
      <div className="top"><CoinAvatar address={coin.address} /><div><h3>{coin.name ?? "…"}</h3><span className="sym">${coin.symbol ?? ""}</span></div></div>
      <div className="kv"><div>PRICE<b>{fmtEth(coin.price, 8)} Ξ</b></div><div>PAID TO CREW<b>{fmtEth(coin.paid)} Ξ</b></div></div>
      <Meter value={coin.pct} label={`⛽ ${coin.pct.toFixed(1)}% launched`} />
    </Link>
  );
}

function useCoins(tokens: `0x${string}`[], chainId: number): Coin[] {
  const { data } = useReadContracts({
    contracts: tokens.flatMap((address) => {
      const c = { address, abi: tokenAbi, chainId } as const;
      return [
        { ...c, functionName: "name" }, { ...c, functionName: "symbol" }, { ...c, functionName: "spotPrice" },
        { ...c, functionName: "totalDividendsDistributed" }, { ...c, functionName: "tokensSold" }, { ...c, functionName: "curveSupply" },
      ] as const;
    }),
    query: { enabled: tokens.length > 0 },
  });
  return tokens.map((address, idx) => {
    const r = (j: number) => data?.[idx * 6 + j]?.result as any;
    const sold = (r(4) ?? 0n) as bigint, curve = (r(5) ?? 0n) as bigint;
    return {
      address, idx, name: r(0), symbol: r(1), price: (r(2) ?? 0n) as bigint, paid: (r(3) ?? 0n) as bigint,
      pct: curve > 0n ? Number((sold * 10000n) / curve) / 100 : 0,
    };
  });
}

/** Case-insensitive match on name, ticker or address. */
export function matchesQuery(c: Pick<Coin, "name" | "symbol" | "address">, q: string) {
  const needle = q.trim().toLowerCase().replace(/^\$/, "");
  if (!needle) return true;
  return [c.name, c.symbol, c.address].some((v) => v?.toLowerCase().includes(needle));
}

export function sortCoins(coins: Coin[], key: SortKey): Coin[] {
  const by = (f: (c: Coin) => number | bigint) => (a: Coin, b: Coin) => (f(b) > f(a) ? 1 : f(b) < f(a) ? -1 : b.idx - a.idx);
  const out = [...coins];
  if (key === "new") return out.sort((a, b) => b.idx - a.idx);
  if (key === "price") return out.sort(by((c) => c.price));
  if (key === "paid") return out.sort(by((c) => c.paid));
  return out.sort(by((c) => c.pct));
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
  const coins = useCoins((list ?? []) as `0x${string}`[], chainId);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const shown = sortCoins(coins.filter((c) => matchesQuery(c, q)), sort);
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
      {n > 0 && (
        <div className="toolbar">
          <input type="search" aria-label="Search coins" placeholder="🔎 Search name, $ticker or address" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="pills" role="group" aria-label="Sort coins">
            {SORTS.map((o) => <button key={o.k} type="button" className={sort === o.k ? "pill on" : "pill"} aria-pressed={sort === o.k} onClick={() => setSort(o.k)}>{o.label}</button>)}
          </div>
        </div>
      )}
      <div className="grid">{shown.map((c) => <CoinCard key={c.address} coin={c} chainId={chainId} />)}</div>
      {n > 0 && shown.length === 0 && coins.length > 0 && <p className="warn">No coins match “{q}”.</p>}
      {factory && n === 0 && (
        <div className="empty-state"><Crewmate size={90} color="#3b82f6" wave /><h3>It's quiet in space…</h3><p>Be the first to launch a coin on this chain.</p><Link className="btn" to="/create">Launch the first one</Link></div>
      )}
    </>
  );
}
