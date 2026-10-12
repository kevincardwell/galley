import { afterEach, describe, expect, it, vi } from "vitest";
import type { Site } from "@/db/schema";
import { buildState, githubRepo, openReview } from "@/lib/site/github";

const site: Site = {
  workspaceId: "gh",
  repoUrl: "https://github.com/kevincardwell/cardwellbridge",
  baseBranch: "main",
  workBranch: "galley",
  root: "",
  token: "tok",
  previewToken: "p",
  prNumber: null,
  prHeadSha: null,
  fetchedAt: null,
  createdBy: null,
  createdAt: 0,
};

const pull = (n: number) => ({ number: n, html_url: `https://github.com/x/y/pull/${n}`, state: "open", merged_at: null, head: { sha: "abc" } });

function mockFetch(routes: Record<string, unknown>) {
  const calls: { url: string; method: string; body?: string; auth?: string }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body as string | undefined, auth: (init.headers as Record<string, string>).authorization });
    const key = `${method} ${new URL(url).pathname}`;
    if (!(key in routes)) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200 });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("site: GitHub", () => {
  it("only treats github.com https addresses as GitHub", () => {
    expect(githubRepo("https://github.com/kevincardwell/cardwellbridge")).toEqual({ owner: "kevincardwell", repo: "cardwellbridge" });
    expect(githubRepo("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" });
    expect(githubRepo("https://gitlab.com/a/b")).toBeNull();
    expect(githubRepo("https://github.com.evil.example/a/b")).toBeNull();
  });

  it("reuses the open pull request from the work branch", async () => {
    const calls = mockFetch({ "GET /repos/kevincardwell/cardwellbridge/pulls": [pull(7)] });
    const r = await openReview(site, "Title", "Body");
    expect(r).toEqual({ number: 7, url: "https://github.com/x/y/pull/7", state: "open", headSha: "abc" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("head=kevincardwell%3Agalley");
    expect(calls[0].auth).toBe("Bearer tok");
  });

  it("opens one when there is none", async () => {
    const calls = mockFetch({ "GET /repos/kevincardwell/cardwellbridge/pulls": [], "POST /repos/kevincardwell/cardwellbridge/pulls": pull(8) });
    expect((await openReview(site, "Title", "Body")).number).toBe(8);
    expect(JSON.parse(calls[1].body!)).toEqual({ title: "Title", body: "Body", head: "galley", base: "main" });
  });

  it("explains a rejected token", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 401 }));
    await expect(openReview(site, "t", "b")).rejects.toThrow(/refused the token/);
  });

  it("sums up the Actions runs for a commit", async () => {
    const runs = (...r: [string, string | null][]) => ({ workflow_runs: r.map(([status, conclusion], i) => ({ status, conclusion, html_url: `run${i}` })) });
    const path = "GET /repos/kevincardwell/cardwellbridge/actions/runs";
    mockFetch({ [path]: runs() });
    expect(await buildState(site, "abc")).toEqual({ state: "none", url: null });
    mockFetch({ [path]: runs(["completed", "success"], ["completed", "skipped"]) });
    expect((await buildState(site, "abc")).state).toBe("passing");
    mockFetch({ [path]: runs(["completed", "success"], ["in_progress", null]) });
    expect(await buildState(site, "abc")).toEqual({ state: "running", url: "run1" });
    mockFetch({ [path]: runs(["in_progress", null], ["completed", "failure"]) });
    expect(await buildState(site, "abc")).toEqual({ state: "failing", url: "run1" });
  });
});
