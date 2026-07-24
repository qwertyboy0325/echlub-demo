import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("audio param scheduling hygiene", () => {
  const engineSource = readFileSync(join(process.cwd(), "src/audioEngine.ts"), "utf8");
  const schedulingSource = readFileSync(join(process.cwd(), "src/audio/audioParamScheduling.ts"), "utf8");
  const mixSource = readFileSync(join(process.cwd(), "src/audio/mixApplication.ts"), "utf8");

  it("does not schedule AudioParams with Transport.seconds", () => {
    expect(engineSource).not.toContain("Tone.getTransport().seconds");
    expect(engineSource).not.toContain("transport.seconds");
    expect(mixSource).not.toContain("Tone.getTransport().seconds");
  });

  it("anchors every mix ramp with setRampPoint", () => {
    expect(schedulingSource).toContain("param.setRampPoint(t)");
    expect(mixSource).toContain("audioNow()");
    expect(mixSource).toContain("rampLinear(");
  });
});
