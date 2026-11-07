import type { Trade } from "../lib/useTrades";

export function PriceChart({ trades }: { trades: Trade[] }) {
  const pts = trades.filter((t) => t.tokens > 0n).map((t) => Number(t.eth) / Number(t.tokens));
  if (pts.length < 2) return <div className="chart empty">📈 Chart wakes up after a couple of trades</div>;
  const w = 600, h = 180, pad = 8;
  const min = Math.min(...pts), max = Math.max(...pts);
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`${d} L${x(pts.length - 1)} ${h} L${x(0)} ${h} Z`} fill={up ? "rgba(132,204,22,.25)" : "rgba(239,68,68,.25)"} />
      <path d={d} fill="none" stroke="#111" strokeWidth="5" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={up ? "#84cc16" : "#ef4444"} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}
