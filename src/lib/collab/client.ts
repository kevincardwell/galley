import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate } from "y-protocols/awareness";
import { fromBase64, toBase64 } from "./protocol";
import type { AwarenessEvent, AwarenessMessage, SavedEvent, SyncEvent, UpdateEvent } from "./protocol";

/**
 * Browser side of the collaboration transport: an EventSource for everything
 * coming down and small JSON POSTs for everything going up. See hub.ts for why
 * this is not a websocket.
 */

export type CollabStatus = "connecting" | "connected" | "offline";
export type Peer = { clientId: number; name: string; color: string };
export type SavedInfo = { version: number; updatedAt: number };

export type ProviderOptions = {
  sectionId: string;
  doc: Y.Doc;
  user: { name: string; color: string };
  readOnly: boolean;
  /** Share one stream between the sections of a page. Optional: without it the provider opens its own. */
  connection?: CollabConnection;
  onStatus?: (status: CollabStatus) => void;
  onSaved?: (info: SavedInfo) => void;
  /** Fires when local changes are queued, sent, or acknowledged. */
  onPending?: (state: "dirty" | "saving" | "saved") => void;
  onPeers?: (peers: Peer[]) => void;
};

export type SseProvider = {
  awareness: Awareness;
  readonly status: CollabStatus;
  /** Sends whatever is queued right now (used on page hide and Cmd+S). */
  flush: () => Promise<void>;
  destroy: () => void;
};

const DEBOUNCE_MS = 40;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];

export function newClientId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Listener = {
  onSync: (e: SyncEvent) => void;
  onUpdate: (e: UpdateEvent) => void;
  onAwareness: (e: AwarenessEvent) => void;
  onSaved: (e: SavedEvent) => void;
};

/**
 * One EventSource for a set of sections. Browsers allow six HTTP/1.1
 * connections per host, so a page with many sections cannot afford a stream
 * each; the events route multiplexes rooms and tags every event with its
 * section id.
 */
export class CollabConnection {
  readonly clientId = newClientId();
  status: CollabStatus = "connecting";
  private source: EventSource | null = null;
  private listeners = new Map<string, Listener>();
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private statusListeners = new Set<(s: CollabStatus) => void>();
  private closed = false;

  constructor(private sectionIds: string[]) {}

  subscribe(sectionId: string, listener: Listener, onStatus?: (s: CollabStatus) => void) {
    // A closed connection reopens on the next subscriber (React strict mode mounts twice).
    this.closed = false;
    this.listeners.set(sectionId, listener);
    if (onStatus) {
      this.statusListeners.add(onStatus);
      onStatus(this.status);
    }
    if (!this.sectionIds.includes(sectionId)) {
      this.sectionIds = [...this.sectionIds, sectionId];
      this.reconnect(0);
    } else if (!this.source && !this.retryTimer) this.open();
    return () => {
      this.listeners.delete(sectionId);
      if (onStatus) this.statusListeners.delete(onStatus);
      if (this.listeners.size === 0) this.close();
    };
  }

  private setStatus(s: CollabStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }

  private open() {
    if (this.closed || this.sectionIds.length === 0) return;
    const [primary, ...rest] = this.sectionIds;
    const qs = new URLSearchParams({ client: this.clientId });
    if (rest.length) qs.set("sections", rest.join(","));
    const es = new EventSource(`/api/collab/${primary}/events?${qs.toString()}`);
    this.source = es;
    this.setStatus(this.attempts === 0 ? "connecting" : this.status);
    const on = <T extends { section: string }>(name: string, pick: (l: Listener) => (e: T) => void) =>
      es.addEventListener(name, (ev) => {
        const data = JSON.parse((ev as MessageEvent<string>).data) as T;
        const l = this.listeners.get(data.section);
        if (l) pick(l)(data);
      });
    on<SyncEvent>("sync", (l) => l.onSync);
    on<UpdateEvent>("update", (l) => l.onUpdate);
    on<AwarenessEvent>("awareness", (l) => l.onAwareness);
    on<SavedEvent>("saved", (l) => l.onSaved);
    es.onopen = () => {
      this.attempts = 0;
      this.setStatus("connected");
    };
    es.onerror = () => {
      // EventSource retries on its own for transient drops, but a 404/closed
      // response leaves it in CLOSED; either way we own the backoff.
      es.close();
      if (this.source === es) this.source = null;
      this.setStatus("offline");
      this.reconnect(BACKOFF_MS[Math.min(this.attempts++, BACKOFF_MS.length - 1)]!);
    };
  }

  private reconnect(delay: number) {
    if (this.closed) return;
    this.source?.close();
    this.source = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }

  close() {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.source?.close();
    this.source = null;
  }
}

/** Builds a y-protocols awareness update for one remote client from the JSON the server relays. */
function remoteAwarenessUpdate(message: AwarenessMessage): Uint8Array {
  // Format (lib0 varints): count, then per entry clientId, clock, JSON string.
  const json = new TextEncoder().encode(JSON.stringify(message.state));
  const out: number[] = [];
  const varUint = (n: number) => {
    while (n > 127) {
      out.push(128 | (n & 127));
      n = Math.floor(n / 128);
    }
    out.push(n);
  };
  varUint(1);
  varUint(message.clientId);
  varUint(message.clock);
  varUint(json.length);
  for (const b of json) out.push(b);
  return Uint8Array.from(out);
}

