// Client-safe types shared by the asset queries, actions and UI. No server imports here.

export type AssetKind = "image" | "video" | "pdf";

export type AssetUsage = { type: "task" | "section"; id: string; title: string; href: string };

export type AssetItem = {
  id: string;
  workspaceId: string;
  folderId: string | null;
  kind: AssetKind;
  filename: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  palette: string[] | null;
  processedAt: number | null;
  processError: string | null;
  uploadedByName: string | null;
  /** True when a client sent this in through the share link rather than the studio uploading it. */
  fromClient?: boolean;
  createdAt: number;
  tags: string[];
  usedIn: AssetUsage[];
};

export type AssetFolder = { id: string; name: string; count: number };

export type AssetFilters = { kind?: AssetKind; tag?: string; folder?: string; unused?: boolean };

export type AssetCounts = { all: number; image: number; video: number; pdf: number; unused: number };

/** What the upload route returns per created asset, and what the picker lists. */
export type AssetSummary = { id: string; filename: string; kind: AssetKind; width: number | null; height: number | null; processedAt: number | null };

export type UploadResponse = { assets: AssetSummary[]; errors: { filename: string; error: string }[] };
