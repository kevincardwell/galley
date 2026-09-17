import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";

import { fetchFavicon } from "@/lib/favicon";

// Any real network call is a failure: request() throws if the code reaches it, and the spy
// assertions prove it never did. The rebinding test swaps in a fake response instead.
const realLookup = dns.lookup;
const httpRequest = vi.spyOn(http, "request");
const httpsRequest = vi.spyOn(https, "request");
const dnsLookup = vi.spyOn(dns, "lookup");

const forbidden = () => {
  throw new Error("network disabled in tests");
};

let captured: (http.RequestOptions & { servername?: string }) | null = null;

beforeEach(() => {
  captured = null;
  httpRequest.mockReset().mockImplementation(forbidden as never);
  httpsRequest.mockReset().mockImplementation(forbidden as never);
  dnsLookup.mockReset().mockImplementation(realLookup as never);
});

afterAll(() => vi.restoreAllMocks());

function fakeResponse(body: Buffer, headers: Record<string, string>) {
  return (options: http.RequestOptions, callback?: (res: http.IncomingMessage) => void) => {
    captured = options;
    const res = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string>; resume: () => void };
    res.statusCode = 200;
    res.headers = headers;
    res.resume = () => {};
    const req = {
      setTimeout: () => req,
      on: () => req,
      end: () => {
        process.nextTick(() => {
          callback?.(res as unknown as http.IncomingMessage);
          res.emit("data", body);
          res.emit("end");
        });
      },
      destroy: () => {},
    };
    return req as unknown as http.ClientRequest;
  };
}

const PRIVATE_TARGETS = [
  "http://127.0.0.1:9200/",
  "http://localhost:8080/",
  "http://169.254.169.254/latest/meta-data/",
  "http://10.0.0.5/",
  "http://192.168.1.1/",
  "http://172.16.4.2/",
  "http://[::1]:3000/",
  "http://[fe80::1]/",
  "http://[ff02::1]/",
  "http://[fc00::1]/",
  "http://[fd12:3456::1]/",
  "http://[fec0::1]/",
  "http://[::ffff:127.0.0.1]/",
  "http://[::7f00:1]/",
  "http://[64:ff9b::7f00:1]/",
  "http://[2001:db8::1]/",
  "file:///etc/passwd",
  "gopher://127.0.0.1:11211/",
  "http://127.0.0.1:22/",
];

describe("favicon fetching refuses to reach inside the network", () => {
  it.each(PRIVATE_TARGETS)("ignores %s", async (target) => {
    await fetchFavicon("ws-ssrf", target);
    expect(httpRequest).not.toHaveBeenCalled();
    expect(httpsRequest).not.toHaveBeenCalled();
  });

  it("refuses a name that resolves to any private address", async () => {
    dnsLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ] as never);
    await fetchFavicon("ws-mixed", "https://mixed.test/");
    expect(httpsRequest).not.toHaveBeenCalled();
  });

  it("connects to the address it checked, so a rebinding name cannot move", async () => {
    dnsLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    httpsRequest.mockImplementation(fakeResponse(Buffer.alloc(128, 7), { "content-type": "image/png" }) as never);

    await fetchFavicon("ws-pin", "https://example.test/");

    expect(captured?.host).toBe("93.184.216.34");
    expect(captured?.servername).toBe("example.test");
    expect(captured?.headers).toMatchObject({ host: "example.test" });
  });

  it("still fetches an ordinary public address", async () => {
    await fetchFavicon("ws-ip", "http://93.184.216.34/");
    expect(httpRequest).toHaveBeenCalled();
  });
});
