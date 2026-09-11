import "server-only";
import * as Y from "yjs";
import { eq } from "drizzle-orm";
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "y-prosemirror";
import { db, schema } from "@/db/client";
import { listCollabUpdates } from "@/lib/queries/copy";
import { asDoc } from "@/lib/copy/serialize";
import type { TiptapDoc } from "@/lib/copy/serialize";
import { copyExtensions, Y_FIELD } from "./extensions";
import { snapshotSection } from "./snapshot";
import type { AwarenessMessage } from "./protocol";

/**
 * In-memory collaboration rooms, one per section.
 *
 * Why not websockets: Next.js route handlers cannot upgrade a connection, and
 * the app ships as one container on one port behind whatever reverse proxy the
 * user has. Server-sent events for the downstream and plain POSTs for the
 * upstream work through every proxy and need no second process.
 *
 * Durability: every incoming update is appended to collab_updates right away,
 * so nothing acknowledged to a client is ever lost. Periodically the room is
 * compacted: sections.ydoc gets the full encoded state and, in the same
 * transaction, the section's update rows are deleted. There is no snapshot
 * sequence column, so this "snapshot + delete" rule is what keeps
 * "ydoc + all remaining rows" a correct reconstruction on load.
 */

export type ClientSend = (event: string, data: object) => void;
export type RoomClient = { id: string; userId: string; userName: string; send: ClientSend; lastSeen?: number };

export type Room = {
  sectionId: string;
  workspaceId: string;
  doc: Y.Doc;
  clients: Map<string, RoomClient>;
  awareness: Map<string, AwarenessMessage>;
  /** Updates appended since the last compaction. */
  pending: number;
  /** Who last changed the document; credited on the next snapshot. */
  lastEditor: string | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  evictTimer: ReturnType<typeof setTimeout> | null;
};

export const COMPACT_EVERY = 30;
export const IDLE_PERSIST_MS = 10_000;
export const EVICT_AFTER_MS = 5 * 60_000;
/** A client that has neither posted nor been re-announced for this long is gone (its stream close was never observed). */
export const STALE_CLIENT_MS = 45_000;

type Hub = { rooms: Map<string, Room>; schema: ReturnType<typeof getSchema> | null; impl?: HubImpl };
const g = globalThis as unknown as { __galleyCollab?: Hub };
const hub: Hub = (g.__galleyCollab ??= { rooms: new Map(), schema: null });

function pmSchema() {
  return (hub.schema ??= getSchema(copyExtensions()));
}

/**
 * Tiptap JSON of the live document, shaped like `editor.getJSON()`:
 * y-prosemirror emits `attrs: {}` where ProseMirror omits empty attrs, and
 * the snapshot compares JSON to decide whether a version is due.
 */
function docToJSON(doc: Y.Doc): TiptapDoc {
  return asDoc(stripEmptyAttrs(yDocToProsemirrorJSON(doc, Y_FIELD)));
}

function stripEmptyAttrs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmptyAttrs);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "attrs" && v && typeof v === "object" && Object.keys(v).length === 0) continue;
    out[k] = stripEmptyAttrs(v);
  }
  return out;
}

function loadDoc(sectionId: string, content: unknown, stored: Buffer | null): Y.Doc {
  if (stored) {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(stored));
    for (const r of listCollabUpdates(sectionId)) Y.applyUpdate(doc, new Uint8Array(r.update));
    return doc;
  }
  // Section predates collaboration: seed from the Tiptap JSON. The seed is
  // written back immediately so that any update logged afterwards refers to a
  // stored base; re-seeding on the next load would produce different Yjs
  // struct ids and the log would no longer apply.
  const doc = prosemirrorJSONToYDoc(pmSchema(), asDoc(content), Y_FIELD);
  db.transaction(() => {
    db.update(schema.sections).set({ ydoc: Buffer.from(Y.encodeStateAsUpdate(doc)) }).where(eq(schema.sections.id, sectionId)).run();
    db.delete(schema.collabUpdates).where(eq(schema.collabUpdates.sectionId, sectionId)).run();
  });
  return doc;
}

