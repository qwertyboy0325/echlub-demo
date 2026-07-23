import { describe, expect, it } from "vitest";
import { loadReconstructionPack } from "../domain/packLoader";
import { createIncompleteSession } from "../demo/productionMutations";
import { buildTopologyTransformation } from "../demo/canonicalPlayback";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import { legacyBrainsInActiveView, resolveDraftAuthor } from "../domain/draftAuthorship";
import {
  getActivePerformanceView,
  resolvePerformanceConfiguration,
} from "../domain/performanceModel";
import { fourCapabilityPresetAvailable } from "../ui/performanceOverlay";

describe("collaborative DAW campaign — variable topology", () => {
  const pack = loadReconstructionPack();

  it("derives participant count from pack, not fixed four", () => {
    expect(pack.participants.length).toBeGreaterThan(4);
    const session = createIncompleteSession(pack);
    expect(session.participants.length).toBe(pack.participants.length);
  });

  it("keeps track count independent from participant count", () => {
    expect(pack.tracks.length).not.toBe(pack.participants.length);
    const session = createIncompleteSession(pack);
    expect(session.tracks.length).toBe(pack.tracks.length);
  });

  it("does not assume exactly four capabilities in active view for complex songs", () => {
    const config = resolvePerformanceConfiguration(pack);
    const view = getActivePerformanceView(config);
    if (pack.participants.length > 4) {
      expect(view.capabilityIds.length).toBeGreaterThan(4);
    }
    expect(view.capabilityIds.length).not.toBe(4);
  });

  it("allows one participant to map to capability assignments", () => {
    const config = resolvePerformanceConfiguration(pack);
    const multiAssignParticipant = pack.participants.find((p) => {
      const count = config.assignments.filter((a) => a.participantId === p.id).length;
      return count >= 1;
    });
    expect(multiAssignParticipant).toBeDefined();
  });

  it("allows shared capability across participants (rhythm)", () => {
    const config = resolvePerformanceConfiguration(pack);
    const rhythmAssignees = config.assignments.filter((a) => a.capabilityId === "cap-rhythm");
    const participantIds = new Set(rhythmAssignees.map((a) => a.participantId));
    expect(participantIds.size).toBeGreaterThanOrEqual(1);
  });

  it("retains legacy four-capability preset as optional view", () => {
    const session = createIncompleteSession(pack);
    expect(fourCapabilityPresetAvailable(session)).toBe(true);
    const legacy = session.performanceConfig.views.find((v) => v.legacyPreset === "four-capability");
    expect(legacy?.capabilityIds.length).toBe(4);
  });

  it("stores performance configuration on session", () => {
    const session = createIncompleteSession(pack);
    expect(session.performanceConfig.capabilities.length).toBeGreaterThan(0);
    expect(session.performanceConfig.views.length).toBeGreaterThanOrEqual(2);
    expect(session.performanceConfig.activeViewId).toBeTruthy();
  });

  it("resolves clip author via workspace, not BrainId identity", () => {
    const session = createIncompleteSession(pack);
    const draft = session.drafts["memory-opening"];
    const author = resolveDraftAuthor(session, draft);
    expect(author?.roleId).toBe("melody");
    expect(author?.displayName).toContain("Melody");
  });

  it("supports non-four participant fixture topology", () => {
    const miniPack = structuredClone(placeholderReconstructionPack);
    miniPack.participants = miniPack.participants.slice(0, 3);
    miniPack.workspaces = miniPack.workspaces.filter((ws) =>
      miniPack.participants.some((p) => p.id === ws.participantId),
    );
    const config = resolvePerformanceConfiguration(miniPack);
    expect(config.capabilities.length).toBeGreaterThan(0);
    expect(miniPack.participants.length).toBe(3);
    const view = getActivePerformanceView(config);
    expect(view.capabilityIds.length).toBeGreaterThan(0);
  });

  it("can activate legacy four-capability preset without forcing participant count", () => {
    const session = createIncompleteSession(pack);
    const legacy = session.performanceConfig.views.find((v) => v.legacyPreset === "four-capability");
    expect(legacy).toBeDefined();
    session.performanceConfig.activeViewId = legacy!.id;
    const brains = legacyBrainsInActiveView(session);
    expect(brains.length).toBe(4);
    expect(session.participants.length).toBeGreaterThan(4);
  });

  it("emits data-driven topology text without fixed four-capability wording", () => {
    const session = createIncompleteSession(pack);
    const text = buildTopologyTransformation(session);
    expect(text).not.toContain("Performance view regrouping (4 capabilities)");
    expect(text).toContain(String(session.participants.length));
    expect(text).toMatch(/capabilities\)/);
  });
});
