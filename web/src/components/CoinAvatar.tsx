import { Crewmate, crewColor, hatFor } from "./Crewmate";
export function CoinAvatar({ address, size = 60, className = "avatar" }: { address: string; size?: number; className?: string }) {
  const c = crewColor(address);
  return <div className={className} style={{ background: `linear-gradient(135deg,${c}55,#fff)` }}><Crewmate color={c} hat={hatFor(address)} size={size} /></div>;
}
