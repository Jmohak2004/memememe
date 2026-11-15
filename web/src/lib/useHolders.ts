import { useEffect, useState } from "react";
import { parseAbiItem } from "viem";
import { usePublicClient, useReadContracts } from "wagmi";
import { tokenAbi } from "./abi";

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const ZERO = "0x0000000000000000000000000000000000000000";
const MAX_CANDIDATES = 200;

export type Holder = { address: `0x${string}`; balance: bigint };

/** Candidate holder addresses seen as recipients in the log window, most recent first, de-duplicated. */
export function candidatesFromRecipients(recipients: string[]): `0x${string}`[] {
  const seen = new Set<string>();
  const out: `0x${string}`[] = [];
  for (let i = recipients.length - 1; i >= 0 && out.length < MAX_CANDIDATES; i--) {
    const a = recipients[i];
    const k = a.toLowerCase();
    if (k === ZERO || seen.has(k)) continue;
    seen.add(k);
    out.push(a as `0x${string}`);
  }
  return out;
}

/**
 * Top holders by live balance. Addresses come from recent Transfer logs (bounded window, like useTrades),
 * balances are read on-chain, so the numbers are exact for the addresses found but a wallet that has
 * not received tokens inside the window can be missing. A real indexer would remove that limit.
 */
export function useHolders(token: `0x${string}`, chainId: number, top = 10, window = 40000n) {
  const pc = usePublicClient({ chainId });
  const [cands, setCands] = useState<`0x${string}`[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!pc) return;
    let dead = false;
    (async () => {
      try {
        const head = await pc.getBlockNumber();
        const logs = await pc.getLogs({ address: token, event: TRANSFER, fromBlock: head > window ? head - window : 0n, toBlock: head });
        if (!dead) setCands(candidatesFromRecipients(logs.map((l) => l.args.to!)));
      } catch { /* RPC may reject large ranges; panel stays empty */ }
    })();
    return () => { dead = true; };
  }, [pc, token, tick, window]);

  const { data } = useReadContracts({
    contracts: cands.map((a) => ({ address: token, abi: tokenAbi, chainId, functionName: "balanceOf", args: [a] } as const)),
    query: { enabled: cands.length > 0, refetchInterval: 15000 },
  });
  const holders: Holder[] = cands
    .map((address, i) => ({ address, balance: (data?.[i]?.result ?? 0n) as bigint }))
    .filter((h) => h.balance > 0n)
    .sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0))
    .slice(0, top);
  return holders;
}
