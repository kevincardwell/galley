import { parse, parseFragment } from "parse5";
import { UserError } from "@/lib/user-error";
import { contentHash } from "./hash";

// The few parts of parse5's tree this file reads, typed here rather than leaning on the package's generics.
type Loc = { startOffset: number; endOffset: number };
type ElementLoc = Loc & { startTag?: Loc; endTag?: Loc; attrs?: Record<string, Loc> };
type Attr = { name: string; value: string; prefix?: string };
type Node = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: Attr[];
  childNodes?: Node[];
  sourceCodeLocation?: ElementLoc | null;
};

/** Elements that may sit inside an editable block; anything else makes the block not editable. */
const INLINE = new Set(["a", "abbr", "b", "bdi", "br", "cite", "code", "del", "dfn", "em", "i", "ins", "kbd", "mark", "q", "s", "small", "span", "strong", "sub", "sup", "time", "u", "wbr"]);
const VOID_INLINE = new Set(["br", "wbr"]);
/** Never editable, and nothing inside them is either. */
const OPAQUE = new Set(["head", "script", "style", "svg", "math", "template", "noscript", "textarea", "select", "option", "title", "iframe", "object", "video", "audio", "canvas", "picture"]);
const URL_ATTRS = new Set(["href", "src", "action", "formaction", "poster", "data", "xlink:href"]);
const SRCSET_ATTRS = new Set(["srcset", "imagesrcset"]);

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const escapeText = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");

const isRootRelative = (u: string) => u.startsWith("/") && !u.startsWith("//");
export const rewriteUrl = (u: string, prefix: string) => (isRootRelative(u.trimStart()) ? prefix + u.trimStart() : u);
const rewriteSrcset = (v: string, prefix: string) =>
  v
    .split(",")
    .map((part) => part.replace(/^(\s*)(\S+)/, (_, sp: string, url: string) => sp + rewriteUrl(url, prefix)))
    .join(",");

