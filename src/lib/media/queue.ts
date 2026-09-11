import "server-only";

// In-process job queue for thumbnailing. Lives on globalThis so Next's hot reload
// does not start a second worker pool with its own copy of the state.

type Job = () => Promise<void>;
type State = { active: number; pending: { key: string; job: Job }[]; queued: Set<string> };

const CONCURRENCY = 2;

const g = globalThis as unknown as { __galleyMediaQueue?: State };
const state: State = (g.__galleyMediaQueue ??= { active: 0, pending: [], queued: new Set() });

function pump() {
  while (state.active < CONCURRENCY && state.pending.length > 0) {
    const next = state.pending.shift()!;
    state.active++;
    next
      .job()
      .catch((err: unknown) => console.error(`[media] job ${next.key} failed`, err))
      .finally(() => {
        state.active--;
        state.queued.delete(next.key);
        pump();
      });
  }
}

/** Queue a job keyed by asset id. A key already waiting or running is not queued twice. */
export function enqueue(key: string, job: Job): boolean {
  if (state.queued.has(key)) return false;
  state.queued.add(key);
  state.pending.push({ key, job });
  pump();
  return true;
}

export function queueStats() {
  return { active: state.active, waiting: state.pending.length };
}
