import "server-only";
import { UserError } from "@/lib/user-error";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { SITES_DIR } from "@/db/client";

const run = promisify(execFile);

/** A message fit to show the person who pressed the button. */
export class GitError extends UserError {}

export const siteDir = (workspaceId: string) => path.join(SITES_DIR, workspaceId);

/**
 * Settings every git call runs with, passed as GIT_CONFIG_* variables so nothing is written to
 * `.git/config` and the token never appears in a process listing.
 *
 * - hooks and fsmonitor off: belt and braces, since members can never reach `.git/` (see files.ts).
 * - https only: no file://, ssh or ext:: transports, so a repository URL cannot read the server's disk.
 *   Tests set GALLEY_TEST_GIT_FILE=1 to use a local bare repository.
 */
function gitConfig(token?: string | null): [string, string][] {
  const config: [string, string][] = [
    ["core.hooksPath", "/dev/null"],
    ["core.fsmonitor", "false"],
    ["credential.helper", ""],
    ["submodule.recurse", "false"],
    ["protocol.allow", "never"],
    ["protocol.https.allow", "always"],
    ["advice.detachedHead", "false"],
    ["init.defaultBranch", "main"],
  ];
  if (process.env.GALLEY_TEST_GIT_FILE === "1") config.push(["protocol.file.allow", "always"]);
  if (token) config.push(["http.extraHeader", `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`]);
  return config;
}

function cleanMessage(stderr: string): string {
  const lines = stderr.split("\n").map((l) => l.trim()).filter(Boolean);
  const fatal = lines.find((l) => /^(fatal|error):/.test(l)) ?? lines.at(-1) ?? "Git failed";
  return fatal.replace(/^(fatal|error):\s*/, "").slice(0, 300);
}

/** Runs git in `cwd` and returns stdout. Throws GitError with a readable message. */
export async function git(
  cwd: string,
  args: string[],
  opts: { token?: string | null; timeout?: number; env?: Record<string, string> } = {},
): Promise<string> {
  const home = path.join(SITES_DIR, ".home");
  fs.mkdirSync(home, { recursive: true });
  const config = gitConfig(opts.token);
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PATH: process.env.PATH,
    HOME: home, // the container user (often 99 or 1000) may have no home directory at all
    LANG: "C",
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: String(config.length),
    ...opts.env,
  };
  config.forEach(([k, v], i) => {
    env[`GIT_CONFIG_KEY_${i}`] = k;
    env[`GIT_CONFIG_VALUE_${i}`] = v;
  });
  try {
    const { stdout } = await run("git", args, { cwd, env, timeout: opts.timeout ?? 60_000, maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
    if (e.code === "ENOENT") throw new GitError(fs.existsSync(cwd) ? "Git is not installed on this server" : "The site's working copy is missing");
    if (e.killed) throw new GitError("Git took too long and was stopped");
    throw new GitError(cleanMessage(e.stderr || e.message));
  }
}

const g = globalThis as unknown as { __galleySiteLocks?: Map<string, Promise<unknown>> };
const locks = (g.__galleySiteLocks ??= new Map());

/**
 * One git operation at a time per working copy, or two people pressing buttons at once collide on
 * `.git/index.lock`.
 * ponytail: in-process lock; Galley is one container. Needs a file lock if it ever runs as several processes.
 */
export function withRepoLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(workspaceId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(workspaceId, next);
  next.then(
    () => locks.get(workspaceId) === next && locks.delete(workspaceId),
    () => locks.get(workspaceId) === next && locks.delete(workspaceId),
  );
  return next;
}
