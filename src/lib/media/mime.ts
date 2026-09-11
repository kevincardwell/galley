import type { AssetKind } from "./types";

// The extension is the source of truth: browsers report inconsistent MIME types for .mov and .avif.
export const ACCEPTED: Record<string, { mime: string; kind: AssetKind }> = {
  ".jpg": { mime: "image/jpeg", kind: "image" },
  ".jpeg": { mime: "image/jpeg", kind: "image" },
  ".png": { mime: "image/png", kind: "image" },
  ".webp": { mime: "image/webp", kind: "image" },
  ".gif": { mime: "image/gif", kind: "image" },
  ".avif": { mime: "image/avif", kind: "image" },
  ".svg": { mime: "image/svg+xml", kind: "image" },
  ".mp4": { mime: "video/mp4", kind: "video" },
  ".webm": { mime: "video/webm", kind: "video" },
  ".mov": { mime: "video/quicktime", kind: "video" },
  ".pdf": { mime: "application/pdf", kind: "pdf" },
};

/** Value for `<input accept>`. */
export const ACCEPT_ATTR = Object.keys(ACCEPTED).join(",");

export const ACCEPTED_SUMMARY = "jpg, png, webp, gif, svg, avif, mp4, webm, mov and pdf";

export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

/** Classifies an upload by its extension; null when the type is not accepted. */
export function describeFile(filename: string): { ext: string; mime: string; kind: AssetKind } | null {
  const ext = extOf(filename);
  const hit = ACCEPTED[ext];
  return hit ? { ext, ...hit } : null;
}

/** Canonical extension for a stored MIME type. Renaming an asset never moves its files, so this is stable. */
export function extForMime(mime: string): string {
  for (const [ext, v] of Object.entries(ACCEPTED)) if (v.mime === mime) return ext;
  return "";
}

/** Strip path separators and control characters from a client-supplied filename. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.slice(0, 180) || "file";
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = h ? String(m % 60).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s % 60).padStart(2, "0")}`;
}
