import { describe, expect, it } from "vitest";
import { currentStep, hashRecovery, newRecoveryCodes, newSecret, otpauthUrl, qrPath, verifyCode } from "@/lib/auth/totp";

/** RFC 6238 appendix B: the ASCII secret "12345678901234567890", base32-encoded. */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  it("matches the RFC 6238 test vector", () => {
    // T = 59s is step 1, and the published 8-digit value 94287082 truncates to 287082.
    expect(verifyCode(RFC_SECRET, "287082", 59_000)).toBe(1);
    expect(verifyCode(RFC_SECRET, "000000", 59_000)).toBeNull();
  });

  it("allows one step of drift either way, and no more", () => {
    const now = 59_000;
    expect(verifyCode(RFC_SECRET, "287082", now + 30_000)).toBe(1); // last step
    expect(verifyCode(RFC_SECRET, "287082", now - 30_000)).toBe(1); // next step
    expect(verifyCode(RFC_SECRET, "287082", now + 90_000)).toBeNull();
  });

  it("makes secrets an authenticator app can read", () => {
    expect(newSecret()).toMatch(/^[A-Z2-7]{32}$/);
    expect(newSecret()).not.toBe(newSecret());
    expect(currentStep(59_000)).toBe(1);
    expect(verifyCode(RFC_SECRET, "2870823", 59_000)).toBeNull(); // wrong length
    expect(verifyCode(RFC_SECRET, "287082", 0)).toBe(1); // step -1 is not a crash
  });

  it("ignores case and dashes in recovery codes", () => {
    const [code] = newRecoveryCodes(1);
    expect(code).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(hashRecovery(code!)).toBe(hashRecovery(code!.toUpperCase().replace(/-/g, " ")));
    expect(hashRecovery(code!)).not.toBe(hashRecovery("wxyz-wxyz-wxyz"));
  });

  it("builds an otpauth URL and a QR for it", () => {
    const url = otpauthUrl(RFC_SECRET, "kev@galley.test", "Galley Studio");
    expect(url).toContain("otpauth://totp/Galley%20Studio:kev%40galley.test");
    expect(url).toContain(`secret=${RFC_SECRET}`);
    const qr = qrPath(url);
    expect(qr.size).toBeGreaterThan(20);
    expect(qr.d.startsWith("M")).toBe(true);
  });
});
