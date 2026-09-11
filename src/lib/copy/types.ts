import type { SectionStatus } from "@/db/schema";
import type { TiptapDoc } from "./serialize";

/** Shapes shared between the copy queries, actions and client components. */

export type PageRow = {
  id: string;
  title: string;
  slug: string;
  position: number;
  counts: { total: number; approved: number; review: number; draft: number };
};

export type SectionRow = {
  id: string;
  pageId: string;
  title: string;
  content: TiptapDoc;
  status: SectionStatus;
  wordCount: number;
  position: number;
  version: number;
  updatedAt: number;
  updatedByName: string | null;
};

export type VersionRow = {
  id: string;
  version: number;
  wordCount: number;
  createdAt: number;
  authorName: string | null;
};

export type CommentRow = {
  id: string;
  body: string;
  createdAt: number;
  resolvedAt: number | null;
  authorName: string | null;
};

export type AttachedFile = { attachmentId: string; assetId: string; filename: string; kind: "image" | "video" | "pdf" };

export type SectionDetails = { versions: VersionRow[]; comments: CommentRow[]; attachments: AttachedFile[] };

export type SaveResult =
  | { conflict: false; version: number; updatedAt: number }
  | { conflict: true; current: { content: TiptapDoc; version: number; updatedAt: number; updatedByName: string | null } };

/** Rolls a page's section statuses up into one dot. */
export function pageTone(counts: PageRow["counts"]): "done" | "review" | "draft" {
  if (counts.total > 0 && counts.approved === counts.total) return "done";
  if (counts.review > 0) return "review";
  return "draft";
}

export function statusTone(status: SectionStatus): "done" | "review" | "draft" {
  return status === "approved" ? "done" : status === "review" ? "review" : "draft";
}

export const STATUS_LABEL: Record<SectionStatus, string> = { draft: "Draft", review: "In review", approved: "Approved" };
