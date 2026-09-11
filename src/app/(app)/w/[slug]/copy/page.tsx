import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { requireAccess } from "@/lib/permissions";
import { db, schema } from "@/db/client";
import { newId } from "@/lib/ids";
import { firstPage } from "@/lib/queries/copy";

/** /copy has no body of its own: it lands on the first page, creating "Home" if the workspace has none. */
export default async function CopyIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { workspace } = requireAccess(user, slug);
  let page = firstPage(workspace.id);
  if (!page) {
    db.insert(schema.pages).values({ id: newId(), workspaceId: workspace.id, title: "Home", slug: "home", position: 0 }).run();
    page = firstPage(workspace.id);
  }
  redirect(`/w/${slug}/copy/${page!.slug}`);
}
