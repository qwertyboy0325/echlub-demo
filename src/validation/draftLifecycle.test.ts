import { describe, expect, it } from "vitest";
import { validateDraftLifecycle } from "../validation/validate";
import { canTransitionDraft } from "../runtimeState";

describe("draft lifecycle", () => {
  it("allows legal transitions", () => {
    expect(canTransitionDraft("editing", "preview")).toBe(true);
    expect(canTransitionDraft("preview", "ready")).toBe(true);
    expect(canTransitionDraft("ready", "offered")).toBe(true);
    expect(canTransitionDraft("offered", "queued")).toBe(true);
    expect(canTransitionDraft("queued", "playing")).toBe(true);
    expect(canTransitionDraft("playing", "archived")).toBe(true);
    expect(canTransitionDraft("archived", "queued")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransitionDraft("editing", "playing")).toBe(false);
    expect(canTransitionDraft("archived", "preview")).toBe(false);
  });

  it("performance script has no illegal draft transitions", () => {
    const errors = validateDraftLifecycle();
    expect(errors).toEqual([]);
  });
});
