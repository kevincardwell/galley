import { createHash } from "node:crypto";

/** A short fingerprint of some text, so a save can tell whether it is still editing what it loaded. */
export const contentHash = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 16);
