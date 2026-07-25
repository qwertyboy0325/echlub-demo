import { describe, expect, it } from "vitest";
import { createLiveCollabArrangementSlots } from "../shell/domain/liveCollabShellFixtures";
import { ShellStore } from "../shell/domain/shellStore";
import { createFixtureShellState, createInitialShellState } from "../shell/domain/shellFixtures";

describe("SET_PARTICIPANT_PROJECTION", () => {
  it("updates projected room/tab without locking follow", () => {
    const store = new ShellStore({ ...createInitialShellState(), followActive: true, followLocked: false });
    store.dispatch({
      type: "SET_PARTICIPANT_PROJECTION",
      participantId: "p2",
      room: "mixer",
      tab: "Mix",
    });
    const s = store.getState();
    expect(s.followActive).toBe(true);
    expect(s.followLocked).toBe(false);
    expect(s.room).toBe("mixer");
    expect(s.participantTab).toBe("Mix");
    expect(s.participants.find((p) => p.id === "p2")?.projectedRoom).toBe("mixer");
    expect(s.participants.find((p) => p.id === "p2")?.active).toBe(true);
  });

  it("stores projection without moving camera when follow is off", () => {
    const store = new ShellStore(createInitialShellState());
    store.dispatch({
      type: "SET_PARTICIPANT_PROJECTION",
      participantId: "p3",
      room: "participant",
      tab: "Automation",
    });
    const s = store.getState();
    expect(s.room).toBe("global");
    expect(s.participants.find((p) => p.id === "p3")?.projectedTab).toBe("Automation");
  });
});

describe("LAUNCH_SLOT lane accumulation", () => {
  it("keeps prior lane slots active when launching another lane", () => {
    const store = new ShellStore({
      ...createInitialShellState(),
      arrangementSlots: createLiveCollabArrangementSlots(),
    });
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-1" });
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-2" });
    const slots = store.getState().arrangementSlots;
    expect(slots[0]?.state).toBe("active");
    expect(slots[1]?.state).toBe("active");
    expect(slots[2]?.state).toBe("empty");
    expect(store.getState().activeMasterDraftId).toContain("live-collab");
  });
});

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
