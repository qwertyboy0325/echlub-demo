import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createIncompleteSession } from "../demo/productionMutations";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import { loadReconstructionPack } from "../domain/packLoader";
import {
  getActivePerformanceView,
  resolvePerformanceConfiguration,
} from "../domain/performanceModel";

const outDir = join(process.cwd(), "artifacts/collaborative-daw-campaign/evidence");

describe("topology scenario evidence (unit)", () => {
  const pack = loadReconstructionPack();

  it("exports required topology fixtures for owner bundle", () => {
    const config = resolvePerformanceConfiguration(pack);
    const currentView = config.views.find((v) => v.id === "current-song-performance")!;
    const legacyView = config.views.find((v) => v.legacyPreset === "four-capability")!;
    const miniPack = structuredClone(placeholderReconstructionPack);
    miniPack.participants = miniPack.participants.slice(0, 3);
    miniPack.workspaces = miniPack.workspaces.filter((ws) =>
      miniPack.participants.some((p) => p.id === ws.participantId),
    );
    const miniConfig = resolvePerformanceConfiguration(miniPack);
    const session = createIncompleteSession(pack);
    const multiTrack = session.workspaces.find((ws) => ws.trackIds.length > 1)!;
    const rhythmAssignees = config.assignments.filter((a) => a.capabilityId === "cap-rhythm");
    const byParticipant = config.assignments.reduce<Record<string, Set<string>>>((acc, a) => {
      (acc[a.participantId] ??= new Set()).add(a.capabilityId);
      return acc;
    }, {});
    const multiCap = Object.entries(byParticipant).find(([, caps]) => caps.size > 1)!;

    const payload = {
      timestamp: new Date().toISOString(),
      currentSongSixCapability: {
        viewId: currentView.id,
        capabilityIds: currentView.capabilityIds,
        capabilityCount: currentView.capabilityIds.length,
      },
      legacyFourCapability: {
        viewId: legacyView.id,
        capabilityIds: legacyView.capabilityIds,
        capabilityCount: legacyView.capabilityIds.length,
      },
      nonFourFixture: {
        participantCount: miniPack.participants.length,
        capabilityCount: getActivePerformanceView(miniConfig).capabilityIds.length,
      },
      oneParticipantMultipleTracks: {
        workspaceId: multiTrack.id,
        participantId: multiTrack.participantId,
        trackCount: multiTrack.trackIds.length,
      },
      oneParticipantMultipleCapabilities: {
        participantId: multiCap[0],
        capabilityIds: [...multiCap[1]],
      },
      capabilitySharedByMultipleParticipants: {
        capabilityId: "cap-rhythm",
        participantIds: [...new Set(rhythmAssignees.map((a) => a.participantId))],
      },
    };

    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "topology-scenarios.json"), JSON.stringify(payload, null, 2));

    expect(payload.currentSongSixCapability.capabilityCount).toBe(6);
    expect(payload.legacyFourCapability.capabilityCount).toBe(4);
    expect(payload.nonFourFixture.participantCount).toBe(3);
    expect(payload.oneParticipantMultipleTracks.trackCount).toBeGreaterThan(1);
    expect(payload.oneParticipantMultipleCapabilities.capabilityIds.length).toBeGreaterThan(1);
    expect(payload.capabilitySharedByMultipleParticipants.participantIds.length).toBeGreaterThanOrEqual(2);
  });
});
