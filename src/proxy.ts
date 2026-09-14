import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = [/^\/login/, /^\/setup/, /^\/invite\//, /^\/share\//, /^\/sw\.js$/, /^\/offline$/, /^\/manifest\.webmanifest$/, /^\/api\/health/, /^\/api\/file\//, /^\/api\/calendar\//, /^\/api\/upload$/, /^\/api\/auth\/forward$/, /^\/_next\//, /^\/favicon/];
const COOKIE = "galley_session";

// Set when Galley sits behind a proxy that has already authenticated the caller.
// Read here only to decide where to send them; the header itself is checked, and
// the account resolved, in /api/auth/forward where the database lives.
const FORWARD_AUTH = process.env.GALLEY_AUTH_HEADERS === "1" || process.env.GALLEY_AUTH_HEADERS?.toLowerCase() === "true";
const FORWARD_EMAIL_HEADER = (process.env.GALLEY_AUTH_EMAIL_HEADER || "Remote-Email").toLowerCase();

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => p.test(pathname))) return NextResponse.next();
  if (!req.cookies.get(COOKIE)?.value) {
    const url = req.nextUrl.clone();
    const next = pathname !== "/" ? pathname : "";
    // The proxy vouched for them: swap the sign-in page for the handler that
    // turns that into a session. It falls back to /login if the header is no good.
    if (FORWARD_AUTH && req.headers.get(FORWARD_EMAIL_HEADER)) {
      url.pathname = "/api/auth/forward";
      url.search = next ? `?next=${encodeURIComponent(next)}` : "";
      return NextResponse.redirect(url);
    }
    url.pathname = "/login";
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.\\w+$).*)"] };
