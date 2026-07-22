import { describe, expect, it } from "vitest";
import { performanceScript } from "../performanceScript";
import { RuntimeInstrumentation } from "../runtimeInstrumentation";
import { createInitialState } from "../runtimeState";
import { SceneExecutionAuthority } from "../sceneExecution";
import { executeSceneTransaction } from "../sceneTransaction";
import { AudioEngine } from "../audioEngine";
import { parsePosition } from "../musicalPosition";
import type { PerformanceScriptEvent } from "../types";

/** Mirrors post-fix `projectScriptEventUi` instrumentation in main.ts. */
function recordProjectScriptEventUi(inst: RuntimeInstrumentation, event: PerformanceScriptEvent): void {
  inst.logEvent(event);
}

function simulateInstrumentedRun(): { eventIds: string[]; sceneExecutions: string[] } {
  const state = createInitialState();
  const authority = new SceneExecutionAuthority();
  const inst = new RuntimeInstrumentation();
  const engine = new AudioEngine({ onStep: () => {}, onFinished: () => {} });

  for (const event of performanceScript) {
    recordProjectScriptEventUi(inst, event);
    if (event.action === "launch" && event.target) {
      executeSceneTransaction({
        state,
        sceneAuthority: authority,
        audioEngine: engine,
        event,
        bar: parsePosition(event.at).bar,
        transportTime: 0,
      });
      const record = authority.executionRecords[authority.executionRecords.length - 1];
      inst.logSceneExecution(record);
    }
  }

  const snapshot = inst.snapshot(state);
  return { eventIds: snapshot.eventIds, sceneExecutions: snapshot.sceneExecutions };
}

describe("instrumentation event deduplication", () => {
  it("records each semantic event ID once per run without duplicating launches", () => {
    const launches = performanceScript.filter((event) => event.action === "launch" && event.target);
    const { eventIds, sceneExecutions } = simulateInstrumentedRun();

    expect(eventIds).toHaveLength(performanceScript.length);
    expect(new Set(eventIds).size).toBe(eventIds.length);

    for (const launch of launches) {
      expect(eventIds.filter((id) => id === launch.id)).toEqual([launch.id]);
    }

    expect(sceneExecutions).toHaveLength(launches.length);
  });
});
