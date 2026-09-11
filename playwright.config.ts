import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = process.env.GALLEY_E2E_DATA ?? fs.mkdtempSync(path.join(os.tmpdir(), "galley-e2e-"));
const port = Number(process.env.GALLEY_E2E_PORT ?? 3111);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    env: { GALLEY_DATA_DIR: dataDir, GALLEY_URL: `http://127.0.0.1:${port}` },
    timeout: 60_000,
  },
});
