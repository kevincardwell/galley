import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));

import { db, schema } from "@/db/client";
import { accessFor, requireAccess } from "@/lib/permissions";
import type { User } from "@/db/schema";

const u = (id: string, isAdmin = false): User => ({ id, email: `${id}@x.test`, name: id, passwordHash: "", isAdmin, deactivatedAt: null, lastSeenAt: null, createdAt: 0 });

describe("workspace access", () => {
  beforeAll(() => {
    for (const x of ["admin", "editor", "viewer", "stranger"]) db.insert(schema.users).values({ id: x, email: `${x}@x.test`, name: x, passwordHash: "", isAdmin: x === "admin" }).run();
    db.insert(schema.workspaces).values({ id: "w1", name: "One", slug: "one" }).run();
    db.insert(schema.memberships).values({ workspaceId: "w1", userId: "editor", role: "editor" }).run();
    db.insert(schema.memberships).values({ workspaceId: "w1", userId: "viewer", role: "viewer" }).run();
  });

  it("strangers cannot see the workspace at all", () => {
    expect(accessFor(u("stranger"), "w1")).toBeNull();
    expect(accessFor(u("stranger"), "one")).toBeNull();
    expect(() => requireAccess(u("stranger"), "one")).toThrow("NOT_FOUND");
  });
  it("viewers can view but not edit", () => {
    expect(accessFor(u("viewer"), "one", "view")?.role).toBe("viewer");
    expect(accessFor(u("viewer"), "one", "edit")).toBeNull();
  });
  it("editors can edit but not manage", () => {
    expect(accessFor(u("editor"), "one", "edit")?.role).toBe("editor");
    expect(accessFor(u("editor"), "one", "manage")).toBeNull();
  });
  it("admins can do everything without a membership", () => {
    expect(accessFor(u("admin", true), "one", "manage")?.role).toBe("admin");
  });
  it("unknown workspace is not found", () => {
    expect(accessFor(u("admin", true), "nope")).toBeNull();
  });
});
