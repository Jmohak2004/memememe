import { useState } from "react";
import { short } from "../lib/format";
import { explorerAddr } from "../lib/config";

/** Address pill: click to copy, small link to the block explorer. */
export function CopyChip({ value, chainId, icon }: { value: string; chainId: number; icon: string }) {
  const [ok, setOk] = useState(false);
  const url = explorerAddr(chainId, value);
  return (
    <span className="pill chip">
      <button type="button" onClick={() => { navigator.clipboard?.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }).catch(() => {}); }}>
        {icon} {ok ? "copied!" : short(value)}
      </button>
      {url && <a href={url} target="_blank" rel="noreferrer" title="Open in explorer">↗</a>}
    </span>
  );
}
