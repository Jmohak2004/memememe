import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { parseEther, parseEventLogs } from "viem";
import { FACTORIES } from "../lib/config";
import { factoryAbi } from "../lib/abi";

const DAY = 86400;

export default function Create() {
  const nav = useNavigate();
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const pc = usePublicClient();
  const factory = FACTORIES[chainId];
  const { writeContractAsync } = useWriteContract();
  const { data: fee } = useReadContract({ address: factory, abi: factoryAbi, functionName: "launchFee", chainId, query: { enabled: !!factory } });
  const [f, setF] = useState({ name: "", symbol: "", supply: "1000000000", veth: "1", vest: "90", uri: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const supply = Number(f.supply) || 0;
  const startPrice = supply ? Number(f.veth) / (supply * 0.8 * 1.25) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const hash = await writeContractAsync({ address: factory!, abi: factoryAbi, functionName: "createToken", chainId,
        args: [f.name, f.symbol, parseEther(f.supply), parseEther(f.veth), BigInt(Number(f.vest) * DAY), f.uri], value: fee ?? 0n });
      const rcpt = await pc!.waitForTransactionReceipt({ hash });
      const ev = rcpt.logs.find((l) => l.address.toLowerCase() === factory!.toLowerCase());
      const topicAddr = ev?.topics[1] ? ("0x" + ev.topics[1].slice(26)) : undefined;
      nav(topicAddr ? `/token/${chainId}/${topicAddr}` : "/");
    } catch (x: any) { setErr(x?.shortMessage || x?.message || "failed"); }
    setBusy(false);
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Launch a creator coin</h2>
      <label>Name<input required maxLength={48} value={f.name} onChange={set("name")} /></label>
      <label>Symbol<input required maxLength={12} value={f.symbol} onChange={set("symbol")} /></label>
      <label>Total supply (you choose, 1M – 1T)<input required type="number" min="1000000" max="1000000000000" value={f.supply} onChange={set("supply")} /></label>
      <label>Starting virtual ETH (sets launch price)<input required type="number" step="0.01" min="0.01" value={f.veth} onChange={set("veth")} /></label>
      <label>Your allocation vests over (days, min 7)<input required type="number" min="7" value={f.vest} onChange={set("vest")} /></label>
      <label>Metadata URI (image / socials JSON)<input value={f.uri} onChange={set("uri")} placeholder="ipfs://…" /></label>
      <div className="note">
        <b>How supply is split:</b> 80% sold on the bonding curve · 10% yours, vesting linearly · 10% for your subscribers via airdrop.<br />
        Starting price ≈ {startPrice.toExponential(2)} ETH. Trade fee 1%: 40% you, 40% all holders, 20% protocol.
      </div>
      {err && <p className="warn">{err}</p>}
      <button className="btn" disabled={!isConnected || !factory || busy}>{!isConnected ? "Connect wallet" : busy ? "Launching…" : "Launch"}</button>
    </form>
  );
}
