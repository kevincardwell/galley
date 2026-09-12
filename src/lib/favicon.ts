import "server-only";
import fsp from "node:fs/promises";
import path from "node:path";
import dns from "node:dns/promises";
import net from "node:net";
import { eq } from "drizzle-orm";
import { db, schema, DATA_DIR } from "@/db/client";

/** Only raster formats. SVG would be executable content served back from our own origin. */
const ALLOWED: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
  "image/webp": ".webp",
};

const MAX_BYTES = 256 * 1024;

/** Blocks loopback, link-local, private and other non-public destinations. */
function isPublicAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false; // link-local, including cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
    if (a >= 224) return false; // multicast and reserved
    return true;
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return false;
    if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return false;
    if (v.startsWith("::ffff:")) return isPublicAddress(v.slice(7)); // IPv4-mapped
    return true;
  }
  return false;
}

async function resolvesToPublicHost(hostname: string): Promise<boolean> {
  if (net.isIP(hostname)) return isPublicAddress(hostname);
  try {
    const records = await dns.lookup(hostname, { all: true });
    return records.length > 0 && records.every((r) => isPublicAddress(r.address));
  } catch {
    return false;
  }
}

/** Reads at most MAX_BYTES, so a hostile endpoint cannot stream us out of memory. */
async function readCapped(res: Response): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return null;
  if (!res.body) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > MAX_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Best-effort favicon fetch for the workspace card.
 *
 * The URL comes from whoever created the workspace, so this is a request forgery surface: we
 * only speak http(s) to a public address, never follow redirects, and never store SVG.
 * Failures are silent; the card falls back to the project's initial.
 */
export async function fetchFavicon(workspaceId: string, siteUrl: string) {
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    if (parsed.port && !["", "80", "443", "8080", "8443"].includes(parsed.port)) return;
    if (!(await resolvesToPublicHost(parsed.hostname))) return;

    for (const candidate of ["/favicon.ico", "/favicon.png", "/apple-touch-icon.png"]) {
      const res = await fetch(new URL(candidate, parsed.origin), {
        signal: AbortSignal.timeout(5000),
        redirect: "manual", // a redirect is how an attacker would reach an internal host
        headers: { accept: "image/*" },
      });
      if (!res.ok) continue;
      const ext = ALLOWED[(res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()];
      if (!ext) continue;
      const buf = await readCapped(res);
      if (!buf || buf.length < 64) continue;

      const dir = path.join(DATA_DIR, "favicons");
      await fsp.mkdir(dir, { recursive: true });
      const rel = `favicons/${workspaceId}${ext}`;
      await fsp.writeFile(path.join(DATA_DIR, rel), buf);
      db.update(schema.workspaces).set({ faviconPath: rel }).where(eq(schema.workspaces.id, workspaceId)).run();
      return;
    }
  } catch {
    /* ignore: the card falls back to the initial */
  }
}
