"use client";
import { initials } from "@/lib/format";
import type { Peer } from "@/lib/collab/client";

const MAX_SHOWN = 6;

/** Who else has this page open: small initials in a coloured ring, names on hover. */
export function Presence({ peers }: { peers: Peer[] }) {
  if (peers.length === 0) return null;
  const shown = peers.slice(0, MAX_SHOWN);
  const extra = peers.length - shown.length;
  const names = peers.map((p) => p.name).join(", ");
  return (
    <span className="inline-flex items-center -space-x-1" title={names} aria-label={`Also here: ${names}`}>
      {shown.map((p) => (
        <span
          key={p.clientId}
          className="inline-grid size-[22px] place-items-center rounded-full border-2 border-surface bg-surface-2 text-[9px] font-semibold text-ink"
          style={{ boxShadow: `0 0 0 1.5px ${p.color}` }}
        >
          {initials(p.name)}
        </span>
      ))}
      {extra > 0 && <span className="ml-1.5 text-xs font-medium text-ink-3">+{extra}</span>}
    </span>
  );
}
