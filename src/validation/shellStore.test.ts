import { describe, expect, it } from "vitest";
import { ShellStore } from "../shell/domain/shellStore";
import { createFixtureShellState, createInitialShellState } from "../shell/domain/shellFixtures";

describe("shellStore", () => {
  it("breaks follow on manual room change", () => {
    const store = new ShellStore({ ...createInitialShellState(), followActive: true, followLocked: false });
    store.dispatch({ type: "SET_ROOM", room: "mixer" });
    const s = store.getState();
    expect(s.followActive).toBe(false);
    expect(s.followLocked).toBe(true);
    expect(s.room).toBe("mixer");
  });

  it("resumes follow only via RESUME_FOLLOW", () => {
    const store = new ShellStore({ ...createInitialShellState(), followLocked: true });
    store.dispatch({ type: "RESUME_FOLLOW" });
    const s = store.getState();
    expect(s.followActive).toBe(true);
    expect(s.followLocked).toBe(false);
    expect(s.room).toBe("participant");
    expect(s.participantTab).toBe("Create");
  });

  it("revise returns Review clips to In Progress with bumped revision", () => {
    const store = new ShellStore(createFixtureShellState());
    const clipId = store.getState().exchangeClips[0]!.id;
    store.dispatch({ type: "SUBMIT_REVIEW", clipId });
    store.dispatch({ type: "REVISE_CLIP", clipId });
    const clip = store.getState().exchangeClips.find((c) => c.id === clipId)!;
    expect(clip.lifecycle).toBe("In Progress");
    expect(clip.revision).toBe(2);
  });

  it("ignores stage/activate when clip not ready", () => {
    const store = new ShellStore(createFixtureShellState());
    const clipId = store.getState().exchangeClips[0]!.id;
    store.dispatch({ type: "STAGE_CLIP", clipId, slotId: "s1" });
    expect(store.getState().arrangementSlots[0]!.state).toBe("empty");
  });

  it("stages and activates only through arrangement commands", () => {
    const store = new ShellStore(createFixtureShellState());
    const clipId = store.getState().exchangeClips[0]!.id;
    store.dispatch({ type: "MARK_READY", clipId });
    store.dispatch({ type: "STAGE_CLIP", clipId, slotId: "s1" });
    expect(store.getState().arrangementSlots[0]!.state).toBe("staged");
    store.dispatch({ type: "ACTIVATE_SLOT", slotId: "s1" });
    expect(store.getState().arrangementSlots[0]!.state).toBe("active");
  });

  it("preserves exchange state across room switches", () => {
    const store = new ShellStore(createFixtureShellState());
    store.dispatch({ type: "SHARE_CLIP" });
    const count = store.getState().exchangeClips.length;
    store.dispatch({ type: "SET_ROOM", room: "participant" });
    store.dispatch({ type: "SET_ROOM", room: "global" });
    expect(store.getState().exchangeClips.length).toBe(count);
  });

  it("freezes follow mutations while interaction frozen", () => {
    const store = new ShellStore({ ...createInitialShellState(), interactionFrozen: true });
    store.dispatch({ type: "SET_ROOM", room: "mixer" });
    expect(store.getState().room).toBe("global");
  });
});
