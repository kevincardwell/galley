/**
 * Wire shapes shared by the SSE route, the POST route and the browser
 * provider. Binary Yjs data travels as base64 so everything fits in JSON and
 * text/event-stream.
 */

export type AwarenessMessage = { clientId: number; clock: number; state: Record<string, unknown> | null };

export type SyncEvent = { section: string; state: string; vector: string };
export type UpdateEvent = { section: string; update: string };
export type AwarenessEvent = { section: string } & AwarenessMessage;
export type SavedEvent = { section: string; version: number; updatedAt: number };

export type PostBody = { client: string; update?: string; awareness?: AwarenessMessage | null };

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(text, "base64"));
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
