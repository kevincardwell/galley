import { collabAccess } from "@/lib/collab/access";
import { applyClientUpdate, getRoom, setAwareness, touchClient } from "@/lib/collab/hub";
import { fromBase64, type AwarenessMessage, type PostBody } from "@/lib/collab/protocol";

const MAX_UPDATE_B64 = 4 * 1024 * 1024;

type Params = Promise<{ sectionId: string }>;

function isAwareness(v: unknown): v is AwarenessMessage {
  if (!v || typeof v !== "object") return false;
  const a = v as Partial<AwarenessMessage>;
  return typeof a.clientId === "number" && typeof a.clock === "number" && (a.state === null || (typeof a.state === "object" && a.state !== null));
}

/** Upstream channel: a Yjs update and/or an awareness change from one client. */
export async function POST(req: Request, ctx: { params: Params }) {
  const { sectionId } = await ctx.params;
  const access = await collabAccess(sectionId);
  if (!access) return new Response(null, { status: 404 });

  let body: Partial<PostBody>;
  try {
    body = (await req.json()) as Partial<PostBody>;
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const clientId = typeof body.client === "string" ? body.client : "";
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(clientId)) return Response.json({ error: "Bad client id" }, { status: 400 });

  const room = getRoom(sectionId);
  if (!room) return new Response(null, { status: 404 });
  touchClient(room, clientId);

  if (typeof body.update === "string" && body.update.length > 0) {
    if (!access.canEdit) return Response.json({ error: "Read only" }, { status: 403 });
    if (body.update.length > MAX_UPDATE_B64) return Response.json({ error: "Update too large" }, { status: 413 });
    let bytes: Uint8Array;
    try {
      bytes = fromBase64(body.update);
    } catch {
      return Response.json({ error: "Bad update" }, { status: 400 });
    }
    try {
      applyClientUpdate(room, bytes, { clientId, userId: access.user.id });
    } catch {
      return Response.json({ error: "Update rejected" }, { status: 400 });
    }
  }

  if (body.awareness === null) setAwareness(room, clientId, null);
  else if (body.awareness !== undefined) {
    if (!isAwareness(body.awareness)) return Response.json({ error: "Bad awareness" }, { status: 400 });
    // Never trust the client's claim about who they are.
    const state = body.awareness.state ? { ...body.awareness.state, user: { ...(asRecord(body.awareness.state.user) ?? {}), name: access.user.name } } : null;
    setAwareness(room, clientId, { clientId: body.awareness.clientId, clock: body.awareness.clock, state });
  }

  return Response.json({ ok: true });
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}
