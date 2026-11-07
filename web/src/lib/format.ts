import { formatEther } from "viem";
export const fmtEth = (v?: bigint, d = 5) => (v === undefined ? "–" : Number(formatEther(v)).toLocaleString(undefined, { maximumFractionDigits: d }));
export const fmtTok = (v?: bigint) => (v === undefined ? "–" : Number(formatEther(v)).toLocaleString(undefined, { maximumFractionDigits: 2 }));
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
