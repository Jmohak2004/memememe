import { useAccount } from "wagmi";
import { FAUCETS } from "../lib/config";

export function FaucetBar() {
  const { chainId } = useAccount();
  const links = chainId ? FAUCETS[chainId] : undefined;
  if (!links) return null;
  return (
    <div className="faucet">Need testnet ETH? {links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label}</a>)}</div>
  );
}