/** Points `url(/…)` and `@import "/…"` at the preview instead of the server root. */
export function rewriteCss(css: string, prefix: string): string {
  return css.replace(/url\(\s*(['"]?)\/(?!\/)/g, `url($1${prefix}/`).replace(/@import\s+(['"])\/(?!\/)/g, `@import $1${prefix}/`);
}

const attrKey = (a: Attr) => (a.prefix ? `${a.prefix}:${a.name}` : a.name);

function textOf(n: Node): string {
  if (n.nodeName === "#text") return n.value ?? "";
  return (n.childNodes ?? []).map(textOf).join("");
}

/** Only text and inline elements, every element closed explicitly so its source range is exact. */
function inlineOnly(n: Node): boolean {
  for (const c of n.childNodes ?? []) {
    if (c.nodeName === "#text") continue;
    if (!c.tagName || !INLINE.has(c.tagName)) return false;
    if (!VOID_INLINE.has(c.tagName) && !c.sourceCodeLocation?.endTag) return false;
    if (!inlineOnly(c)) return false;
  }
  return true;
}

function editable(el: Node): boolean {
  if (el.tagName === "html" || el.tagName === "body") return false;
  const loc = el.sourceCodeLocation;
  return !!loc?.startTag && !!loc.endTag && inlineOnly(el) && /\S/.test(textOf(el));
}

type Edit = { at: number; end: number; text: string };

function applyEdits(src: string, edits: Edit[]): string {
  edits.sort((a, b) => a.at - b.at || a.end - b.end);
  let out = "";
  let pos = 0;
  for (const e of edits) {
    if (e.at < pos) continue; // overlapping: keep the first, never corrupt the page
    out += src.slice(pos, e.at) + e.text;
    pos = e.end;
  }
  return out + src.slice(pos);
}

/**
 * Prepares a page of the site for the preview frame:
 * - root-relative URLs (`/style.css`) are pointed at the preview, since the site is not at the server root;
 * - every block of plain text gets `data-galley-edit="start-end"` (where its content sits in the source
 *   file) and `data-galley-hash` (what that content was), which is all a click-to-edit needs;
 * - the in-frame helper script goes first in <head>, before any of the site's own scripts.
 * A directory index served without its trailing slash also gets a <base>, so relative links still work.
 */
export function previewHtml(src: string, opts: { prefix: string; file: string; base?: string; script: string }): string {
  const doc = parse(src, { sourceCodeLocationInfo: true }) as unknown as Node;
  const edits: Edit[] = [];
  let headEnd: number | null = null;
  let htmlEnd: number | null = null;

  const visit = (n: Node, annotated: boolean, opaque: boolean) => {
    const loc = n.sourceCodeLocation;
    if (n.tagName && loc) {
      for (const a of n.attrs ?? []) {
        const key = attrKey(a);
        const at = loc.attrs?.[key];
        if (!at) continue;
        let value = a.value;
        if (URL_ATTRS.has(key)) value = rewriteUrl(a.value, opts.prefix);
        else if (SRCSET_ATTRS.has(key)) value = rewriteSrcset(a.value, opts.prefix);
        else if (key === "style") value = rewriteCss(a.value, opts.prefix);
        if (value !== a.value) edits.push({ at: at.startOffset, end: at.endOffset, text: `${key}="${escapeAttr(value)}"` });
      }
      if (n.tagName === "head" && loc.startTag) headEnd = loc.startTag.endOffset;
      if (n.tagName === "html" && loc.startTag) htmlEnd = loc.startTag.endOffset;
      if (n.tagName === "style") {
        for (const t of n.childNodes ?? []) {
          const tl = t.sourceCodeLocation;
          if (t.nodeName === "#text" && tl) {
            const css = src.slice(tl.startOffset, tl.endOffset);
            const fixed = rewriteCss(css, opts.prefix);
            if (fixed !== css) edits.push({ at: tl.startOffset, end: tl.endOffset, text: fixed });
          }
        }
      }
    }
    const nowOpaque = opaque || (!!n.tagName && OPAQUE.has(n.tagName));
    let nowAnnotated = annotated;
    if (!annotated && !nowOpaque && n.tagName && editable(n)) {
      const { startTag, endTag } = n.sourceCodeLocation!;
      const start = startTag!.endOffset;
      const end = endTag!.startOffset;
      const close = src[start - 2] === "/" ? start - 2 : start - 1; // before `>` (or a stray `/>`)
      edits.push({ at: close, end: close, text: ` data-galley-edit="${start}-${end}" data-galley-hash="${contentHash(src.slice(start, end))}"` });
      nowAnnotated = true;
    }
    for (const c of n.childNodes ?? []) visit(c, nowAnnotated, nowOpaque);
  };
  visit(doc, false, false);

  const base = opts.base ? `<base href="${escapeAttr(opts.base)}">` : "";
  const script = `${base}<script src="${escapeAttr(opts.script)}" data-prefix="${escapeAttr(opts.prefix)}" data-file="${escapeAttr(opts.file)}"></script>`;
  const at = headEnd ?? htmlEnd ?? 0;
  edits.push({ at, end: at, text: script });
  return applyEdits(src, edits);
}

const KEEP_ATTR = /^(href|title|class|id|lang|dir|datetime|cite|aria-[\w-]+|data-(?!galley)[\w-]+)$/;

/** What may come back from a click-to-edit: text and inline formatting, never scripts or handlers. */
export function sanitizeInline(html: string, prefix: string): string {
  const out = (nodes: Node[]): string =>
    nodes
      .map((n) => {
        if (n.nodeName === "#text") return escapeText(n.value ?? "");
        if (!n.tagName) return ""; // comments
        const inner = out(n.childNodes ?? []);
        if (!INLINE.has(n.tagName)) return inner; // a <div> from a stray Enter: keep the words, drop the box
        if (VOID_INLINE.has(n.tagName)) return `<${n.tagName}>`;
        const attrs = (n.attrs ?? [])
          .filter((a) => KEEP_ATTR.test(attrKey(a)))
          .map((a) => {
            let v = a.value;
            if (a.name === "href") {
              if (/^\s*(javascript|data|vbscript):/i.test(v)) return "";
              if (v.startsWith(prefix + "/")) v = v.slice(prefix.length); // undo the preview's own rewrite
            }
            return ` ${attrKey(a)}="${escapeAttr(v)}"`;
          })
          .join("");
        return `<${n.tagName}${attrs}>${inner}</${n.tagName}>`;
      })
      .join("");
  return out((parseFragment(html) as unknown as Node).childNodes ?? []);
}

/**
 * Lays an edited block back into the page source. Refuses when the block is no longer what the
 * preview showed, because the offsets would then point at someone else's words.
 */
export function applyTextEdit(src: string, edit: { start: number; end: number; hash: string; html: string; prefix: string }): string {
  const { start, end } = edit;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > src.length) throw new UserError("This page changed. It has been reloaded, so try again.");
  if (contentHash(src.slice(start, end)) !== edit.hash) throw new UserError("This page changed. It has been reloaded, so try again.");
  const clean = sanitizeInline(edit.html, edit.prefix);
  return src.slice(0, start) + clean + src.slice(end);
}
