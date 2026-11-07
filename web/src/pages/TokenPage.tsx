import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { parseEther, zeroHash } from "viem";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { tokenAbi } from "../lib/abi";
import { fmtEth, fmtTok, short } from "../lib/format";
import { CoinAvatar } from "../components/CoinAvatar";
import { Badge, Confetti, Meter, Toast } from "../components/Fx";
import { PriceChart } from "../components/PriceChart";
import { useTrades } from "../lib/useTrades";
import { ipfsUpload } from "../lib/ipfs";

const ZERO = "0x0000000000000000000000000000000000000000";

export default function TokenPage() {
  const { chainId: cid, address } = useParams();
  const chainId = Number(cid);
  const token = address as `0x${string}`;
  const { address: me } = useAccount();
  const pc = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const trades = useTrades(token, chainId);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("");
  const [msg, setMsg] = useState("");
  const [boom, setBoom] = useState(0);
  const [csv, setCsv] = useState("");

  const c = { address: token, abi: tokenAbi, chainId } as const;
  const who = (me ?? ZERO) as `0x${string}`;
  const { data, refetch } = useReadContracts({ contracts: [
    { ...c, functionName: "name" }, { ...c, functionName: "symbol" }, { ...c, functionName: "spotPrice" },
    { ...c, functionName: "totalSupply" }, { ...c, functionName: "tokensSold" }, { ...c, functionName: "curveSupply" },
    { ...c, functionName: "balanceOf", args: [who] }, { ...c, functionName: "withdrawableDividendOf", args: [who] },
    { ...c, functionName: "totalDividendsDistributed" }, { ...c, functionName: "creator" },
    { ...c, functionName: "earlySellPenaltyBps", args: [who] }, { ...c, functionName: "vestedAmount" },
    { ...c, functionName: "creatorClaimed" }, { ...c, functionName: "creatorFees" }, { ...c, functionName: "airdropRoot" },
    { ...c, functionName: "airdropDone", args: [who] }, { ...c, functionName: "maxSupply" }, { ...c, functionName: "metadataURI" },
  ], query: { refetchInterval: 8000 } });
  const r = (i: number) => data?.[i]?.result as any;
  const [name, symbol, price, supply, sold, curve, bal, divs, totalDivs, creator, penalty, vested, claimed, cFees, root, done, maxSupply, meta] =
    Array.from({ length: 18 }, (_, i) => r(i));
  const isCreator = !!me && creator?.toLowerCase() === me.toLowerCase();

  let input = 0n; try { input = amt ? parseEther(amt) : 0n; } catch { /* ignore */ }
  const { data: qBuy } = useReadContract({ ...c, functionName: "quoteBuy", args: [input], query: { enabled: tab === "buy" && input > 0n } });
  const { data: qSell } = useReadContract({ ...c, functionName: "quoteSell", args: [who, input], query: { enabled: tab === "sell" && input > 0n } });

  async function run(fn: () => Promise<`0x${string}`>, celebrate = false) {
    setMsg("Confirm in your wallet…");
    try {
      const h = await fn(); setMsg("Waiting for the chain…");
      await pc!.waitForTransactionReceipt({ hash: h });
      setMsg("Done ✓"); if (celebrate) setBoom(Date.now()); refetch(); setTimeout(() => setMsg(""), 3000);
    } catch (e: any) { setMsg(e?.shortMessage || e?.message || "failed"); }
  }
  const w = (functionName: any, args: any[] = [], value?: bigint) => () => writeContractAsync({ ...c, functionName, args, value } as any);
  const trade = () => tab === "buy"
    ? run(w("buy", [(((qBuy as any)?.[0] ?? 0n) * 99n) / 100n], input), true)
    : run(w("sell", [input, (((qSell as any)?.[0] ?? 0n) * 99n) / 100n]));

  async function publishAirdrop() {
    const rows = csv.trim().split("\n").map((l) => l.split(",").map((s) => s.trim())).filter((x) => x.length === 2).map(([a, v]) => [a, parseEther(v).toString()]);
    if (!rows.length) return setMsg("Add lines like 0xabc…,1000");
    const tree = StandardMerkleTree.of(rows, ["address", "uint256"]);
    const dump = JSON.stringify(tree.dump());
    localStorage.setItem(`airdrop:${chainId}:${token}`, dump);
    setMsg("Pinning list…");
    const cid = await ipfsUpload(dump).catch(() => null);
    if (cid) localStorage.setItem(`airdrop-cid:${chainId}:${token}`, cid);
    await run(w("setAirdropRoot", [tree.root]), true);
    setMsg(cid ? `Airdrop live! List pinned: ipfs://${cid}` : "Airdrop live! (IPFS key missing — list saved in this browser only)");
  }
  async function claimAirdrop() {
    let raw = localStorage.getItem(`airdrop:${chainId}:${token}`);
    if (!raw) {
      const cidIn = prompt("Paste the creator's airdrop link (ipfs://…) or tree JSON");
      if (!cidIn) return;
      raw = cidIn.startsWith("ipfs://") ? await fetch(`https://ipfs.io/ipfs/${cidIn.slice(7)}`).then((x) => x.text()) : cidIn;
    }
    const tree = StandardMerkleTree.load(JSON.parse(raw!));
    for (const [i, v] of tree.entries()) if ((v[0] as string).toLowerCase() === who.toLowerCase())
      return run(w("claimAirdrop", [BigInt(v[1] as string), tree.getProof(i)]), true);
    setMsg("You're not on this airdrop list.");
  }

  const pct = curve ? Number((sold * 10000n) / curve) / 100 : 0;
  const share = supply && bal ? Number((bal * 100000n) / supply) / 1000 : 0; // % of supply
  const level = bal > 0n ? Math.min(99, 1 + Math.floor(Math.sqrt(share * 20))) : 0;
  const quick = tab === "buy" ? ["0.01", "0.05", "0.1", "0.5"] : null;

  return (
    <div className="two">
      <Confetti fire={boom} />
      <div className="col">
        <section className="panel">
          <div className="tokhead">
            <CoinAvatar address={token} size={90} className="avatar" />
            <div>
              <h2>{name ?? "…"}</h2>
              <div className="pills"><span className="pill">${symbol}</span><span className="pill">👤 {creator ? short(creator) : "…"}</span><span className="pill">📜 {short(token)}</span></div>
            </div>
          </div>
          <div className="stats">
            <span>PRICE<b>{fmtEth(price, 9)} Ξ</b></span><span>SUPPLY<b>{fmtTok(supply)}</b></span>
            <span>PAID TO CREW<b>{fmtEth(totalDivs)} Ξ</b></span><span>MAX SUPPLY<b>{fmtTok(maxSupply)}</b></span>
          </div>
          <PriceChart trades={trades} />
          <h3>⛽ Launch progress</h3>
          <Meter value={pct} label={`${pct.toFixed(2)}% of market supply sold`} />
        </section>

        <section className="panel" style={{ marginTop: 20 }}>
          <h2>📡 Live activity</h2>
          <div className="feed">
            {trades.length === 0 && <div className="muted">No trades yet. Be the first!</div>}
            {[...trades].reverse().slice(0, 25).map((t) => (
              <div className="it" key={t.tx + t.side}><b className={t.side}>{t.side === "buy" ? "🟢 BUY" : "🔴 SELL"}</b><span>{short(t.who)}</span><span style={{ marginLeft: "auto" }}>{fmtEth(t.eth, 4)} Ξ</span></div>
            ))}
          </div>
        </section>
      </div>

      <div className="col">
        <section className="panel">
          <div className="tabs"><button className={`buy ${tab === "buy" ? "on" : ""}`} onClick={() => setTab("buy")}>🟢 Buy</button><button className={`sell ${tab === "sell" ? "on" : ""}`} onClick={() => setTab("sell")}>🔴 Sell</button></div>
          <label>{tab === "buy" ? "How much ETH?" : `How many ${symbol ?? "tokens"}?`}<input value={amt} inputMode="decimal" onChange={(e) => setAmt(e.target.value)} placeholder="0.0" /></label>
          {quick && <div className="quick">{quick.map((q) => <button key={q} onClick={() => setAmt(q)}>{q} Ξ</button>)}</div>}
          {tab === "sell" && bal > 0n && <div className="quick">{[25, 50, 100].map((p) => <button key={p} onClick={() => setAmt((Number(bal) / 1e18 * p / 100).toString())}>{p}%</button>)}</div>}
          {tab === "buy" && qBuy && <div className="quote">You get ≈ <b>{fmtTok((qBuy as any)[0])} {symbol}</b><br />Fee {fmtEth((qBuy as any)[2])} Ξ → <b>40% paid to all holders</b></div>}
          {tab === "sell" && qSell && <div className="quote">You get ≈ <b>{fmtEth((qSell as any)[0])} Ξ</b><br />Fee {fmtEth((qSell as any)[1])} Ξ · early-sell tax {fmtEth((qSell as any)[2])} Ξ → shared with the crew</div>}
          {tab === "sell" && penalty > 0n && <p className="warn">⏳ Early-sell tax is {(Number(penalty) / 100).toFixed(2)}% now. It melts to 0 within 24h of your last buy.</p>}
          <button className={`btn xl ${tab === "sell" ? "red" : ""}`} style={{ width: "100%", marginTop: 8 }} disabled={!me || input === 0n} onClick={trade}>{me ? (tab === "buy" ? "BUY!" : "SELL") : "Connect wallet"}</button>
        </section>

        {me && (
          <section className="panel" style={{ marginTop: 20 }}>
            <h2>🎒 Your crew card</h2>
            <div className="level"><div className="lv">{level}</div><Meter value={Math.min(100, share * 20)} label={`${share.toFixed(3)}% of supply`} color="var(--violet)" /></div>
            <div className="stats"><span>BALANCE<b>{fmtTok(bal)}</b></span><span>TO CLAIM<b>{fmtEth(divs)} Ξ</b></span></div>
            <button className="btn yellow" disabled={!divs || divs === 0n} onClick={() => run(w("claimDividends"), true)}>💸 Claim payout</button>
            <h3>🏅 Badges</h3>
            <div className="badges">
              <Badge emoji="🪙" title="Holder" locked={!(bal > 0n)} />
              <Badge emoji="💎" title="Diamond hands" locked={!(bal > 0n && penalty === 0n)} />
              <Badge emoji="🐋" title="Whale (1%+)" locked={!(share >= 1)} />
              <Badge emoji="🎁" title="Subscriber" locked={!done} />
              <Badge emoji="👑" title="Creator" locked={!isCreator} />
              <Badge emoji="💸" title="Earner" locked={!(divs > 0n)} />
            </div>
            {root && root !== zeroHash && !done && <button className="btn pink sm" style={{ marginTop: 12 }} onClick={claimAirdrop}>🎁 Claim subscriber airdrop</button>}
          </section>
        )}

        {isCreator && (
          <section className="panel" style={{ marginTop: 20 }}>
            <h2>🎛️ Creator console</h2>
            <div className="stats"><span>FEES<b>{fmtEth(cFees)} Ξ</b></span><span>VESTED<b>{fmtTok(vested)}</b></span><span>CLAIMED<b>{fmtTok(claimed)}</b></span></div>
            <div className="row"><button className="btn sm" onClick={() => run(w("claimCreatorFees"))}>Claim fees</button><button className="btn sm blue" onClick={() => run(w("claimVested"))}>Unlock vested</button></div>
            {root === zeroHash && <>
              <label>🎁 Subscriber airdrop<small>One "address,amount" per line. Max 10% of supply total. Can only be set once.</small><textarea rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"0xabc…,1000\n0xdef…,2500"} /></label>
              <button className="btn pink sm" onClick={publishAirdrop}>Publish airdrop</button></>}
            {meta && <p className="muted">metadata: {String(meta).slice(0, 40)}…</p>}
          </section>
        )}
      </div>
      <Toast text={msg} />
    </div>
  );
}
