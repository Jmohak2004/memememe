import { Link } from "react-router-dom";
import { useChainId, useReadContract, useReadContracts } from "wagmi";
import { FACTORIES } from "../lib/config";
import { factoryAbi, tokenAbi } from "../lib/abi";
import { fmtEth } from "../lib/format";
import { CoinAvatar } from "../components/CoinAvatar";
import { Crewmate } from "../components/Crewmate";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const chainId = useChainId();
  const factory = FACTORIES[chainId];
  const { data: len } = useReadContract({ address: factory, abi: factoryAbi, functionName: "allTokensLength", chainId, query: { enabled: !!factory } });
  const n = Number(len ?? 0n);
  const { data: list } = useReadContract({ address: factory, abi: factoryAbi, functionName: "getTokens", args: [BigInt(Math.max(0, n - 100)), 100n], chainId, query: { enabled: !!factory && n > 0 } });
  const toks = (list ?? []) as `0x${string}`[];
  const { data } = useReadContracts({
    contracts: toks.flatMap((t) => [
      { address: t, abi: tokenAbi, chainId, functionName: "symbol" },
      { address: t, abi: tokenAbi, chainId, functionName: "totalDividendsDistributed" },
      { address: t, abi: tokenAbi, chainId, functionName: "tokensSold" },
      { address: t, abi: tokenAbi, chainId, functionName: "curveSupply" },
    ] as const),
    query: { enabled: toks.length > 0 },
  });
  const rows = toks.map((t, i) => ({
    t, sym: data?.[i * 4]?.result as string, paid: (data?.[i * 4 + 1]?.result ?? 0n) as bigint,
    sold: (data?.[i * 4 + 2]?.result ?? 0n) as bigint, curve: (data?.[i * 4 + 3]?.result ?? 1n) as bigint,
  }));
  const byPaid = [...rows].sort((a, b) => (b.paid > a.paid ? 1 : -1)).slice(0, 10);
  const byFill = [...rows].sort((a, b) => Number((b.sold * 10000n) / b.curve) - Number((a.sold * 10000n) / a.curve)).slice(0, 10);

  const Board = ({ title, items, val }: { title: string; items: typeof rows; val: (r: (typeof rows)[0]) => string }) => (
    <section className="panel">
      <h2>{title}</h2>
      <div className="feed" style={{ maxHeight: "none" }}>
        {items.map((r, i) => (
          <Link key={r.t} to={`/token/${chainId}/${r.t}`} className="it">
            <b style={{ width: 28 }}>{MEDAL[i] ?? i + 1}</b><CoinAvatar address={r.t} size={28} className="mini" /><span>${r.sym}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>{val(r)}</span>
          </Link>
        ))}
      </div>
    </section>
  );

  if (!factory || rows.length === 0)
    return <div className="empty-state"><Crewmate size={90} color="#f97316" wave /><h3>No racers yet</h3><Link className="btn" to="/create">Launch one</Link></div>;
  return (
    <div className="two">
      <Board title="💸 Biggest payouts to holders" items={byPaid} val={(r) => `${fmtEth(r.paid)} Ξ`} />
      <Board title="🚀 Fastest filling curves" items={byFill} val={(r) => `${(Number((r.sold * 10000n) / r.curve) / 100).toFixed(1)}%`} />
    </div>
  );
}
