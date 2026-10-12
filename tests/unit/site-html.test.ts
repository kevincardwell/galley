import { describe, expect, it } from "vitest";
import { applyTextEdit, previewHtml, rewriteCss, sanitizeInline } from "@/lib/site/html";
import { contentHash } from "@/lib/site/hash";

const P = "/api/site/ws1/tok";
const render = (src: string, base?: string) => previewHtml(src, { prefix: P, file: "index.html", base, script: "/site-editor.js" });

/** Every editable block as [start, end, hash, source slice]. */
function blocks(src: string) {
  const out = render(src);
  return [...out.matchAll(/data-galley-edit="(\d+)-(\d+)" data-galley-hash="([0-9a-f]+)"/g)].map((m) => {
    const [s, e] = [Number(m[1]), Number(m[2])];
    return { start: s, end: e, hash: m[3], text: src.slice(s, e) };
  });
}

describe("site preview: editable blocks", () => {
  it("marks blocks of text with their exact place in the source", () => {
    const src = `<!doctype html><html><head><title>T</title></head><body><h1 class="big">Hello <em>there</em></h1><p>Second &amp; last</p></body></html>`;
    const b = blocks(src);
    expect(b.map((x) => x.text)).toEqual(["Hello <em>there</em>", "Second &amp; last"]);
    for (const x of b) expect(x.hash).toBe(contentHash(x.text));
  });

  it("marks the outermost block only, and skips containers of blocks", () => {
    const src = `<div><p>One <a href="/x">link</a></p><p>Two</p></div>`;
    expect(blocks(src).map((x) => x.text)).toEqual([`One <a href="/x">link</a>`, "Two"]);
  });

  it("skips elements without an explicit end tag, since their range would be a guess", () => {
    const src = `<ul><li>One<li>Two</ul><p>Kept</p>`;
    expect(blocks(src).map((x) => x.text)).toEqual(["Kept"]);
  });

  it("never marks scripts, styles, svg text, empty blocks or comments inside text", () => {
    const src = `<script>let a = "<p>x</p>"</script><style>p{}</style><svg><text>Map</text></svg><p>  </p><p>a<!-- note -->b</p><button>Go</button>`;
    expect(blocks(src).map((x) => x.text)).toEqual(["Go"]);
  });
});

describe("site preview: URLs", () => {
  it("points root-relative URLs at the preview and leaves the rest alone", () => {
    const src = `<head><link rel="stylesheet" href="/style.css"></head><body><a href="/about/">A</a><a href="//cdn.x/y">B</a><a href="https://e.com/">C</a><a href="#top">D</a><img src="pic.png" srcset="/a.png 1x, /b.png 2x"><div style="background:url(/bg.jpg)"></div><svg><use href="#art"></use></svg></body>`;
    const out = render(src);
    expect(out).toContain(`href="${P}/style.css"`);
    expect(out).toContain(`href="${P}/about/"`);
    expect(out).toContain(`href="//cdn.x/y"`);
    expect(out).toContain(`href="https://e.com/"`);
    expect(out).toContain(`href="#top"`);
    expect(out).toContain(`src="pic.png"`);
    expect(out).toContain(`srcset="${P}/a.png 1x, ${P}/b.png 2x"`);
    expect(out).toContain(`style="background:url(${P}/bg.jpg)"`);
    expect(out).toContain(`<use href="#art">`);
  });

  it("rewrites CSS url() and @import, inline and in files", () => {
    expect(rewriteCss(`@font-face{src:url("/fonts/a.woff2")} @import '/b.css'; x{background:url(//cdn/c.png)}`, P)).toBe(
      `@font-face{src:url("${P}/fonts/a.woff2")} @import '${P}/b.css'; x{background:url(//cdn/c.png)}`,
    );
    expect(render(`<style>body{background:url(/bg.png)}</style>`)).toContain(`url(${P}/bg.png)`);
  });

  it("puts the helper first in <head>, before the site's own scripts", () => {
    const out = render(`<html><head><script src="/app.js"></script></head><body></body></html>`);
    expect(out.indexOf("/site-editor.js")).toBeLessThan(out.indexOf(`${P}/app.js`));
    expect(out).toMatch(/<head><script src="\/site-editor\.js" data-prefix="\/api\/site\/ws1\/tok" data-file="index\.html"><\/script>/);
  });

  it("still injects into a page with no <head> or <html> tag, and adds <base> for folder indexes", () => {
    expect(render(`<p>Hi</p>`)).toMatch(/^<script src="\/site-editor\.js"/);
    expect(render(`<head></head>`, `${P}/about/`)).toContain(`<head><base href="${P}/about/"><script`);
  });
});

describe("site preview: saving an edit", () => {
  it("lays the new words exactly where the old ones were, and nowhere else", () => {
    const src = `<body>\n  <h1>Old title</h1>\n  <p>Keep me</p>\n</body>`;
    const [h1] = blocks(src);
    const next = applyTextEdit(src, { ...h1, html: "New title", prefix: P });
    expect(next).toBe(`<body>\n  <h1>New title</h1>\n  <p>Keep me</p>\n</body>`);
  });

  it("refuses when the block changed since the preview was drawn", () => {
    const src = `<h1>Old</h1>`;
    const [h1] = blocks(src);
    expect(() => applyTextEdit(`<h1>Changed</h1>`, { ...h1, html: "New", prefix: P })).toThrow(/changed/);
    expect(() => applyTextEdit(src, { ...h1, end: 999, html: "New", prefix: P })).toThrow(/changed/);
  });

  it("keeps text and inline formatting, drops anything that could run or restyle", () => {
    expect(sanitizeInline(`Hi <b onclick="x()">bold</b><script>alert(1)</script> <a href="javascript:alert(1)">bad</a> <img src=x onerror=y>`, P)).toBe(
      `Hi <b>bold</b>alert(1) <a>bad</a> `,
    );
    expect(sanitizeInline(`<span style="color:red" data-galley-edit="1-2" class="k">x</span>`, P)).toBe(`<span class="k">x</span>`);
    expect(sanitizeInline(`a<div>b</div>c &amp; 1 &lt; 2 `, P)).toBe(`abc &amp; 1 &lt; 2&nbsp;`);
  });

  it("undoes the preview's own link rewrite, so the source keeps its real URLs", () => {
    expect(sanitizeInline(`See <a href="${P}/about/">us</a>`, P)).toBe(`See <a href="/about/">us</a>`);
  });
});
