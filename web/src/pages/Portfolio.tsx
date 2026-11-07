import { Link } from "react-router-dom";
import { useAccount, useChainId, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { useState } from "react";
import { FACTORIES } from "../lib/config";
import { factoryAbi, tokenAbi } from "../lib/abi";
import { fmtEth, fmtTok } from "../lib/format";
import { CoinAvatar } from "../components/CoinAvatar";
import { Crewmate } from "../components/Crewmate";
import { Confetti, Toast } from "../components/Fx";

export default function Portfolio() {
  const chainId = useChainId();
  const { address: me } = useAccount();
  const pc = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const factory = FACTORIES[chainId];
  const [msg, setMsg] = useState("");
  const [boom, setBoom] = useState(0);
  const { data: len } = useReadContract({ address: factory, abi: factoryAbi, functionName: "allTokensLength", chainId, query: { enabled: !!factory } });
  const n = Number(len ?? 0n);
  const { data: list } = useReadContract({ address: factory, abi: factoryAbi, functionName: "getTokens", args: [BigInt(Math.max(0, n - 50)), 50n], chainId, query: { enabled: !!factory && n > 0 } });
  const toks = (list ?? []) as `0x${string}`[];
  const { data, refetch } = useReadContracts({
    contracts: toks.flatMap((t) => [
      { address: t, abi: tokenAbi, chainId, functionName: "symbol" },
      { address: t, abi: tokenAbi, chainId, functionName: "balanceOf", args: [me!] },
      { address: t, abi: tokenAbi, chainId, functionName: "withdrawableDividendOf", args: [me!] },
    ] as const),
    query: { enabled: !!me && toks.length > 0 },
  });
  const rows = toks.map((t, i) => ({ t, sym: data?.[i * 3]?.result as string, bal: (data?.[i * 3 + 1]?.result ?? 0n) as bigint, div: (data?.[i * 3 + 2]?.result ?? 0n) as bigint }))
    .filter((r) => r.bal > 0n || r.div > 0n);
  const total = rows.reduce((a, r) => a + r.div, 0n);

  async function claimAll() {
    try {
      for (const r of rows.filter((x) => x.div > 0n)) {
        setMsg(`Claiming ${r.sym}…`);
        const h = await writeContractAsync({ address: r.t, abi: tokenAbi, functionName: "claimDividends", chainId });
        await pc!.waitForTransactionReceipt({ hash: h });
      }
      setBoom(Date.now()); setMsg("All claimed! 💰"); refetch(); setTimeout(() => setMsg(""), 3000);
    } catch (e: any) { setMsg(e?.shortMessage || "failed"); }
  }

  if (!me) return <div className="empty-state"><Crewmate size={90} color="#22c55e" wave /><h3>Connect a wallet to see your stash</h3></div>;
  return (
    <>
      <Confetti fire={boom} />
      <section className="panel">
        <h2>💰 My Stash</h2>
        <div className="stats"><span>COINS HELD<b>{rows.length}</b></span><span>UNCLAIMED PAYOUT<b>{fmtEth(total)} Ξ</b></span></div>
        <button className="btn yellow xl" disabled={total === 0n} onClick={claimAll}>💸 Claim everything</button>
      </section>
      <h2 className="section-title">Your coins</h2>
      <div className="grid">
        {rows.map((r) => (
          <Link key={r.t} className="card coin" to={`/token/${chainId}/${r.t}`}>
            <div className="top"><CoinAvatar address={r.t} /><div><h3>${r.sym}</h3></div></div>
            <div className="kv"><div>BALANCE<b>{fmtTok(r.bal)}</b></div><div>TO CLAIM<b>{fmtEth(r.div)} Ξ</b></div></div>
          </Link>
        ))}
      </div>
      {rows.length === 0 && <div className="empty-state"><Crewmate size={90} color="#3b82f6" wave /><h3>Nothing here yet</h3><Link className="btn" to="/">Find a coin</Link></div>}
      <Toast text={msg} />
    </>
  );
}
