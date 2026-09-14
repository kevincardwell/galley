import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { getSettings } from "@/lib/settings";
import { can, requireAccess } from "@/lib/permissions";
import { listSuppliers, listWorkspaceSuppliers } from "@/lib/queries/suppliers";
import { PageHeader, Screen } from "@/components/ui/page";
import { AddToProject } from "@/components/suppliers/add-to-project";
import { linkButtonClass } from "@/components/suppliers/bits";
import { ProjectSuppliers } from "@/components/suppliers/project-suppliers";

export default async function WorkspaceSuppliersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { currency } = getSettings();
  const access = requireAccess(user, slug);
  const ws = access.workspace;
  const canEdit = can(access, "edit");

  const { rows, totals } = listWorkspaceSuppliers(ws.id);
  const directory = canEdit
    ? listSuppliers().map((s) => ({ id: s.id, name: s.name, category: s.category, email: s.email }))
    : [];

  return (
    <Screen>
      <PageHeader
        title="Suppliers"
        count={rows.length}
        description={canEdit ? "Who you are using on this project, what they cost and where each one stands." : "Who is being used on this project. Ask an editor to make changes."}
        action={
          <>
            {canEdit && rows.length > 0 && <AddToProject workspaceId={ws.id} directory={directory} linkedIds={rows.map((r) => r.supplierId)} />}
            <Link href="/suppliers" className={linkButtonClass}>
              Directory
            </Link>
          </>
        }
      />
      <ProjectSuppliers workspaceId={ws.id} rows={rows} totals={totals} directory={directory} canEdit={canEdit} currency={currency} />
    </Screen>
  );
}
