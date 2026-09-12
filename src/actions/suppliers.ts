"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { SUPPLIER_LINK_STATUSES, type SupplierLinkStatus } from "@/db/schema";
import { requireUser } from "@/lib/auth/current";
import { assertAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { newId } from "@/lib/ids";
import { COST_HINT, parseCost } from "@/components/suppliers/shared";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = <T,>(error: string): Result<T> => ({ ok: false, error });
const nowS = () => Math.floor(Date.now() / 1000);
const firstIssue = (e: z.ZodError): string => e.issues[0]?.message ?? "Check the form";

/** Optional free text: blank becomes null so the database never holds an empty string. */
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null));

const supplierInput = z.object({
  name: z.string().trim().min(1, "Give the supplier a name").max(120, "That name is too long"),
  category: opt(60),
  contactName: opt(120),
  email: opt(200).refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v), "Enter a valid email address"),
  phone: opt(40).refine((v) => v === null || /^[+(\d][\d\s()+.-]{4,}$/.test(v), "Enter a valid phone number"),
  website: opt(200)
    .transform((v) => (v === null ? null : /^https?:\/\//i.test(v) ? v : `https://${v}`))
    .refine((v) => v === null || /^https?:\/\/[^\s/]+\.[^\s/]{2,}/i.test(v), "Enter a valid website address"),
  address: opt(300),
  notes: opt(4000),
  rating: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v) : v),
    z.number().int("Rating goes from 1 to 5").min(1, "Rating goes from 1 to 5").max(5, "Rating goes from 1 to 5").nullable(),
  ),
});

export type SupplierInput = {
  name: string;
  category?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
  rating?: number | string | null;
};

function refreshDirectory(supplierId?: string) {
  revalidatePath("/suppliers");
  if (supplierId) revalidatePath(`/suppliers/${supplierId}`);
}

function refreshProject(slug: string) {
  revalidatePath(`/w/${slug}/suppliers`);
  revalidatePath(`/w/${slug}`);
}

// ---- Directory: any signed-in person may keep the shared address book up to date ----

export async function createSupplier(input: SupplierInput): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const parsed = supplierInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const id = newId();
  db.insert(schema.suppliers).values({ id, ...parsed.data, createdBy: user.id }).run();
  refreshDirectory(id);
  return ok({ id });
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<Result> {
  await requireUser();
  const parsed = supplierInput.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const existing = db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
  if (!existing) return fail("That supplier is no longer here");
  db.update(schema.suppliers).set(parsed.data).where(eq(schema.suppliers.id, id)).run();
  refreshDirectory(id);
  return ok(undefined);
}

export async function archiveSupplier(id: string, archived: boolean): Promise<Result> {
  await requireUser();
  const existing = db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
  if (!existing) return fail("That supplier is no longer here");
  db.update(schema.suppliers).set({ archivedAt: archived ? nowS() : null }).where(eq(schema.suppliers.id, id)).run();
  refreshDirectory(id);
  return ok(undefined);
}

export async function deleteSupplier(id: string): Promise<Result> {
  await requireUser();
  const existing = db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
  if (!existing) return fail("That supplier is no longer here");
  // Tags and project links go with it (foreign keys cascade).
  db.delete(schema.suppliers).where(eq(schema.suppliers.id, id)).run();
  revalidatePath("/", "layout");
  return ok(undefined);
}

const tagsInput = z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20, "Twenty tags is plenty");

export async function setSupplierTags(id: string, tags: string[]): Promise<Result<{ tags: string[] }>> {
  await requireUser();
  const parsed = tagsInput.safeParse(tags);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const existing = db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
  if (!existing) return fail("That supplier is no longer here");
  const next = [...new Set(parsed.data.filter(Boolean))].sort();
  db.transaction((tx) => {
    tx.delete(schema.supplierTags).where(eq(schema.supplierTags.supplierId, id)).run();
    for (const tag of next) tx.insert(schema.supplierTags).values({ supplierId: id, tag }).run();
  });
  refreshDirectory(id);
  return ok({ tags: next });
}

// ---- Project links: you must be able to edit the project ----

export type LinkInput = { status?: SupplierLinkStatus; cost?: string | number | null; note?: string | null };

const linkFields = z.object({
  status: z.enum(SUPPLIER_LINK_STATUSES).optional(),
  note: opt(500),
});

