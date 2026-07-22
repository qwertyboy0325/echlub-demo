import { describe, expect, it } from "vitest";
import { registerTimeout, cancelTimeout, clearAllTimeouts, activeTimeoutCount } from "../timerRegistry";

describe("timer registry", () => {
  it("tracks and clears native timeouts", async () => {
    let fired = false;
    const id = registerTimeout(() => { fired = true; }, 20);
    expect(activeTimeoutCount()).toBe(1);
    cancelTimeout(id);
    expect(activeTimeoutCount()).toBe(0);
    await new Promise((r) => setTimeout(r, 30));
    expect(fired).toBe(false);
  });

  it("clears all registered timeouts", () => {
    registerTimeout(() => {}, 1000);
    registerTimeout(() => {}, 1000);
    expect(activeTimeoutCount()).toBe(2);
    clearAllTimeouts();
    expect(activeTimeoutCount()).toBe(0);
  });
});
