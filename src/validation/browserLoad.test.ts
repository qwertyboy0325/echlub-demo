import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(root, "scripts/browser-load-regression.mjs");

describe("browser load regression", () => {
  it(
    "renders #start-button and survives start/restart without page errors",
    () => {
      const out = execFileSync("node", [script], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, BROWSER_LOAD_PORT: "4184" },
      });
      const result = JSON.parse(out) as { ok: boolean };
      expect(result.ok).toBe(true);
    },
    120000,
  );
});
