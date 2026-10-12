import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { cleanRel, contentHash, readEditable, resolveServed, writeEditable } from "@/lib/site/files";

let root: string;
let outside: string;

beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "galley-site-files-"));
  root = path.join(base, "site");
  outside = path.join(base, "secret.db");
  fs.mkdirSync(path.join(root, "about"), { recursive: true });
  fs.mkdirSync(path.join(root, ".git"));
  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<h1>Home</h1>");
  fs.writeFileSync(path.join(root, "about", "index.html"), "<h1>About</h1>");
  fs.writeFileSync(path.join(root, ".git", "config"), "[core]");
  fs.writeFileSync(path.join(root, ".github", "workflows", "site.yml"), "on: push");
  fs.writeFileSync(path.join(root, "logo.png"), Buffer.from([0x89, 0x50, 0, 0]));
  fs.writeFileSync(outside, "password hashes");
  fs.symlinkSync(outside, path.join(root, "link.txt"));
  fs.symlinkSync(path.dirname(outside), path.join(root, "up"));
});

describe("site files: paths", () => {
  it("normalises harmless paths and refuses ones that climb out or reach git's own files", () => {
    expect(cleanRel("/about/./index.html")).toBe("about/index.html");
    expect(cleanRel("about%2Findex.html")).toBe("about/index.html");
    expect(cleanRel("")).toBe("");
    for (const bad of ["../secret.db", "about/../../x", "%2e%2e/x", ".git/config", "a/.GIT/x", ".github/workflows/site.yml", "a\0b", "%E0%A4%A"]) {
      expect(cleanRel(bad), bad).toBeNull();
    }
  });

  it("serves folders by their index.html and nothing outside the site", async () => {
    expect((await resolveServed(root, ""))?.rel).toBe("index.html");
    expect((await resolveServed(root, "about"))?.rel).toBe("about/index.html");
    expect((await resolveServed(root, "about/"))?.rel).toBe("about/index.html");
    expect(await resolveServed(root, "missing.html")).toBeNull();
    expect(await resolveServed(root, "link.txt")).toBeNull(); // symlink to a file outside
    expect(await resolveServed(root, "up/secret.db")).toBeNull(); // symlinked folder outside
    expect(await resolveServed(root, ".git/config")).toBeNull();
  });
});

describe("site files: editing", () => {
  it("reads text files and refuses binaries and links", async () => {
    expect((await readEditable(root, "index.html")).text).toBe("<h1>Home</h1>");
    await expect(readEditable(root, "logo.png")).rejects.toThrow(/not a text file/);
    await expect(readEditable(root, "link.txt")).rejects.toThrow(/Linked/);
    await expect(readEditable(root, ".github/workflows/site.yml")).rejects.toThrow();
  });

  it("only saves over the version the editor loaded", async () => {
    const { hash } = await readEditable(root, "index.html");
    const saved = await writeEditable(root, "index.html", "<h1>Mine</h1>", hash);
    expect(saved.hash).toBe(contentHash("<h1>Mine</h1>"));
    await expect(writeEditable(root, "index.html", "<h1>Theirs</h1>", hash)).rejects.toThrow(/Someone else changed/);
    expect(fs.readFileSync(path.join(root, "index.html"), "utf8")).toBe("<h1>Mine</h1>");
  });

  it("creates new files, but never through a link or into git's folders", async () => {
    await writeEditable(root, "new/page.html", "<p>New</p>", "");
    expect(fs.readFileSync(path.join(root, "new", "page.html"), "utf8")).toBe("<p>New</p>");
    await expect(writeEditable(root, "link.txt", "x", contentHash("password hashes"))).rejects.toThrow(/Linked/);
    await expect(writeEditable(root, "up/evil.txt", "x", "")).rejects.toThrow(/can't be saved/);
    await expect(writeEditable(root, ".git/hooks/pre-commit", "x", "")).rejects.toThrow(/can't be saved/);
    expect(fs.readFileSync(outside, "utf8")).toBe("password hashes");
    expect(fs.existsSync(path.join(path.dirname(outside), "evil.txt"))).toBe(false);
  });
});
