import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db/client";
import { getSettings, saveSettings } from "@/lib/settings";

beforeEach(() => {
  db.delete(schema.settings).run();
  delete process.env.GALLEY_URL;
  delete process.env.MAX_UPLOAD_MB;
});

describe("settings precedence", () => {
  it("returns the stored value when no environment variable is set", () => {
    saveSettings({ baseUrl: "https://stored.test", maxUploadMb: 123 });
    expect(getSettings().baseUrl).toBe("https://stored.test");
    expect(getSettings().maxUploadMb).toBe(123);
  });

  it("lets the environment override the stored value", () => {
    saveSettings({ baseUrl: "https://stored.test", maxUploadMb: 123 });
    process.env.GALLEY_URL = "https://environment.test";
    process.env.MAX_UPLOAD_MB = "2000";
    expect(getSettings().baseUrl).toBe("https://environment.test");
    expect(getSettings().maxUploadMb).toBe(2000);
  });

  it("ignores an unparseable upload limit", () => {
    saveSettings({ maxUploadMb: 123 });
    process.env.MAX_UPLOAD_MB = "not-a-number";
    expect(getSettings().maxUploadMb).toBe(123);
  });
});
