import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(root, "scripts/browser-three-act-smoke.mjs");

describe("Production to Canonical to Live causal browser proof", () => {
  it(
    "proves the same edited memory-opening revision reaches Cue, Master and comparison",
    () => {
      const out = execFileSync("node", [script], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, BROWSER_LOAD_PORT: "4186" },
      });
      const result = JSON.parse(out) as {
        ok: boolean;
        missingMaterialCount: number;
        canonicalMaterialResolution?: { fingerprint: string };
        liveMasterResolution?: { fingerprint: string };
        comparisonDelta?: { draftId: string };
      };
      expect(result.ok).toBe(true);
      expect(result.missingMaterialCount).toBe(0);
      expect(result.liveMasterResolution?.fingerprint).not.toBe(
        result.canonicalMaterialResolution?.fingerprint,
      );
      expect(result.comparisonDelta?.draftId).toBe("memory-opening");
    },
    180000,
  );
});
