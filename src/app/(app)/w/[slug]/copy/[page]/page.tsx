import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current";
import { requireAccess } from "@/lib/permissions";
import { findPage, listPages, listSections, sectionDetails } from "@/lib/queries/copy";
import type { SectionDetails } from "@/lib/copy/types";
import { CopyScreen } from "@/components/copy/copy-screen";

type Params = Promise<{ slug: string; page: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, page } = await params;
  const user = await requireUser();
  const { workspace } = requireAccess(user, slug);
  const p = findPage(workspace.id, page);
  return { title: p ? `${p.title} · ${workspace.name}` : workspace.name };
}

export default async function CopyPage({ params }: { params: Params }) {
  const { slug, page: pageSlug } = await params;
  const user = await requireUser();
  const access = requireAccess(user, slug);
  const ws = access.workspace;
  const page = findPage(ws.id, pageSlug);
  if (!page) notFound();

  const pages = listPages(ws.id);
  const sections = listSections(page.id);
  const details: Record<string, SectionDetails> = {};
  for (const s of sections) details[s.id] = sectionDetails(s.id);

  return (
    <CopyScreen
      key={page.id}
      workspace={{ id: ws.id, slug: ws.slug }}
      page={{ id: page.id, title: page.title, slug: page.slug }}
      pages={pages}
      sections={sections}
      details={details}
      readOnly={access.role === "viewer"}
      selfName={user.name}
    />
  );
}
