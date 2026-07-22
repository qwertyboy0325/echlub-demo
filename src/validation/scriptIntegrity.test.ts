import { describe, expect, it } from "vitest";
import { validateAll, validateScriptIntegrity, parseTransportPosition } from "../validation/validate";
import { performanceScript } from "../performanceScript";

describe("script integrity", () => {
  it("events are deterministically ordered", () => {
    let last = -1;
    for (const e of performanceScript) {
      const pos = parseTransportPosition(e.at);
      expect(pos).toBeGreaterThanOrEqual(last);
      last = pos;
    }
  });

  it("all choreography targets resolve", () => {
    const errors = validateScriptIntegrity().filter((i) => i.code.startsWith("CHOREO"));
    expect(errors).toEqual([]);
  });

  it("no blocking validation errors", () => {
    const errors = validateAll().filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });
});