/** Returns the live room for a section, loading it from the database on first use. */
function getRoom(sectionId: string): Room | null {
  const existing = hub.rooms.get(sectionId);
  if (existing) return existing;
  const section = db.select().from(schema.sections).where(eq(schema.sections.id, sectionId)).get();
  if (!section) return null;
  const room: Room = {
    sectionId,
    workspaceId: section.workspaceId,
    doc: loadDoc(sectionId, section.content, section.ydoc),
    clients: new Map(),
    awareness: new Map(),
    pending: 0,
    lastEditor: null,
    idleTimer: null,
    evictTimer: null,
  };
  hub.rooms.set(sectionId, room);
  scheduleEviction(room);
  return room;
}

function peekRoom(sectionId: string): Room | undefined {
  return hub.rooms.get(sectionId);
}

function broadcast(room: Room, event: string, data: object, except?: string) {
  for (const c of room.clients.values()) {
    if (c.id === except) continue;
    try {
      c.send(event, data);
    } catch {
      room.clients.delete(c.id);
    }
  }
}

function joinRoom(room: Room, client: RoomClient) {
  if (room.evictTimer) clearTimeout(room.evictTimer);
  room.evictTimer = null;
  client.lastSeen = Date.now();
  room.clients.set(client.id, client);
  client.send("sync", {
    section: room.sectionId,
    state: Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString("base64"),
    vector: Buffer.from(Y.encodeStateVector(room.doc)).toString("base64"),
  });
  for (const [id, a] of room.awareness) if (id !== client.id) client.send("awareness", { section: room.sectionId, ...a });
}

/** Marks a client alive; the POST route calls this on every message. */
function touchClient(room: Room, clientId: string) {
  const c = room.clients.get(clientId);
  if (c) c.lastSeen = Date.now();
}

/**
 * Drops clients whose stream ended without the abort being observed (a
 * reload in dev, a proxy that swallows the close). Browsers re-announce
 * awareness every 15s, so a live client is never this quiet.
 */
function sweepStaleClients(now = Date.now()) {
  for (const room of hub.rooms.values()) {
    for (const c of room.clients.values()) {
      if (now - (c.lastSeen ?? now) > STALE_CLIENT_MS) leaveRoom(room, c.id);
    }
  }
}

function leaveRoom(room: Room, clientId: string) {
  room.clients.delete(clientId);
  const a = room.awareness.get(clientId);
  if (a) {
    room.awareness.delete(clientId);
    // y-protocols removes a client when it sees a null state at the same clock.
    broadcast(room, "awareness", { section: room.sectionId, clientId: a.clientId, clock: a.clock, state: null });
  }
  if (room.clients.size === 0) scheduleEviction(room);
}

/** Applies a client's update, logs it durably and fans it out to everyone else. */
function applyClientUpdate(room: Room, update: Uint8Array, from: { clientId: string; userId: string }) {
  Y.applyUpdate(room.doc, update, from.clientId);
  db.insert(schema.collabUpdates).values({ sectionId: room.sectionId, update: Buffer.from(update) }).run();
  room.pending += 1;
  room.lastEditor = from.userId;
  broadcast(room, "update", { section: room.sectionId, update: Buffer.from(update).toString("base64") }, from.clientId);
  if (room.pending >= COMPACT_EVERY) persistRoom(room);
  else scheduleIdlePersist(room);
}

function setAwareness(room: Room, clientId: string, message: AwarenessMessage | null) {
  if (!message || message.state === null) {
    const prev = room.awareness.get(clientId);
    room.awareness.delete(clientId);
    if (prev) broadcast(room, "awareness", { section: room.sectionId, clientId: prev.clientId, clock: Math.max(message?.clock ?? 0, prev.clock), state: null }, clientId);
    return;
  }
  // A state only counts while its stream is attached; otherwise a POST that
  // lands after the stream closed (page unload, keepalive) leaves a ghost cursor.
  if (!room.clients.has(clientId)) return;
  room.awareness.set(clientId, message);
  broadcast(room, "awareness", { section: room.sectionId, ...message }, clientId);
}

function scheduleIdlePersist(room: Room) {
  if (room.idleTimer) clearTimeout(room.idleTimer);
  room.idleTimer = setTimeout(() => persistRoom(room), IDLE_PERSIST_MS);
}

