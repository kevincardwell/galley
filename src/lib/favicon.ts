import "server-only";
import fsp from "node:fs/promises";
import http from "node:http";
import https from "node:https";
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
const TIMEOUT_MS = 5_000;

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
    if (v.startsWith("::ffff:")) return isPublicAddress(v.slice(7)); // IPv4-mapped
    const [firstHex, secondHex] = v.split(":");
    const first = parseInt(firstHex || "0", 16);
    const second = parseInt(secondHex || "0", 16);
    if (first === 0) return false; // ::, ::1 and IPv4-compatible forms like ::127.0.0.1
    if ((first & 0xff00) === 0xff00) return false; // ff00::/8 multicast
    if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
    if ((first & 0xffc0) === 0xfec0) return false; // fec0::/10 deprecated site-local
    if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
    if (first === 0x0064 && second === 0xff9b) return false; // NAT64 (64:ff9b::/96 and 64:ff9b:1::/48)
    if (first === 0x2001 && second === 0x0db8) return false; // documentation
    return true;
  }
  return false;
}

const bareHost = (hostname: string) => hostname.replace(/^\[|\]$/g, "");

/**
 * The address to connect to, or null when the name must not be reached.
 *
 * Every address the name resolves to has to be public: a name that answers with one public and
 * one private address is a rebinding attempt, not a target.
 */
async function publicAddressFor(hostname: string): Promise<{ address: string; family: number } | null> {
  const host = bareHost(hostname);
  const literal = net.isIP(host);
  if (literal) return isPublicAddress(host) ? { address: host, family: literal } : null;
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0 || !records.every((r) => isPublicAddress(r.address))) return null;
    const first = records[0]!;
    return { address: first.address, family: first.family };
  } catch {
    return null;
  }
}

/**
 * One GET to a fixed address, reading at most MAX_BYTES and only from a 2xx.
 *
 * The request goes to the address that was just checked, not the name: resolving again at
 * connect time would reopen the DNS-rebinding window the check exists to close. Redirects are
 * not followed, for the same reason.
 */
function getPinned(url: URL, pinned: { address: string; family: number }): Promise<{ contentType: string; body: Buffer } | null> {
  return new Promise((resolve) => {
    const secure = url.protocol === "https:";
    let settled = false;
    const finish = (value: { contentType: string; body: Buffer } | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const handler = (res: http.IncomingMessage) => {
      const status = res.statusCode ?? 0;
      const declared = Number(res.headers["content-length"] ?? 0);
      if (status < 200 || status >= 300 || declared > MAX_BYTES) {
        res.resume();
        return finish(null);
      }
      const chunks: Buffer[] = [];
      let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_BYTES) {
          request.destroy();
          return finish(null);
        }
        chunks.push(chunk);
      });
      res.on("end", () => finish({ contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }));
      res.on("error", () => finish(null));
    };

    const options = {
      host: pinned.address,
      family: pinned.family,
      port: url.port || (secure ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: { host: url.host, accept: "image/*" },
    };
    const request = secure
      ? https.request({ ...options, servername: bareHost(url.hostname) }, handler)
      : http.request(options, handler);
    request.setTimeout(TIMEOUT_MS, () => {
      request.destroy();
      finish(null);
    });
    request.on("error", () => finish(null));
    request.end();
  });
}

/**
 * Best-effort favicon fetch for the workspace card.
 *
 * The URL comes from whoever created the workspace, so this is a request forgery surface: we
 * only speak http(s) to a public address, pin the address we checked, never follow redirects,
 * and never store SVG. Failures are silent; the card falls back to the project's initial.
 */
export async function fetchFavicon(workspaceId: string, siteUrl: string) {
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    if (parsed.port && !["", "80", "443", "8080", "8443"].includes(parsed.port)) return;
    const pinned = await publicAddressFor(parsed.hostname);
    if (!pinned) return;

    for (const candidate of ["/favicon.ico", "/favicon.png", "/apple-touch-icon.png"]) {
      const res = await getPinned(new URL(candidate, parsed.origin), pinned);
      if (!res) continue;
      const ext = ALLOWED[res.contentType.split(";")[0]!.trim().toLowerCase()];
      if (!ext || res.body.length < 64) continue;

      const dir = path.join(DATA_DIR, "favicons");
      await fsp.mkdir(dir, { recursive: true });
      const rel = `favicons/${workspaceId}${ext}`;
      await fsp.writeFile(path.join(DATA_DIR, rel), res.body);
      db.update(schema.workspaces).set({ faviconPath: rel }).where(eq(schema.workspaces.id, workspaceId)).run();
      return;
    }
  } catch {
    /* ignore: the card falls back to the initial */
  }
}
