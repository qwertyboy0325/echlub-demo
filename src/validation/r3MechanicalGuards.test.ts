import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const FORBIDDEN_RUNTIME_MODULES = [
  "src/audioEngine.ts",
  "src/sceneExecution.ts",
  "src/sceneTransaction.ts",
  "src/demo/demoRuntime.ts",
  "src/demo/demoController.ts",
];

describe("no hidden static musicData imports in runtime consumers", () => {
  for (const rel of FORBIDDEN_RUNTIME_MODULES) {
    it(`${rel} does not import musicData`, () => {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).not.toMatch(/from\s+["']\.\.?\/musicData["']/);
      expect(src).not.toMatch(/from\s+["']\.\.?\/\.\.?\/musicData["']/);
    });
  }
});

describe("no pack-answer copying in productionMutations", () => {
  it("placeInScene does not read pack.arrangement.scenes draftRefs", () => {
    const src = readFileSync(join(root, "src/demo/productionMutations.ts"), "utf8");
    expect(src).not.toMatch(/pack\.arrangement\.scenes/);
    expect(src).not.toMatch(/draftRefs/);
  });
});

describe("Live authority convergence guards", () => {
  it("RuntimeState collaboration path cannot mutate Draft content or mix values", () => {
    const src = readFileSync(join(root, "src/runtimeState.ts"), "utf8");
    const body = src.slice(
      src.indexOf("export function applyCollaborationEvent"),
      src.indexOf("export const applyScriptEvent"),
    );
    expect(body).not.toMatch(/\.notes\s*[.=]/);
    expect(body).not.toMatch(/\.steps\s*[.=]/);
    expect(body).not.toMatch(/state\.mix\s*[.=]/);
    expect(body).not.toMatch(/state\.mix\.[A-Za-z]/);
  });

  it("normal Live execution has no RuntimeState-to-session repair bridge", () => {
    const main = readFileSync(join(root, "src/legacy/fourBrainMain.ts"), "utf8");
    const controller = readFileSync(join(root, "src/demo/demoController.ts"), "utf8");
    expect(main).not.toContain("syncRuntimeDraftsToSession");
    expect(controller).not.toContain("syncRuntimeDraftsToSession");
  });
});
