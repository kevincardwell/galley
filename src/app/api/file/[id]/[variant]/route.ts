import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { currentUser } from "@/lib/auth/current";
import { accessFor } from "@/lib/permissions";
import type { Variant } from "@/lib/storage";
import { variantExt, variantMime, variantPath } from "@/lib/media/paths";

const VARIANTS: readonly Variant[] = ["original", "thumb", "preview", "poster"];
const isVariant = (v: string): v is Variant => (VARIANTS as readonly string[]).includes(v);

const notFound = () => new Response(null, { status: 404 });

/** RFC 6266 disposition with an ASCII fallback and a UTF-8 `filename*`. */
function disposition(kind: "inline" | "attachment", filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null | "bad" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "bad";
  const [, a, b] = m;
  if (a === "" && b === "") return "bad";
  if (a === "") {
    const suffix = Math.min(Number(b), size);
    return suffix === 0 ? "bad" : { start: size - suffix, end: size - 1 };
  }
  const start = Number(a);
  const end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  if (start > end || start >= size) return "bad";
  return { start, end };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await params;
  if (!isVariant(variant)) return notFound();

  const asset = db.select().from(schema.assets).where(eq(schema.assets.id, id)).get();
  if (!asset) return notFound();

  // Access: a signed-in member, or the workspace's share token.
  const url = new URL(req.url);
  const share = url.searchParams.get("share");
  let allowed = false;
  if (share) {
    const ws = db.select({ token: schema.workspaces.shareToken }).from(schema.workspaces).where(eq(schema.workspaces.id, asset.workspaceId)).get();
    allowed = !!ws?.token && ws.token === share;
  }
  if (!allowed) {
    const user = await currentUser();
    allowed = !!user && !!accessFor(user, asset.workspaceId);
  }
  if (!allowed) return notFound();

  // Resolve the file, falling back while derived variants are still being made.
  let served: Variant = variant;
  let file = variantPath(asset, served);
  if (!fs.existsSync(file)) {
    if (variant === "thumb" && asset.kind === "video" && fs.existsSync(variantPath(asset, "poster"))) served = "poster";
    else if ((variant === "thumb" || variant === "preview") && asset.kind === "image") served = "original";
    else return notFound();
    file = variantPath(asset, served);
    if (!fs.existsSync(file)) return notFound();
  }

  const stat = await fsp.stat(file);
  const etag = `"${asset.id}-${served}-${asset.processedAt ?? 0}-${stat.size}"`;
  const download = url.searchParams.get("download") === "1";
  const base = asset.filename.replace(/\.[^.]+$/, "");
  const filename = served === "original" ? asset.filename : `${base}-${served}${variantExt(asset, served)}`;

  const headers = new Headers({
    "content-type": variantMime(asset, served),
    "content-disposition": disposition(download ? "attachment" : "inline", filename),
    "cache-control": "private, max-age=3600",
    "accept-ranges": "bytes",
    etag,
    "last-modified": stat.mtime.toUTCString(),
  });
  if (asset.mime === "image/svg+xml" && served !== "thumb") headers.set("content-security-policy", "script-src 'none'");

  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const range = parseRange(req.headers.get("range"), stat.size);
  if (range === "bad") {
    headers.set("content-range", `bytes */${stat.size}`);
    return new Response(null, { status: 416, headers });
  }
  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${stat.size}`);
    headers.set("content-length", String(range.end - range.start + 1));
    const stream = fs.createReadStream(file, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
  }

  headers.set("content-length", String(stat.size));
  if (req.method === "HEAD") return new Response(null, { status: 200, headers });
  const stream = fs.createReadStream(file);
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers });
}

export const HEAD = GET;
