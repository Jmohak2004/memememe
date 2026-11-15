import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVT = "cc:watchlist";
const key = (chainId: number) => `cc:watch:${chainId}`;

const isAddr = (a: unknown): a is `0x${string}` => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
const raw = (chainId: number) => { try { return localStorage.getItem(key(chainId)) ?? "[]"; } catch { return "[]"; } };

function parse(json: string): `0x${string}`[] {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v.filter(isAddr) : []; } catch { return []; }
}

function write(chainId: number, list: string[]) {
  try { localStorage.setItem(key(chainId), JSON.stringify(list)); } catch { /* storage may be blocked */ }
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}

/** Per-chain watchlist kept in this browser's localStorage, synced across components and tabs. */
export function useWatchlist(chainId: number) {
  // The serialized string is the snapshot so useSyncExternalStore sees a stable value between changes.
  const snap = useSyncExternalStore(subscribe, () => raw(chainId), () => "[]");
  const list = useMemo(() => parse(snap), [snap]);
  const has = useCallback((a: string) => list.some((x) => x.toLowerCase() === a.toLowerCase()), [list]);
  const toggle = useCallback((a: `0x${string}`) => {
    const cur = parse(raw(chainId));
    const on = cur.some((x) => x.toLowerCase() === a.toLowerCase());
    write(chainId, on ? cur.filter((x) => x.toLowerCase() !== a.toLowerCase()) : [...cur, a]);
  }, [chainId]);
  return { list, has, toggle };
}
