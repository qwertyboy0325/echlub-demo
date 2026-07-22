// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { addMeasures, formatPosition, parsePosition } from "../musicalPosition";
import { computeRampTargetTime } from "../mixMapping";
import { createInitialState, applyScriptEvent } from "../runtimeState";
import { performanceScript } from "../performanceScript";
import { finalizeQueueForTransaction } from "../queueLifecycle";
import { SceneExecutionAuthority } from "../sceneExecution";
import { executeSceneTransaction } from "../sceneTransaction";
import { AudioEngine, computeCueStopPosition } from "../audioEngine";
import { PresentationEngine } from "../presentation";
import { activeTimeoutCount, clearAllTimeouts } from "../timerRegistry";
import { EXPECTED_SCRIPT_SCHEDULE_COUNT } from "../performanceScript";

describe("cue stop transport-position calculation", () => {
  it("stores stop position two measures after start", () => {
    const start = parsePosition("2:0:0");
    const stop = addMeasures(start, 2);
    expect(formatPosition(stop)).toBe("4:0:0");
  });

  it("schedules cue stop relative to transport start position", () => {
    const start = parsePosition("2:0:0");
    const stop = computeCueStopPosition(start, 2);
    expect(formatPosition(stop)).toBe("4:0:0");
  });
});

describe("completed cue evidence", () => {
  it("builds completion record with start and stop transport positions", () => {
    const evidence = {
      draftId: "memory-opening",
      cueStartedAt: "2:0:0",
      cueStoppedAt: "4:0:0",
      masterSceneBefore: "idle",
      masterSceneDuring: "opening",
      masterStepCountAtStart: 12,
      masterStepCountAtStop: 44,
      cueNoteCount: 4,
    };
    expect(evidence.masterStepCountAtStop).toBeGreaterThan(evidence.masterStepCountAtStart);
    expect(evidence.cueNoteCount).toBeGreaterThan(0);
    expect(evidence.cueStoppedAt).toBe(formatPosition(computeCueStopPosition(parsePosition(evidence.cueStartedAt), 2)));
  });

  it("does not expose scheduleStopPrivateCue on the audio surface", () => {
    const engine = new AudioEngine({ onStep: () => {}, onFinished: () => {} });
    expect((engine as unknown as { scheduleStopPrivateCue?: unknown }).scheduleStopPrivateCue).toBeUndefined();
  });
});

describe("audio ramp target time", () => {
  it("computes target as start plus duration", () => {
    expect(computeRampTargetTime(1.5, 0.18)).toBeCloseTo(1.68, 5);
    expect(computeRampTargetTime(10, 0.12)).toBeCloseTo(10.12, 5);
  });
});

describe("presentation timer cancellation", () => {
  it("cancels actor-chain and cleanup timers on reset", async () => {
    const presentation = new PresentationEngine();
    document.body.innerHTML = `
      <article class="brain-window" data-brain="memory">
        <div class="brain-workspace" data-target="memory-grid"></div>
        <div class="virtual-cursor" data-cursor="memory"><i></i><b>M</b></div>
      </article>`;
    presentation.initialize();
    presentation.executeSteps([{
      actor: "memory",
      gesture: "click",
      target: "memory-grid",
      eventId: "test-chain",
      duration: 0.1,
      dwell: 0.1,
    }, {
      actor: "memory",
      gesture: "click",
      target: "memory-grid",
      eventId: "test-chain",
      duration: 0.1,
      dwell: 0.1,
    }]);
    expect(activeTimeoutCount()).toBeGreaterThan(0);
    presentation.reset();
    expect(activeTimeoutCount()).toBe(0);
    clearAllTimeouts();
  });
});

describe("restart phase schedule counts", () => {
  it("uses a fixed expected script schedule count", () => {
    expect(EXPECTED_SCRIPT_SCHEDULE_COUNT).toBe(performanceScript.length);
    expect(EXPECTED_SCRIPT_SCHEDULE_COUNT).toBe(44);
  });
});

describe("true queuedAt versus executeAt", () => {
  it("stores queue event position separately from launch position", () => {
    const state = createInitialState();
    applyScriptEvent(state, performanceScript.find((e) => e.id === "e27")!);
    const item = state.queue.find((q) => q.sceneId === "release");
    expect(item?.queuedAt).toEqual(parsePosition("27:0:0"));
    expect(item?.executeAt).toEqual(parsePosition("28:0:0"));
    expect(item?.queuedAt.bar).not.toBe(item?.executeAt.bar);
  });
});

describe("playing queue lifecycle", () => {
  it("promotes queued to playing without same-tick executed transition", () => {
    const state = createInitialState();
    const authority = new SceneExecutionAuthority();
    const engine = new AudioEngine({ onStep: () => {}, onFinished: () => {} });
    applyScriptEvent(state, performanceScript.find((e) => e.id === "e27")!);
    const launch = performanceScript.find((e) => e.id === "e28")!;
    const bar = parsePosition(launch.at).bar;
    executeSceneTransaction({
      state,
      sceneAuthority: authority,
      audioEngine: engine,
      event: launch,
      bar,
      transportTime: 0,
    });
    const release = state.queue.find((q) => q.sceneId === "release");
    expect(release?.status).toBe("playing");
    expect(state.activeSceneId).toBe("release");
  });

  it("archives previous playing when next scene executes", () => {
    const state = createInitialState();
    const authority = new SceneExecutionAuthority();
    const tx = authority.executeScene("tease", { bar: 22, beat: 0, sixteenth: 0 }).transaction;
    state.queue.push({
      id: "q-groove",
      sceneId: "groove",
      label: "Groove",
      queuedAt: parsePosition("12:0:0"),
      executeAt: parsePosition("14:0:0"),
      executeAtBar: 14,
      boundary: "phrase",
      boundaryId: "groove@bar-15",
      status: "playing",
    });
    state.queue.push({
      id: "q-tease",
      sceneId: "tease",
      label: "Tease",
      queuedAt: parsePosition("21:0:0"),
      executeAt: parsePosition("22:0:0"),
      executeAtBar: 22,
      boundary: "phrase",
      boundaryId: "tease@bar-23",
      status: "queued",
    });
    finalizeQueueForTransaction(state, tx, { bar: 22, beat: 0, sixteenth: 0 });
    expect(state.queue.find((q) => q.sceneId === "groove")?.status).toBe("executed");
    expect(state.queue.find((q) => q.sceneId === "tease")?.status).toBe("playing");
  });

  it("archives stale draft-only queue items when a scene launches", () => {
    const state = createInitialState();
    const authority = new SceneExecutionAuthority();
    const tx = authority.executeScene("opening", { bar: 6, beat: 0, sixteenth: 0 }).transaction;
    state.queue.push({
      id: "queue-item-e07",
      draftId: "memory-opening",
      label: "Offered: Opening fragment",
      queuedAt: parsePosition("4:0:0"),
      executeAt: parsePosition("6:0:0"),
      executeAtBar: 6,
      boundary: "phrase",
      status: "queued",
    });
    finalizeQueueForTransaction(state, tx, { bar: 6, beat: 0, sixteenth: 0 });
    expect(state.queue.find((q) => q.id === "queue-item-e07")?.status).toBe("archived");
  });
});
