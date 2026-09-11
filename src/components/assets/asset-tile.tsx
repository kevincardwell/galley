"use client";
import { memo } from "react";
import { clsx } from "@/lib/clsx";
import { formatDuration } from "@/lib/media/mime";
import type { AssetItem } from "@/lib/media/types";
import { fileUrl } from "./urls";

export function KindIcon({ kind, className }: { kind: "video" | "pdf" | "image"; className?: string }) {
  if (kind === "pdf") {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
        <path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5" /><path d="M9 14h6M9 17h4" />
      </svg>
    );
  }
  if (kind === "video") {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
        <rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.5" />
    </svg>
  );
}

type Props = { asset: AssetItem; selected: boolean; onSelect: (id: string) => void; onOpen: (id: string) => void };

export const AssetTile = memo(function AssetTile({ asset, selected, onSelect, onOpen }: Props) {
  const ratio = asset.width && asset.height ? `${asset.width} / ${asset.height}` : asset.kind === "video" ? "16 / 9" : asset.kind === "pdf" ? "3 / 4" : "4 / 3";
  const pending = !asset.processedAt && !asset.processError;
  const hasThumb = asset.kind === "image" || (asset.kind === "video" && !!asset.processedAt && !asset.processError);
  return (
    <button
      type="button"
      data-asset-id={asset.id}
      aria-pressed={selected}
      aria-label={asset.filename}
      title={asset.filename}
      onClick={() => onSelect(asset.id)}
      onDoubleClick={() => onOpen(asset.id)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onOpen(asset.id); } }}
      className={clsx(
        "group relative mb-2.5 block w-full overflow-hidden rounded-r border border-line-2 bg-surface-2 text-left transition-[outline-color] duration-150 [break-inside:avoid]",
        selected ? "outline outline-2 outline-offset-1 outline-accent" : "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
      )}
      style={{ aspectRatio: ratio }}
    >
      {hasThumb ? (
         
        <img
          src={fileUrl(asset, "thumb")}
          alt=""
          loading="lazy"
          decoding="async"
          width={asset.width ?? undefined}
          height={asset.height ?? undefined}
          className={clsx("absolute inset-0 size-full object-cover transition-opacity duration-150", pending && "opacity-70")}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-ink-3">
          <KindIcon kind={asset.kind} />
          <span className="line-clamp-2 max-w-full break-all text-center text-xs text-ink-2">{asset.filename}</span>
          {asset.processError && asset.kind !== "pdf" && <span className="text-[11px] text-late">Could not process</span>}
        </div>
      )}
      {pending && <span className="absolute right-2 top-2 rounded-full bg-black/55 px-1.5 py-px text-[10px] font-medium text-white">Processing</span>}
      {asset.kind === "video" && asset.durationMs != null && (
        <span className="tnum absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-px text-[11px] text-white">{formatDuration(asset.durationMs)}</span>
      )}
      {hasThumb && (
        <span
          className={clsx(
            "pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-5 text-xs text-white transition-opacity duration-150",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {asset.filename}
        </span>
      )}
    </button>
  );
});
