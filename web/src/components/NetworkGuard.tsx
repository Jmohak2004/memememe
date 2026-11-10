import { useAccount, useSwitchChain } from "wagmi";
import { FACTORIES } from "../lib/config";

/** Warns when the wallet is on an unsupported chain and offers one-click switching. */
export function NetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { chains, switchChain, isPending } = useSwitchChain();
  if (!isConnected || (chainId !== undefined && chainId in FACTORIES)) return null;
  return (
    <div className="faucet" style={{ background: "var(--pink)" }}>
      🛰️ Wrong network. Switch to:
      {chains.map((c) => (
        <button key={c.id} className="btn sm yellow" disabled={isPending} onClick={() => switchChain({ chainId: c.id })}>{c.name}</button>
      ))}
    </div>
  );
}
