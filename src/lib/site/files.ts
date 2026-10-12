import "server-only";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Site } from "@/db/schema";
import { siteDir } from "./git";
import { contentHash } from "./hash";

export { contentHash };

/** The folder inside the working copy that is the website. */
export const siteRoot = (site: Pick<Site, "workspaceId" | "root">) => path.join(siteDir(site.workspaceId), site.root);

/**
 * `.git/` holds the repository's own config (core.fsmonitor, diff drivers and the like run commands),
 * and `.github/` holds workflows that run on GitHub with the repository's secrets as soon as a pull
 * request is opened. Members can edit everything else; never these.
 */
const FORBIDDEN = new Set([".git", ".github"]);

/**
 * Turns a path from a URL or the editor into a safe path relative to the site root, or null.
 * Lexical only: callers that touch the disk also check where symlinks lead (`realInside`).
 */
export function cleanRel(input: string): string | null {
  if (input.includes("\0")) return null;
  let p: string;
  try {
    p = decodeURIComponent(input);
  } catch {
    return null;
  }
  p = p.replace(/\\/g, "/");
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") return null;
    if (FORBIDDEN.has(seg.toLowerCase())) return null;
    parts.push(seg);
  }
  return parts.join("/");
}

/** True when `file` (after following symlinks) is inside `root`. A repository can contain a symlink to anywhere. */
async function realInside(root: string, file: string): Promise<boolean> {
  try {
    const [r, f] = await Promise.all([fsp.realpath(root), fsp.realpath(file)]);
    return f === r || f.startsWith(r + path.sep);
  } catch {
    return false;
  }
}

/** Resolves a URL path to a file to serve: directories get their index.html. Null when there is nothing safe to serve. */
export async function resolveServed(root: string, urlPath: string): Promise<{ file: string; rel: string } | null> {
  const rel = cleanRel(urlPath);
  if (rel === null) return null;
  let file = path.join(root, rel);
  let stat = await fsp.stat(file).catch(() => null);
  if (stat?.isDirectory()) {
    file = path.join(file, "index.html");
    stat = await fsp.stat(file).catch(() => null);
  }
  if (!stat?.isFile() || !(await realInside(root, file))) return null;
  return { file, rel: path.relative(root, file).split(path.sep).join("/") };
}

export const MAX_EDIT_BYTES = 1024 * 1024;

/** Reads a file for the code editor. Refuses binaries, big files and symlinks. */
export async function readEditable(root: string, rel: string): Promise<{ text: string; hash: string }> {
  const clean = cleanRel(rel);
  if (!clean) throw new Error("That file can't be opened here");
  const file = path.join(root, clean);
  const stat = await fsp.lstat(file).catch(() => null);
  if (!stat?.isFile()) throw new Error(stat?.isSymbolicLink() ? "Linked files can't be edited here" : "That file no longer exists");
  if (stat.size > MAX_EDIT_BYTES) throw new Error("That file is too big to edit here");
  if (!(await realInside(root, file))) throw new Error("That file can't be opened here");
  const buf = await fsp.readFile(file);
  if (buf.includes(0)) throw new Error("That is not a text file");
  const text = buf.toString("utf8");
  return { text, hash: contentHash(text) };
}

/**
 * Writes a file from the editor. `baseHash` is the version the editor loaded ("" for a new file),
 * so two people saving the same file cannot silently overwrite each other.
 */
export async function writeEditable(root: string, rel: string, text: string, baseHash: string): Promise<{ hash: string }> {
  const clean = cleanRel(rel);
  if (!clean) throw new Error("That file can't be saved here");
  if (Buffer.byteLength(text) > MAX_EDIT_BYTES) throw new Error("That file is too big to save here");
  if (text.includes("\0")) throw new Error("That is not a text file");
  const file = path.join(root, clean);
  const stat = await fsp.lstat(file).catch(() => null);
  if (stat?.isSymbolicLink()) throw new Error("Linked files can't be edited here");
  if (stat && !stat.isFile()) throw new Error("That is a folder");
  const current = stat ? contentHash(await fsp.readFile(file, "utf8")) : "";
  if (current !== baseHash) throw new Error("Someone else changed this file. Reopen it to see their version.");
  await fsp.mkdir(path.dirname(file), { recursive: true });
  if (!(await realInside(root, path.dirname(file)))) throw new Error("That file can't be saved here");
  await fsp.writeFile(file, text);
  return { hash: contentHash(text) };
}

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
};

export const mimeFor = (file: string) => MIME[path.extname(file).slice(1).toLowerCase()] ?? "application/octet-stream";
