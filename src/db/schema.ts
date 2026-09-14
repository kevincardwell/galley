import { sqliteTable, text, integer, blob, primaryKey, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = () => sql`(unixepoch())`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  deactivatedAt: integer("deactivated_at"),
  lastSeenAt: integer("last_seen_at"),
  createdAt: integer("created_at").notNull().default(now()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull().default(now()),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  workspaceRole: text("workspace_role", { enum: ["manager", "editor", "viewer"] }),
  invitedBy: text("invited_by").notNull().references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
  acceptedAt: integer("accepted_at"),
  revokedAt: integer("revoked_at"),
  emailedAt: integer("emailed_at"),
  createdAt: integer("created_at").notNull().default(now()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  meta: text("meta", { mode: "json" }),
  createdAt: integer("created_at").notNull().default(now()),
});

export const WORKSPACE_STATUSES = ["planning", "building", "review", "live", "archived"] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  url: text("url"),
  clientName: text("client_name"),
  status: text("status", { enum: WORKSPACE_STATUSES }).notNull().default("planning"),
  accent: text("accent").notNull().default("#2F6B4F"),
  faviconPath: text("favicon_path"),
  shareToken: text("share_token").unique(),
  calendarToken: text("calendar_token").unique(),
  shareReview: integer("share_review", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull().default(now()),
  archivedAt: integer("archived_at"),
});

export const WORKSPACE_ROLES = ["manager", "editor", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const memberships = sqliteTable(
  "memberships",
  {
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: WORKSPACE_ROLES }).notNull().default("editor"),
    addedBy: text("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] }), index("memberships_user").on(t.userId)],
);

// ---- Tasks ----
export const taskSections = sqliteTable("task_sections", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
});

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_REPEATS = ["weekly", "fortnightly", "monthly", "quarterly", "yearly"] as const;
export type TaskRepeat = (typeof TASK_REPEATS)[number];

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull().references(() => taskSections.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("todo"),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueOn: text("due_on"), // ISO date YYYY-MM-DD
    repeatEvery: text("repeat_every", { enum: TASK_REPEATS }), // null = one-off; completing a repeating task spawns the next
    position: integer("position").notNull().default(0),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull().default(now()),
    completedAt: integer("completed_at"),
  },
  (t) => [index("tasks_ws").on(t.workspaceId), index("tasks_assignee").on(t.assigneeId)],
);

export const taskChecklist = sqliteTable("task_checklist", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
});

// ---- Copy ----
export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now()),
});

export const SECTION_STATUSES = ["draft", "review", "approved"] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

export const sections = sqliteTable(
  "sections",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content", { mode: "json" }).notNull().default(sql`'{"type":"doc","content":[]}'`), // Tiptap JSON
    plainText: text("plain_text").notNull().default(""),
    status: text("status", { enum: SECTION_STATUSES }).notNull().default("draft"),
    wordCount: integer("word_count").notNull().default(0),
    position: integer("position").notNull().default(0),
    version: integer("version").notNull().default(1),
    ydoc: blob("ydoc", { mode: "buffer" }), // Yjs encoded state, source of truth once collaboration has started
    clientApprovedAt: integer("client_approved_at"),
    clientApprovedBy: text("client_approved_by"),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: integer("updated_at").notNull().default(now()),
  },
  (t) => [index("sections_page").on(t.pageId)],
);

export const sectionVersions = sqliteTable(
  "section_versions",
  {
    id: text("id").primaryKey(),
    sectionId: text("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content", { mode: "json" }).notNull(),
    plainText: text("plain_text").notNull().default(""),
    wordCount: integer("word_count").notNull().default(0),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [index("section_versions_section").on(t.sectionId)],
);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  sectionId: text("section_id").references(() => sections.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  guestName: text("guest_name"), // set when a client left it through the share link
  resolvedAt: integer("resolved_at"),
  createdAt: integer("created_at").notNull().default(now()),
});

