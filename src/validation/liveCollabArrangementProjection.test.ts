import { describe, expect, it } from "vitest";
import {
  loopLengthFromMaterialId,
  projectLiveCollabTimelineClips,
} from "../shell/liveCollabArrangementProjection";
import {
  createLiveCollabArrangementSlots,
  createLiveCollabArrangementTracks,
} from "../shell/domain/liveCollabShellFixtures";
import type { ArrangementSlot } from "../shell/domain/shellTypes";

describe("liveCollabArrangementProjection", () => {
  it("parses loop length from material id suffix", () => {
    expect(loopLengthFromMaterialId("kai-lh-sparse-4")).toBe(4);
    expect(loopLengthFromMaterialId("mei-tenor-entry-8")).toBe(8);
    expect(loopLengthFromMaterialId("no-suffix")).toBe(4);
  });

  it("projects preloaded and playing lanes into score-map blocks", () => {
    const tracks = createLiveCollabArrangementTracks();
    const slots = createLiveCollabArrangementSlots().map((slot) =>
      slot.id === "lane-1"
        ? { ...slot, state: "playing" as const, materialId: "kai-lh-sparse-4", label: "kai-lh-sparse-4" }
        : slot,
    );
    const clips = projectLiveCollabTimelineClips(slots, tracks);
    expect(clips.length).toBeGreaterThanOrEqual(4);
    const lh = clips.find((clip) => clip.exchangeClipId === "kai-lh-sparse-4");
    expect(lh).toMatchObject({
      trackId: "track-piano-lh",
      startBar: 1,
      lengthBars: 4,
      variant: "active",
    });
  });

  it("shows all seven lanes when every slot is playing", () => {
    const tracks = createLiveCollabArrangementTracks();
    const slots = createLiveCollabArrangementSlots().map(
      (slot, index): ArrangementSlot => ({
        ...slot,
        state: "playing",
        materialId: slot.materialId ?? `lane-material-${index + 1}-4`,
        label: slot.materialId ?? slot.label,
      }),
    );
    const clips = projectLiveCollabTimelineClips(slots, tracks);
    expect(clips).toHaveLength(7);
    expect(clips.every((clip) => clip.variant === "active")).toBe(true);
  });
});
