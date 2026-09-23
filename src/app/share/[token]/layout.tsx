import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Pill } from "@/components/ui/pill";
import { GuestIdentity } from "@/components/share/guest-identity";
import { listPages, waitingOnClient, workspaceByShareToken } from "@/lib/queries/copy";
import { ShareNav } from "./nav";

const SHOW_WAITING = 8;

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
  const waiting = ws.shareReview ? waitingOnClient(ws.id) : [];
  const pages = listPages(ws.id).map((p) => ({ slug: p.slug, title: p.title, waiting: waiting.filter((w) => w.pageSlug === p.slug).length }));

  return (
    <div className="flex min-h-dvh flex-col bg-surface font-ui text-ink" style={{ ["--accent" as string]: ws.accent }}>
      <span aria-hidden className="block h-1 shrink-0 bg-accent" />

      <header className="px-5 pt-9 pb-7 sm:px-8">
        <div className="mx-auto flex w-full max-w-[880px] flex-wrap items-center gap-x-4 gap-y-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent font-serif text-xl font-semibold text-accent-ink">{ws.name[0]}</span>
          <div className="min-w-[min(100%,15rem)] flex-1">
            <h1 className="m-0 truncate text-[22px] leading-tight font-semibold tracking-tight">
              <Link href={`/share/${token}`} className="cursor-pointer rounded-r hover:underline">{ws.name}</Link>
            </h1>
            <p className="m-0 mt-1 truncate text-[13px] text-ink-2">{ws.clientName ? `Prepared for ${ws.clientName}` : "Prepared for you"}</p>
          </div>
          {ws.shareReview || ws.shareUploads ? <GuestIdentity /> : <Pill tone="neutral" dot={false}>Read-only preview</Pill>}
        </div>

        {waiting.length > 0 && (
          <div className="mx-auto mt-6 w-full max-w-[880px] rounded-lg border border-accent-line bg-accent-soft px-4 py-3.5 text-[13px]">
            <p className="m-0 font-medium">
              {waiting.length === 1 ? "One section is" : `${waiting.length} sections are`} waiting for your approval
            </p>
            <p className="m-0 mt-0.5 text-ink-2">Read each one, then approve it or suggest the wording you would like instead.</p>
            <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-1.5 p-0">
              {waiting.slice(0, SHOW_WAITING).map((w) => (
                <li key={w.id} className="min-w-0">
                  <Link
                    href={`/share/${token}/${w.pageSlug}#s-${w.id}`}
                    className="block max-w-full cursor-pointer truncate rounded-full border border-accent-line bg-surface px-2.5 py-0.5 text-xs text-ink transition-colors duration-150 hover:border-accent"
                  >
                    {w.pageTitle} › {w.title}
                  </Link>
                </li>
              ))}
              {waiting.length > SHOW_WAITING && <li className="px-1 py-0.5 text-xs text-ink-2">and {waiting.length - SHOW_WAITING} more</li>}
            </ul>
          </div>
        )}
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
