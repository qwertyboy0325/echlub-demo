import { describe, expect, it } from "vitest";
import { createLiveCollabArrangementSlots, createLiveCollabInitialShellState } from "../shell/domain/liveCollabShellFixtures";
import { ShellStore } from "../shell/domain/shellStore";
import { createFixtureShellState, createInitialShellState } from "../shell/domain/shellFixtures";

describe("participant workspace state", () => {
  it("loads each participant draft/tab/submode on SELECT_PARTICIPANT", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p2" });
    let s = store.getState();
    expect(s.workspaceDraftId).toBe("kai-lh-sparse-4");
    expect(s.participantTab).toBe("Create");
    expect(s.createSubMode).toBe("piano");

    store.dispatch({ type: "SET_PARTICIPANT_TAB", tab: "Devices" });
    store.dispatch({ type: "SET_CREATE_SUBMODE", mode: "clip" });
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p4" });
    s = store.getState();
    expect(s.workspaceDraftId).toBe("ren-comp-2");
    expect(s.participantTab).toBe("Devices");

    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p2" });
    s = store.getState();
    expect(s.workspaceDraftId).toBe("kai-lh-sparse-4");
    expect(s.participantTab).toBe("Devices");
    expect(s.createSubMode).toBe("clip");
  });

  it("persists fork draft to the active participant workspace", () => {
    const store = new ShellStore({
      ...createFixtureShellState(),
      exchangeClips: [
        {
          id: "c1",
          title: "pulse-r1",
          revision: 1,
          creatorId: "p2",
          contributorId: null,
          lifecycle: "Available",
          thumbnail: "notes",
          lineageParentId: null,
          forkOf: null,
          draftId: "kai-lh-sparse-4",
        },
      ],
      selectedParticipantId: "p2",
      participantWorkspaces: {
        ...createInitialShellState().participantWorkspaces,
        p2: {
          draftId: "kai-lh-sparse-4",
          tab: "Create",
          createSubMode: "piano",
          ownedTrackIds: [],
        },
      },
    });
    store.dispatch({ type: "FORK_CLIP", clipId: "c1" });
    const s = store.getState();
    expect(s.workspaceDraftId).toContain("fork");
    expect(s.participantWorkspaces.p2?.draftId).toContain("fork");
  });

  it("follow projection restores participant tab from workspace record", () => {
    const store = new ShellStore({
      ...createLiveCollabInitialShellState(),
      followActive: true,
      followLocked: false,
    });
    store.dispatch({
      type: "SET_PARTICIPANT_PROJECTION",
      participantId: "p4",
      room: "participant",
      tab: "Devices",
    });
    const s = store.getState();
    expect(s.room).toBe("participant");
    expect(s.participantTab).toBe("Devices");
    expect(s.workspaceDraftId).toBe("ren-comp-2");
  });
});

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
  it("keeps prior lane slots playing when launching another lane", () => {
    const store = new ShellStore({
      ...createInitialShellState(),
      arrangementSlots: createLiveCollabArrangementSlots(),
    });
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-3" });
    store.dispatch({ type: "COMMIT_LANE_LAUNCH", slotId: "lane-3" });
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-4" });
    store.dispatch({ type: "COMMIT_LANE_LAUNCH", slotId: "lane-4" });
    const slots = store.getState().arrangementSlots;
    expect(slots[2]?.state).toBe("playing");
    expect(slots[3]?.state).toBe("playing");
    expect(slots[0]?.state).toBe("empty");
    expect(store.getState().activeMasterDraftId).toContain("live-collab");
  });

  it("rejects launch from empty lane slots", () => {
    const store = new ShellStore({
      ...createInitialShellState(),
      arrangementSlots: createLiveCollabArrangementSlots(),
    });
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-1" });
    expect(store.getState().arrangementSlots[0]?.state).toBe("empty");
  });
});

describe("handoff captions", () => {
  it("mints authored draft titles on share", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p2" });
    store.dispatch({ type: "SHARE_CLIP" });
    const s = store.getState();
    const clip = s.exchangeClips.at(-1);
    expect(clip?.title).toBe("kai-lh-sparse-4");
    expect(s.activityFeed[0]).toBe("Exchange: kai-lh-sparse-4 shared");
    expect(s.exchangeOpen).toBe(true);
    expect(s.selectedExchangeClipId).toBe(clip?.id ?? null);
  });

  it("recalls workspace draft with caption", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    store.dispatch({
      type: "SET_WORKSPACE_DRAFT",
      draftId: "kai-lh-sparse-4",
      recallRole: "closing pad",
    });
    const s = store.getState();
    expect(s.workspaceDraftId).toBe("kai-lh-sparse-4");
    expect(s.recallRole).toBe("closing pad");
    expect(s.activityFeed[0]).toBe("Recall · kai-lh-sparse-4 → closing pad");
  });

  it("promotes fork clips via PROMOTE_CLIP command", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p4" });
    store.dispatch({ type: "SHARE_CLIP" });
    store.dispatch({ type: "FORK_CLIP", clipId: "c1" });
    const fork = store.getState().exchangeClips.find((clip) => clip.forkOf === "c1")!;
    store.dispatch({ type: "MARK_READY", clipId: fork.id });
    store.dispatch({ type: "PROMOTE_CLIP", clipId: fork.id, slotId: "lane-5" });
    const slot = store.getState().arrangementSlots.find((entry) => entry.id === "lane-5");
    expect(slot?.label).toContain("←");
    expect(store.getState().activityFeed[0]).toContain("Promote ·");
  });

  it("stages fork clips with promote lineage on lane label", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p4" });
    store.dispatch({ type: "SHARE_CLIP" });
    store.dispatch({ type: "FORK_CLIP", clipId: "c1" });
    const fork = store.getState().exchangeClips.find((clip) => clip.forkOf === "c1")!;
    store.dispatch({ type: "MARK_READY", clipId: fork.id });
    store.dispatch({ type: "STAGE_CLIP", clipId: fork.id, slotId: "lane-5" });
    const slot = store.getState().arrangementSlots.find((entry) => entry.id === "lane-5");
    expect(slot?.label).toContain("←");
    expect(store.getState().activityFeed[0]).toContain("Promote ·");
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
