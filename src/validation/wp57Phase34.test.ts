// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { deviceCountForParticipant } from "../features/devices/DevicesPanel";
import { choreographyForCommand, parkedCursorLabel } from "../shell/choreographyForCommand";
import { createLiveCollabInitialShellState } from "../shell/domain/liveCollabShellFixtures";
import { PHASE5_WALKTHROUGH } from "../shell/presenterWalkthrough";
import { resolveShellUiTarget, selectorForShellUiTarget } from "../shell/shellUiTargets";

const PARTICIPANTS = [
  { id: "p1", name: "Ryo", taskProfile: "Rhythm" },
  { id: "p2", name: "Kai", taskProfile: "Keys" },
  { id: "p3", name: "Mei", taskProfile: "Horns" },
  { id: "p4", name: "Ren", taskProfile: "Guitar" },
];

describe("WP5.7 Phase 3-4", () => {
  it("keeps 34 walkthrough beats unchanged", () => {
    expect(PHASE5_WALKTHROUGH).toHaveLength(34);
  });

  it("maps four desk device counts to two-rack panels", () => {
    expect(deviceCountForParticipant("p1")).toBe(2);
    expect(deviceCountForParticipant("p2")).toBe(2);
    expect(deviceCountForParticipant("p3")).toBe(2);
    expect(deviceCountForParticipant("p4")).toBe(2);
  });

  it("builds parked cursor desk labels per profile", () => {
    expect(parkedCursorLabel("Ryo", "Rhythm")).toBe("Ryo at Rhythm Desk");
    expect(parkedCursorLabel("Ren", "Guitar")).toBe("Ren at Guitar + Color Desk");
  });

  it("targets visible handoff controls for share fork accept stage promote", () => {
    const shareBeat = PHASE5_WALKTHROUGH.find((step) => step.beat === 18)!;
    const shareCommand = shareBeat.commands.find((command) => command.type === "SHARE_CLIP")!;
    const shareAction = choreographyForCommand(
      shareCommand,
      shareBeat,
      shareBeat.commands.indexOf(shareCommand),
      PARTICIPANTS,
    );
    expect(shareAction?.target).toEqual({ kind: "share-clip" });
    expect(selectorForShellUiTarget(shareAction!.target)).toBe('[data-demo-target="share-clip"]');

    const forkBeat = PHASE5_WALKTHROUGH.find((step) => step.commands.some((command) => command.type === "FORK_CLIP"))!;
    const forkCommand = forkBeat.commands.find((command) => command.type === "FORK_CLIP")!;
    const forkAction = choreographyForCommand(forkCommand, forkBeat, forkBeat.commands.indexOf(forkCommand), PARTICIPANTS);
    expect(forkAction?.target.kind).toBe("fork-clip");

    const acceptBeat = PHASE5_WALKTHROUGH.find((step) => step.commands.some((command) => command.type === "MARK_READY"))!;
    const acceptCommand = acceptBeat.commands.find((command) => command.type === "MARK_READY")!;
    const acceptAction = choreographyForCommand(acceptCommand!, acceptBeat, acceptBeat.commands.indexOf(acceptCommand!), PARTICIPANTS);
    expect(acceptAction?.target.kind).toBe("accept-clip");

    const stageBeat = PHASE5_WALKTHROUGH.find((step) => step.commands.some((command) => command.type === "STAGE_CLIP"))!;
    const stageCommand = stageBeat.commands.find((command) => command.type === "STAGE_CLIP")!;
    const stageAction = choreographyForCommand(stageCommand!, stageBeat, stageBeat.commands.indexOf(stageCommand!), PARTICIPANTS);
    expect(stageAction?.target.kind).toBe("stage-clip");

    const promoteBeat = PHASE5_WALKTHROUGH.find((step) => step.commands.some((command) => command.type === "PROMOTE_CLIP"))!;
    const promoteCommand = promoteBeat.commands.find((command) => command.type === "PROMOTE_CLIP")!;
    const promoteAction = choreographyForCommand(
      promoteCommand!,
      promoteBeat,
      promoteBeat.commands.indexOf(promoteCommand!),
      PARTICIPANTS,
    );
    expect(promoteAction?.target.kind).toBe("promote-clip");
  });

  it("prefers visible demo targets over sr-only decoys", () => {
    document.body.innerHTML = `
      <span class="sr-only" data-demo-target="share-clip"></span>
      <button data-demo-target="share-clip">Share revision</button>
    `;
    const target = resolveShellUiTarget({ kind: "share-clip" });
    expect(target?.tagName).toBe("BUTTON");
    expect(target?.classList.contains("sr-only")).toBe(false);
  });

  it("initializes live-collab shell with building session phase", () => {
    const state = createLiveCollabInitialShellState();
    expect(state.sessionPhase).toBe("building");
    expect(state.recallRole).toBeNull();
  });
});
