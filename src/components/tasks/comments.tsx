"use client";
import { useState } from "react";
import { clsx } from "@/lib/clsx";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useBoard, isTempId } from "./board-context";
import type { TaskItem } from "./types";

export function Comments({ task, readOnly }: { task: TaskItem; readOnly: boolean }) {
  const board = useBoard();
  const [draft, setDraft] = useState("");
  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    board.addComment(task.id, body);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-3">
      {task.comments.length === 0 && <p className="m-0 text-[13px] text-ink-3">No comments yet.</p>}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {task.comments.map((c) => {
          const resolved = !!c.resolvedAt;
          return (
            <li key={c.id} className={clsx("flex gap-2.5", resolved && "opacity-60")}>
              <Avatar name={c.authorName ?? "?"} size={22} muted={c.authorId !== board.currentUserId} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-ink">{c.authorName ?? "Someone"}</span>
                  <span className="text-ink-3">{timeAgo(c.createdAt)}</span>
                  {resolved && <span className="text-done">Resolved</span>}
                  {!readOnly && !isTempId(c.id) && (
                    <button onClick={() => board.resolveComment(task.id, c.id, !resolved)} className="ml-auto text-ink-3 hover:text-ink">
                      {resolved ? "Reopen" : "Resolve"}
                    </button>
                  )}
                </div>
                <p className={clsx("m-0 mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed", resolved && "line-through")}>{c.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            placeholder="Write a comment…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
            className="min-h-16 text-[13px]"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-3"><kbd>⌘</kbd> <kbd>↵</kbd> to send</span>
            <Button size="sm" disabled={!draft.trim()} onClick={submit}>Comment</Button>
          </div>
        </div>
      )}
    </div>
  );
}
