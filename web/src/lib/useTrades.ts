import { useEffect, useState } from "react";
import { parseAbiItem } from "viem";
import { usePublicClient } from "wagmi";

export type Trade = { side: "buy" | "sell"; who: `0x${string}`; eth: bigint; tokens: bigint; block: bigint; tx: string };
const BOUGHT = parseAbiItem("event Bought(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 fee)");
const SOLD = parseAbiItem("event Sold(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 fee, uint256 penalty)");

/** Pulls recent trades from logs. Public RPCs cap getLogs ranges, so we scan a bounded window. */
export function useTrades(token: `0x${string}`, chainId: number, window = 40000n) {
  const pc = usePublicClient({ chainId });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 10000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!pc) return;
    let dead = false;
    (async () => {
      try {
        const head = await pc.getBlockNumber();
        const fromBlock = head > window ? head - window : 0n;
        const [b, s] = await Promise.all([
          pc.getLogs({ address: token, event: BOUGHT, fromBlock, toBlock: head }),
          pc.getLogs({ address: token, event: SOLD, fromBlock, toBlock: head }),
        ]);
        const all: Trade[] = [
          ...b.map((l) => ({ side: "buy" as const, who: l.args.buyer!, eth: l.args.ethIn!, tokens: l.args.tokensOut!, block: l.blockNumber, tx: l.transactionHash })),
          ...s.map((l) => ({ side: "sell" as const, who: l.args.seller!, eth: l.args.ethOut!, tokens: l.args.tokensIn!, block: l.blockNumber, tx: l.transactionHash })),
        ].sort((x, y) => Number(x.block - y.block));
        if (!dead) setTrades(all);
      } catch { /* RPC may reject large ranges; UI degrades gracefully */ }
    })();
    return () => { dead = true; };
  }, [pc, token, tick, window]);
  return trades;
}
