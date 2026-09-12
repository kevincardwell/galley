import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = [/^\/login/, /^\/setup/, /^\/invite\//, /^\/share\//, /^\/sw\.js$/, /^\/offline$/, /^\/manifest\.webmanifest$/, /^\/api\/health/, /^\/api\/file\//, /^\/api\/calendar\//, /^\/_next\//, /^\/favicon/];
const COOKIE = "galley_session";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => p.test(pathname))) return NextResponse.next();
  if (!req.cookies.get(COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.\\w+$).*)"] };
