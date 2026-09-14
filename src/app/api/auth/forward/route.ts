import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth/session";
import { getSessionUser } from "@/lib/auth/session";
import { resolveForwardAuth } from "@/lib/auth/forward";
import { logAudit } from "@/lib/activity";

/**
 * Signs someone in from the headers a reverse proxy set, then sends them on.
 *
 * A route handler rather than the middleware because it needs the database, and
 * rather than a server component because only a handler may set a cookie. The
 * proxy sends unauthenticated requests here when forward auth is switched on;
 * everything downstream then sees an ordinary Galley session.
 */

/** Only ever bounce to a path inside this app: `next` arrives from the query string. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));

  // Already signed in: nothing to do, and re-issuing would churn sessions on every navigation.
  if (await getSessionUser()) redirect(next);

  const result = resolveForwardAuth(req.headers);
  if (!result.ok) {
    // Never loop back through the proxy's redirect; land on the normal login page.
    redirect(`/login?sso=${result.reason}`);
  }

  await createSession(result.user.id);
  logAudit({ actorId: result.user.id, action: "session.proxy_login", subjectType: "user", subjectId: result.user.id });
  redirect(next);
}
