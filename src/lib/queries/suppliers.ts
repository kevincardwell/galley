import "server-only";
import { and, asc, eq, inArray, isNull, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { User } from "@/db/schema";
import { listWorkspacesFor } from "@/lib/queries/workspaces";
import {
  emptyTotals,
  type StatusTotals,
  type SupplierDetail,
  type SupplierRow,
  type SupplierUsage,
  type WorkspaceSupplierRow,
} from "@/components/suppliers/shared";

/** SQLite needs to be told which character escapes a LIKE wildcard. */
const LIKE_ESCAPE = sql.raw("escape '\\'");

const supplierColumns = {
  id: schema.suppliers.id,
  name: schema.suppliers.name,
  category: schema.suppliers.category,
  contactName: schema.suppliers.contactName,
  email: schema.suppliers.email,
  phone: schema.suppliers.phone,
  website: schema.suppliers.website,
  address: schema.suppliers.address,
  notes: schema.suppliers.notes,
  rating: schema.suppliers.rating,
  archivedAt: schema.suppliers.archivedAt,
} as const;

/** Tags for a set of suppliers, in one query, alphabetical inside each supplier. */
function tagsFor(ids: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  for (const t of db.select().from(schema.supplierTags).where(inArray(schema.supplierTags.supplierId, ids)).orderBy(asc(schema.supplierTags.tag)).all()) {
    const list = map.get(t.supplierId);
    if (list) list.push(t.tag);
    else map.set(t.supplierId, [t.tag]);
  }
  return map;
}

type Usage = { projectCount: number; bookedTotal: number };
const NO_USAGE: Usage = { projectCount: 0, bookedTotal: 0 };

/**
 * How many projects use each supplier, and how much of that is booked. Done as its own grouped
 * query rather than a correlated subquery: Drizzle writes bare column names into raw SQL, which a
 * subquery over another table would resolve against the wrong table.
 */
function usageFor(ids: string[]): Map<string, Usage> {
  const map = new Map<string, Usage>();
  if (ids.length === 0) return map;
  const rows = db
    .select({
      supplierId: schema.workspaceSuppliers.supplierId,
      projectCount: sql<number>`count(*)`,
      bookedTotal: sql<number>`coalesce(sum(case when ${schema.workspaceSuppliers.status} = 'booked' then ${schema.workspaceSuppliers.cost} else 0 end), 0)`,
    })
    .from(schema.workspaceSuppliers)
    .where(inArray(schema.workspaceSuppliers.supplierId, ids))
    .groupBy(schema.workspaceSuppliers.supplierId)
    .all();
  for (const r of rows) map.set(r.supplierId, { projectCount: r.projectCount, bookedTotal: r.bookedTotal });
  return map;
}

export type SupplierFilters = { q?: string; category?: string; tag?: string; includeArchived?: boolean };

/** The whole directory: it is instance-wide, so everyone signed in sees the same rows. */
export function listSuppliers(filters: SupplierFilters = {}): SupplierRow[] {
  const where: SQL[] = [];
  if (!filters.includeArchived) where.push(isNull(schema.suppliers.archivedAt));
  if (filters.category) where.push(eq(schema.suppliers.category, filters.category));

  const q = filters.q?.trim();
  if (q) {
    // Whatever they typed is literal text, so % and _ are escaped rather than treated as wildcards.
    const needle = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const hit = (c: AnyColumn) => sql`${c} like ${needle} ${LIKE_ESCAPE}`;
    where.push(
      sql`(${hit(schema.suppliers.name)} or ${hit(schema.suppliers.category)} or ${hit(schema.suppliers.contactName)} or ${hit(schema.suppliers.email)} or ${hit(schema.suppliers.notes)})`,
    );
  }
  if (filters.tag) {
    const tagged = db.select({ id: schema.supplierTags.supplierId }).from(schema.supplierTags).where(eq(schema.supplierTags.tag, filters.tag));
    where.push(inArray(schema.suppliers.id, tagged));
  }

  const rows = db
    .select(supplierColumns)
    .from(schema.suppliers)
    .where(where.length ? and(...where) : undefined)
    .orderBy(sql`${schema.suppliers.name} collate nocase asc`)
    .all();

  const ids = rows.map((r) => r.id);
  const tags = tagsFor(ids);
  const usage = usageFor(ids);
  return rows.map((r) => ({ ...r, tags: tags.get(r.id) ?? [], ...(usage.get(r.id) ?? NO_USAGE) }));
}

export function getSupplier(id: string): SupplierRow | null {
  const row = db.select(supplierColumns).from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
  if (!row) return null;
  return { ...row, tags: tagsFor([id]).get(id) ?? [], ...(usageFor([id]).get(id) ?? NO_USAGE) };
}

/**
 * One supplier with every project link the caller is allowed to know about. Links on projects they
 * are not a member of are counted as `hidden` and never named.
 */
export function supplierDetail(id: string, user: User): SupplierDetail | null {
  const supplier = getSupplier(id);
  if (!supplier) return null;

  const visible = new Set(listWorkspacesFor(user, true).map((w) => w.ws.id));
  const links = db
    .select({
      id: schema.workspaceSuppliers.id,
      workspaceId: schema.workspaceSuppliers.workspaceId,
      supplierId: schema.workspaceSuppliers.supplierId,
      status: schema.workspaceSuppliers.status,
      cost: schema.workspaceSuppliers.cost,
      note: schema.workspaceSuppliers.note,
      workspaceName: schema.workspaces.name,
      workspaceSlug: schema.workspaces.slug,
      accent: schema.workspaces.accent,
    })
    .from(schema.workspaceSuppliers)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.workspaceSuppliers.workspaceId))
    .where(eq(schema.workspaceSuppliers.supplierId, id))
    .orderBy(sql`${schema.workspaces.name} collate nocase asc`)
    .all();

  const usage: SupplierUsage[] = links.filter((l) => visible.has(l.workspaceId));
  return { supplier, usage, hidden: links.length - usage.length };
}

