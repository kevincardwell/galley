import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Site } from "@/db/schema";

process.env.GALLEY_TEST_GIT_FILE = "1"; // a local bare repository stands in for GitHub

import { siteDir, withRepoLock } from "@/lib/site/git";
import { changes, cloneSite, commitAndPush, fileDiff, revertFile, syncState, updateFromBase } from "@/lib/site/repo";

const ID_ENV = { GIT_AUTHOR_NAME: "Seed", GIT_AUTHOR_EMAIL: "seed@example.com", GIT_COMMITTER_NAME: "Seed", GIT_COMMITTER_EMAIL: "seed@example.com" };
const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, env: { ...process.env, ...ID_ENV }, encoding: "utf8" }).trim();

let origin: string;
let seed: string; // stands in for Jasper's own clone, where pull requests get merged
let site: Site;
const TOKEN = "secret-token-that-must-not-be-written-down";

beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "galley-site-repo-"));
  origin = path.join(base, "origin.git");
  seed = path.join(base, "seed");
  sh(base, "init", "--bare", "--initial-branch=main", origin);
  sh(base, "clone", origin, seed);
  fs.writeFileSync(path.join(seed, "index.html"), "<h1>Hello</h1>\n<p>Line two</p>\n");
  fs.writeFileSync(path.join(seed, "style.css"), "body{}\n");
  sh(seed, "add", ".");
  sh(seed, "commit", "-m", "First");
  sh(seed, "push", "origin", "HEAD:main");
  site = {
    workspaceId: "repo-ws",
    repoUrl: `file://${origin}`,
    baseBranch: "main",
    workBranch: "galley",
    root: "",
    token: TOKEN,
    previewToken: "p",
    prNumber: null,
    prHeadSha: null,
    fetchedAt: null,
    createdBy: null,
    createdAt: 0,
  };
});

const dir = () => siteDir(site.workspaceId);
const write = (file: string, text: string) => fs.writeFileSync(path.join(dir(), file), text);

describe("site repository", () => {
  it("clones onto a work branch made from main", async () => {
    await cloneSite(site);
    expect(sh(dir(), "branch", "--show-current")).toBe("galley");
    expect(fs.readFileSync(path.join(dir(), "index.html"), "utf8")).toContain("Hello");
  });

  it("lists, diffs and reverts unsent changes", async () => {
    write("index.html", "<h1>Hello there</h1>\n<p>Line two</p>\n");
    write("new.html", "<p>New</p>\n");
    expect(await changes(site)).toEqual([
      { file: "index.html", kind: "modified" },
      { file: "new.html", kind: "added" },
    ]);
    const diff = await fileDiff(site, "index.html");
    expect(diff).toMatch(/^@@/);
    expect(diff).toContain("-<h1>Hello</h1>");
    expect(diff).toContain("+<h1>Hello there</h1>");
    expect(await fileDiff(site, "new.html")).toBe("+<p>New</p>\n+");
    await revertFile(site, "new.html");
    expect(fs.existsSync(path.join(dir(), "new.html"))).toBe(false);
  });

  it("commits as the person sending, with their commit address, and pushes the work branch", async () => {
    const head = await commitAndPush(site, { name: "Joe Clark", email: "joe@login.example", gitEmail: "joe@noreply.example" }, "Friendlier heading");
    expect(sh(origin, "rev-parse", "galley")).toBe(head);
    expect(sh(origin, "log", "-1", "--format=%an <%ae>", "galley")).toBe("Joe Clark <joe@noreply.example>");
    expect(await changes(site)).toEqual([]);
    expect(await syncState(site)).toEqual({ behind: 0, unsent: 1 });
    site = { ...site, prHeadSha: head };
  });

  it("never writes the token into the repository", () => {
    const config = fs.readFileSync(path.join(dir(), ".git", "config"), "utf8");
    expect(config).not.toContain(TOKEN);
    expect(config).not.toMatch(/extraHeader/i);
  });

  it("refuses to send when there is nothing new", async () => {
    sh(seed, "fetch", "origin");
    sh(seed, "merge", "--ff-only", "origin/galley");
    sh(seed, "push", "origin", "HEAD:main");
    await updateFromBase(site, true);
    await expect(commitAndPush(site, { name: "Joe", email: "j@e", gitEmail: null }, "Nothing")).rejects.toThrow(/nothing to send/i);
  });

  it("starts again from main once the review is merged", async () => {
    expect(sh(dir(), "rev-parse", "HEAD")).toBe(sh(origin, "rev-parse", "main"));
    expect(sh(dir(), "branch", "--show-current")).toBe("galley");
  });

  it("replays local edits on top of new work from main", async () => {
    fs.writeFileSync(path.join(seed, "style.css"), "body{color:red}\n");
    sh(seed, "commit", "-am", "Red");
    sh(seed, "push", "origin", "HEAD:main");
    write("index.html", "<h1>Hello there</h1>\n<p>Line two, edited</p>\n");
    expect(await updateFromBase(site, false)).toBe("rebased");
    expect(fs.readFileSync(path.join(dir(), "style.css"), "utf8")).toBe("body{color:red}\n");
    expect(fs.readFileSync(path.join(dir(), "index.html"), "utf8")).toContain("Line two, edited");
  });

  it("gives up cleanly when main and the edits changed the same line", async () => {
    await commitAndPush(site, { name: "Joe", email: "j@e", gitEmail: null }, "Edit line two");
    fs.writeFileSync(path.join(seed, "index.html"), "<h1>Hello there</h1>\n<p>Line two, theirs</p>\n");
    sh(seed, "commit", "-am", "Theirs");
    sh(seed, "push", "origin", "HEAD:main");
    const before = sh(dir(), "rev-parse", "HEAD");
    await expect(updateFromBase(site, false)).rejects.toThrow(/both edited the same lines/);
    expect(sh(dir(), "rev-parse", "HEAD")).toBe(before);
    expect(fs.existsSync(path.join(dir(), ".git", "rebase-merge"))).toBe(false);
    expect(fs.readFileSync(path.join(dir(), "index.html"), "utf8")).toContain("Line two, edited");
  });

  it("runs one operation at a time per site", async () => {
    const order: string[] = [];
    const slow = withRepoLock("lock-ws", async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push("first");
    });
    const fast = withRepoLock("lock-ws", async () => {
      order.push("second");
    });
    await Promise.all([slow, fast]);
    expect(order).toEqual(["first", "second"]);
  });
});
