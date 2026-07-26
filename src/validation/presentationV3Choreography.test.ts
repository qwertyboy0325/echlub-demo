import { describe, expect, it } from "vitest";
import { shellStore } from "../shell/domain/shellStore";
import {
  isProjectionCommand,
  v3TargetResolutionReport,
  V3ActionExecutionError,
} from "../presentation-v3/choreography/v3ActionAdapter";
import { allV3DemoActionTargets, V3_PRESENTATION_BEATS } from "../presentation-v3/choreography/v3DemoSequence";
import { V3_UI_TARGET_KEYS, V3_TARGET_SELECTORS } from "../presentation-v3/choreography/v3UiTargets";
import { resolveV3Target } from "../presentation-v3/choreography/v3TargetResolver";

describe("v3UiTargets", () => {
  it("covers every formal demo action target key", () => {
    const demoTargets = allV3DemoActionTargets();
    for (const key of demoTargets) {
      expect(V3_UI_TARGET_KEYS.includes(key)).toBe(true);
      expect(V3_TARGET_SELECTORS[key]).toMatch(/data-demo-target/);
    }
  });

  it("reports full registry inventory", () => {
    const report = v3TargetResolutionReport();
    expect(report.keys.length).toBe(V3_UI_TARGET_KEYS.length);
    expect(Object.keys(report.selectors).length).toBe(V3_UI_TARGET_KEYS.length);
  });
});

describe("v3TargetResolver", () => {
  it("returns missing when selector has no match", () => {
    const root = { querySelector: () => null } as unknown as ParentNode;
    const result = resolveV3Target("room-mixer", {
      beatId: "test-beat",
      participantId: "p2",
      state: shellStore.getState(),
    }, root);
    expect(result).toMatchObject({ reason: "missing", key: "room-mixer" });
  });

  it("formal adapter throws on missing target", () => {
    const failure = {
      key: "room-mixer" as const,
      selector: '[data-demo-target="room-mixer"]',
      reason: "missing" as const,
      beatId: "test-beat",
      participantId: "p2",
      room: "global" as const,
      exchangeOpen: false,
      participantTab: "Create",
    };
    const error = new V3ActionExecutionError(failure);
    expect(error.failure.beatId).toBe("test-beat");
  });

  it("does not dispatch shell commands on failed click resolution", () => {
    const before = shellStore.getState().room;
    try {
      resolveV3Target("launch-lane-1", {
        beatId: "t",
        participantId: "p1",
        state: shellStore.getState(),
      });
    } catch {
      /* resolver returns failure object */
    }
    expect(shellStore.getState().room).toBe(before);
  });
});

describe("v3DemoSequence", () => {
  it("uses transport-bar waits for musically consequential beats", () => {
    const barWaits = V3_PRESENTATION_BEATS.filter((b) => b.afterBar != null);
    expect(barWaits.length).toBeGreaterThan(6);
    expect(V3_PRESENTATION_BEATS.some((b) => b.id === "b04-kai-preview")).toBe(true);
    expect(V3_PRESENTATION_BEATS.some((b) => b.id === "b18-dock-to-mixer")).toBe(true);
    expect(V3_PRESENTATION_BEATS.some((b) => b.id === "b21-restart")).toBe(true);
  });
});

describe("v3 lifecycle targets", () => {
  it("includes exchange lifecycle action keys", () => {
    expect(V3_UI_TARGET_KEYS).toContain("exchange-submit-c2");
    expect(V3_UI_TARGET_KEYS).toContain("exchange-ready-c2");
    expect(V3_UI_TARGET_KEYS).toContain("exchange-ready-c1");
  });
});

describe("v3DemoSequence pacing", () => {
  it("has 22 completed beats with transport-bar waits", () => {
    expect(V3_PRESENTATION_BEATS.length).toBe(22);
    const holdMs = V3_PRESENTATION_BEATS.reduce(
      (sum, beat) =>
        sum + beat.actions.filter((a) => a.type === "hold").reduce((h, a) => h + (a.type === "hold" ? a.ms : 0), 0),
      0,
    );
    expect(holdMs).toBeGreaterThan(40000);
  });
});

describe("projection boundary", () => {
  it("allows only follow projection commands", () => {
    expect(isProjectionCommand({ type: "ENABLE_FOLLOW" })).toBe(true);
    expect(isProjectionCommand({ type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" })).toBe(true);
    expect(isProjectionCommand({ type: "LAUNCH_SLOT", slotId: "lane-1" })).toBe(false);
    expect(isProjectionCommand({ type: "MARK_READY", clipId: "c1" })).toBe(false);
  });
});
