import fs from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.GALLEY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "galley-test-"));
