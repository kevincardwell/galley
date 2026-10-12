import { afterEach, describe, expect, it, vi } from "vitest";
import type { Site } from "@/db/schema";
import nacl from "tweetnacl";
import { blake2b } from "blakejs";
import { buildState, deleteSecret, githubRepo, listSecrets, openReview, setSecrets } from "@/lib/site/github";
import { sealedBox } from "@/lib/site/sealed-box";

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
    if (routes[key] === null) return new Response(null, { status: method === "PUT" ? 201 : 204 }); // GitHub's empty answers
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

/** What GitHub does with a secret: open the sealed box with the repository's private key. */
function openSealed(sealed: Uint8Array, kp: nacl.BoxKeyPair): string | null {
  const epk = sealed.slice(0, 32);
  const both = new Uint8Array(64);
  both.set(epk);
  both.set(kp.publicKey, 32);
  const opened = nacl.box.open(sealed.slice(32), blake2b(both, undefined, 24), epk, kp.secretKey);
  return opened && Buffer.from(opened).toString("utf8");
}

describe("site: deploy secrets", () => {
  it("seals a value so that only the holder of the private key can read it", () => {
    const repo = nacl.box.keyPair();
    const sealed = sealedBox(Buffer.from("hunter2 & friends"), repo.publicKey);
    expect(sealed.length).toBe(32 + 16 + 17);
    expect(openSealed(sealed, repo)).toBe("hunter2 & friends");
    expect(openSealed(sealed, nacl.box.keyPair())).toBeNull();
    expect(Buffer.from(sealed).toString("utf8")).not.toContain("hunter2"); // never plain on the wire
  });

  it("stores each value encrypted to the repository's key, and lists only names", async () => {
    const repo = nacl.box.keyPair();
    const calls = mockFetch({
      "GET /repos/kevincardwell/cardwellbridge/actions/secrets/public-key": { key_id: "k1", key: Buffer.from(repo.publicKey).toString("base64") },
      "PUT /repos/kevincardwell/cardwellbridge/actions/secrets/FTP_SERVER": null,
      "PUT /repos/kevincardwell/cardwellbridge/actions/secrets/FTP_PASSWORD": null,
      "GET /repos/kevincardwell/cardwellbridge/actions/secrets": { secrets: [{ name: "FTP_SERVER", updated_at: "2026-10-12T21:00:00Z" }] },
      "DELETE /repos/kevincardwell/cardwellbridge/actions/secrets/FTP_SERVER": null,
    });
    await setSecrets(site, { FTP_SERVER: "ftp.example.com", FTP_PASSWORD: "s3cret" });
    const puts = calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(2);
    for (const p of puts) {
      const body = JSON.parse(p.body!);
      expect(body.key_id).toBe("k1");
      expect(p.body).not.toMatch(/ftp\.example\.com|s3cret/);
    }
    expect(openSealed(Buffer.from(JSON.parse(puts[1].body!).encrypted_value, "base64"), repo)).toBe("s3cret");
    expect(await listSecrets(site)).toEqual([{ name: "FTP_SERVER", updatedAt: "2026-10-12T21:00:00Z" }]);
    await deleteSecret(site, "FTP_SERVER");
    expect(calls.at(-1)?.method).toBe("DELETE");
  });

  it("names the missing permission when GitHub refuses", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ message: "Resource not accessible by personal access token" }), { status: 403 }));
    await expect(listSecrets(site)).rejects.toThrow(/Secrets: Read and write/);
  });
});
