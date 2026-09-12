import Link from "next/link";
import { Empty } from "@/components/ui/empty";
import { Section } from "@/components/ui/page";
import { Stat } from "@/components/ui/stat";
import { linkButtonClass, Table, Th } from "./bits";
import { AddToProject, type Candidate } from "./add-to-project";
import { LinkRow } from "./link-row";
import { formatMoney, LINK_STATUSES, STATUS_LABEL, type StatusTotals, type WorkspaceSupplierRow } from "./shared";

/** The suppliers tab of one project: totals, then a table per status. */
export function ProjectSuppliers({ workspaceId, rows, totals, directory, canEdit }: {
  workspaceId: string;
  rows: WorkspaceSupplierRow[];
  totals: StatusTotals;
  directory: Candidate[];
  canEdit: boolean;
}) {
  const linkedIds = rows.map((r) => r.supplierId);

  if (rows.length === 0) {
    return (
      <Empty
        icon="supplier"
        title="No suppliers on this project yet"
        hint="Link a florist, printer or freelancer from the directory so their cost and status live next to the work."
        action={
          <>
            {canEdit && <AddToProject workspaceId={workspaceId} directory={directory} linkedIds={linkedIds} />}
            <Link href="/suppliers" className={linkButtonClass}>
              Open the directory
            </Link>
          </>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4 rounded-lg border border-line bg-surface px-4 py-3.5">
        <Stat label="Booked" value={formatMoney(totals.booked.cost)} hint={`${totals.booked.count} supplier${totals.booked.count === 1 ? "" : "s"}`} icon="check-circle" />
        {LINK_STATUSES.filter((s) => s !== "booked").map((s) => (
          <Stat key={s} label={STATUS_LABEL[s]} value={totals[s].count} hint={totals[s].cost > 0 ? formatMoney(totals[s].cost) : undefined} />
        ))}
      </div>

      {LINK_STATUSES.map((status) => {
        const group = rows.filter((r) => r.status === status);
        if (group.length === 0) return null;
        return (
          <Section
            key={status}
            title={STATUS_LABEL[status]}
            action={
              <span className="tnum text-xs text-ink-3">
                {group.length} · {formatMoney(totals[status].cost)}
              </span>
            }
          >
            <Table>
              <thead>
                <tr>
                  <Th>Supplier</Th>
                  <Th>Contact</Th>
                  <Th numeric>Cost</Th>
                  <Th>Note</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {group.map((row) => (
                  <LinkRow key={row.id} row={row} canEdit={canEdit} />
                ))}
              </tbody>
            </Table>
          </Section>
        );
      })}
    </div>
  );
}
