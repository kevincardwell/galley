import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current";
import { auditPage } from "@/lib/queries/admin";
import { Hint, Table, Td, Th } from "@/components/admin/bits";
import { Empty } from "@/components/ui/empty";
import { clsx } from "@/lib/clsx";

const PAGE_SIZE = 50;

function when(unix: number) {
  return new Date(unix * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function PagerLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const cls = "inline-flex items-center rounded-r border px-2.5 py-1 text-[13px] font-medium";
  if (disabled) return <span className={clsx(cls, "cursor-not-allowed border-line text-ink-3 opacity-50")}>{children}</span>;
  return <Link href={href} className={clsx(cls, "border-line bg-surface hover:bg-surface-2")}>{children}</Link>;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  const { rows, total } = auditPage(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="overflow-auto px-6 pb-8 pt-5">
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <Hint>Sign-ins, invites, role changes and deletions across the instance. Newest first.</Hint>
        <span className="tnum ml-auto text-xs text-ink-3">{total} {total === 1 ? "entry" : "entries"}</span>
      </div>
      {rows.length === 0 ? (
        <Empty title={page > 1 ? "Nothing on this page" : "Nothing logged yet"} hint={page > 1 ? "Go back a page." : "Actions show up here as people use the instance."} />
      ) : (
        <Table>
          <thead>
            <tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Subject</Th><Th>Details</Th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-ink-2">{when(r.createdAt)}</Td>
                <Td>{r.actorName ?? <span className="text-ink-3">system</span>}</Td>
                <Td><code className="rounded-r bg-surface-2 px-1.5 py-0.5 text-xs">{r.action}</code></Td>
                <Td className="text-ink-2">{r.subjectType ? <>{r.subjectType}{r.subjectId && <span className="ml-1 text-xs text-ink-3">{r.subjectId}</span>}</> : <span className="text-ink-3">—</span>}</Td>
                <Td className="max-w-md">{r.meta != null ? <code className="block truncate text-xs text-ink-2" title={JSON.stringify(r.meta)}>{JSON.stringify(r.meta)}</code> : <span className="text-ink-3">—</span>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="mt-4 flex items-center gap-2">
        <PagerLink href={`/admin/audit?page=${page - 1}`} disabled={page <= 1}>Previous</PagerLink>
        <span className="tnum text-xs text-ink-3">Page {page} of {pages}</span>
        <PagerLink href={`/admin/audit?page=${page + 1}`} disabled={page >= pages}>Next</PagerLink>
      </div>
    </div>
  );
}
