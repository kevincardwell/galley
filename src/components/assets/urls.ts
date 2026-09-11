import type { AssetKind } from "@/lib/media/types";

type Variant = "original" | "thumb" | "preview" | "poster";

/** Variant URL with a cache-buster so a thumb that fell back to the original refreshes once processing lands. */
export function fileUrl(asset: { id: string; processedAt: number | null }, variant: Variant, extra?: Record<string, string>): string {
  const q = new URLSearchParams({ v: String(asset.processedAt ?? 0), ...extra });
  return `/api/file/${asset.id}/${variant}?${q}`;
}

/** The URL the lightbox and detail preview should show for a given kind. */
export function previewUrl(asset: { id: string; kind: AssetKind; processedAt: number | null }): string {
  if (asset.kind === "image") return fileUrl(asset, "preview");
  return fileUrl(asset, "original");
}
