import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { workspaceByShareToken } from "@/lib/queries/copy";
import { workspaceByCalendarToken } from "@/lib/queries/workspaces";
import { shareWorkspace } from "@/lib/share/guard";

describe("archiving a project closes its public doors", () => {
  it("serves the tokens while open, stops while archived, and returns on unarchive", () => {
    db.insert(schema.workspaces)
      .values({ id: "arc-ws", name: "Arc", slug: "arc", shareToken: "arc-share-token", calendarToken: "arc-cal-token", shareReview: true })
      .run();
    const setArchived = (at: number | null) => db.update(schema.workspaces).set({ archivedAt: at }).where(eq(schema.workspaces.id, "arc-ws")).run();

    expect(workspaceByShareToken("arc-share-token")?.id).toBe("arc-ws");
    expect(workspaceByCalendarToken("arc-cal-token")?.id).toBe("arc-ws");
    expect(shareWorkspace("arc-share-token", "shareReview")?.id).toBe("arc-ws");

    setArchived(1_700_000_000);
    expect(workspaceByShareToken("arc-share-token")).toBeUndefined();
    expect(workspaceByCalendarToken("arc-cal-token")).toBeUndefined();
    expect(shareWorkspace("arc-share-token", "shareReview")).toBeNull();

    // Archiving hides the links; it does not burn them.
    setArchived(null);
    expect(workspaceByShareToken("arc-share-token")?.id).toBe("arc-ws");
    expect(workspaceByCalendarToken("arc-cal-token")?.id).toBe("arc-ws");
  });
});
