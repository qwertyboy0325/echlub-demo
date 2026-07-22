import { describe, expect, it } from "vitest";
import { createInitialState, applyScriptEvent } from "../runtimeState";
import { performanceScript } from "../performanceScript";
import { parsePosition } from "../musicalPosition";
import { executeSceneTransaction } from "../sceneTransaction";
import { SceneExecutionAuthority } from "../sceneExecution";
import { AudioEngine } from "../audioEngine";

describe("queue lifecycle around Main Release", () => {
  it("queues release at bar 28 before launch without executing early", () => {
    const state = createInitialState();
    state.currentBar = 27;

    const queueEvent = performanceScript.find((e) => e.id === "e27")!;
    applyScriptEvent(state, queueEvent);

    expect(state.activeSceneId).toBe("idle");
    expect(state.queue.some((q) => q.sceneId === "release" && q.status === "queued")).toBe(true);
    expect(state.queue.find((q) => q.sceneId === "release")?.executeAtBar).toBe(28);
    expect(state.queue.find((q) => q.sceneId === "release")?.boundaryId).toBe("release@bar-29");
    expect(state.boundaryCountdown?.barsRemaining).toBe(1);
    expect(state.boundaryCountdown?.boundaryId).toBe("release@bar-29");
  });

  it("executes queue only through scene transaction at boundary", () => {
    const state = createInitialState();
    const authority = new SceneExecutionAuthority();
    const engine = new AudioEngine({ onStep: () => {}, onFinished: () => {} });

    applyScriptEvent(state, performanceScript.find((e) => e.id === "e27")!);
    const launchEvent = performanceScript.find((e) => e.id === "e28")!;
    const bar = parsePosition(launchEvent.at).bar;

    expect(state.activeSceneId).toBe("idle");
    const ok = executeSceneTransaction({
      state,
      sceneAuthority: authority,
      audioEngine: engine,
      event: launchEvent,
      bar,
      transportTime: 0,
    });
    expect(ok).toBe(true);
    expect(state.activeSceneId).toBe("release");
    expect(state.queue.find((q) => q.sceneId === "release")?.status).toBe("playing");
    expect(state.boundaryCountdown).toBeNull();
    expect(authority.executionRecords).toHaveLength(1);
    expect(authority.executionRecords[0].boundaryId).toBe("release@bar-29");
  });
});
