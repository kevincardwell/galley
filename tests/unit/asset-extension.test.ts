import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ACCEPTED, describeFile, extForMime } from "@/lib/media/mime";
import { storage } from "@/lib/storage";
import { UPLOAD_DIR } from "@/db/client";

/**
 * A .jpeg upload was written to disk as original.jpeg while everything that
 * read it back derived the path from the stored mime — which resolves to
 * original.jpg, because ACCEPTED lists .jpg first. The file was on disk, the
 * byte count matched, and Galley said "The original file is missing".
 */
describe("where an upload is stored", () => {
  it("resolves both spellings of a type to one canonical extension", () => {
    expect(describeFile("photo.jpg")!.ext).toBe(".jpg");
    expect(describeFile("photo.jpeg")!.ext).toBe(".jpeg");
    // Both mean the same type, so both must be stored under the same name.
    expect(extForMime(describeFile("photo.jpg")!.mime)).toBe(extForMime(describeFile("photo.jpeg")!.mime));
  });

  /** Any mime with two accepted extensions can drift the same way. */
  it("has a canonical extension for every accepted type", () => {
    for (const [ext, { mime }] of Object.entries(ACCEPTED)) {
      const canonical = extForMime(mime);
      expect(canonical, `no canonical extension for ${ext} (${mime})`).toBeTruthy();
      expect(ACCEPTED[canonical]?.mime, `${canonical} does not round-trip to ${mime}`).toBe(mime);
    }
  });
});

describe("healing an original stored under the old name", () => {
  const ws = "heal-ws";
  const asset = "heal-asset";
  const dir = path.join(UPLOAD_DIR, ws, asset);
  const canonical = path.join(dir, "original.jpg");

  it("renames it into place and reports that it did", () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "original.jpeg"), "pretend jpeg bytes");

    expect(fs.existsSync(canonical)).toBe(false);
    expect(storage.healOriginal(ws, asset, canonical)).toBe(true);
    expect(fs.existsSync(canonical)).toBe(true);
    expect(fs.readFileSync(canonical, "utf8")).toBe("pretend jpeg bytes");
    // The old name is gone, so this is a move and not a copy.
    expect(fs.existsSync(path.join(dir, "original.jpeg"))).toBe(false);
  });

  it("does nothing when the canonical file is already there", () => {
    expect(storage.healOriginal(ws, asset, canonical)).toBe(false);
    expect(fs.readFileSync(canonical, "utf8")).toBe("pretend jpeg bytes");
  });

  it("does nothing when the original is genuinely absent", () => {
    const empty = path.join(UPLOAD_DIR, ws, "no-such-asset");
    fs.mkdirSync(empty, { recursive: true });
    expect(storage.healOriginal(ws, "no-such-asset", path.join(empty, "original.jpg"))).toBe(false);
  });

  it("does nothing when the asset directory does not exist at all", () => {
    expect(storage.healOriginal(ws, "never-existed", path.join(UPLOAD_DIR, ws, "never-existed", "original.jpg"))).toBe(false);
  });

  /** Thumbnails and previews are derived files; healing must not touch them. */
  it("only moves the original, never a derived variant", () => {
    const other = path.join(UPLOAD_DIR, ws, "derived");
    fs.mkdirSync(other, { recursive: true });
    fs.writeFileSync(path.join(other, "thumb.webp"), "thumb");
    expect(storage.healOriginal(ws, "derived", path.join(other, "original.jpg"))).toBe(false);
    expect(fs.existsSync(path.join(other, "thumb.webp"))).toBe(true);
  });
});
