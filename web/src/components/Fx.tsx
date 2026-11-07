import { useEffect, useState } from "react";

export function Stars() {
  return <div className="stars" aria-hidden><i /><i /><i /></div>;
}

export function Ticker({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="ticker"><div className="track">{row.map((t, i) => <span key={i}>{t}</span>)}</div></div>
  );
}

const CONF = ["#facc15", "#ef4444", "#22c55e", "#3b82f6", "#ec4899", "#fff"];
export function Confetti({ fire }: { fire: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => { if (!fire) return; setOn(true); const t = setTimeout(() => setOn(false), 1800); return () => clearTimeout(t); }, [fire]);
  if (!on) return null;
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 48 }, (_, i) => (
        <b key={i} style={{ left: `${(i * 37) % 100}%`, background: CONF[i % CONF.length], animationDelay: `${(i % 8) * 0.05}s`, ["--dx" as any]: `${((i * 53) % 200) - 100}px` }} />
      ))}
    </div>
  );
}

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return <div className="toast">{text}</div>;
}

export function Meter({ value, label, color = "var(--lime)" }: { value: number; label?: string; color?: string }) {
  return (
    <div className="meter"><i style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} /><span>{label}</span></div>
  );
}

export function Badge({ emoji, title, locked }: { emoji: string; title: string; locked?: boolean }) {
  return <div className={`badge ${locked ? "locked" : ""}`} title={title}><span>{emoji}</span><small>{title}</small></div>;
}
