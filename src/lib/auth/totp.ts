import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import qrcode from "qrcode-generator";

/**
 * TOTP (RFC 6238) against node:crypto — Google Authenticator, 1Password, Aegis
 * and the rest all speak it. No dependency: it is an HMAC, a truncation and a
 * base32 alphabet.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;
const DIGITS = 6;

/** 160 bits, the size RFC 4226 recommends — 32 base32 characters, no padding. */
export function newSecret(): string {
  let bits = "";
  for (const byte of randomBytes(20)) bits += byte.toString(2).padStart(8, "0");
  return (bits.match(/.{5}/g) ?? []).map((chunk) => ALPHABET[parseInt(chunk, 2)]).join("");
}

function decode(secret: string): Buffer {
  let bits = "";
  for (const c of secret.toUpperCase().replace(/[^A-Z2-7]/g, "")) bits += ALPHABET.indexOf(c).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
}

function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const truncated = mac.readUInt32BE(offset) & 0x7fffffff;
  return (truncated % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP);

/**
 * The time step the code matched, or null. One step either side of now, which is
 * what every authenticator assumes and what keeps a slow-typing person signed in.
 * The caller must refuse a step it has already accepted, so a code cannot be replayed.
 */
export function verifyCode(secret: string, typed: string, now = Date.now()): number | null {
  const code = typed.replace(/\D/g, "");
  if (code.length !== DIGITS) return null;
  const at = currentStep(now);
  for (const step of [at - 1, at, at + 1]) {
    if (step < 0) continue;
    if (timingSafeEqual(Buffer.from(codeAt(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}

export function otpauthUrl(secret: string, email: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`;
}

/** The QR as one SVG path, so the page can draw it without a client-side library or raw HTML. */
export function qrPath(text: string): { size: number; d: string } {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let d = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
  }
  return { size, d };
}

/** Secret in groups of four, for anyone typing it in by hand. */
export const grouped = (secret: string) => (secret.match(/.{4}/g) ?? [secret]).join(" ");

// ---- Recovery codes: the way back in when the phone is gone ----

const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no l/o/0/1 to mistype
const RECOVERY_LENGTH = 12;

export function newRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const chars = Array.from(randomBytes(RECOVERY_LENGTH), (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join("");
    return (chars.match(/.{4}/g) ?? []).join("-");
  });
}

/** Stored hashed. 60 bits of randomness, so a plain digest is enough — there is nothing to guess. */
export const hashRecovery = (code: string) => createHash("sha256").update(code.toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");
