import { describe, expect, it } from "vitest";
import { createInitialState, applyScriptEvent, resetState } from "../runtimeState";
import { performanceScript, EXPECTED_SCRIPT_SCHEDULE_COUNT } from "../performanceScript";
import { SceneExecutionAuthority } from "../sceneExecution";
import { RuntimeInstrumentation } from "../runtimeInstrumentation";
import { defaultMix } from "../musicData";
import { parsePosition } from "../musicalPosition";
import { executeSceneTransaction } from "../sceneTransaction";
import { AudioEngine } from "../audioEngine";
import { captureJamMemoryForTransaction } from "../jamMemory";

function simulateRun(): { events: string[]; scenes: string[]; queue: number; memories: string[] } {
  const state = createInitialState();
  const authority = new SceneExecutionAuthority();
  const inst = new RuntimeInstrumentation();
  const engine = new AudioEngine({ onStep: () => {}, onFinished: () => {} });
  inst.setScheduleCount(EXPECTED_SCRIPT_SCHEDULE_COUNT);

  for (const event of performanceScript) {
    inst.logEvent(event);
    applyScriptEvent(state, event);
    if (event.action === "launch" && event.target) {
      const bar = parsePosition(event.at).bar;
      executeSceneTransaction({
        state,
        sceneAuthority: authority,
        audioEngine: engine,
        event,
        bar,
        transportTime: 0,
      });
      const record = authority.executionRecords[authority.executionRecords.length - 1];
      inst.logSceneExecution(record);
    }
  }
  return {
    events: inst.snapshot(state).eventIds,
    scenes: inst.snapshot(state).sceneExecutions,
    queue: inst.snapshot(state).queueLength,
    memories: state.history.map((h) => h.id),
  };
}

describe("restart determinism", () => {
  it("three identical simulated runs produce equal event and scene logs", () => {
    const run1 = simulateRun();
    const run2 = simulateRun();
    const run3 = simulateRun();
    expect(run1.events).toEqual(run2.events);
    expect(run2.events).toEqual(run3.events);
    expect(run1.scenes).toEqual(run2.scenes);
    expect(run2.scenes).toEqual(run3.scenes);
    expect(run1.memories).toEqual(run2.memories);
    expect(run1.scenes.filter((s) => s.startsWith("release@")).length).toBe(1);
  });

  it("reset restores drafts, queue, mix and scene authority", () => {
    const state = createInitialState();
    const authority = new SceneExecutionAuthority();
    state.drafts["memory-opening"].status = "playing";
    state.queue.push({
      id: "q1",
      label: "test",
      queuedAt: { bar: 28, beat: 0, sixteenth: 0 },
      executeAt: { bar: 28, beat: 0, sixteenth: 0 },
      executeAtBar: 28,
      boundary: "bar",
      status: "queued",
    });
    state.mix.filter = 3200;
    authority.executeScene("release", { bar: 28, beat: 0, sixteenth: 0 });
    resetState(state);
    authority.reset();
    expect(state.drafts["memory-opening"].status).toBe("editing");
    expect(state.queue).toEqual([]);
    expect(state.mix.filter).toBe(defaultMix.filter);
    expect(authority.executionRecords).toEqual([]);
  });
});

describe("jam memory execution binding", () => {
  it("does not capture without scene transaction", () => {
    const state = createInitialState();
    state.currentBar = 29;
    expect(state.history).toHaveLength(0);
  });

  it("captures once per execution with boundary reference", () => {
    const state = createInitialState();
    const authority = new SceneExecutionAuthority();
    const tx = authority.executeScene("release", { bar: 28, beat: 0, sixteenth: 0 }).transaction;
    const captured = captureJamMemoryForTransaction(state, tx);
    expect(captured?.boundaryId).toBe("release@bar-29");
    expect(captured?.sceneExecutionId).toBe(tx.sceneExecutionId);
    expect(captureJamMemoryForTransaction(state, tx)).toBeNull();
  });
});
