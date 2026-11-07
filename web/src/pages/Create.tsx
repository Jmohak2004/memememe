import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { FACTORIES } from "../lib/config";
import { factoryAbi } from "../lib/abi";
import { COLOR_LIST, Crewmate } from "../components/Crewmate";
import { Confetti, Toast } from "../components/Fx";

const DAY = 86400;
const HATS = ["none", "cap", "crown", "sprout", "horns", "halo"];
const fmtBig = (n: number) => n >= 1e12 ? `${(n / 1e12).toFixed(1)}T` : n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : `${(n / 1e6).toFixed(0)}M`;

export default function Create() {
  const nav = useNavigate();
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const pc = usePublicClient();
  const factory = FACTORIES[chainId];
  const { writeContractAsync } = useWriteContract();
  const { data: fee } = useReadContract({ address: factory, abi: factoryAbi, functionName: "launchFee", chainId, query: { enabled: !!factory } });
  const [f, setF] = useState({ name: "", symbol: "", exp: 9, veth: "1", vest: 90, uri: "" });
  const [look, setLook] = useState({ color: COLOR_LIST[0], hat: "crown" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [boom, setBoom] = useState(0);
  const supply = Math.pow(10, f.exp);
  const startPrice = Number(f.veth) / (supply * 0.8 * 1.25);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("Confirm in your wallet…");
    try {
      const meta = f.uri || `data:application/json,${encodeURIComponent(JSON.stringify({ color: look.color, hat: look.hat }))}`;
      const hash = await writeContractAsync({ address: factory!, abi: factoryAbi, functionName: "createToken", chainId,
        args: [f.name, f.symbol.toUpperCase(), parseEther(String(supply)), parseEther(f.veth), BigInt(f.vest * DAY), meta], value: fee ?? 0n });
      setMsg("Launching…");
      const rcpt = await pc!.waitForTransactionReceipt({ hash });
      const ev = rcpt.logs.find((l) => l.address.toLowerCase() === factory!.toLowerCase());
      const addr = ev?.topics[1] ? "0x" + ev.topics[1].slice(26) : undefined;
      setBoom(Date.now()); setMsg("🎉 Coin launched!");
      setTimeout(() => nav(addr ? `/token/${chainId}/${addr}` : "/"), 1500);
    } catch (x: any) { setMsg(x?.shortMessage || x?.message || "Something went wrong"); }
    setBusy(false);
  }

  return (
    <form className="build" onSubmit={submit}>
      <Confetti fire={boom} />
      <div className="panel">
        <h2>🛠️ Build your coin</h2>
        <p className="muted">Three quick steps. You can't break anything.</p>
        <h3>1 · Name it</h3>
        <label>Coin name<input required maxLength={48} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Space Cat" /></label>
        <label>Ticker<input required maxLength={12} value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })} placeholder="MEOW" /></label>
        <h3>2 · Style it</h3>
        <div className="swatches">{COLOR_LIST.map((c) => <div key={c} className={`swatch ${look.color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setLook({ ...look, color: c })} />)}</div>
        <div className="hats">{HATS.map((h) => <button type="button" key={h} className={look.hat === h ? "on" : ""} onClick={() => setLook({ ...look, hat: h })}>{h}</button>)}</div>
        <h3>3 · Tune it</h3>
        <label>Total supply: <b>{fmtBig(supply)}</b> tokens<small>You choose. 1M to 1T.</small>
          <input type="range" min={6} max={12} step={0.5} value={f.exp} onChange={(e) => setF({ ...f, exp: Number(e.target.value) })} /></label>
        <label>Launch size (virtual ETH): <b>{f.veth}</b><small>Bigger = pricier start and slower climb. Start price ≈ {startPrice.toExponential(2)} ETH</small>
          <input type="range" min={0.1} max={100} step={0.1} value={f.veth} onChange={(e) => setF({ ...f, veth: e.target.value })} /></label>
        <label>Your tokens unlock over: <b>{f.vest} days</b><small>Longer = more trust from holders. Min 7.</small>
          <input type="range" min={7} max={365} value={f.vest} onChange={(e) => setF({ ...f, vest: Number(e.target.value) })} /></label>
        <div className="split"><div style={{ width: "80%", background: "#a3e635" }}>80% market</div><div style={{ width: "10%", background: "#ffd23f" }}>10% you</div><div style={{ width: "10%", background: "#ff5fa2" }}>10% fans</div></div>
        <p className="muted">Trading fee 1% → 40% you · 40% all holders · 20% protocol.</p>
        {!factory && <p className="warn">Factory not configured for this chain yet.</p>}
        <button className="btn xl" disabled={!isConnected || !factory || busy}>{!isConnected ? "Connect wallet first" : busy ? "…" : "🚀 Launch!"}</button>
      </div>
      <aside className="panel preview">
        <div className="avatar" style={{ background: `linear-gradient(135deg,${look.color}66,#fff)` }}><Crewmate size={110} color={look.color} hat={look.hat} wave /></div>
        <h2>{f.name || "Your Coin"}</h2>
        <span className="pill">${(f.symbol || "TICK").toUpperCase()}</span>
        <div className="stats"><span>Supply<b>{fmtBig(supply)}</b></span><span>Vest<b>{f.vest}d</b></span></div>
      </aside>
      <Toast text={msg} />
    </form>
  );
}
