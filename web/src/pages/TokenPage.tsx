import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { parseEther, zeroHash } from "viem";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { tokenAbi } from "../lib/abi";
import { fmtEth, fmtTok, short } from "../lib/format";

export default function TokenPage() {
  const { chainId: cid, address } = useParams();
  const chainId = Number(cid);
  const token = address as `0x${string}`;
  const { address: me } = useAccount();
  const pc = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("");
  const [msg, setMsg] = useState("");
  const [airdropCsv, setAirdropCsv] = useState("");

  const c = { address: token, abi: tokenAbi, chainId } as const;
  const who = me ?? "0x0000000000000000000000000000000000000000";
  const { data, refetch } = useReadContracts({ contracts: [
    { ...c, functionName: "name" }, { ...c, functionName: "symbol" }, { ...c, functionName: "spotPrice" },
    { ...c, functionName: "totalSupply" }, { ...c, functionName: "tokensSold" }, { ...c, functionName: "curveSupply" },
    { ...c, functionName: "balanceOf", args: [who] }, { ...c, functionName: "withdrawableDividendOf", args: [who] },
    { ...c, functionName: "totalDividendsDistributed" }, { ...c, functionName: "creator" },
    { ...c, functionName: "earlySellPenaltyBps", args: [who] }, { ...c, functionName: "vestedAmount" },
    { ...c, functionName: "creatorClaimed" }, { ...c, functionName: "creatorFees" }, { ...c, functionName: "airdropRoot" },
    { ...c, functionName: "airdropDone", args: [who] },
  ], query: { refetchInterval: 8000 } });
  const r = (i: number) => data?.[i]?.result as any;
  const [name, symbol, price, supply, sold, curve, bal, divs, totalDivs, creator, penalty, vested, claimed, cFees, root, done] = Array.from({ length: 16 }, (_, i) => r(i));
  const isCreator = !!me && creator?.toLowerCase() === me.toLowerCase();

  let input = 0n; try { input = amt ? parseEther(amt) : 0n; } catch {}
  const { data: qBuy } = useReadContract({ ...c, functionName: "quoteBuy", args: [input], query: { enabled: tab === "buy" && input > 0n } });
  const { data: qSell } = useReadContract({ ...c, functionName: "quoteSell", args: [who, input], query: { enabled: tab === "sell" && input > 0n } });

  async function run(fn: () => Promise<`0x${string}`>) {
    setMsg("Confirm in wallet…");
    try { const h = await fn(); setMsg("Waiting for confirmation…"); await pc!.waitForTransactionReceipt({ hash: h }); setMsg("Done ✓"); refetch(); }
    catch (e: any) { setMsg(e?.shortMessage || e?.message || "failed"); }
  }
  const w = (functionName: any, args: any[] = [], value?: bigint) => () => writeContractAsync({ ...c, functionName, args, value } as any);

  const trade = () => tab === "buy"
    ? run(w("buy", [((qBuy as any)?.[0] ?? 0n) * 99n / 100n], input))
    : run(w("sell", [input, ((qSell as any)?.[0] ?? 0n) * 99n / 100n]));

  async function publishAirdrop() {
    // lines: address,amount(tokens)
    const rows = airdropCsv.trim().split("\n").map((l) => l.split(",").map((s) => s.trim())).filter((x) => x.length === 2).map(([a, v]) => [a, parseEther(v).toString()]);
    const tree = StandardMerkleTree.of(rows, ["address", "uint256"]);
    localStorage.setItem(`airdrop:${chainId}:${token}`, JSON.stringify(tree.dump()));
    await run(w("setAirdropRoot", [tree.root]));
    setMsg(`Root set. Share this tree JSON with subscribers (saved in this browser).`);
  }
  async function claimAirdrop() {
    const raw = localStorage.getItem(`airdrop:${chainId}:${token}`) || prompt("Paste the creator's airdrop tree JSON");
    if (!raw) return;
    const tree = StandardMerkleTree.load(JSON.parse(raw));
    for (const [i, v] of tree.entries()) if ((v[0] as string).toLowerCase() === who.toLowerCase())
      return run(w("claimAirdrop", [BigInt(v[1] as string), tree.getProof(i)]));
    setMsg("You are not in this airdrop.");
  }

  const pct = curve ? Number((sold * 10000n) / curve) / 100 : 0;
  return (
    <div className="two">
      <section className="panel">
        <h2>{name} <span className="muted">${symbol}</span></h2>
        <p className="muted">Creator {creator ? short(creator) : "…"} · {short(token)}</p>
        <div className="stats big">
          <span>Price<b>{fmtEth(price, 10)} ETH</b></span>
          <span>Supply<b>{fmtTok(supply)}</b></span>
          <span>Paid to holders<b>{fmtEth(totalDivs)} ETH</b></span>
        </div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <p className="muted">{pct.toFixed(2)}% of curve sold</p>
        {me && <>
          <h3>Your position</h3>
          <div className="stats"><span>Balance<b>{fmtTok(bal)}</b></span><span>Unclaimed dividends<b>{fmtEth(divs)} ETH</b></span></div>
          <button className="btn" disabled={!divs || divs === 0n} onClick={() => run(w("claimDividends"))}>Claim dividends</button>
        </>}
      </section>

      <section className="panel">
        <div className="tabs"><button className={tab === "buy" ? "on" : ""} onClick={() => setTab("buy")}>Buy</button><button className={tab === "sell" ? "on" : ""} onClick={() => setTab("sell")}>Sell</button></div>
        <label>{tab === "buy" ? "ETH to spend" : `${symbol ?? "Tokens"} to sell`}<input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.0" /></label>
        {tab === "buy" && qBuy && <p className="muted">You get ≈ {fmtTok((qBuy as any)[0])} · fee {fmtEth((qBuy as any)[2])} ETH (40% of it goes to holders)</p>}
        {tab === "sell" && qSell && <p className="muted">You get ≈ {fmtEth((qSell as any)[0])} ETH · fee {fmtEth((qSell as any)[1])} · early-sell penalty {fmtEth((qSell as any)[2])} (shared with holders)</p>}
        {tab === "sell" && penalty > 0n && <p className="warn">Early-sell penalty now {(Number(penalty) / 100).toFixed(2)}%, decays to 0 within 24h of your last buy.</p>}
        <button className="btn" disabled={!me || input === 0n} onClick={trade}>{me ? (tab === "buy" ? "Buy" : "Sell") : "Connect wallet"}</button>
        {msg && <p className="muted">{msg}</p>}

        {isCreator && <>
          <h3>Creator tools</h3>
          <p className="muted">Fees {fmtEth(cFees)} ETH · vested {fmtTok(vested)} · claimed {fmtTok(claimed)}</p>
          <div className="row"><button className="btn sm" onClick={() => run(w("claimCreatorFees"))}>Claim fees</button><button className="btn sm" onClick={() => run(w("claimVested"))}>Claim vested tokens</button></div>
          {root === zeroHash && <>
            <label>Subscriber airdrop (one "address,amount" per line, max 10% of supply total)<textarea rows={4} value={airdropCsv} onChange={(e) => setAirdropCsv(e.target.value)} /></label>
            <button className="btn sm" onClick={publishAirdrop}>Publish airdrop</button></>}
        </>}
        {me && root && root !== zeroHash && !done && <button className="btn sm" onClick={claimAirdrop}>Claim subscriber airdrop</button>}
      </section>
    </div>
  );
}
