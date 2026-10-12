import { timingSafeEqual } from "node:crypto";

/** Constant-time string compare, so a token in a URL cannot be probed byte by byte. */
export function timingSafeEqualStr(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