function scheduleEviction(room: Room) {
  if (room.evictTimer) clearTimeout(room.evictTimer);
  room.evictTimer = setTimeout(() => evictRoom(room), EVICT_AFTER_MS);
}

/**
 * Compacts the update log into sections.ydoc and refreshes the classic
 * columns. Safe to call at any time; a no-op when nothing changed.
 */
function persistRoom(room: Room, by?: string | null): { version: number; updatedAt: number } | null {
  if (room.idleTimer) clearTimeout(room.idleTimer);
  room.idleTimer = null;
  if (room.pending === 0 && by === undefined) return null;
  const userId = by ?? room.lastEditor;
  const result = db.transaction(() => {
    db.update(schema.sections).set({ ydoc: Buffer.from(Y.encodeStateAsUpdate(room.doc)) }).where(eq(schema.sections.id, room.sectionId)).run();
    db.delete(schema.collabUpdates).where(eq(schema.collabUpdates.sectionId, room.sectionId)).run();
    return snapshotSection(room.sectionId, docToJSON(room.doc), userId);
  });
  room.pending = 0;
  if (result.changed) broadcast(room, "saved", { section: room.sectionId, version: result.version, updatedAt: result.updatedAt });
  return { version: result.version, updatedAt: result.updatedAt };
}

function evictRoom(room: Room) {
  if (room.clients.size > 0) return;
  try {
    persistRoom(room);
  } finally {
    if (room.idleTimer) clearTimeout(room.idleTimer);
    if (room.evictTimer) clearTimeout(room.evictTimer);
    hub.rooms.delete(room.sectionId);
    room.doc.destroy();
  }
}

/**
 * Next bundles this module once per server layer (route handlers, server
 * actions), each with its own copy of yjs. Rooms are shared through
 * globalThis, and yjs/y-prosemirror rely on `instanceof`, so every layer must
 * operate rooms through the copy that created them: the first instance to
 * load registers itself and the others delegate to it.
 */
type HubImpl = {
  docToJSON: typeof docToJSON;
  getRoom: typeof getRoom;
  peekRoom: typeof peekRoom;
  joinRoom: typeof joinRoom;
  touchClient: typeof touchClient;
  sweepStaleClients: typeof sweepStaleClients;
  leaveRoom: typeof leaveRoom;
  applyClientUpdate: typeof applyClientUpdate;
  setAwareness: typeof setAwareness;
  persistRoom: typeof persistRoom;
  evictRoom: typeof evictRoom;
};
const impl: HubImpl = (hub.impl ??= { docToJSON, getRoom, peekRoom, joinRoom, touchClient, sweepStaleClients, leaveRoom, applyClientUpdate, setAwareness, persistRoom, evictRoom });

const docToJSON_: typeof docToJSON = (doc) => impl.docToJSON(doc);
const getRoom_: typeof getRoom = (id) => impl.getRoom(id);
const peekRoom_: typeof peekRoom = (id) => impl.peekRoom(id);
const joinRoom_: typeof joinRoom = (room, client) => impl.joinRoom(room, client);
const touchClient_: typeof touchClient = (room, id) => impl.touchClient(room, id);
const sweepStaleClients_: typeof sweepStaleClients = (now) => impl.sweepStaleClients(now);
const leaveRoom_: typeof leaveRoom = (room, id) => impl.leaveRoom(room, id);
const applyClientUpdate_: typeof applyClientUpdate = (room, update, from) => impl.applyClientUpdate(room, update, from);
const setAwareness_: typeof setAwareness = (room, id, m) => impl.setAwareness(room, id, m);
const persistRoom_: typeof persistRoom = (room, by) => impl.persistRoom(room, by);
const evictRoom_: typeof evictRoom = (room) => impl.evictRoom(room);

export {
  docToJSON_ as docToJSON,
  getRoom_ as getRoom,
  peekRoom_ as peekRoom,
  joinRoom_ as joinRoom,
  touchClient_ as touchClient,
  sweepStaleClients_ as sweepStaleClients,
  leaveRoom_ as leaveRoom,
  applyClientUpdate_ as applyClientUpdate,
  setAwareness_ as setAwareness,
  persistRoom_ as persistRoom,
  evictRoom_ as evictRoom,
};
