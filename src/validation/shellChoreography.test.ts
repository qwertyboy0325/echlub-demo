import { describe, expect, it } from "vitest";
import {
  choreographyForCommand,
  choreographyStepOrder,
  deskContextForParticipant,
  isNavigationCommand,
  parkedCursorLabel,
  resolveStepOperator,
} from "../shell/choreographyForCommand";
import { PHASE5_WALKTHROUGH } from "../shell/presenterWalkthrough";
import {
  LIVE_COLLAB_LAUNCH_OPERATORS,
  selectorForShellUiTarget,
  shellUiTargetId,
} from "../shell/shellUiTargets";

describe("shellUiTargets", () => {
  it("builds stable selectors for demo hooks", () => {
    expect(shellUiTargetId({ kind: "launch-slot", slotId: "lane-1" })).toBe("launch-slot-lane-1");
    expect(selectorForShellUiTarget({ kind: "step-cell", step: 2 })).toBe('[data-demo-target="step-cell-2"]');
  });

  it("builds selector strings for launch slots", () => {
    expect(selectorForShellUiTarget({ kind: "launch-slot", slotId: "lane-3" })).toBe(
      '[data-demo-target="launch-slot-lane-3"]',
    );
  });

  it("maps lane owners for beats without projection", () => {
    expect(LIVE_COLLAB_LAUNCH_OPERATORS["lane-6"]).toBe("p3");
    expect(LIVE_COLLAB_LAUNCH_OPERATORS["lane-3"]).toBe("p1");
  });
});