const STATUS_RANK = sql`case ${schema.workspaceSuppliers.status} when 'booked' then 0 when 'enquired' then 1 when 'shortlisted' then 2 else 3 end`;

/** Everything linked to one project, ordered by status then name, with the money already added up. */
export function listWorkspaceSuppliers(workspaceId: string): { rows: WorkspaceSupplierRow[]; totals: StatusTotals } {
  const rows = db
    .select({
      id: schema.workspaceSuppliers.id,
      workspaceId: schema.workspaceSuppliers.workspaceId,
      supplierId: schema.workspaceSuppliers.supplierId,
      status: schema.workspaceSuppliers.status,
      cost: schema.workspaceSuppliers.cost,
      note: schema.workspaceSuppliers.note,
      name: schema.suppliers.name,
      category: schema.suppliers.category,
      contactName: schema.suppliers.contactName,
      email: schema.suppliers.email,
      phone: schema.suppliers.phone,
      website: schema.suppliers.website,
      archivedAt: schema.suppliers.archivedAt,
    })
    .from(schema.workspaceSuppliers)
    .innerJoin(schema.suppliers, eq(schema.suppliers.id, schema.workspaceSuppliers.supplierId))
    .where(eq(schema.workspaceSuppliers.workspaceId, workspaceId))
    .orderBy(STATUS_RANK, sql`${schema.suppliers.name} collate nocase asc`)
    .all();

  const totals = emptyTotals();
  for (const r of rows) {
    const t = totals[r.status];
    t.count += 1;
    t.cost += r.cost ?? 0;
  }
  return { rows, totals };
}

export type FacetCount = { value: string; count: number };

/** How many suppliers the directory holds, before any search or chip is applied. */
export function countSuppliers(includeArchived = false): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(schema.suppliers)
    .where(includeArchived ? undefined : isNull(schema.suppliers.archivedAt))
    .get();
  return row?.n ?? 0;
}

/** Categories in use, for the filter bar. */
export function supplierCategories(includeArchived = false): FacetCount[] {
  const live = includeArchived ? undefined : isNull(schema.suppliers.archivedAt);
  return db
    .select({ value: sql<string>`${schema.suppliers.category}`, count: sql<number>`count(*)` })
    .from(schema.suppliers)
    .where(and(live, sql`${schema.suppliers.category} is not null and trim(${schema.suppliers.category}) != ''`))
    .groupBy(schema.suppliers.category)
    .orderBy(sql`${schema.suppliers.category} collate nocase asc`)
    .all();
}

/** Tags in use, most used first. */
export function supplierTagCounts(includeArchived = false): FacetCount[] {
  return db
    .select({ value: schema.supplierTags.tag, count: sql<number>`count(*)` })
    .from(schema.supplierTags)
    .innerJoin(schema.suppliers, eq(schema.suppliers.id, schema.supplierTags.supplierId))
    .where(includeArchived ? undefined : isNull(schema.suppliers.archivedAt))
    .groupBy(schema.supplierTags.tag)
    .orderBy(sql`count(*) desc`, asc(schema.supplierTags.tag))
    .all();
}
