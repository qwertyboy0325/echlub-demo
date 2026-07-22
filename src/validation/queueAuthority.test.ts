import { describe, expect, it } from "vitest";
import { AudioEngine } from "../audioEngine";
import { createInitialState } from "../runtimeState";
import { queueExecutedBeforeTransaction } from "../queueLifecycle";
import { SceneExecutionAuthority } from "../sceneExecution";
import { executeSceneTransaction } from "../sceneTransaction";
import { performanceScript } from "../performanceScript";
import { parsePosition } from "../musicalPosition";
import { applyScriptEvent } from "../runtimeState";

describe("queue single authority", () => {
  it("fails validation when queue executed before transaction", () => {
    const state = createInitialState();
    state.queue.push({
      id: "q",
      label: "Main Release",
      queuedAt: { bar: 27, beat: 0, sixteenth: 0 },
      executeAt: { bar: 28, beat: 0, sixteenth: 0 },
      executeAtBar: 28,
      boundary: "phrase",
      boundaryId: "release@bar-29",
      sceneId: "release",
      status: "executed",
    });
    expect(queueExecutedBeforeTransaction(state, "release@bar-29")).toBe(true);
  });

  it("scene executes only once for duplicate callback", () => {
    const state = createInitialState();
    const authority = new SceneExecutionAuthority();
    const engine = new AudioEngine({ onStep: () => {}, onFinished: () => {} });
    applyScriptEvent(state, performanceScript.find((e) => e.id === "e27")!);
    const launch = performanceScript.find((e) => e.id === "e28")!;
    const bar = parsePosition(launch.at).bar;
    const ctx = { state, sceneAuthority: authority, audioEngine: engine, event: launch, bar, transportTime: 0 };
    expect(executeSceneTransaction(ctx)).toBe(true);
    expect(executeSceneTransaction(ctx)).toBe(false);
    expect(authority.executionRecords).toHaveLength(1);
  });
});

describe("private cue bus surface", () => {
  it("exposes independent cue controls without preview mode gate", () => {
    const engine = new AudioEngine({ onStep: () => {}, onFinished: () => {} });
    expect(typeof engine.startPrivateCue).toBe("function");
    expect(typeof engine.stopPrivateCue).toBe("function");
    expect(typeof engine.resetPrivateCue).toBe("function");
    expect(engine.isCueActive()).toBe(false);
    expect((engine as unknown as { previewMode?: boolean }).previewMode).toBeUndefined();
  });
});
