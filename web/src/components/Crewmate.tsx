const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#ec4899", "#f97316", "#facc15", "#14b8a6", "#a855f7", "#e5e7eb", "#78350f"];
export const crewColor = (seed: string | number) => {
  const n = typeof seed === "number" ? seed : parseInt(seed.slice(2, 10) || "0", 16);
  return COLORS[n % COLORS.length];
};
export const COLOR_LIST = COLORS;
const HATS = ["none", "cap", "crown", "sprout", "horns", "halo"] as const;
export const hatFor = (seed: string) => HATS[parseInt(seed.slice(10, 14) || "0", 16) % HATS.length];

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Original "little astronaut" mascot (not any official artwork). */
export function Crewmate({ color = "#ef4444", hat = "none", size = 96, wave = false, dead = false }:
  { color?: string; hat?: string; size?: number; wave?: boolean; dead?: boolean }) {
  const dark = shade(color, -60);
  return (
    <svg className={wave ? "crew bob" : "crew"} width={size} height={size * 1.1} viewBox="0 0 100 110" aria-hidden>
      <ellipse cx="50" cy="104" rx="26" ry="5" fill="rgba(0,0,0,.25)" />
      {/* backpack */}
      <rect x="6" y="46" width="16" height="36" rx="7" fill={dark} stroke="#111" strokeWidth="4" />
      {/* legs */}
      <rect x="28" y="78" width="18" height="24" rx="8" fill={color} stroke="#111" strokeWidth="4" />
      <rect x="54" y="78" width="18" height="24" rx="8" fill={color} stroke="#111" strokeWidth="4" />
      {/* body */}
      <path d="M24 40 Q24 10 52 10 Q80 10 80 40 L80 78 Q80 86 72 86 L32 86 Q24 86 24 78 Z" fill={color} stroke="#111" strokeWidth="4" />
      <path d="M30 70 Q30 80 38 80" stroke="rgba(255,255,255,.45)" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* visor */}
      <rect x="44" y="26" width="42" height="26" rx="13" fill="#bfe9ff" stroke="#111" strokeWidth="4" />
      <ellipse cx="60" cy="34" rx="9" ry="4" fill="#fff" opacity=".85" />
      {dead && <path d="M56 36l8 8m0-8l-8 8" stroke="#111" strokeWidth="3" />}
      {/* hats */}
      {hat === "cap" && <path d="M28 20 Q52 -2 76 20 Z M70 18 h20" fill="#facc15" stroke="#111" strokeWidth="4" strokeLinejoin="round" />}
      {hat === "crown" && <path d="M32 14 L36 -2 L46 8 L52 -4 L58 8 L68 -2 L72 14 Z" fill="#facc15" stroke="#111" strokeWidth="4" strokeLinejoin="round" />}
      {hat === "sprout" && <path d="M52 10 Q52 -4 44 -6 M52 10 Q54 -2 64 -4" stroke="#16a34a" strokeWidth="5" fill="none" strokeLinecap="round" />}
      {hat === "horns" && <path d="M32 18 L28 2 L42 12 M72 18 L76 2 L62 12" fill="#ef4444" stroke="#111" strokeWidth="4" strokeLinejoin="round" />}
      {hat === "halo" && <ellipse cx="52" cy="2" rx="18" ry="5" fill="none" stroke="#facc15" strokeWidth="5" />}
    </svg>
  );
}
