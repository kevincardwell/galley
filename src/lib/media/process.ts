import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Asset } from "@/db/schema";
import { enqueue } from "./queue";
import { extractPalette } from "./palette";
import { variantPath } from "./paths";

const run = promisify(execFile);

const THUMB = 320;
const PREVIEW = 1600;

type Patch = Partial<Pick<Asset, "width" | "height" | "durationMs" | "palette" | "processError">>;

const nowS = () => Math.floor(Date.now() / 1000);

/** Generate derived files and metadata for one asset. Safe to call twice; never throws. */
export async function processAsset(assetId: string): Promise<void> {
  const asset = db.select().from(schema.assets).where(eq(schema.assets.id, assetId)).get();
  if (!asset) return;
  const original = variantPath(asset, "original");
  if (!fs.existsSync(original)) {
    db.update(schema.assets).set({ processError: "The original file is missing" }).where(eq(schema.assets.id, assetId)).run();
    return;
  }
  try {
    const patch: Patch =
      asset.kind === "image" ? await processImage(asset, original) : asset.kind === "video" ? await processVideo(asset, original) : {};
    db.update(schema.assets)
      .set({ processError: null, ...patch, processedAt: nowS() })
      .where(eq(schema.assets.id, assetId))
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[media] ${asset.filename}: ${message}`);
    db.update(schema.assets).set({ processError: message.slice(0, 400) }).where(eq(schema.assets.id, assetId)).run();
  }
}

/** Put an asset on the queue. Returns false if it was already queued. */
export function enqueueAsset(assetId: string) {
  return enqueue(assetId, () => processAsset(assetId));
}

// ---- images ----

async function processImage(asset: Asset, original: string): Promise<Patch> {
  const isSvg = asset.mime === "image/svg+xml";
  // Density only affects rasterising; read metadata without it so SVG dimensions are the intrinsic ones.
  const input = () => sharp(original, { failOn: "none", density: isSvg ? 144 : undefined }).rotate();
  const meta = await sharp(original, { failOn: "none" }).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? null;
  const height = (swap ? meta.width : meta.height) ?? null;

  await input().resize({ width: THUMB, height: THUMB, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(variantPath(asset, "thumb"));
  if (isSvg) await fsp.copyFile(original, variantPath(asset, "preview"));
  else await input().resize({ width: PREVIEW, height: PREVIEW, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toFile(variantPath(asset, "preview"));

  const raw = await input().resize(16, 16, { fit: "fill" }).removeAlpha().toColourspace("srgb").raw().toBuffer();
  const palette = extractPalette(raw, 5);
  return { width, height, palette };
}

// ---- video ----

type Probe = {
  format?: { duration?: string };
  streams?: { codec_type?: string; width?: number; height?: number; tags?: { rotate?: string }; side_data_list?: { rotation?: number }[] }[];
};

function isMissingBinary(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

async function processVideo(asset: Asset, original: string): Promise<Patch> {
  let probe: Probe;
  try {
    const { stdout } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", original], { maxBuffer: 4 * 1024 * 1024 });
    probe = JSON.parse(stdout) as Probe;
  } catch (err) {
    if (isMissingBinary(err)) return { processError: "ffmpeg is not installed on the server, so there is no poster frame" };
    throw err;
  }
  const video = probe.streams?.find((s) => s.codec_type === "video");
  const rotation = Math.abs(Number(video?.tags?.rotate ?? video?.side_data_list?.find((d) => d.rotation != null)?.rotation ?? 0)) % 180;
  const swap = rotation === 90;
  const width = (swap ? video?.height : video?.width) ?? null;
  const height = (swap ? video?.width : video?.height) ?? null;
  const seconds = Number(probe.format?.duration ?? 0);
  const durationMs = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null;

  // Grab one frame as PNG on stdout, then let sharp make the WebP variants so we do not depend on ffmpeg's encoder set.
  const at = durationMs && durationMs > 1500 ? "1" : "0";
  let frame: Buffer;
  try {
    const { stdout } = await run(
      "ffmpeg",
      ["-v", "error", "-ss", at, "-i", original, "-frames:v", "1", "-vf", `scale='min(${PREVIEW},iw)':-2`, "-f", "image2pipe", "-vcodec", "png", "-"],
      { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
    );
    frame = stdout;
  } catch (err) {
    if (isMissingBinary(err)) return { width, height, durationMs, processError: "ffmpeg is not installed on the server, so there is no poster frame" };
    throw err;
  }
  if (frame.length === 0) return { width, height, durationMs, processError: "ffmpeg could not decode a poster frame" };
  await sharp(frame).webp({ quality: 84 }).toFile(variantPath(asset, "poster"));
  await sharp(frame).resize({ width: THUMB, height: THUMB, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toFile(variantPath(asset, "thumb"));
  const raw = await sharp(frame).resize(16, 16, { fit: "fill" }).removeAlpha().toColourspace("srgb").raw().toBuffer();
  return { width, height, durationMs, palette: extractPalette(raw, 5) };
}

// ---- restart safety ----

/** Queue every asset that has not been processed and has not failed. Runs once per process on module load. */
export function requeueUnprocessed(): number {
  const rows = db
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(isNull(schema.assets.processedAt), isNull(schema.assets.processError)))
    .all();
  for (const r of rows) enqueueAsset(r.id);
  return rows.length;
}

const g = globalThis as unknown as { __galleyMediaRequeued?: boolean };
if (!g.__galleyMediaRequeued) {
  g.__galleyMediaRequeued = true;
  try {
    const n = requeueUnprocessed();
    if (n) console.log(`[media] requeued ${n} unprocessed asset(s)`);
  } catch (err) {
    console.error("[media] requeue failed", err);
  }
}

/** Importing this module is enough; calling this makes the intent explicit at call sites. */
export function ensureMediaWorker() {
  return true;
}
