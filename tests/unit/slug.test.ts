import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => expect(slugify("Marlow & Finch Joinery")).toBe("marlow-finch-joinery"));
  it("strips accents", () => expect(slugify("Café Été")).toBe("cafe-ete"));
  it("falls back for empty", () => expect(slugify("!!!")).toBe("untitled"));
});
