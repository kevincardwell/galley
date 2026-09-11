"use client";
import { useState, useTransition } from "react";
import type { Result } from "@/actions/admin";

/** Runs an admin action inside a transition and keeps its error for inline display. */
export function useAdminAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run<T>(fn: () => Promise<Result<T>>, onOk?: (data: T) => void) {
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) onOk?.(r.data);
      else setError(r.error);
    });
  }
  return { pending, error, setError, run };
}
