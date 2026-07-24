import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(root, "scripts/browser-three-act-smoke.mjs");

describe("Phase 3A shell browser smoke", () => {
  it(
    "follow lock breaks on room change and stage controls stay Global-only",
    () => {
      const out = execFileSync("node", [script], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, BROWSER_LOAD_PORT: "4186" },
      });
      const result = JSON.parse(out) as { ok: boolean };
      expect(result.ok).toBe(true);
    },
    180000,
  );
});
