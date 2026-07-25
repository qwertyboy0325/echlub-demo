import { describe, expect, it } from "vitest";
import { resolveExchangeComparePair } from "../features/exchange/exchangeCompare";
import { createLiveCollabArrangementSlots, createLiveCollabInitialShellState } from "../shell/domain/liveCollabShellFixtures";
import { ShellStore } from "../shell/domain/shellStore";
import type { ShellCommand } from "../shell/domain/shellTypes";
import { PHASE5_WALKTHROUGH } from "../shell/presenterWalkthrough";

const HANDOFF_COMMANDS = new Set<ShellCommand["type"]>([
  "SHARE_CLIP",
  "FORK_CLIP",
  "MARK_READY",
  "STAGE_CLIP",
  "PROMOTE_CLIP",
]);

function applyBeatCommands(store: ShellStore, beat: number): void {
  const step = PHASE5_WALKTHROUGH.find((entry) => entry.beat === beat);
  if (!step) throw new Error(`missing beat ${beat}`);
  for (const command of step.commands) store.dispatch(command);
}

describe("WP5.7 Phase 1-2", () => {
  it("keeps exchange open with selected clip on handoff beats", () => {
    const handoffBeats = PHASE5_WALKTHROUGH.filter((step) =>
      step.commands.some((command) => HANDOFF_COMMANDS.has(command.type)),
    );
    expect(handoffBeats.length).toBeGreaterThan(8);
    for (const step of handoffBeats) {
      const store = new ShellStore(createLiveCollabInitialShellState());
      for (let beat = 1; beat <= step.beat; beat += 1) {
        applyBeatCommands(store, beat);
      }
      const state = store.getState();
      expect(state.exchangeOpen, step.label).toBe(true);
      const selectsClip = step.commands.some((command) => command.type === "SELECT_EXCHANGE_CLIP");
      if (selectsClip) {
        const clipId = step.commands.find((command) => command.type === "SELECT_EXCHANGE_CLIP")?.clipId;
        expect(state.selectedExchangeClipId, step.label).toBe(clipId ?? null);
      }
    }
  });

  it("shows compare pair when a fork clip is selected", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p2" });
    store.dispatch({ type: "SHARE_CLIP" });
    store.dispatch({ type: "FORK_CLIP", clipId: "c1" });
    const fork = store.getState().exchangeClips.find((clip) => clip.forkOf === "c1")!;
    store.dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: fork.id });
    const pair = resolveExchangeComparePair(store.getState());
    expect(pair?.parent.id).toBe("c1");
    expect(pair?.fork.id).toBe(fork.id);
  });

  it("runs fork compare accept stage launch lifecycle on beats 11-14", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    for (let beat = 1; beat <= 14; beat += 1) applyBeatCommands(store, beat);
    const fork = store.getState().exchangeClips.find((clip) => clip.forkOf === "c2");
    expect(fork?.lifecycle).toBe("Ready");
    expect(store.getState().arrangementSlots.find((slot) => slot.id === "lane-2")?.state).toBe("queued");
    expect(resolveExchangeComparePair(store.getState())?.fork.id).toBe(fork?.id);
  });

  it("promotes fork lineage without launch alias", () => {
    const store = new ShellStore({
      ...createLiveCollabInitialShellState(),
      arrangementSlots: createLiveCollabArrangementSlots(),
    });
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p4" });
    store.dispatch({ type: "SHARE_CLIP" });
    store.dispatch({ type: "FORK_CLIP", clipId: "c1" });
    const fork = store.getState().exchangeClips.find((clip) => clip.forkOf === "c1")!;
    store.dispatch({ type: "MARK_READY", clipId: fork.id });
    store.dispatch({ type: "PROMOTE_CLIP", clipId: fork.id, slotId: "lane-5" });
    const slot = store.getState().arrangementSlots.find((entry) => entry.id === "lane-5");
    expect(slot?.state).toBe("loaded");
    expect(slot?.label).toContain("←");
    expect(store.getState().activityFeed[0]).toContain("Promote ·");
    const beforeLaunch = store.getState().arrangementSlots.find((entry) => entry.id === "lane-5")?.state;
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-5", draftId: fork.draftId ?? undefined });
    expect(beforeLaunch).toBe("loaded");
    expect(store.getState().arrangementSlots.find((entry) => entry.id === "lane-5")?.state).toBe("queued");
  });

  it("enters performing mode and blocks launch until building resumes", () => {
    const store = new ShellStore({
      ...createLiveCollabInitialShellState(),
      arrangementSlots: createLiveCollabArrangementSlots().map((slot, index) =>
        index < 6 ? { ...slot, state: "playing" as const } : slot,
      ),
      sessionPhase: "performing",
    });
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-1" });
    expect(store.getState().arrangementSlots[0]?.state).not.toBe("queued");
    store.dispatch({ type: "SET_SESSION_PHASE", phase: "building" });
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-1" });
    expect(store.getState().arrangementSlots[0]?.state).toBe("queued");
  });

  it("persists recall role for caption and desk chip", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    store.dispatch({
      type: "SET_WORKSPACE_DRAFT",
      draftId: "kai-lh-sparse-4",
      recallRole: "closing pad",
    });
    const state = store.getState();
    expect(state.recallRole).toBe("closing pad");
    expect(state.activityFeed[0]).toBe("Recall · kai-lh-sparse-4 → closing pad");
  });

  it("covers compare perform recall promote beats in phase 5 arc", () => {
    expect(PHASE5_WALKTHROUGH).toHaveLength(34);
    expect(PHASE5_WALKTHROUGH.some((step) => step.label.includes("compare"))).toBe(true);
    expect(PHASE5_WALKTHROUGH.some((step) => step.label.startsWith("Perform ·"))).toBe(true);
    expect(PHASE5_WALKTHROUGH.some((step) => step.label.startsWith("Recall ·"))).toBe(true);
    expect(PHASE5_WALKTHROUGH.some((step) => step.commands.some((command) => command.type === "PROMOTE_CLIP"))).toBe(
      true,
    );
  });
});
