import { useWatchlist } from "../lib/useWatchlist";

export function StarButton({ address, chainId, className = "star", withText = false }: { address: `0x${string}`; chainId: number; className?: string; withText?: boolean }) {
  const { has, toggle } = useWatchlist(chainId);
  const on = has(address);
  return (
    <button type="button" className={on ? `${className} on` : className} aria-pressed={on}
      aria-label={on ? "Remove from watchlist" : "Add to watchlist"} title={on ? "Watching" : "Add to watchlist"}
      onClick={() => toggle(address)}>{withText ? (on ? "★ Watching" : "☆ Watch") : on ? "★" : "☆"}</button>
  );
}
