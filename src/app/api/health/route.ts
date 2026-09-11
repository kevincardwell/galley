import { sqlite } from "@/db/client";

export function GET() {
  const ok = sqlite.prepare("select 1 as ok").get() as { ok: number };
  return Response.json({ ok: ok.ok === 1, version: process.env.npm_package_version ?? "dev" });
}
