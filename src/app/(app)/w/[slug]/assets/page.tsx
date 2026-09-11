import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current";
import { requireAccess } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { ensureMediaWorker } from "@/lib/media/process";
import { applyFilters, countAssets, listAssets, listFolders, tagCounts, workspaceStorageBytes } from "@/lib/queries/assets";
import type { AssetFilters, AssetKind } from "@/lib/media/types";
import { AssetsView } from "@/components/assets/assets-view";

type Search = { asset?: string; kind?: string; tag?: string; folder?: string; unused?: string };

const KINDS: readonly AssetKind[] = ["image", "video", "pdf"];

export default async function AssetsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const access = requireAccess(user, slug);
  const ws = access.workspace;
  ensureMediaWorker();

  const filters: AssetFilters = {
    kind: KINDS.includes(sp.kind as AssetKind) ? (sp.kind as AssetKind) : undefined,
    tag: sp.tag || undefined,
    folder: sp.folder || undefined,
    unused: sp.unused === "1" || undefined,
  };

  const all = listAssets(ws.id, slug);
  const items = applyFilters(all, filters);
  const canEdit = access.role === "admin" || access.role === "manager" || access.role === "editor";

  return (
    <Suspense>
      <AssetsView
        workspaceId={ws.id}
        slug={slug}
        items={items}
        totalCount={all.length}
        counts={countAssets(all)}
        folders={listFolders(ws.id, all)}
        tags={tagCounts(all)}
        filters={filters}
        selectedId={sp.asset && all.some((a) => a.id === sp.asset) ? sp.asset : null}
        canEdit={canEdit}
        shareToken={ws.shareToken}
        storageBytes={workspaceStorageBytes(ws.id)}
        maxUploadMb={getSettings().maxUploadMb}
      />
    </Suspense>
  );
}
