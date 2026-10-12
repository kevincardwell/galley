import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current";
import { can, requireAccess } from "@/lib/permissions";
import { getSite, previewPrefix } from "@/lib/site";
import { Empty } from "@/components/ui/empty";
import { PageHeader, Screen } from "@/components/ui/page";
import { ConnectSiteForm } from "@/components/site/site-fields";
import { SiteScreen } from "@/components/site/site-screen";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const user = await requireUser();
  const { workspace } = requireAccess(user, slug);
  return { title: `Site · ${workspace.name}` };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const access = requireAccess(user, slug);
  const ws = access.workspace;
  const site = getSite(ws.id);

  if (!site) {
    return (
      <Screen width="narrow">
        <PageHeader
          eyebrow={ws.name}
          title="Site"
          description="Edit the website itself. Click any words in the preview to change them, or open the code, then send the changes for review as a pull request."
        />
        {can(access, "manage") ? (
          <ConnectSiteForm workspaceId={ws.id} />
        ) : (
          <Empty icon="globe" title="No website connected yet" hint="Ask a manager of this project to connect the site's repository." />
        )}
      </Screen>
    );
  }

  return (
    <SiteScreen
      workspaceId={ws.id}
      previewUrl={previewPrefix(site)}
      repoLabel={site.repoUrl.replace(/^https:\/\/(www\.)?/, "")}
      baseBranch={site.baseBranch}
    />
  );
}
