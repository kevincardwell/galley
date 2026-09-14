import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (u: string) => {
    throw new Error("REDIRECT:" + u);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const actor = {
  id: "linker",
  email: "linker@x.test",
  name: "Linker",
  passwordHash: "",
  isAdmin: false,
  deactivatedAt: null,
  lastSeenAt: null,
  createdAt: 0,
};
vi.mock("@/lib/auth/current", () => ({ requireUser: async () => actor, currentUser: async () => actor, requireAdmin: async () => actor }));

import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { COST_HINT, DEFAULT_CURRENCY, formatMoney, formatMoneyRounded, parseCost } from "@/components/suppliers/shared";
import { linkSupplier, unlinkSupplier } from "@/actions/suppliers";
import { countSuppliers, listSuppliers, listWorkspaceSuppliers, supplierCategories, supplierDetail, supplierTagCounts } from "@/lib/queries/suppliers";

describe("cost parsing", () => {
  it("reads pounds with symbols and separators as pence", () => {
    expect(parseCost("£1,250.50")).toBe(125050);
    // Whatever symbol the instance uses, or one pasted from somewhere else.
    expect(parseCost("$1,250.50")).toBe(125050);
    expect(parseCost("€1,250.50")).toBe(125050);
    expect(parseCost("¥1250")).toBe(125000);
    expect(parseCost("1250")).toBe(125000);
    expect(parseCost(" 1,250 ")).toBe(125000);
    expect(parseCost("0.99")).toBe(99);
    expect(parseCost(1250)).toBe(125000);
  });

  it("treats blank as no cost recorded", () => {
    expect(parseCost("")).toBeNull();
    expect(parseCost("   ")).toBeNull();
    expect(parseCost(null)).toBeNull();
    expect(parseCost(undefined)).toBeNull();
  });

  it("refuses anything that is not a number", () => {
    expect(() => parseCost("about a grand")).toThrow(COST_HINT);
    expect(() => parseCost("12.345")).toThrow(COST_HINT);
    expect(() => parseCost("-50")).toThrow(COST_HINT);
    expect(() => parseCost("1,2 50 quid")).toThrow(COST_HINT);
  });

  it("formats pence back as pounds", () => {
    expect(formatMoney(125050)).toBe("£1,250.50");
    expect(formatMoney(0)).toBe("£0.00");
    expect(formatMoney(null)).toBe("£0.00");
  });
});

describe("linking a supplier to a project", () => {
  beforeAll(() => {
    db.insert(schema.users).values(actor).run();
    db.insert(schema.workspaces).values({ id: "ws1", name: "Bloom", slug: "bloom" }).run();
    db.insert(schema.memberships).values({ workspaceId: "ws1", userId: actor.id, role: "editor" }).run();
    db.insert(schema.suppliers).values({ id: "sup1", name: "Bramble Flowers", category: "Florist" }).run();
  });

  it("updates the existing link instead of adding a second one", async () => {
    const first = await linkSupplier("ws1", "sup1", { status: "shortlisted", cost: "£500", note: "Quoted by email" });
    expect(first.ok).toBe(true);

    const again = await linkSupplier("ws1", "sup1", { status: "booked", cost: "1,250.50", note: "Confirmed" });
    expect(again.ok).toBe(true);
    if (first.ok && again.ok) expect(again.data.id).toBe(first.data.id);

    const links = db.select().from(schema.workspaceSuppliers).where(eq(schema.workspaceSuppliers.supplierId, "sup1")).all();
    expect(links).toHaveLength(1);
    expect(links[0]!.status).toBe("booked");
    expect(links[0]!.cost).toBe(125050);
    expect(links[0]!.note).toBe("Confirmed");

    const { rows, totals } = listWorkspaceSuppliers("ws1");
    expect(rows).toHaveLength(1);
    expect(totals.booked).toEqual({ count: 1, cost: 125050 });
    expect(totals.shortlisted).toEqual({ count: 0, cost: 0 });
  });

  it("rejects a cost it cannot read, and leaves the link alone", async () => {
    const bad = await linkSupplier("ws1", "sup1", { status: "booked", cost: "loads" });
    expect(bad).toEqual({ ok: false, error: COST_HINT });
    expect(db.select().from(schema.workspaceSuppliers).all()).toHaveLength(1);
  });

  it("unlinks without touching the directory entry", async () => {
    const link = db.select().from(schema.workspaceSuppliers).where(eq(schema.workspaceSuppliers.supplierId, "sup1")).get()!;
    expect((await unlinkSupplier(link.id)).ok).toBe(true);
    expect(db.select().from(schema.workspaceSuppliers).all()).toHaveLength(0);
    expect(db.select().from(schema.suppliers).where(eq(schema.suppliers.id, "sup1")).all()).toHaveLength(1);
  });
});

describe("the directory", () => {
  beforeAll(async () => {
    db.insert(schema.suppliers).values([
      { id: "sup2", name: "acorn print", category: "Printer", email: "hi@acorn.test" },
      { id: "sup3", name: "Zephyr Photo", category: "Photographer", notes: "Shot the Bloom launch" },
      { id: "sup4", name: "Old Mill Catering", category: "Caterer", archivedAt: 1 },
    ]).run();
    db.insert(schema.supplierTags).values([
      { supplierId: "sup2", tag: "local" },
      { supplierId: "sup3", tag: "local" },
      { supplierId: "sup3", tag: "pricey" },
    ]).run();
    // A project the test user is not a member of: its link must be counted, never named.
    db.insert(schema.workspaces).values({ id: "ws2", name: "Secret", slug: "secret" }).run();
    db.insert(schema.workspaceSuppliers).values({ id: "l-hidden", workspaceId: "ws2", supplierId: "sup3", status: "booked", cost: 50000 }).run();
    await linkSupplier("ws1", "sup3", { status: "booked", cost: "250" });
  });

  it("sorts by name regardless of case and hides archived by default", () => {
    expect(listSuppliers().map((s) => s.name)).toEqual(["acorn print", "Bramble Flowers", "Zephyr Photo"]);
    expect(listSuppliers({ includeArchived: true }).map((s) => s.name)).toContain("Old Mill Catering");
    expect(countSuppliers()).toBe(3);
    expect(countSuppliers(true)).toBe(4);
  });

  it("searches name, category and notes, and filters by category and tag", () => {
    expect(listSuppliers({ q: "acorn" }).map((s) => s.id)).toEqual(["sup2"]);
    expect(listSuppliers({ q: "nobody here" })).toHaveLength(0);
    expect(listSuppliers({ q: "Bloom" }).map((s) => s.id)).toEqual(["sup3"]);
    expect(listSuppliers({ category: "Printer" }).map((s) => s.id)).toEqual(["sup2"]);
    expect(listSuppliers({ tag: "pricey" }).map((s) => s.id)).toEqual(["sup3"]);
    expect(listSuppliers({ tag: "local" }).map((s) => s.id)).toEqual(["sup2", "sup3"]);
    // % and _ are what the person typed, not wildcards.
    expect(listSuppliers({ q: "%" })).toHaveLength(0);
    expect(listSuppliers({ q: "acor_" })).toHaveLength(0);
  });

  it("counts projects and booked money per supplier", () => {
    const zephyr = listSuppliers().find((s) => s.id === "sup3")!;
    expect(zephyr.projectCount).toBe(2);
    expect(zephyr.bookedTotal).toBe(75000);
    expect(zephyr.tags).toEqual(["local", "pricey"]);
  });

  it("counts links on projects the reader cannot see without naming them", () => {
    const detail = supplierDetail("sup3", actor)!;
    expect(detail.usage.map((u) => u.workspaceName)).toEqual(["Bloom"]);
    expect(detail.hidden).toBe(1);
    expect(supplierDetail("nope", actor)).toBeNull();
  });

  it("offers the filter bar its categories and tags", () => {
    expect(supplierCategories().map((c) => c.value)).toEqual(["Florist", "Photographer", "Printer"]);
    expect(supplierCategories(true).map((c) => c.value)).toContain("Caterer");
    expect(supplierTagCounts()).toEqual([
      { value: "local", count: 2 },
      { value: "pricey", count: 1 },
    ]);
  });
});

describe("a project's supplier list", () => {
  beforeAll(async () => {
    await linkSupplier("ws1", "sup2", { status: "enquired", cost: "80" });
    await linkSupplier("ws1", "sup1", { status: "shortlisted" });
  });

  it("orders by status then name, and totals the money per status", () => {
    const { rows, totals } = listWorkspaceSuppliers("ws1");
    expect(rows.map((r) => r.name)).toEqual(["Zephyr Photo", "acorn print", "Bramble Flowers"]);
    expect(rows.map((r) => r.status)).toEqual(["booked", "enquired", "shortlisted"]);
    expect(totals.booked).toEqual({ count: 1, cost: 25000 });
    expect(totals.enquired).toEqual({ count: 1, cost: 8000 });
    expect(totals.shortlisted).toEqual({ count: 1, cost: 0 });
    expect(totals.declined).toEqual({ count: 0, cost: 0 });
  });
});

describe("showing money in the instance's currency", () => {
  const digits = (s: string) => s.replace(/[^\d.,]/g, "");

  it("formats the same amount in whichever currency is configured", () => {
    expect(formatMoney(125050, "GBP")).toContain("£");
    expect(formatMoney(125050, "USD")).toContain("$");
    expect(formatMoney(125050, "EUR")).toContain("€");
    // Only the symbol changes; the amount is the same stored minor units.
    expect(digits(formatMoney(125050, "USD"))).toBe(digits(formatMoney(125050, "GBP")));
  });

  it("still rounds for summaries", () => {
    expect(digits(formatMoneyRounded(125050, "USD"))).toBe("1,251");
  });

  it("falls back rather than taking a page down on a bad code", () => {
    expect(() => formatMoney(125050, "NOPE")).not.toThrow();
    expect(formatMoney(125050, "NOPE")).toContain("£");
  });

  it("defaults to pounds, so an instance that never sets one is unchanged", () => {
    expect(DEFAULT_CURRENCY).toBe("GBP");
    expect(formatMoney(125050)).toBe(formatMoney(125050, "GBP"));
  });
});
