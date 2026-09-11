/**
 * Pure Tiptap JSON serialisers. No server-only imports so this can run in the
 * browser (live counts, copy as Markdown) and in unit tests.
 *
 * Supported nodes: doc, paragraph, heading (1–3), bulletList, orderedList,
 * listItem, blockquote, hardBreak, text. Marks: bold, italic, link.
 */

export type TiptapMark = { type: string; attrs?: Record<string, unknown> };
export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
};
export type TiptapDoc = { type: "doc"; content?: TiptapNode[] };

export function emptyDoc(): TiptapDoc {
  return { type: "doc", content: [] };
}

/** Coerce whatever came out of the database into a doc. */
export function asDoc(value: unknown): TiptapDoc {
  if (value && typeof value === "object" && (value as { type?: unknown }).type === "doc") {
    const v = value as TiptapDoc;
    return { type: "doc", content: Array.isArray(v.content) ? v.content : [] };
  }
  if (typeof value === "string") {
    try {
      return asDoc(JSON.parse(value));
    } catch {
      return emptyDoc();
    }
  }
  return emptyDoc();
}

export function isDocEmpty(doc: TiptapDoc): boolean {
  return tiptapToText(doc).trim().length === 0;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function charCount(text: string): number {
  return text.length;
}

// ---------------------------------------------------------------- plain text

function inlineText(nodes: TiptapNode[] | undefined): string {
  if (!nodes) return "";
  return nodes.map((n) => (n.type === "hardBreak" ? "\n" : n.type === "text" ? n.text ?? "" : inlineText(n.content))).join("");
}

function blockText(node: TiptapNode, out: string[]): void {
  switch (node.type) {
    case "paragraph":
    case "heading":
      out.push(inlineText(node.content));
      return;
    case "bulletList":
    case "orderedList":
    case "blockquote":
    case "listItem":
      for (const c of node.content ?? []) blockText(c, out);
      return;
    default:
      if (node.content) for (const c of node.content) blockText(c, out);
      else if (node.text) out.push(node.text);
  }
}

export function tiptapToText(doc: TiptapDoc): string {
  const out: string[] = [];
  for (const n of doc.content ?? []) blockText(n, out);
  return out.filter((s) => s.length > 0).join("\n");
}

// ---------------------------------------------------------------- markdown

function linkHref(marks: TiptapMark[] | undefined): string | null {
  const link = marks?.find((m) => m.type === "link");
  const href = link?.attrs?.href;
  return typeof href === "string" && href ? href : null;
}

function hasMark(marks: TiptapMark[] | undefined, type: string): boolean {
  return Boolean(marks?.some((m) => m.type === type));
}

function escapeMd(text: string): string {
  return text.replace(/([\\`*_[\]])/g, "\\$1");
}

function inlineMd(nodes: TiptapNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      if (n.type !== "text") return inlineMd(n.content);
      let s = escapeMd(n.text ?? "");
      if (!s) return "";
      // Keep whitespace outside the emphasis markers so Markdown parsers accept it.
      const lead = s.match(/^\s*/)?.[0] ?? "";
      const trail = s.match(/\s*$/)?.[0] ?? "";
      s = s.slice(lead.length, s.length - trail.length);
      if (s) {
        if (hasMark(n.marks, "bold")) s = `**${s}**`;
        if (hasMark(n.marks, "italic")) s = `*${s}*`;
        const href = linkHref(n.marks);
        if (href) s = `[${s}](${href})`;
      }
      return lead + s + trail;
    })
    .join("");
}

function indent(text: string, prefix: string, firstPrefix = prefix): string {
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? firstPrefix : prefix) + line)
    .join("\n");
}

function blockMd(node: TiptapNode): string {
  switch (node.type) {
    case "paragraph":
      return inlineMd(node.content);
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `${"#".repeat(level)} ${inlineMd(node.content)}`;
    }
    case "bulletList":
      return (node.content ?? []).map((li) => indent(listItemMd(li), "  ", "- ")).join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((li, i) => {
          const marker = `${start + i}. `;
          return indent(listItemMd(li), " ".repeat(marker.length), marker);
        })
        .join("\n");
    }
    case "blockquote":
      return indent(blocksMd(node.content), "> ");
    case "hardBreak":
      return "";
    default:
      return node.content ? blocksMd(node.content) : node.text ? escapeMd(node.text) : "";
  }
}

function listItemMd(li: TiptapNode): string {
  const parts = (li.content ?? []).map(blockMd).filter((s) => s.length > 0);
  return parts.join("\n");
}

function blocksMd(nodes: TiptapNode[] | undefined): string {
  return (nodes ?? [])
    .map(blockMd)
    .filter((s) => s.length > 0)
    .join("\n\n");
}

export function tiptapToMarkdown(doc: TiptapDoc): string {
  return blocksMd(doc.content).trim();
}

// ---------------------------------------------------------------- html

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeHref(href: string): string {
  const h = href.trim();
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(h)) return escapeHtml(h);
  return "#";
}

function inlineHtml(nodes: TiptapNode[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "<br>";
      if (n.type !== "text") return inlineHtml(n.content);
      let s = escapeHtml(n.text ?? "");
      if (hasMark(n.marks, "bold")) s = `<strong>${s}</strong>`;
      if (hasMark(n.marks, "italic")) s = `<em>${s}</em>`;
      const href = linkHref(n.marks);
      if (href) s = `<a href="${safeHref(href)}" rel="noopener">${s}</a>`;
      return s;
    })
    .join("");
}

function blockHtml(node: TiptapNode): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${inlineHtml(node.content)}</p>`;
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `<h${level}>${inlineHtml(node.content)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${(node.content ?? []).map(blockHtml).join("")}</ul>`;
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return `<ol${start !== 1 ? ` start="${start}"` : ""}>${(node.content ?? []).map(blockHtml).join("")}</ol>`;
    }
    case "listItem":
      return `<li>${(node.content ?? []).map(blockHtml).join("")}</li>`;
    case "blockquote":
      return `<blockquote>${(node.content ?? []).map(blockHtml).join("")}</blockquote>`;
    case "hardBreak":
      return "<br>";
    default:
      return node.content ? node.content.map(blockHtml).join("") : node.text ? escapeHtml(node.text) : "";
  }
}

export function tiptapToHtml(doc: TiptapDoc): string {
  return (doc.content ?? []).map(blockHtml).join("\n");
}
