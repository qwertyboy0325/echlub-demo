import type { ProductionSession } from "./sessionTypes";
import type { LayerId } from "../types";

export interface CapabilityOperationContext {
  capabilityId: string;
  participantId: string;
  participantRoleId: string;
  trackId: string;
  draftId: string;
  layer: LayerId;
}

const CAPABILITY_LAYER: Record<string, LayerId> = {
  "cap-lowend": "bass",
  "cap-harmony": "harmony",
};

function assignmentTrackIds(
  session: ProductionSession,
  capabilityId: string,
  participantId: string,
): string[] {
  const fromAssignment = session.performanceConfig.assignments
    .filter((a) => a.capabilityId === capabilityId && a.participantId === participantId)
    .flatMap((a) => a.trackIds ?? []);
  if (fromAssignment.length) return [...new Set(fromAssignment)];
  const workspace = session.workspaces.find((ws) => ws.participantId === participantId);
  return workspace?.trackIds ?? [];
}

function pickDraftForTrack(
  session: ProductionSession,
  trackId: string,
  layer: LayerId,
): string | undefined {
  const track = session.tracks.find((t) => t.id === trackId);
  if (!track) return undefined;

  for (const scene of session.scenes) {
    const ref = scene.layers[layer];
    if (ref?.draftId && (track.draftIds.includes(ref.draftId) || session.drafts[ref.draftId])) {
      return ref.draftId;
    }
  }

  return track.draftIds.find((id) => session.drafts[id]);
}

/** Resolve acting participant, track and draft through CapabilityAssignment — not BrainId. */
export function resolveCapabilityOperationContext(
  session: ProductionSession,
  capabilityId: string,
): CapabilityOperationContext | undefined {
  const layer = CAPABILITY_LAYER[capabilityId];
  if (!layer) return undefined;

  const assignments = session.performanceConfig.assignments
    .filter((a) => a.capabilityId === capabilityId && a.act === "live")
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  const participantId = assignments[0]?.participantId;
  if (!participantId) return undefined;

  const participant = session.participants.find((p) => p.id === participantId);
  if (!participant) return undefined;

  const trackIds = assignmentTrackIds(session, capabilityId, participantId);
  const tracks = session.tracks.filter((t) => trackIds.includes(t.id) || t.layerKind === layer);
  const track = tracks.find((t) => t.id === "track-bass" && layer === "bass")
    ?? tracks.find((t) => t.id === "track-harmony" && layer === "harmony")
    ?? tracks.find((t) => t.layerKind === layer)
    ?? tracks[0];
  if (!track) return undefined;

  const draftId = pickDraftForTrack(session, track.id, layer);
  if (!draftId || !session.drafts[draftId]) return undefined;

  return {
    capabilityId,
    participantId,
    participantRoleId: participant.roleId,
    trackId: track.id,
    draftId,
    layer,
  };
}

export function draftIdsForCapability(session: ProductionSession, capabilityId: string): string[] {
  const layer = CAPABILITY_LAYER[capabilityId];
  if (!layer) return [];
  const ctx = resolveCapabilityOperationContext(session, capabilityId);
  const assignments = session.performanceConfig.assignments.filter((a) => a.capabilityId === capabilityId);
  const trackIds = [...new Set(assignments.flatMap((a) => {
    const ids = a.trackIds?.length ? a.trackIds : assignmentTrackIds(session, capabilityId, a.participantId);
    return ids;
  }))];
  const fromTracks = session.tracks
    .filter((t) => trackIds.includes(t.id) || t.layerKind === layer)
    .flatMap((t) => t.draftIds)
    .filter((id, i, arr) => arr.indexOf(id) === i && session.drafts[id]);
  if (fromTracks.length) return fromTracks;
  return ctx ? [ctx.draftId] : [];
}
