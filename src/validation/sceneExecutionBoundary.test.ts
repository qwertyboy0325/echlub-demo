import { describe, expect, it } from "vitest";
import {
  SceneExecutionAuthority,
  barPosition,
  buildLaunchBoundaryMap,
  buildQueuePlan,
  positionsEqual,
} from "../sceneExecution";
import { performanceScript } from "../performanceScript";
import { parsePosition } from "../musicalPosition";

describe("scene execution boundary", () => {
  it("executes each scene once at a musical position", () => {
    const authority = new SceneExecutionAuthority();
    const pos = barPosition(28);
    const record = authority.executeScene("release", pos, barPosition(27));
    expect(record.sceneId).toBe("release");
    expect(record.boundaryId).toBe("release@bar-29");
    expect(positionsEqual(record.audioActivatedAt!, record.runtimeActivatedAt!)).toBe(true);
    expect(() => authority.executeScene("release", pos)).toThrow(/Duplicate/);
  });

  it("aligns queue execute bars with launch events", () => {
    const plan = buildQueuePlan();
    const release = plan.get("release");
    expect(release?.executeAtBar).toBe(28);
    const launch = performanceScript.find((e) => e.id === "e28");
    expect(launch).toBeDefined();
    expect(parsePosition(launch!.at).bar).toBe(28);
  });

  it("passes launch alignment validation", () => {
    const errors = new SceneExecutionAuthority().validateLaunchAlignment();
    expect(errors).toEqual([]);
  });

  it("maps every launch event to a scheduleRepeat boundary bar", () => {
    const map = buildLaunchBoundaryMap();
    const launches = performanceScript.filter((e) => e.action === "launch" && e.target);
    expect(map.size).toBe(launches.length);
    for (const event of launches) {
      expect(map.get(parsePosition(event.at).bar)).toBe(event.target);
    }
  });
});