export function createSseProvider(opts: ProviderOptions): SseProvider {
  const { doc, sectionId } = opts;
  const connection = opts.connection ?? new CollabConnection([sectionId]);
  const ownsConnection = !opts.connection;
  const awareness = new Awareness(doc);
  awareness.setLocalStateField("user", opts.user);

  let pendingUpdates: Uint8Array[] = [];
  let pendingAwareness: AwarenessMessage | null | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> | null = null;
  let destroyed = false;
  let synced = false;
  const origin = { provider: sectionId };

  const peers = () => {
    const list: Peer[] = [];
    for (const [id, state] of awareness.getStates()) {
      if (id === doc.clientID) continue;
      const u = (state as { user?: { name?: string; color?: string } }).user;
      if (u?.name) list.push({ clientId: id, name: u.name, color: u.color ?? "#888" });
    }
    opts.onPeers?.(list);
  };

  const localAwarenessMessage = (): AwarenessMessage => ({
    clientId: doc.clientID,
    clock: awareness.meta.get(doc.clientID)?.clock ?? 0,
    state: (awareness.getLocalState() as Record<string, unknown> | null) ?? null,
  });

  async function send(keepalive = false): Promise<void> {
    if (destroyed && !keepalive) return;
    if (inFlight) await inFlight;
    if (pendingUpdates.length === 0 && pendingAwareness === undefined) return;
    const updates = pendingUpdates;
    const aw = pendingAwareness;
    pendingUpdates = [];
    pendingAwareness = undefined;
    const body: { client: string; update?: string; awareness?: AwarenessMessage | null } = { client: connection.clientId };
    if (updates.length) body.update = toBase64(updates.length === 1 ? updates[0]! : Y.mergeUpdates(updates));
    if (aw !== undefined) body.awareness = aw;
    if (updates.length) opts.onPending?.("saving");
    inFlight = (async () => {
      try {
        const res = await fetch(`/api/collab/${sectionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive,
        });
        if (!res.ok) throw new Error(`collab post ${res.status}`);
        if (updates.length && pendingUpdates.length === 0) opts.onPending?.("saved");
      } catch {
        // Put the bytes back; they go out with the next batch or on reconnect.
        if (updates.length) {
          pendingUpdates = [...updates, ...pendingUpdates];
          opts.onPending?.("dirty");
        }
        if (aw !== undefined && pendingAwareness === undefined) pendingAwareness = aw;
        schedule(1000);
      } finally {
        inFlight = null;
      }
    })();
    await inFlight;
  }

  function schedule(delay = DEBOUNCE_MS) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void send();
    }, delay);
  }

  const onDocUpdate = (update: Uint8Array, updateOrigin: unknown) => {
    if (updateOrigin === origin || opts.readOnly) return;
    pendingUpdates.push(update);
    opts.onPending?.("dirty");
    schedule();
  };
  doc.on("update", onDocUpdate);

  const onAwarenessUpdate = (_changes: unknown, updateOrigin: unknown) => {
    // The caret plugin sets its awareness field while the editor is being
    // built, i.e. during a React render; report peers from a fresh task.
    setTimeout(peers, 0);
    if (updateOrigin !== "local") return;
    pendingAwareness = localAwarenessMessage();
    schedule();
  };
  awareness.on("update", onAwarenessUpdate);

  const unsubscribe = connection.subscribe(
    sectionId,
    {
      onSync: (e) => {
        Y.applyUpdate(doc, fromBase64(e.state), origin);
        synced = true;
        // Anything written while we were away (or before the first sync) is
        // exactly the diff against the server's state vector.
        if (!opts.readOnly) {
          const diff = Y.encodeStateAsUpdate(doc, fromBase64(e.vector));
          if (diff.length > 2) pendingUpdates = [diff];
        }
        // Re-announce with a fresh clock: peers may have seen us leave.
        awareness.setLocalState(awareness.getLocalState());
        pendingAwareness = localAwarenessMessage();
        schedule(0);
      },
      onUpdate: (e) => Y.applyUpdate(doc, fromBase64(e.update), origin),
      onAwareness: (e) => applyAwarenessUpdate(awareness, remoteAwarenessUpdate(e), "remote"),
      onSaved: (e) => opts.onSaved?.({ version: e.version, updatedAt: e.updatedAt }),
    },
    (s) => opts.onStatus?.(s),
  );

  // Tab hidden: flush edits with keepalive so nothing is lost. Page going
  // away: also withdraw our cursor rather than re-announce it.
  const onHide = () => {
    if (document.visibilityState !== "hidden") return;
    if (timer) clearTimeout(timer);
    timer = null;
    if (pendingAwareness !== null) pendingAwareness = undefined;
    void send(true);
  };
  const onPageHide = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingAwareness = null;
    void send(true);
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);

  return {
    awareness,
    get status() {
      return connection.status;
    },
    flush: async () => {
      if (timer) clearTimeout(timer);
      timer = null;
      await send();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      doc.off("update", onDocUpdate);
      awareness.off("update", onAwarenessUpdate);
      if (timer) clearTimeout(timer);
      // Tell the room we left so our cursor disappears for others.
      pendingUpdates = synced ? pendingUpdates : [];
      pendingAwareness = null;
      void send(true);
      unsubscribe();
      awareness.destroy();
      if (ownsConnection) connection.close();
    },
  };
}
