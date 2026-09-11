import { notFound } from "next/navigation";
import { Pill } from "@/components/ui/pill";
import { findPage, listSections, shareReviewForPage, workspaceByShareToken } from "@/lib/queries/copy";
import { SectionReview } from "./review";
import { isDocEmpty, tiptapToHtml } from "@/lib/copy/serialize";
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
      <p className="tnum m-0 mb-7 flex items-baseline justify-between gap-3 text-[13px] font-semibold text-ink-3">
        <span className="truncate">{page.title}</span>
        <span className="shrink-0 font-medium">{sections.length === 1 ? "1 section" : `${sections.length} sections`}</span>
      </p>
      {sections.length === 0 ? (
        <p className="m-0 text-ink-3">Nothing written for this page yet.</p>
      ) : (
        <div>
          {sections.map((s) => (
            <section key={s.id} id={`s-${s.id}`} className="border-t border-line-2 py-5 first:border-t-0 first:pt-0">
              <div className="mb-3 flex items-center gap-2.5 text-xs font-medium text-ink-3">
                <span className="truncate">{s.title}</span>
                <Pill tone={statusTone(s.status)}>{STATUS_LABEL[s.status]}</Pill>
              </div>
              {isDocEmpty(s.content) ? <p className="prose-copy m-0 text-ink-3">Empty.</p> : <div className="prose-copy" dangerouslySetInnerHTML={{ __html: tiptapToHtml(s.content) }} />}
              {review && <SectionReview token={token} sectionId={s.id} review={review[s.id] ?? { comments: [], clientApprovedAt: null, clientApprovedBy: null }} />}
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
