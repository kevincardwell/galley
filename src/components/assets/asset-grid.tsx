"use client";
import type { AssetItem } from "@/lib/media/types";
import { AssetTile } from "./asset-tile";

type Props = { items: AssetItem[]; selectedId: string | null; onSelect: (id: string) => void; onOpen: (id: string) => void };

/** Masonry via CSS columns; each tile reserves its aspect ratio so nothing jumps when thumbs land. */
export function AssetGrid({ items, selectedId, onSelect, onOpen }: Props) {
  return (
    <div className="[column-gap:10px] [columns:150px]" role="list" aria-label="Files">
      {items.map((a) => (
        <div key={a.id} role="listitem" className="[break-inside:avoid]">
          <AssetTile asset={a} selected={a.id === selectedId} onSelect={onSelect} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}
