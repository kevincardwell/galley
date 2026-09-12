import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Pill } from "@/components/ui/pill";
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
      <span aria-hidden className="block h-1 shrink-0 bg-accent" />

      <header className="px-5 pt-9 pb-7 sm:px-8">
        <div className="mx-auto flex w-full max-w-[880px] flex-wrap items-center gap-x-4 gap-y-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent font-serif text-xl font-semibold text-accent-ink">{ws.name[0]}</span>
          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate text-[22px] leading-tight font-semibold tracking-tight">
              <Link href={`/share/${token}`} className="cursor-pointer rounded-r hover:underline">{ws.name}</Link>
            </h1>
            <p className="m-0 mt-1 truncate text-[13px] text-ink-2">{ws.clientName ? `Prepared for ${ws.clientName}` : "Prepared for you"}</p>
          </div>
          <Pill tone={ws.shareReview ? "accent" : "neutral"} dot={false}>{ws.shareReview ? "Read, comment and approve" : "Read-only preview"}</Pill>
        </div>
      </header>

      <div className="sticky top-0 z-20 border-y border-line bg-surface/90 backdrop-blur-[6px]">
        <div className="mx-auto w-full max-w-[880px] px-5 sm:px-8">
          <ShareNav token={token} pages={pages} />
        </div>
      </div>

      <main className="flex-1 px-5 py-9 sm:px-8">
        <div className="mx-auto w-full max-w-[880px]">{children}</div>
      </main>

      <footer className="border-t border-line-2 px-5 py-7 text-center text-xs text-ink-3 sm:px-8">
        Shared from Galley. Ask the person who sent you this link if something looks wrong.
      </footer>
    </div>
  );
}
