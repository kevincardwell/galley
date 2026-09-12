import { describe, expect, it, vi } from "vitest";

// Any outbound request at all would be a failure: these targets must be rejected before fetch.
const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
vi.stubGlobal("fetch", fetchSpy);

import { fetchFavicon } from "@/lib/favicon";

const PRIVATE_TARGETS = [
  "http://127.0.0.1:9200/",
  "http://localhost:8080/",
  "http://169.254.169.254/latest/meta-data/",
  "http://10.0.0.5/",
  "http://192.168.1.1/",
  "http://172.16.4.2/",
  "http://[::1]:3000/",
  "file:///etc/passwd",
  "gopher://127.0.0.1:11211/",
  "http://127.0.0.1:22/",
];

describe("favicon fetching refuses to reach inside the network", () => {
  it.each(PRIVATE_TARGETS)("ignores %s", async (target) => {
    fetchSpy.mockClear();
    await fetchFavicon("ws-ssrf", target);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
