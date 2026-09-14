"use client";
import { memo } from "react";
import { clsx } from "@/lib/clsx";
import { formatBytes } from "@/lib/format";
import { formatDuration } from "@/lib/media/mime";
import type { AssetItem, AssetKind } from "@/lib/media/types";
import { Icon, type IconName } from "@/components/ui/icon";
import { fileUrl } from "./urls";

/** One alphabet for file kinds, shared by the tiles, the filter bar and the picker. */
export const KIND_ICON: Record<AssetKind, IconName> = { image: "image", video: "play", pdf: "file" };
export const KIND_LABEL: Record<AssetKind, string> = { image: "Image", video: "Video", pdf: "PDF" };

export function KindIcon({ kind, size = 22, className }: { kind: AssetKind; size?: number; className?: string }) {
  return <Icon name={KIND_ICON[kind]} size={size} className={className} />;
}

type Props = { asset: AssetItem; selected: boolean; onSelect: (id: string) => void; onOpen: (id: string) => void };

export const AssetTile = memo(function AssetTile({ asset, selected, onSelect, onOpen }: Props) {
  const ratio = asset.width && asset.height ? `${asset.width} / ${asset.height}` : asset.kind === "video" ? "16 / 9" : asset.kind === "pdf" ? "3 / 4" : "4 / 3";
  const pending = !asset.processedAt && !asset.processError;
  // Images were trusted to have a thumbnail whether or not processing had
  // succeeded, so a failure rendered the browser's broken-image glyph instead of
  // the icon and the "Could not process" note below. Videos already checked.
  const hasThumb = (asset.kind === "image" || asset.kind === "video") && !!asset.processedAt && !asset.processError;
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
        "group relative mb-2.5 block w-full cursor-pointer overflow-hidden rounded-r border bg-surface-2 text-left transition-colors duration-150 [break-inside:avoid]",
        selected
          ? "border-accent-line outline outline-2 outline-offset-1 outline-accent"
          : "border-line-2 outline-none hover:border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
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
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex flex-col gap-1.5 bg-surface-2 p-2.5">
          <Icon name={KIND_ICON[asset.kind]} size={18} className="text-ink-3" />
          <span className="mt-auto line-clamp-3 break-all text-[13px] leading-snug font-medium text-ink">{asset.filename}</span>
          <span className="tnum text-[11px] text-ink-3">
            {KIND_LABEL[asset.kind]} · {formatBytes(asset.bytes)}
          </span>
          {asset.processError && asset.kind !== "pdf" && <span className="text-[11px] text-late">Could not process</span>}
        </span>
      )}

      {asset.kind === "video" && (
        <span className="tnum absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/75 px-1.5 py-0.5 text-[11px] font-medium text-surface">
          <Icon name="play" size={9} strokeWidth={2.5} />
          {formatDuration(asset.durationMs) || "Video"}
        </span>
      )}

      {pending && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-0 animate-pulse bg-surface-2/75" />
          <span className="absolute top-2 right-2 rounded-full bg-ink/75 px-1.5 py-px text-[10px] font-medium text-surface">Processing</span>
        </>
      )}

      {hasThumb && (
        <span
          className={clsx(
            "pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-ink/75 to-transparent px-2 pt-6 pb-1.5 text-xs font-medium text-surface transition-opacity duration-150",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {asset.filename}
        </span>
      )}
    </button>
  );
});
