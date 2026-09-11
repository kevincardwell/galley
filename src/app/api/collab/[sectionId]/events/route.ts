import { collabAccess } from "@/lib/collab/access";
import { getRoom, joinRoom, leaveRoom, sweepStaleClients, type Room, type RoomClient } from "@/lib/collab/hub";

const KEEPALIVE_MS = 20_000;
const MAX_SECTIONS = 60;

type Params = Promise<{ sectionId: string }>;

/**
 * Downstream channel: one text/event-stream carrying `sync`, `update`,
 * `awareness` and `saved` events. The path names the primary section; the
 * optional `sections` query lists further sections of the same workspace to
 * multiplex onto this stream, because browsers cap HTTP/1.1 connections per
 * host at six and a page can have more sections than that.
 */
export async function GET(req: Request, ctx: { params: Params }) {
  const { sectionId } = await ctx.params;
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client") ?? "";
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(clientId)) return new Response("Bad client id", { status: 400 });

  const primary = await collabAccess(sectionId);
  if (!primary) return new Response(null, { status: 404 });

  const extra = (url.searchParams.get("sections") ?? "").split(",").filter((s) => s && s !== sectionId).slice(0, MAX_SECTIONS);
  const rooms: Room[] = [];
  for (const id of [sectionId, ...extra]) {
    const access = id === sectionId ? primary : await collabAccess(id);
    // Extra sections must belong to the same workspace as the primary one.
    if (!access || access.workspaceId !== primary.workspaceId) continue;
    const room = getRoom(id);
    if (room) rooms.push(room);
  }
  if (rooms.length === 0) return new Response(null, { status: 404 });

  const encoder = new TextEncoder();
  let closed = false;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const send = (event: string, data: object) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      const client: RoomClient = { id: clientId, userId: primary.user.id, userName: primary.user.name, send };

      const close = () => {
        if (closed) return;
        closed = true;
        if (keepalive) clearInterval(keepalive);
        for (const room of rooms) leaveRoom(room, clientId);
        try {
          controller.close();
        } catch {
          // already closed by the peer
        }
      };

      write(`retry: 2000\n\n`);
      for (const room of rooms) joinRoom(room, client);
      // Comment lines keep proxies and the browser from timing the stream out.
      keepalive = setInterval(() => {
        write(": ping\n\n");
        sweepStaleClients();
      }, KEEPALIVE_MS);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      if (keepalive) clearInterval(keepalive);
      for (const room of rooms) leaveRoom(room, clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
