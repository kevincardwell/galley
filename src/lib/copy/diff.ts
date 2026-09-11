import { diffWords } from "diff";

export type DiffPart = { value: string; added?: boolean; removed?: boolean };
export type PlainDiff = { parts: DiffPart[]; added: number; removed: number; changed: boolean };

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Word-level diff of two plain-text strings (old → new), with word counts for a summary line. */
export function diffPlainText(a: string, b: string): PlainDiff {
  const parts: DiffPart[] = diffWords(a ?? "", b ?? "").map((p) => ({
    value: p.value,
    added: p.added || undefined,
    removed: p.removed || undefined,
  }));
  let added = 0;
  let removed = 0;
  for (const p of parts) {
    if (p.added) added += countWords(p.value);
    else if (p.removed) removed += countWords(p.value);
  }
  return { parts, added, removed, changed: added > 0 || removed > 0 || parts.some((p) => p.added || p.removed) };
}

/** "12 words added, 3 removed" / "No changes". */
export function diffSummary(d: PlainDiff): string {
  if (!d.changed) return "No changes";
  const bits: string[] = [];
  if (d.added) bits.push(`${d.added} ${d.added === 1 ? "word" : "words"} added`);
  if (d.removed) bits.push(d.added ? `${d.removed} removed` : `${d.removed} ${d.removed === 1 ? "word" : "words"} removed`);
  return bits.length ? bits.join(", ") : "Only spacing changed";
}
