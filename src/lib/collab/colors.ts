/** Eight hues that read well as thin rings and caret labels on the off-white surface. */
const HUES = ["#2F6B4F", "#B4532A", "#3A5FA8", "#8B4A9C", "#B8860B", "#1F7A8C", "#C2417A", "#5A6B2F"];

/** A stable colour for a name, so a person looks the same in every session and section. */
export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length]!;
}
