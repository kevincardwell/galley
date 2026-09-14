import { notFound } from "next/navigation";
import { Pill } from "@/components/ui/pill";
import { findPage, listSections, shareReviewForPage, workspaceByShareToken } from "@/lib/queries/copy";
import { SectionReview } from "./review";
import { docToEditableText, isDocEmpty, tiptapToHtml } from "@/lib/copy/serialize";
import { GuestWrite } from "@/components/share/guest-write";
import { STATUS_LABEL, statusTone } from "@/lib/copy/types";

export default async function SharePage({ params }: { params: Promise<{ token: string; page: string }> }) {
  const { token, page: pageSlug } = await params;
  const ws = workspaceByShareToken(token);
  if (!ws) notFound();
  const page = findPage(ws.id, pageSlug);
  if (!page) notFound();
  const sections = listSections(page.id);
  const review = ws.shareReview ? shareReviewForPage(page.id) : null;

  return (
    <article className="mx-auto max-w-[68ch]">
      <header className="mb-8">
        <p className="tnum m-0 text-xs font-medium text-ink-3">{sections.length === 1 ? "1 section" : `${sections.length} sections`}</p>
        <h2 className="m-0 mt-1.5 font-serif text-[30px] leading-tight font-medium tracking-tight">{page.title}</h2>
      </header>

      {sections.length === 0 ? (
        <p className="m-0 text-ink-3">Nothing written for this page yet.</p>
      ) : (
        <div className="flex flex-col">
          {sections.map((s) => (
            <section key={s.id} id={`s-${s.id}`} className="border-t border-line-2 py-7 first:border-t-0 first:pt-0">
              <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
                <h3 className="m-0 min-w-0 truncate text-xs font-medium tracking-wide text-ink-3 uppercase">{s.title}</h3>
                <Pill tone={statusTone(s.status)}>{STATUS_LABEL[s.status]}</Pill>
              </div>
              {review && s.clientCanWrite ? (
                // Handed to the client: the box holds what is there, so there is
                // nothing to render above it.
                <GuestWrite token={token} sectionId={s.id} title={s.title} initialText={docToEditableText(s.content)} />
              ) : isDocEmpty(s.content) ? (
                <p className="prose-copy m-0 text-ink-3">Empty.</p>
              ) : (
                <div className="prose-copy" dangerouslySetInnerHTML={{ __html: tiptapToHtml(s.content) }} />
              )}
              {review && <SectionReview token={token} sectionId={s.id} review={review[s.id] ?? { comments: [], clientApprovedAt: null, clientApprovedBy: null }} />}
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