// ---- Suppliers (instance-wide directory, linked into the projects that use them) ----
export const SUPPLIER_LINK_STATUSES = ["shortlisted", "enquired", "booked", "declined"] as const;
export type SupplierLinkStatus = (typeof SUPPLIER_LINK_STATUSES)[number];

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category"), // florist, caterer, photographer, printer, developer…
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    address: text("address"),
    notes: text("notes"),
    rating: integer("rating"), // 1-5, null when unrated
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull().default(now()),
    archivedAt: integer("archived_at"),
  },
  (t) => [index("suppliers_name").on(t.name)],
);

export const supplierTags = sqliteTable(
  "supplier_tags",
  { supplierId: text("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }), tag: text("tag").notNull() },
  (t) => [primaryKey({ columns: [t.supplierId, t.tag] })],
);

export const workspaceSuppliers = sqliteTable(
  "workspace_suppliers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
    status: text("status", { enum: SUPPLIER_LINK_STATUSES }).notNull().default("shortlisted"),
    cost: integer("cost"), // minor units (pence)
    note: text("note"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [index("workspace_suppliers_ws").on(t.workspaceId), index("workspace_suppliers_supplier").on(t.supplierId)],
);

// ---- Schedule (dated run-sheet entries; the calendar also shows task due dates) ----
export const scheduleItems = sqliteTable(
  "schedule_items",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    startsAt: integer("starts_at").notNull(), // unix seconds
    endsAt: integer("ends_at"),
    allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
    location: text("location"),
    supplierId: text("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [index("schedule_items_ws").on(t.workspaceId, t.startsAt)],
);

// ---- Collaboration (Yjs update log, compacted into sections.ydoc) ----
export const collabUpdates = sqliteTable(
  "collab_updates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sectionId: text("section_id").notNull().references(() => sections.id, { onDelete: "cascade" }),
    update: blob("update", { mode: "buffer" }).notNull(),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [index("collab_updates_section").on(t.sectionId, t.id)],
);

// ---- Notifications (in-app inbox; email is sent alongside when SMTP is configured) ----
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // mention, assigned, client_comment, client_approved, invite
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: integer("read_at"),
    emailedAt: integer("emailed_at"),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [index("notifications_user").on(t.userId, t.readAt)],
);

// ---- Mail log (last sends, so an admin can debug delivery without server access) ----
export const mailLog = sqliteTable(
  "mail_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    provider: text("provider").notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    error: text("error"),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [index("mail_log_created").on(t.createdAt)],
);

// ---- Backups ----
export const backups = sqliteTable("backups", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  bytes: integer("bytes").notNull(),
  kind: text("kind", { enum: ["manual", "scheduled"] }).notNull().default("manual"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at").notNull().default(now()),
});

// ---- Assets ----
export const ASSET_KINDS = ["image", "video", "pdf"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const assetFolders = sqliteTable("asset_folders", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  position: integer("position").notNull().default(0),
});

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => assetFolders.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ASSET_KINDS }).notNull(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    palette: text("palette", { mode: "json" }).$type<string[]>(),
    processedAt: integer("processed_at"),
    processError: text("process_error"),
    uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [index("assets_ws").on(t.workspaceId)],
);

export const assetTags = sqliteTable(
  "asset_tags",
  {
    assetId: text("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.tag] })],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    sectionId: text("section_id").references(() => sections.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [index("attachments_asset").on(t.assetId), index("attachments_task").on(t.taskId), index("attachments_section").on(t.sectionId)],
);

// ---- Activity ----
export const activity = sqliteTable(
  "activity",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    verb: text("verb").notNull(), // created, updated, completed, uploaded, approved, commented ...
    subjectType: text("subject_type").notNull(), // task, page, section, asset, workspace, member
    subjectId: text("subject_id"),
    subjectTitle: text("subject_title"),
    meta: text("meta", { mode: "json" }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => [index("activity_ws").on(t.workspaceId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskSection = typeof taskSections.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type WorkspaceSupplier = typeof workspaceSuppliers.$inferSelect;
export type ScheduleItem = typeof scheduleItems.$inferSelect;
