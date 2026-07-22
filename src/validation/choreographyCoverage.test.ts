import { describe, expect, it } from "vitest";
import { buildChoreographyCoverage, validateHumanAuthoredCoverage } from "../choreographyCoverage";

describe("choreography coverage", () => {
  it("covers 100% of human-authored events", () => {
    const result = validateHumanAuthoredCoverage();
    expect(result.missing).toEqual([]);
    expect(result.unresolvedTargets).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("reports coverage rows for every script event", () => {
    const rows = buildChoreographyCoverage();
    expect(rows.length).toBeGreaterThan(30);
    const human = rows.filter((r) => r.classification === "human_authored");
    expect(human.every((r) => r.coverageStatus === "covered")).toBe(true);
  });
});
