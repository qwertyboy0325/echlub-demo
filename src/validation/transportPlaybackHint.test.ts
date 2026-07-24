import { describe, expect, it } from "vitest";
import { createInitialShellState } from "../shell/domain/shellFixtures";
import { displayTransportBar, transportPlaybackHint } from "../shell/transportPlaybackHint";

describe("transportPlaybackHint", () => {
  it("warns when transport runs without Shared Master", () => {
    const state = { ...createInitialShellState(), transportPlaying: true };
    const hint = transportPlaybackHint(state, true, true);
    expect(hint.attention).toBe(true);
    expect(hint.text).toContain("silent");
  });

  it("describes lifecycle before first Play", () => {
    const hint = transportPlaybackHint(createInitialShellState(), true, true);
    expect(hint.text).toContain("Exchange");
    expect(hint.text).toContain("Activate");
  });

  it("maps transport bar 0 to ruler bar 1", () => {
    expect(displayTransportBar(0)).toBe(1);
    expect(displayTransportBar(3)).toBe(3);
  });
});
