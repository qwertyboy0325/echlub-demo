import { describe, expect, it } from "vitest";
import { choreographyForCommand } from "../shell/choreographyForCommand";
import { createLiveCollabInitialShellState } from "../shell/domain/liveCollabShellFixtures";
import { ShellStore } from "../shell/domain/shellStore";
import { PHASE5_WALKTHROUGH } from "../shell/presenterWalkthrough";
import { selectorForShellUiTarget } from "../shell/shellUiTargets";

const PARTICIPANTS = [
  { id: "p1", name: "Ryo", taskProfile: "Rhythm" },
  { id: "p2", name: "Kai", taskProfile: "Keys" },
  { id: "p3", name: "Mei", taskProfile: "Horns" },
  { id: "p4", name: "Ren", taskProfile: "Guitar" },
];

function applyBeatCommands(store: ShellStore, beat: number): void {
  const step = PHASE5_WALKTHROUGH.find((entry) => entry.beat === beat);
  if (!step) throw new Error(`missing beat ${beat}`);
  for (const command of step.commands) store.dispatch(command);
}

describe("WP6 creation depth", () => {
  it("shows Ren guitar creation on Create clip desk before share", () => {
    const renCreate = PHASE5_WALKTHROUGH.find((step) => step.beat === 23)!;
    expect(renCreate.label.toLowerCase()).toContain("creating guitar");
    const projection = renCreate.commands.find((command) => command.type === "SET_PARTICIPANT_PROJECTION");
    expect(projection).toMatchObject({ participantId: "p4", room: "participant", tab: "Create" });
    expect(renCreate.commands.some((command) => command.type === "SET_CREATE_SUBMODE")).toBe(true);
    expect(renCreate.commands.some((command) => command.type === "PREVIEW_WORKSPACE")).toBe(true);
    const previewIdx = renCreate.commands.findIndex((command) => command.type === "PREVIEW_WORKSPACE");
    const shareIdx = renCreate.commands.findIndex((command) => command.type === "SHARE_CLIP");
    expect(previewIdx).toBeGreaterThanOrEqual(0);
    expect(shareIdx).toBeGreaterThan(previewIdx);
  });

  it("shows Mei alto creation with piano note select before share", () => {
    const meiCreate = PHASE5_WALKTHROUGH.find((step) => step.beat === 28)!;
    expect(meiCreate.commands.some((command) => command.type === "SELECT_PIANO_NOTE")).toBe(true);
    expect(meiCreate.commands.some((command) => command.type === "SET_NOTE_VELOCITY")).toBe(true);
    const select = meiCreate.commands.find((command) => command.type === "SELECT_PIANO_NOTE")!;
    expect(select).toMatchObject({ draftId: "mei-alto-themeA-8", noteId: "mei-alto-themeA-8-n0" });
    const action = choreographyForCommand(select, meiCreate, meiCreate.commands.indexOf(select), PARTICIPANTS);
    expect(action?.target).toEqual({ kind: "piano-note", noteId: "mei-alto-themeA-8-n0" });
    expect(selectorForShellUiTarget(action!.target)).toBe('[data-demo-target="piano-note-mei-alto-themeA-8-n0"]');
  });

  it("records desk create captions through Ren and Mei creation beats", () => {
    const store = new ShellStore(createLiveCollabInitialShellState());
    for (let beat = 1; beat <= 23; beat += 1) applyBeatCommands(store, beat);
    expect(store.getState().activityFeed.some((entry) => entry.includes("Private desk · shaping ren-comp-2"))).toBe(true);
    expect(store.getState().activityFeed.some((entry) => entry.includes("Desk audition · ren-comp-2"))).toBe(true);
    expect(store.getState().activityFeed.some((entry) => entry.includes("Saved to library · ren-comp-2"))).toBe(true);
    for (let beat = 24; beat <= 28; beat += 1) applyBeatCommands(store, beat);
    expect(store.getState().activityFeed.some((entry) => entry.includes("Private desk · shaping mei-alto-themeA-8"))).toBe(true);
    expect(store.getState().activityFeed.some((entry) => entry.includes("Desk audition · mei-alto-themeA-8"))).toBe(true);
  });
});
