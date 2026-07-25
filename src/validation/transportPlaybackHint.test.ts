import { describe, expect, it } from "vitest";
import { createInitialShellState } from "../shell/domain/shellFixtures";
import { transportPlaybackHint } from "../shell/transportPlaybackHint";

describe("transportPlaybackHint live-collab", () => {
  it("reports lane count when lanes are active", () => {
    const hint = transportPlaybackHint(createInitialShellState(), true, true, 3, "live-collab");
    expect(hint.text).toContain("3/7 lanes active");
    expect(hint.attention).toBe(false);
  });

  it("warns when transport runs with zero lanes", () => {
    const playing = { ...createInitialShellState(), transportPlaying: true };
    const hint = transportPlaybackHint(playing, true, true, 0, "live-collab");
    expect(hint.attention).toBe(true);
    expect(hint.text).toContain("Launch a lane");
  });
});
