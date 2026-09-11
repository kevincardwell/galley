import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listPages, workspaceByShareToken } from "@/lib/queries/copy";
import { ShareNav } from "./nav";

type Params = Promise<{ token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const ws = workspaceByShareToken(token);
  return { title: ws ? `${ws.name} · Shared copy` : "Not found", robots: { index: false, follow: false } };
}

/** Public, read-only client view. No sidebar, no auth; the token is the whole key. */
export default async function ShareLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ws = workspaceByShareToken(token);
  if (!ws) notFound();
  const pages = listPages(ws.id).map((p) => ({ slug: p.slug, title: p.title }));

  return (
    <div className="flex min-h-dvh flex-col bg-surface font-ui text-ink" style={{ ["--accent" as string]: ws.accent }}>
      <header className="border-b border-line px-5 pt-5 sm:px-8" style={{ background: "linear-gradient(to bottom, var(--accent-soft), var(--surface) 80%)" }}>
        <div className="mx-auto flex w-full max-w-[880px] flex-wrap items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent font-serif text-base font-semibold text-accent-ink">{ws.name[0]}</span>
          <div className="min-w-0">
            <h1 className="m-0 truncate text-lg font-semibold tracking-tight">
              <Link href={`/share/${token}`}>{ws.name}</Link>
            </h1>
            <p className="m-0 text-xs text-ink-2">{ws.clientName ? `Prepared for ${ws.clientName} · ` : ""}{ws.shareReview ? "Read, comment and approve" : "Read-only preview"}</p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[880px]">
          <ShareNav token={token} pages={pages} />
        </div>
      </header>
      <main className="flex-1 px-5 py-8 sm:px-8">
        <div className="mx-auto w-full max-w-[880px]">{children}</div>
      </main>
      <footer className="px-5 py-6 text-center text-xs text-ink-3 sm:px-8">Shared from Galley. Ask the person who sent you this link if something looks wrong.</footer>
    </div>
  );
}
