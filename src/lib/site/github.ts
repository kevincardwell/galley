import "server-only";
import type { Site } from "@/db/schema";

/** owner/repo for a github.com URL, or null for any other host (those get a pushed branch and no pull request). */
export function githubRepo(repoUrl: string): { owner: string; repo: string } | null {
  const m = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(repoUrl.trim());
  return m ? { owner: m[1], repo: m[2] } : null;
}

export type BuildState = { state: "passing" | "failing" | "running" | "none"; url: string | null };
export type Review = { number: number; url: string; state: "open" | "merged" | "closed"; headSha: string };

async function api<T>(site: Site, path: string, init: RequestInit = {}): Promise<T> {
  const gh = githubRepo(site.repoUrl);
  if (!gh || !site.token) throw new Error("No GitHub access for this site");
  const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${site.token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "Galley",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.status === 401) throw new Error("GitHub refused the token. It may have expired.");
    if (res.status === 403 || res.status === 404) throw new Error(`GitHub said no (${body.message ?? res.status}). Check the token can use pull requests on this repository.`);
    throw new Error(`GitHub: ${body.message ?? res.status}`);
  }
  return (await res.json()) as T;
}

type PullJson = { number: number; html_url: string; state: "open" | "closed"; merged_at: string | null; head: { sha: string } };
const asReview = (p: PullJson): Review => ({ number: p.number, url: p.html_url, state: p.merged_at ? "merged" : p.state, headSha: p.head.sha });

/** The open pull request from the work branch, created if there is none. */
export async function openReview(site: Site, title: string, body: string): Promise<Review> {
  const gh = githubRepo(site.repoUrl)!;
  const open = await api<PullJson[]>(site, `/pulls?state=open&head=${encodeURIComponent(`${gh.owner}:${site.workBranch}`)}&base=${encodeURIComponent(site.baseBranch)}`);
  if (open[0]) return asReview(open[0]);
  const created = await api<PullJson>(site, "/pulls", { method: "POST", body: JSON.stringify({ title, body, head: site.workBranch, base: site.baseBranch }) });
  return asReview(created);
}

export async function reviewState(site: Site): Promise<Review | null> {
  if (!site.prNumber) return null;
  return asReview(await api<PullJson>(site, `/pulls/${site.prNumber}`));
}

type RunsJson = { workflow_runs: { status: string; conclusion: string | null; html_url: string }[] };

/** What GitHub Actions made of a commit: the site's build. */
export async function buildState(site: Site, sha: string): Promise<BuildState> {
  const { workflow_runs: runs } = await api<RunsJson>(site, `/actions/runs?head_sha=${sha}&per_page=20`);
  if (!runs.length) return { state: "none", url: null };
  const failed = runs.find((r) => r.status === "completed" && !["success", "neutral", "skipped"].includes(r.conclusion ?? ""));
  if (failed) return { state: "failing", url: failed.html_url };
  const running = runs.find((r) => r.status !== "completed");
  if (running) return { state: "running", url: running.html_url };
  return { state: "passing", url: runs[0].html_url };
}