describe("choreographyForCommand", () => {
  it("treats projection commands as navigation-only", () => {
    expect(
      isNavigationCommand({
        type: "SET_PARTICIPANT_PROJECTION",
        participantId: "p2",
        room: "global",
        tab: "Create",
      }),
    ).toBe(true);
    expect(isNavigationCommand({ type: "LAUNCH_SLOT", slotId: "lane-1" })).toBe(false);
  });

  it("resolves operator from preceding projection in the same beat", () => {
    const step = PHASE5_WALKTHROUGH.find((entry) => entry.beat === 17)!;
    const participants = [
      { id: "p1", name: "Ryo", taskProfile: "Rhythm" },
      { id: "p2", name: "Kai", taskProfile: "Keys" },
    ];
    expect(resolveStepOperator(step.commands, 2)).toBe("p2");
    const action = choreographyForCommand(step.commands[2]!, step, 2, participants);
    expect(action).toEqual({
      participantId: "p2",
      target: { kind: "launch-slot", slotId: "lane-4" },
      gesture: "click",
      deskLabel: "Keys Desk",
    });
  });

  it("orders projection before actionable commands in multi-command beats", () => {
    const participants = [
      { id: "p1", name: "Ryo", taskProfile: "Rhythm" },
      { id: "p2", name: "Kai", taskProfile: "Keys" },
      { id: "p3", name: "Mei", taskProfile: "Horns" },
      { id: "p4", name: "Ren", taskProfile: "Guitar" },
    ];
    for (const step of PHASE5_WALKTHROUGH) {
      const rows = choreographyStepOrder(step, participants);
      const firstActionIndex = rows.findIndex((row) => row.choreography);
      if (firstActionIndex <= 0) continue;
      const prior = rows.slice(0, firstActionIndex);
      expect(prior.some((row) => row.navigation)).toBe(true);
    }
  });

  it("covers launch beats without explicit projection", () => {
    const drums = PHASE5_WALKTHROUGH.find((entry) => entry.beat === 15)!;
    const action = choreographyForCommand(drums.commands[3]!, drums, 3);
    expect(action?.participantId).toBe("p1");
    expect(action?.target).toEqual({ kind: "launch-slot", slotId: "lane-3" });
  });

  it("starts transport before the first lane launch", () => {
    const transportBeat = PHASE5_WALKTHROUGH.find((entry) =>
      entry.commands.some((command) => command.type === "TOGGLE_TRANSPORT"),
    )!.beat;
    const firstLaunchBeat = PHASE5_WALKTHROUGH.find((entry) =>
      entry.commands.some((command) => command.type === "LAUNCH_SLOT"),
    )!.beat;
    expect(transportBeat).toBeLessThan(firstLaunchBeat);
  });

  it("paces progressive lane launches with afterBar gaps", () => {
    const progressiveLaunches = PHASE5_WALKTHROUGH.filter((entry) =>
      entry.commands.some((command) => command.type === "LAUNCH_SLOT"),
    );
    expect(progressiveLaunches.length).toBeGreaterThanOrEqual(7);
    for (const beat of progressiveLaunches) {
      expect(beat.afterBar ?? beat.waitUntilBar, beat.label).toBeTruthy();
    }
  });

  it("includes fork cycle before the second lane launch", () => {
    const firstLaunch = PHASE5_WALKTHROUGH.find((entry) =>
      entry.commands.some((command) => command.type === "LAUNCH_SLOT"),
    )!.beat;
    const secondLaunch = PHASE5_WALKTHROUGH.filter((entry) =>
      entry.commands.some((command) => command.type === "LAUNCH_SLOT"),
    )[1]!.beat;
    const forkBeforeSecond = PHASE5_WALKTHROUGH.some(
      (entry) => entry.beat > firstLaunch && entry.beat < secondLaunch && entry.commands.some((c) => c.type === "FORK_CLIP"),
    );
    expect(forkBeforeSecond).toBe(true);
  });

  it("places Ren fork before payoff hold", () => {
    const payoffHold = PHASE5_WALKTHROUGH.find((entry) => entry.waitUntilBar === 12)!.beat;
    const renFork = PHASE5_WALKTHROUGH.find((entry) =>
      entry.commands.some((command) => command.type === "FORK_CLIP" && entry.label.includes("guitar")),
    )!.beat;
    expect(renFork).toBeLessThan(payoffHold);
  });

  it("builds parked cursor labels from desk profiles", () => {
    expect(parkedCursorLabel("Ryo", "Rhythm")).toBe("Ryo at Rhythm Desk");
    expect(deskContextForParticipant([{ id: "p1", name: "Ryo", taskProfile: "Rhythm" }], "p1")).toEqual({
      deskLabel: "Rhythm Desk",
      parkedLabel: "Ryo at Rhythm Desk",
    });
  });

  it("targets 34 narrative beats with lead-a, trade, and closing triad", () => {
    expect(PHASE5_WALKTHROUGH).toHaveLength(34);
    expect(PHASE5_WALKTHROUGH.some((step) => step.waitUntilBar === 12)).toBe(true);
    expect(PHASE5_WALKTHROUGH.some((step) => step.waitUntilBar === 20)).toBe(true);
    expect(PHASE5_WALKTHROUGH.some((step) => step.label.startsWith("Perform ·"))).toBe(true);
    expect(PHASE5_WALKTHROUGH.some((step) => step.label.startsWith("Recall ·"))).toBe(true);
    expect(PHASE5_WALKTHROUGH.some((step) => step.label.startsWith("Promote ·"))).toBe(true);
  });

  it("includes collaboration and live-fx narrative beats", () => {
    const commandTypes = new Set(
      PHASE5_WALKTHROUGH.flatMap((step) => step.commands.map((command) => command.type)),
    );
    expect(commandTypes.has("SHARE_CLIP")).toBe(true);
    expect(commandTypes.has("FORK_CLIP")).toBe(true);
    expect(commandTypes.has("PIN_DOCK")).toBe(true);
    expect(commandTypes.has("MARK_READY")).toBe(true);
    expect(commandTypes.has("STAGE_CLIP")).toBe(true);
    expect(commandTypes.has("SET_DESK_BUS")).toBe(true);
  });
});