/** Splits the validated fields from the cost, which has its own friendly parser. */
function readLink(input: LinkInput): Result<{ status?: SupplierLinkStatus; note: string | null; cost: number | null }> {
  const parsed = linkFields.safeParse({ status: input.status, note: input.note });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  try {
    return ok({ ...parsed.data, cost: parseCost(input.cost) });
  } catch {
    return fail(COST_HINT);
  }
}

export async function linkSupplier(workspaceId: string, supplierId: string, input: LinkInput = {}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const { workspace } = assertAccess(user, workspaceId, "edit");
  const supplier = db.select({ id: schema.suppliers.id, name: schema.suppliers.name }).from(schema.suppliers).where(eq(schema.suppliers.id, supplierId)).get();
  if (!supplier) return fail("That supplier is no longer here");
  const fields = readLink(input);
  if (!fields.ok) return fail(fields.error);
  const { status, note, cost } = fields.data;

  // One link per supplier per project: linking again edits the link you already have.
  const existing = db
    .select({ id: schema.workspaceSuppliers.id })
    .from(schema.workspaceSuppliers)
    .where(and(eq(schema.workspaceSuppliers.workspaceId, workspace.id), eq(schema.workspaceSuppliers.supplierId, supplierId)))
    .get();

  const id = existing?.id ?? newId();
  if (existing) {
    db.update(schema.workspaceSuppliers).set({ status: status ?? "shortlisted", cost, note }).where(eq(schema.workspaceSuppliers.id, id)).run();
  } else {
    db.insert(schema.workspaceSuppliers).values({ id, workspaceId: workspace.id, supplierId, status: status ?? "shortlisted", cost, note, createdBy: user.id }).run();
  }

  logActivity({
    workspaceId: workspace.id,
    actorId: user.id,
    verb: existing ? "updated" : "linked",
    subjectType: "supplier",
    subjectId: supplierId,
    subjectTitle: supplier.name,
    meta: { status: status ?? "shortlisted" },
  });
  refreshProject(workspace.slug);
  refreshDirectory(supplierId);
  return ok({ id });
}

function loadLink(linkId: string) {
  return db
    .select({
      id: schema.workspaceSuppliers.id,
      workspaceId: schema.workspaceSuppliers.workspaceId,
      supplierId: schema.workspaceSuppliers.supplierId,
      status: schema.workspaceSuppliers.status,
      cost: schema.workspaceSuppliers.cost,
      note: schema.workspaceSuppliers.note,
      supplierName: schema.suppliers.name,
    })
    .from(schema.workspaceSuppliers)
    .innerJoin(schema.suppliers, eq(schema.suppliers.id, schema.workspaceSuppliers.supplierId))
    .where(eq(schema.workspaceSuppliers.id, linkId))
    .get();
}

export async function updateSupplierLink(linkId: string, patch: LinkInput): Promise<Result> {
  const user = await requireUser();
  const link = loadLink(linkId);
  if (!link) return fail("That supplier is no longer on this project");
  const { workspace } = assertAccess(user, link.workspaceId, "edit");

  const parsed = linkFields.safeParse({ status: patch.status, note: patch.note });
  if (!parsed.success) return fail(firstIssue(parsed.error));
  let cost = link.cost;
  if (patch.cost !== undefined) {
    try {
      cost = parseCost(patch.cost);
    } catch {
      return fail(COST_HINT);
    }
  }
  const note = patch.note === undefined ? link.note : parsed.data.note;

  db.update(schema.workspaceSuppliers)
    .set({ status: parsed.data.status ?? link.status, cost, note })
    .where(eq(schema.workspaceSuppliers.id, linkId))
    .run();

  logActivity({
    workspaceId: workspace.id,
    actorId: user.id,
    verb: "updated",
    subjectType: "supplier",
    subjectId: link.supplierId,
    subjectTitle: link.supplierName,
    meta: { status: parsed.data.status ?? link.status },
  });
  refreshProject(workspace.slug);
  refreshDirectory(link.supplierId);
  return ok(undefined);
}

export async function unlinkSupplier(linkId: string): Promise<Result> {
  const user = await requireUser();
  const link = loadLink(linkId);
  if (!link) return fail("That supplier is no longer on this project");
  const { workspace } = assertAccess(user, link.workspaceId, "edit");
  db.delete(schema.workspaceSuppliers).where(eq(schema.workspaceSuppliers.id, linkId)).run();
  logActivity({
    workspaceId: workspace.id,
    actorId: user.id,
    verb: "unlinked",
    subjectType: "supplier",
    subjectId: link.supplierId,
    subjectTitle: link.supplierName,
  });
  refreshProject(workspace.slug);
  refreshDirectory(link.supplierId);
  return ok(undefined);
}
