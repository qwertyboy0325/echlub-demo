import { describe, expect, it } from "vitest";
import { createCompletedProductionSession, createIncompleteSession } from "../demo/productionMutations";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import { loadReconstructionPack } from "../domain/packLoader";
import {
  authorDisplayName,
  formatDraftOwnerForStorage,
  isDraftPrivatelyPreviewed,
  resolveDraftAuthor,
} from "../domain/draftAuthorship";
import { renderHarmonyWorkspace, renderLowEndWorkspace } from "../ui/liveCapabilityWorkspaces";
import { renderClipDetailView } from "../ui/clipDetailView";
import { renderCollaborationInspector } from "../ui/collaborationInspector";
import { createInitialState } from "../runtimeState";

describe("draft authorship — owner is storage compat only", () => {
  const session = createIncompleteSession(placeholderReconstructionPack);
  const draft = session.drafts["memory-opening"]!;

  it("never uses BrainId owner string as author display name", () => {
    const name = authorDisplayName(session, draft);
    expect(name).not.toBe(draft.owner);
    expect(["memory", "pulse", "blend", "story"]).not.toContain(name);
  });

  it("formats owner as legacy capability storage label", () => {
    expect(formatDraftOwnerForStorage(draft)).toBe("legacy-capability:cap-material");
    expect(formatDraftOwnerForStorage(draft)).not.toContain("memory");
  });

  it("resolves author participant from workspace track mapping", () => {
    const author = resolveDraftAuthor(session, draft);
    expect(author?.roleId).toBe("melody");
  });

  it("maps private preview via choreography brain compat, not participant id", () => {
    expect(isDraftPrivatelyPreviewed(draft, "memory")).toBe(true);
    expect(isDraftPrivatelyPreviewed(draft, "pulse")).toBe(false);
  });

  it("never surfaces BrainId owner in collaboration inspector or clip detail", () => {
    const runtimeState = createInitialState();
    runtimeState.activeDraftId = draft.id;
    const inspector = renderCollaborationInspector({
      session,
      state: runtimeState,
      selectedDraftId: draft.id,
    });
    const detail = renderClipDetailView({ session, draftId: draft.id, previewBrain: null });
    for (const html of [inspector, detail]) {
      expect(html).not.toContain(`>${draft.owner}<`);
      expect(html).not.toMatch(/Author.*memory|memory.*Author/i);
      expect(html).toContain("Melody");
    }
  });
});

describe("extended live capability workspaces", () => {
  const pack = loadReconstructionPack();
  const session = createCompletedProductionSession(pack);
  const state = createInitialState();
  for (const [id, d] of Object.entries(session.drafts)) state.drafts[id] = d;

  it("renders operational low-end bass editor with note content", () => {
    const html = renderLowEndWorkspace({ session, state, previewBrain: null });
    expect(html).toContain("data-capability-workspace=\"cap-lowend\"");
    expect(html).toContain("Private cue bass");
    expect(html).toMatch(/piano-note|bass-main|Bass/);
  });

  it("renders operational harmony editor with chord blocks", () => {
    const html = renderHarmonyWorkspace({ session, state, previewBrain: null });
    expect(html).toContain("data-capability-workspace=\"cap-harmony\"");
    expect(html).toContain("Private cue harmony");
    expect(html).toMatch(/chord-block|harmony-chord/);
  });
});
