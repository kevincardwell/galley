import type { SupplierLinkStatus } from "@/db/schema";

/** Type-only import above keeps Drizzle out of the client bundle; the list below is the same order we show. */
export const LINK_STATUSES = ["shortlisted", "enquired", "booked", "declined"] as const satisfies readonly SupplierLinkStatus[];

export const STATUS_LABEL: Record<SupplierLinkStatus, string> = {
  shortlisted: "Shortlisted",
  enquired: "Enquired",
  booked: "Booked",
  declined: "Not using",
};

export type PillTone = "accent" | "review" | "done" | "draft" | "late" | "neutral";

export const STATUS_TONE: Record<SupplierLinkStatus, PillTone> = {
  shortlisted: "neutral",
  enquired: "review",
  booked: "done",
  declined: "draft",
};

// ---- Money ----
// Galley assumes one currency for the whole instance: pounds sterling. Costs are stored as
// integer pence so nothing ever rounds twice.
const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const GBP_ROUND = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

/** 125050 -> "£1,250.50" */
export function formatMoney(minorUnits: number | null | undefined): string {
  return GBP.format((minorUnits ?? 0) / 100);
}

/** 125050 -> "£1,251". For footers and summaries where the pence are noise. */
export function formatMoneyRounded(minorUnits: number | null | undefined): string {
  return GBP_ROUND.format((minorUnits ?? 0) / 100);
}

export const COST_HINT = "Enter a cost like 1250 or 1,250.50";

/**
 * Reads what a person typed into a cost box. Accepts "£1,250.50", "1250", " 1 250.5 ".
 * Empty means "no cost recorded" (null); anything else that is not a number throws.
 */
export function parseCost(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === "") return null;
  const cleaned = text.replace(/[£$€ \s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error(COST_HINT);
  const value = Math.round(Number(cleaned) * 100);
  if (!Number.isSafeInteger(value)) throw new Error(COST_HINT);
  return value;
}

/** Turns stored pence back into something the cost box can show and re-parse. */
export function costToInput(minorUnits: number | null | undefined): string {
  if (minorUnits === null || minorUnits === undefined) return "";
  return (minorUnits / 100).toFixed(2);
}

// ---- Shapes shared by the queries, the screens and the actions ----
export type SupplierRow = {
  id: string;
  name: string;
  category: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  rating: number | null;
  archivedAt: number | null;
  tags: string[];
  projectCount: number;
  bookedTotal: number;
};

export type SupplierLinkRow = {
  id: string;
  workspaceId: string;
  supplierId: string;
  status: SupplierLinkStatus;
  cost: number | null;
  note: string | null;
};

/** A link seen from the supplier's own page: which project, and how to get there. */
export type SupplierUsage = SupplierLinkRow & { workspaceName: string; workspaceSlug: string; accent: string };

/** A link seen from a project's suppliers tab: who the supplier is. */
export type WorkspaceSupplierRow = SupplierLinkRow & {
  name: string;
  category: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  archivedAt: number | null;
};

export type StatusTotal = { count: number; cost: number };
export type StatusTotals = Record<SupplierLinkStatus, StatusTotal>;

export function emptyTotals(): StatusTotals {
  return {
    shortlisted: { count: 0, cost: 0 },
    enquired: { count: 0, cost: 0 },
    booked: { count: 0, cost: 0 },
    declined: { count: 0, cost: 0 },
  };
}

export type SupplierDetail = {
  supplier: SupplierRow;
  usage: SupplierUsage[];
  /** Links on projects the caller is not a member of: counted, never named. */
  hidden: number;
};

export const displayHost = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");
