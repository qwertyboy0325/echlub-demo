import { describe, expect, it } from "vitest";
import {
  choreographyForCommand,
  choreographyStepOrder,
  isNavigationCommand,
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
    const step = PHASE5_WALKTHROUGH.find((entry) => entry.beat === 3)!;
    expect(resolveStepOperator(step.commands, 1)).toBe("p2");
    const action = choreographyForCommand(step.commands[1]!, step, 1);
    expect(action).toEqual({
      participantId: "p2",
      target: { kind: "launch-slot", slotId: "lane-1" },
      gesture: "click",
    });
  });

  it("orders projection before actionable commands in multi-command beats", () => {
    for (const step of PHASE5_WALKTHROUGH) {
      const rows = choreographyStepOrder(step);
      const firstActionIndex = rows.findIndex((row) => row.choreography);
      if (firstActionIndex <= 0) continue;
      const prior = rows.slice(0, firstActionIndex);
      expect(prior.some((row) => row.navigation)).toBe(true);
    }
  });

  it("covers launch beats without explicit projection", () => {
    const drums = PHASE5_WALKTHROUGH.find((entry) => entry.beat === 6)!;
    const action = choreographyForCommand(drums.commands[0]!, drums, 0);
    expect(action?.participantId).toBe("p1");
    expect(action?.target).toEqual({ kind: "launch-slot", slotId: "lane-3" });
  });
});
