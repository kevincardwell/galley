import "server-only";
import { storage, type Variant } from "@/lib/storage";
import { extForMime } from "./mime";

type Located = { id: string; workspaceId: string; mime: string };

/** Extension a variant is stored with. SVG previews are the original SVG; everything else derived is WebP. */
export function variantExt(asset: Pick<Located, "mime">, variant: Variant): string {
  if (variant === "original") return extForMime(asset.mime);
  if (variant === "preview" && asset.mime === "image/svg+xml") return ".svg";
  return ".webp";
}

export function variantMime(asset: Pick<Located, "mime">, variant: Variant): string {
  if (variant === "original") return asset.mime;
  if (variant === "preview" && asset.mime === "image/svg+xml") return "image/svg+xml";
  return "image/webp";
}

export function variantPath(asset: Located, variant: Variant): string {
  return storage.pathFor(asset.workspaceId, asset.id, variant, variantExt(asset, variant));
}
