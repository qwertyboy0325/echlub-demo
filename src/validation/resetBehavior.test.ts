import { describe, expect, it } from "vitest";
import { createInitialState, resetState } from "../runtimeState";
import { initialDrafts } from "../musicData";

describe("reset behavior", () => {
  it("returns drafts to initial values", () => {
    const state = createInitialState();
    state.drafts["memory-opening"].status = "playing";
    state.queue.push({
      id: "q1",
      label: "test",
      queuedAt: { bar: 8, beat: 0, sixteenth: 0 },
      executeAt: { bar: 8, beat: 0, sixteenth: 0 },
      executeAtBar: 8,
      boundary: "bar",
      status: "queued",
    });
    state.offeredDrafts.push("memory-main");
    state.history.push({ id: "m1", at: "0:0:0", title: "t", description: "d" });
    resetState(state);
    expect(state.drafts["memory-opening"].status).toBe("editing");
    expect(state.queue).toEqual([]);
    expect(state.offeredDrafts).toEqual([]);
    expect(state.history).toEqual([]);
    expect(Object.keys(state.drafts).length).toBe(initialDrafts.length);
  });

  it("preserves recording mode across reset", () => {
    const state = createInitialState();
    state.recordingMode = true;
    resetState(state);
    expect(state.recordingMode).toBe(true);
  });

  it("clears boundary countdown", () => {
    const state = createInitialState();
    state.boundaryCountdown = { label: "test", boundaryId: "test@bar-1", barsRemaining: 2, beatsRemaining: 8 };
    resetState(state);
    expect(state.boundaryCountdown).toBeNull();
  });
});
