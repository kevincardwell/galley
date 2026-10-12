import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error("REDIRECT:" + u); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const user = { id: "tt-user", email: "tt@example.test", name: "T", passwordHash: "x", isAdmin: true, totpSecret: null, totpLastStep: null, totpRecovery: null, gitEmail: null, deactivatedAt: null, lastSeenAt: null, createdAt: 0 };
vi.mock("@/lib/auth/current", () => ({ currentUser: async () => user, requireUser: async () => user }));

import { db, schema } from "@/db/client";
import { createTask } from "@/actions/tasks";
import { splitTaskTitle, TASK_TITLE_MAX } from "@/lib/tasks/title";

const long = "Ring the Maypole about the function room for the launch night, and ask whether we can have the back room from 6pm, whether they will do sandwiches, and if there is parking for the minibus coming from Ely";

describe("task titles", () => {
  it("leaves a normal title alone", () => {
    expect(splitTaskTitle("  Call the venue  ")).toEqual({ title: "Call the venue", body: "" });
  });

  it("keeps all of a long entry: the start, cut at a word, as the title and the whole as the description", () => {
    const { title, body } = splitTaskTitle(long);
    expect(title.length).toBeLessThanOrEqual(TASK_TITLE_MAX);
    expect(title.endsWith("…")).toBe(true);
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
    expect(title.slice(0, -1).endsWith(" ")).toBe(false);
    expect(body).toBe(long);
  });

  it("creates a long task instead of refusing it", async () => {
    db.insert(schema.users).values(user).run();
    db.insert(schema.workspaces).values({ id: "tt-ws", name: "T", slug: "tt-ws" }).run();
    db.insert(schema.taskSections).values({ id: "tt-sec", workspaceId: "tt-ws", name: "Build", position: 0 }).run();
    const id = await createTask("tt-ws", "tt-sec", long);
    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).get()!;
    expect(task.title).toBe(splitTaskTitle(long).title);
    expect(task.body).toBe(long);
  });
});
