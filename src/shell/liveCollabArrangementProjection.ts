import { isLanePlayingState } from "./laneSlotSemantics";
import type { ArrangementSlot, ArrangementTrack, TimelineClip } from "./domain/shellTypes";

/** Loop length encoded as trailing `-N` on authored material ids (e.g. kai-lh-sparse-4 → 4). */
export function loopLengthFromMaterialId(materialId: string): number {
  const match = materialId.match(/-(\d+)$/);
  const bars = match ? Number(match[1]) : 4;
  return Number.isFinite(bars) && bars > 0 ? bars : 4;
}

function timelineVariantForSlot(
  state: ArrangementSlot["state"],
): TimelineClip["variant"] {
  if (isLanePlayingState(state)) return "active";
  if (state === "queued" || state === "staged") return "staged";
  return "normal";
}

function slotHasScoreMaterial(slot: ArrangementSlot): boolean {
  if (slot.state === "empty") return false;
  return Boolean(slot.materialId || slot.label || slot.clipId);
}

/**
 * Derive score-map blocks from live-collab lane slots — single source of truth;
 * avoids maintaining a separate timelineClips array in shell state.
 */
export function projectLiveCollabTimelineClips(
  slots: ArrangementSlot[],
  tracks: ArrangementTrack[],
): TimelineClip[] {
  return slots.flatMap((slot, index) => {
    const track = tracks[index];
    if (!track || !slotHasScoreMaterial(slot)) return [];
    const materialId = slot.materialId ?? slot.label;
    return [
      {
        id: `lc-${slot.id}`,
        exchangeClipId: slot.clipId ?? materialId,
        trackId: track.id,
        startBar: 1,
        lengthBars: loopLengthFromMaterialId(materialId),
        variant: timelineVariantForSlot(slot.state),
      },
    ];
  });
}
