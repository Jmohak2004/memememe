import { Link } from "react-router-dom";
import { useChainId, useReadContract, useReadContracts } from "wagmi";
import { FACTORIES } from "../lib/config";
import { factoryAbi, tokenAbi } from "../lib/abi";
import { fmtEth, fmtTok } from "../lib/format";

function Row({ address, chainId }: { address: `0x${string}`; chainId: number }) {
  const c = { address, abi: tokenAbi, chainId } as const;
  const { data } = useReadContracts({ contracts: [
    { ...c, functionName: "name" }, { ...c, functionName: "symbol" }, { ...c, functionName: "spotPrice" },
    { ...c, functionName: "totalSupply" }, { ...c, functionName: "totalDividendsDistributed" } ] });
  const [n, s, p, ts, d] = data?.map((x) => x.result) ?? [];
  return (
    <Link className="card" to={`/token/${chainId}/${address}`}>
      <h3>{(n as string) ?? "…"} <span className="muted">${(s as string) ?? ""}</span></h3>
      <div className="stats">
        <span>Price <b>{fmtEth(p as bigint, 9)} ETH</b></span>
        <span>Supply <b>{fmtTok(ts as bigint)}</b></span>
        <span>Paid to holders <b>{fmtEth(d as bigint)} ETH</b></span>
      </div>
    </Link>
  );
}

export default function Home() {
  const chainId = useChainId();
  const factory = FACTORIES[chainId];
  const { data: len } = useReadContract({ address: factory, abi: factoryAbi, functionName: "allTokensLength", chainId, query: { enabled: !!factory } });
  const n = Number(len ?? 0n);
  const { data: list } = useReadContract({ address: factory, abi: factoryAbi, functionName: "getTokens", args: [BigInt(Math.max(0, n - 24)), 24n], chainId, query: { enabled: !!factory && n > 0 } });
  return (
    <>
      <section className="hero">
        <h1>Meme coins where holders get paid too.</h1>
        <p>Creators launch a coin with any supply. Every trade fee is shared with all holders. Creator tokens vest, early dumps are taxed back to the community, and there is no liquidity pool to rug.</p>
        <Link className="btn" to="/create">Launch your coin</Link>
      </section>
      {!factory && <p className="warn">Factory not configured for this chain. Set VITE_FACTORY_* in web/.env.</p>}
      <div className="grid">{[...(list ?? [])].reverse().map((a) => <Row key={a} address={a} chainId={chainId} />)}</div>
      {factory && n === 0 && <p className="muted">No coins yet on this chain. Be the first.</p>}
    </>
  );
}
