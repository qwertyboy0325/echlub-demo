import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveExchangeComparePair } from "../features/exchange/exchangeCompare";
import { selectorForShellUiTarget } from "../shell/shellUiTargets";
import { choreographyForCommand } from "../shell/choreographyForCommand";
import { MusicalDomainStore } from "../shell/domain/musicalDomain";
import { createLiveCollabInitialShellState } from "../shell/domain/liveCollabShellFixtures";
import { ShellStore } from "../shell/domain/shellStore";
import type { ShellCommand } from "../shell/domain/shellTypes";
import { PHASE5_WALKTHROUGH } from "../shell/presenterWalkthrough";

const PARTICIPANTS = [
  { id: "p1", name: "Ryo", taskProfile: "Rhythm" },
  { id: "p2", name: "Kai", taskProfile: "Keys" },
  { id: "p3", name: "Mei", taskProfile: "Horns" },
  { id: "p4", name: "Ren", taskProfile: "Guitar" },
];

const RYO_BASS_FORK_DRAFT = "ryo-bass-sparse-4-fork-3";

function applyBeatCommands(store: ShellStore, beat: number): void {
  const step = PHASE5_WALKTHROUGH.find((entry) => entry.beat === beat);
  if (!step) throw new Error(`missing beat ${beat}`);
  for (const command of step.commands) store.dispatch(command);
}

describe("WP6 review depth", () => {
  it("walkthrough covers review revise compare accept stage on bass fork", () => {
    expect(PHASE5_WALKTHROUGH).toHaveLength(40);
    const reviseBeat = PHASE5_WALKTHROUGH.find((step) => step.commands.some((c) => c.type === "REVISE_CLIP"));
    expect(reviseBeat?.label).toContain("revise");
    expect(reviseBeat?.commands.some((c) => c.type === "TOGGLE_STEP")).toBe(true);
    const compareBeat = PHASE5_WALKTHROUGH.find((step) => step.label.includes("compare"));
    expect(compareBeat?.commands.filter((c) => c.type === "PREVIEW_WORKSPACE")).toHaveLength(2);
  });

  it("revise reopens fork workspace and bumps revision", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    for (let beat = 1; beat <= 15; beat += 1) applyBeatCommands(store, beat);
    const fork = store.getState().exchangeClips.find((clip) => clip.forkOf === "c2")!;
    expect(fork.lifecycle).toBe("Review");
    store.dispatch({ type: "SELECT_PARTICIPANT", participantId: "p2" });
    store.dispatch({ type: "REVISE_CLIP", clipId: fork.id });
    const revised = store.getState().exchangeClips.find((clip) => clip.id === fork.id)!;
    expect(revised.lifecycle).toBe("In Progress");
    expect(revised.revision).toBe(fork.revision + 1);
    expect(store.getState().participantWorkspaces.p2?.draftId).toBe(RYO_BASS_FORK_DRAFT);
  });

  it("revise edit changes fork musical material without touching parent", () => {
    const packJson = readFileSync(join(process.cwd(), "public/shiki-no-uta.live-collab.pack.json"), "utf8");
    const domain = new MusicalDomainStore();
    domain.loadLiveCollabPackJson(packJson);
    domain.activateLane("track-bass", "ryo-bass-sparse-4");
    domain.forkDraft("ryo-bass-sparse-4", RYO_BASS_FORK_DRAFT, "bass-fork");
    const parentSteps = [...(domain.draftForId("ryo-bass-sparse-4")?.steps ?? [])];
    const beforeFork = domain.draftForId(RYO_BASS_FORK_DRAFT)!.revision ?? 0;
    const toggled = domain.toggleStep(RYO_BASS_FORK_DRAFT, 4);
    expect(toggled?.changed).toBe(true);
    const forkSteps = domain.draftForId(RYO_BASS_FORK_DRAFT)!.steps ?? [];
    expect(forkSteps).not.toEqual(parentSteps);
    expect(domain.draftForId(RYO_BASS_FORK_DRAFT)!.revision).toBeGreaterThan(beforeFork);
    expect([...(domain.draftForId("ryo-bass-sparse-4")?.steps ?? [])]).toEqual(parentSteps);
  });

  it("runs fork review revise compare accept stage launch on beats 14-19", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    for (let beat = 1; beat <= 19; beat += 1) applyBeatCommands(store, beat);
    const fork = store.getState().exchangeClips.find((clip) => clip.forkOf === "c2");
    expect(fork?.lifecycle).toBe("Ready");
    expect(fork?.revision).toBeGreaterThan(2);
    expect(store.getState().arrangementSlots.find((slot) => slot.id === "lane-2")?.state).toBe("queued");
    const pair = resolveExchangeComparePair(store.getState());
    expect(pair?.fork.id).toBe(fork?.id);
  });

  it("maps revise and compare listen controls for choreography", () => {
    const reviseBeat = PHASE5_WALKTHROUGH.find((step) => step.commands.some((c) => c.type === "REVISE_CLIP"))!;
    const reviseCommand = reviseBeat.commands.find((c) => c.type === "REVISE_CLIP") as Extract<
      ShellCommand,
      { type: "REVISE_CLIP" }
    >;
    const reviseAction = choreographyForCommand(
      reviseCommand,
      reviseBeat,
      reviseBeat.commands.indexOf(reviseCommand),
      PARTICIPANTS,
    );
    expect(reviseAction?.target).toEqual({ kind: "revise-clip", clipId: "c3" });
    expect(selectorForShellUiTarget({ kind: "compare-listen-parent" })).toBe(
      '[data-demo-target="compare-listen-parent"]',
    );
    expect(selectorForShellUiTarget({ kind: "compare-listen-fork" })).toBe(
      '[data-demo-target="compare-listen-fork"]',
    );
  });
});
