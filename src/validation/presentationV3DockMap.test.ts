import { describe, expect, it } from "vitest";
import { createInitialShellState } from "../shell/domain/shellFixtures";
import { shellReducer } from "../shell/domain/shellStore";

describe("presentation V3 MAP_MIXER_CONTROL_TO_DOCK", () => {
  it("maps Horns Delay to first empty dock slot with canonical source label", () => {
    const state = createInitialShellState();
    const after = shellReducer(state, {
      type: "MAP_MIXER_CONTROL_TO_DOCK",
      desk: "horns",
      param: "delay",
    });
    const slot = after.dockSlots[0];
    expect(slot?.mapped).toBe(true);
    expect(slot?.sourceParam).toBe("Horns · Delay");
    expect(slot?.sourceClip).toBe("horns");
  });
});
