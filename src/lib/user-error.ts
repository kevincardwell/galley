/**
 * An error whose message is written for the person who pressed the button.
 *
 * Production builds of Next.js replace every server action error's message with a generic one, so a
 * plain `Error` reaches the browser as "An error occurred in the Server Components render". The words
 * travel in `digest` instead, the one field React passes through, and `errorText` reads them back.
 * Unexpected errors (a database failure, a bug) stay hidden behind the fallback, as they should.
 */
const TAG = "galley:";

export class UserError extends Error {
  readonly digest: string;
  constructor(message = "Check the details and try again.") {
    super(message);
    this.digest = TAG + message;
  }
}

/** What to show for an error from a server action, or from the browser's own code. */
export function errorText(e: unknown, fallback = "That didn't work. Try again.") {
  const digest = (e as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && digest.startsWith(TAG)) return digest.slice(TAG.length);
  return e instanceof Error && e.message && digest === undefined ? e.message : fallback;
}
