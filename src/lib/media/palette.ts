// Palette extraction from a tiny raw RGB buffer (no alpha). Pure, so it is unit-testable.

type Bucket = { r: number; g: number; b: number; n: number };

const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
const toHex = (b: Bucket) => `#${hex(b.r / b.n)}${hex(b.g / b.n)}${hex(b.b / b.n)}`;

function distance(a: Bucket, b: Bucket) {
  const dr = a.r / a.n - b.r / b.n;
  const dg = a.g / a.n - b.g / b.n;
  const db = a.b / a.n - b.b / b.n;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Most-frequent quantised colours, preferring ones that differ from what is already picked.
 * `raw` is packed RGB (3 bytes per pixel) such as sharp's `.raw()` output after `.removeAlpha()`.
 */
export function extractPalette(raw: Uint8Array, count = 5): string[] {
  const buckets = new Map<number, Bucket>();
  for (let i = 0; i + 2 < raw.length; i += 3) {
    const r = raw[i]!, g = raw[i + 1]!, b = raw[i + 2]!;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const hit = buckets.get(key);
    if (hit) { hit.r += r; hit.g += g; hit.b += b; hit.n++; }
    else buckets.set(key, { r, g, b, n: 1 });
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n);
  const picked: Bucket[] = [];
  for (const threshold of [48, 24, 0]) {
    for (const c of ranked) {
      if (picked.length >= count) break;
      if (picked.includes(c)) continue;
      if (picked.every((p) => distance(p, c) > threshold)) picked.push(c);
    }
    if (picked.length >= count) break;
  }
  return picked.map(toHex);
}
