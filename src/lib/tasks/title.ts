export const TASK_TITLE_MAX = 200;

/**
 * What someone types into "Add task" is never refused for being long: a title is a line, so anything
 * past the limit keeps its first part (cut at a word) as the title and the whole text as the description.
 * Shared by the server and the board's instant draft, so the two agree.
 */
export function splitTaskTitle(text: string): { title: string; body: string } {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= TASK_TITLE_MAX) return { title: t, body: "" };
  const cut = t.slice(0, TASK_TITLE_MAX - 1);
  const space = cut.lastIndexOf(" ");
  const title = (space > TASK_TITLE_MAX * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "");
  return { title: `${title}…`, body: text.trim() };
}
