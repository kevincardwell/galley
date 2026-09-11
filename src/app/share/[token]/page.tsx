import { notFound, redirect } from "next/navigation";
import { firstPage, workspaceByShareToken } from "@/lib/queries/copy";

export default async function ShareIndex({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ws = workspaceByShareToken(token);
  if (!ws) notFound();
  const page = firstPage(ws.id);
  redirect(page ? `/share/${token}/${page.slug}` : `/share/${token}/files`);
}
