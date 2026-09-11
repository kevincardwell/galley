import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.GALLEY_DATA_DIR ? `${process.env.GALLEY_DATA_DIR}/galley.db` : "./data/galley.db" },
});
