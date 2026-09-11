"use client";
import { createContext, useContext } from "react";
import type { Member, TaskPatch } from "./types";

export type FocusRequest = { sectionId: string; nonce: number };

export type BoardApi = {
  workspaceId: string;
  slug: string;
  currentUserId: string;
  canEdit: boolean;
  members: Member[];
  openId: string | null;
  highlightId: string | null;
  focusRequest: FocusRequest | null;
  open: (id: string | null) => void;
  setHighlight: (id: string | null) => void;
  requestNewTask: (sectionId?: string) => void;
  cancelNewTask: () => void;
  createTask: (sectionId: string, title: string) => void;
  updateTask: (id: string, patch: TaskPatch) => void;
  toggleDone: (id: string) => void;
  deleteTask: (id: string) => void;
  createSection: (name: string) => void;
  renameSection: (id: string, name: string) => void;
  deleteSection: (id: string) => void;
  moveSection: (id: string, dir: -1 | 1) => void;
  addChecklistItem: (taskId: string, text: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  renameChecklistItem: (taskId: string, itemId: string, text: string) => void;
  deleteChecklistItem: (taskId: string, itemId: string) => void;
  addComment: (taskId: string, body: string) => void;
  resolveComment: (taskId: string, commentId: string, resolved: boolean) => void;
};

const Ctx = createContext<BoardApi | null>(null);
export const BoardProvider = Ctx.Provider;

export function useBoard(): BoardApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useBoard must be used inside TaskBoard");
  return api;
}

/** Ids that only exist client-side until the server answers. */
export const isTempId = (id: string) => id.startsWith("tmp-");
