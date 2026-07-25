import { describe, expect, it } from "vitest";
import { resolveExchangeComparePair } from "../features/exchange/exchangeCompare";
import { choreographyForCommand } from "../shell/choreographyForCommand";
import {
  editingTaskForDraft,
  presenceActivityLabel,
} from "../shell/domain/participantWorkspace";
import { createLiveCollabInitialShellState } from "../shell/domain/liveCollabShellFixtures";
import { ShellStore } from "../shell/domain/shellStore";
import type { ShellCommand } from "../shell/domain/shellTypes";
import { PHASE5_WALKTHROUGH } from "../shell/presenterWalkthrough";
import { selectorForShellUiTarget } from "../shell/shellUiTargets";

const PARTICIPANTS = [
  { id: "p1", name: "Ryo", taskProfile: "Rhythm" },
  { id: "p2", name: "Kai", taskProfile: "Keys" },
  { id: "p3", name: "Mei", taskProfile: "Horns" },
  { id: "p4", name: "Ren", taskProfile: "Guitar" },
];

describe("WP6 private boundary", () => {
  it("labels desk audition separately from Shared Master in state", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    expect(store.getState().deskAuditionDraftId).toBeNull();
    store.dispatch({ type: "SET_ROOM", room: "participant" });
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p2" });
    store.dispatch({ type: "PREVIEW_WORKSPACE", draftId: "kai-lh-sparse-4" });
    const after = store.getState();
    expect(after.deskAuditionDraftId).toBe("kai-lh-sparse-4");
    expect(after.activityFeed[0]).toContain("Desk audition");
    expect(after.activityFeed[0]).toContain("not Shared Master");
    expect(after.activeMasterDraftId).toBeNull();
  });

  it("clears desk audition when launching onto Shared Master", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    store.dispatch({ type: "PREVIEW_WORKSPACE", draftId: "kai-lh-sparse-4" });
    expect(store.getState().deskAuditionDraftId).toBe("kai-lh-sparse-4");
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-3" });
    expect(store.getState().deskAuditionDraftId).toBeNull();
  });

  it("Presence activity reads editing task not only desk name", () => {
    expect(presenceActivityLabel("Kai", "Keys", "kai-lh-sparse-4")).toBe("Kai · editing LH");
    expect(editingTaskForDraft("ren-fork-alt-2", { forking: true })).toBe("forking guitar");
    expect(editingTaskForDraft("mei-alto-themeA-8")).toBe("editing alto");
  });
});

describe("WP6 fork audition", () => {
  it("does not demote Shared Master authority on workspace assign during audition", async () => {
    const { MusicalDomainStore } = await import("../shell/domain/musicalDomain");
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const domain = new MusicalDomainStore();
    domain.loadLiveCollabPackJson(readFileSync(join(process.cwd(), "public/shiki-no-uta.live-collab.pack.json"), "utf8"));
    domain.activateAllLanes();
    expect(domain.getAuthority()).toBe("shared-master");
    expect(domain.assignDraftToWorkspace("ren-comp-2")).toBe(true);
    expect(domain.getAuthority()).toBe("shared-master");
  });

  it("promote beat auditions parent then fork before Promote", () => {
    const promoteBeat = PHASE5_WALKTHROUGH.find((step) => step.commands.some((c) => c.type === "PROMOTE_CLIP"))!;
    expect(promoteBeat.label.toLowerCase()).toContain("audition");
    const types = promoteBeat.commands.map((c) => c.type);
    const firstPreview = types.indexOf("PREVIEW_WORKSPACE");
    const secondPreview = types.indexOf("PREVIEW_WORKSPACE", firstPreview + 1);
    const promoteIdx = types.indexOf("PROMOTE_CLIP");
    expect(firstPreview).toBeGreaterThanOrEqual(0);
    expect(secondPreview).toBeGreaterThan(firstPreview);
    expect(promoteIdx).toBeGreaterThan(secondPreview);
    expect(types.includes("LAUNCH_SLOT")).toBe(false);
    expect(promoteBeat.afterBar).toBeGreaterThanOrEqual(1);
    const previews = promoteBeat.commands.filter((c) => c.type === "PREVIEW_WORKSPACE") as Extract<
      ShellCommand,
      { type: "PREVIEW_WORKSPACE" }
    >[];
    expect(previews[0]?.draftId).toBe("ren-comp-2");
    expect(previews[1]?.draftId).toBe("ren-fork-alt-2");
  });

  it("launches promoted fork on the beat after Promote", () => {
    const promoteBeat = PHASE5_WALKTHROUGH.find((step) => step.commands.some((c) => c.type === "PROMOTE_CLIP"))!;
    const launchBeat = PHASE5_WALKTHROUGH.find((step) => step.beat === promoteBeat.beat + 1)!;
    expect(launchBeat.commands.some((c) => c.type === "LAUNCH_SLOT" && c.slotId === "lane-5")).toBe(true);
    expect(launchBeat.commands.some((c) => c.type === "PROMOTE_CLIP")).toBe(false);
    expect(launchBeat.afterBar).toBeGreaterThanOrEqual(1);
  });

  it("maps promote audition previews to Listen Parent / Fork targets", () => {
    const promoteBeat = PHASE5_WALKTHROUGH.find((step) => step.commands.some((c) => c.type === "PROMOTE_CLIP"))!;
    const previews = promoteBeat.commands.filter((c) => c.type === "PREVIEW_WORKSPACE");
    const parentIdx = promoteBeat.commands.indexOf(previews[0]!);
    const forkIdx = promoteBeat.commands.indexOf(previews[1]!);
    const parentAction = choreographyForCommand(previews[0]!, promoteBeat, parentIdx, PARTICIPANTS);
    const forkAction = choreographyForCommand(previews[1]!, promoteBeat, forkIdx, PARTICIPANTS);
    expect(parentAction?.target).toEqual({ kind: "compare-listen-parent" });
    expect(forkAction?.target).toEqual({ kind: "compare-listen-fork" });
    expect(selectorForShellUiTarget({ kind: "compare-listen-parent" })).toBe(
      '[data-demo-target="compare-listen-parent"]',
    );
  });

  it("Ready fork compare pair stays available for Listen before Promote", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p4" });
    store.dispatch({ type: "SHARE_CLIP" });
    store.dispatch({ type: "FORK_CLIP", clipId: "c1" });
    const fork = store.getState().exchangeClips.find((clip) => clip.forkOf === "c1")!;
    store.dispatch({ type: "MARK_READY", clipId: fork.id });
    store.dispatch({ type: "SELECT_EXCHANGE_CLIP", clipId: fork.id });
    const pair = resolveExchangeComparePair(store.getState());
    expect(pair?.fork.id).toBe(fork.id);
    expect(pair?.fork.lifecycle).toBe("Ready");
    expect(pair?.parent.draftId).toBeTruthy();
    expect(pair?.fork.draftId).toBeTruthy();
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-3" });
    const playingBefore = store.getState().arrangementSlots.filter((s) => s.state === "queued" || s.state === "playing").length;
    store.dispatch({ type: "PREVIEW_WORKSPACE", draftId: pair!.parent.draftId! });
    store.dispatch({ type: "PREVIEW_WORKSPACE", draftId: "ren-fork-alt-2" });
    expect(store.getState().deskAuditionDraftId).toBe("ren-fork-alt-2");
    expect(store.getState().arrangementSlots.filter((s) => s.state === "queued" || s.state === "playing").length).toBe(
      playingBefore,
    );
  });
});
