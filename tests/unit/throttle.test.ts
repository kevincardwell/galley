import { beforeEach, describe, expect, it, vi } from "vitest";

// The throttle asks next/headers for the request. Tests swap the header set in place.
const req = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => req.headers }));

import { clearFailures, clearTotpFailures, isThrottled, isTotpThrottled, recordFailure, recordTotpFailure } from "@/lib/auth/throttle";

const setXff = (value: string | null) => {
  req.headers = new Headers(value === null ? {} : { "x-forwarded-for": value });
};

beforeEach(() => {
  delete process.env.TRUSTED_PROXY_HOPS;
  setXff(null);
});

describe("finding the client address", () => {
  it("ignores forwarded headers entirely when nothing is in front", async () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    setXff("198.51.100.7");
    for (let i = 0; i < 8; i++) await recordFailure("no-proxy@x.test");
    expect(await isThrottled("no-proxy@x.test")).toBe(true);

    // A fresh forged address must not open a fresh bucket.
    setXff("203.0.113.99");
    expect(await isThrottled("no-proxy@x.test")).toBe(true);
  });

  it("counts back from the right, so a forged prefix cannot choose the bucket", async () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    for (let i = 0; i < 8; i++) {
      setXff("203.0.113.66, 198.51.100.7");
      await recordFailure("proxy@x.test");
    }
    // The rightmost entry is what the trusted proxy added; a different forged prefix hits the same bucket.
    setXff("192.0.2.1, 198.51.100.7");
    expect(await isThrottled("proxy@x.test")).toBe(true);
    // A genuinely different client is not punished for it.
    setXff("192.0.2.1, 198.51.100.8");
    expect(await isThrottled("proxy@x.test")).toBe(false);
  });

  it("refuses to trust a chain shorter than the configured proxy depth", async () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    setXff("198.51.100.7");
    for (let i = 0; i < 8; i++) await recordFailure("short@x.test");
    // Both forged addresses collapse into the one conservative bucket.
    setXff("203.0.113.99");
    expect(await isThrottled("short@x.test")).toBe(true);
  });
});

describe("what a correct password clears", () => {
  it("clears the account counter but leaves the address counter standing", async () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    setXff("198.51.100.9");
    for (let i = 0; i < 8; i++) await recordFailure("typo@x.test");
    expect(await isThrottled("typo@x.test")).toBe(true);
    await clearFailures("typo@x.test");
    expect(await isThrottled("typo@x.test")).toBe(false);

    // Someone signing in must not wipe the address-wide limit for everyone behind it.
    for (let i = 0; i < 40; i++) await recordFailure(`other-${i}@x.test`);
    expect(await isThrottled("typo@x.test")).toBe(true);
  });

  it("never clears the second-factor bucket", async () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    setXff("198.51.100.10");
    for (let i = 0; i < 8; i++) await recordTotpFailure("user-1");
    expect(await isTotpThrottled("user-1")).toBe(true);

    // The password step succeeding is exactly the event an attacker can repeat for free.
    await clearFailures("user@x.test");
    expect(await isTotpThrottled("user-1")).toBe(true);
    await clearFailures("user@x.test");
    expect(await isTotpThrottled("user-1")).toBe(true);

    // Only a correct code clears it.
    await clearTotpFailures("user-1");
    expect(await isTotpThrottled("user-1")).toBe(false);
  });
});
