import type { AssetKind, TaskStatus } from "@/db/schema";

export type { TaskStatus };
export type TaskView = "list" | "board";

export type Member = { id: string; name: string };

export type ChecklistItem = { id: string; text: string; done: boolean; position: number };

export type TaskAttachment = { attachmentId: string; assetId: string; filename: string; kind: AssetKind };

export type TaskComment = {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: number;
  resolvedAt: number | null;
};

export type TaskItem = {
  id: string;
  workspaceId: string;
  sectionId: string;
  title: string;
  body: string;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueOn: string | null;
  position: number;
  createdAt: number;
  completedAt: number | null;
  checklist: ChecklistItem[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
};

export type SectionWithTasks = { id: string; name: string; position: number; tasks: TaskItem[] };

/** Fields a client may change on a task. `undefined` means "leave alone". */
export type TaskPatch = {
  title?: string;
  body?: string;
  status?: TaskStatus;
  assigneeId?: string | null;
  dueOn?: string | null;
  sectionId?: string;
};

export type MyTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueOn: string | null;
  sectionName: string;
  completedAt: number | null;
};

export type MyTaskGroup = {
  workspace: { id: string; slug: string; name: string; accent: string };
  tasks: MyTask[];
};
