import type { ProductionSession, Participant } from "./sessionTypes";
import type { PatternDraft } from "../types";
import { LEGACY_BRAIN_CAPABILITIES } from "./performanceModel";

const ROLE_LABELS: Record<string, string> = {
  rhythm: "Rhythm",
  percussion: "Percussion",
  bass: "Bass",
  harmony: "Harmony",
  melody: "Melody",
  texture: "Texture",
  mix: "Mix / FX",
  arrangement: "Arrangement",
};

export function formatProductionRole(roleId: string): string {
  return ROLE_LABELS[roleId] ?? roleId.replace(/_/g, " ");
}

/** Resolve clip author from participant/workspace data — not from BrainId as identity. */
export function resolveDraftAuthor(session: ProductionSession, draft?: PatternDraft): Participant | undefined {
  if (!draft) return undefined;
  const track = session.tracks.find((t) => t.draftIds.includes(draft.id));
  if (track) {
    const workspace = session.workspaces.find((ws) => ws.trackIds.includes(track.id));
    if (workspace) {
      const byWorkspace = session.participants.find((p) => p.id === workspace.participantId);
      if (byWorkspace) return byWorkspace;
    }
  }
  const legacyCap = Object.values(LEGACY_BRAIN_CAPABILITIES).find((c) => c.legacyBrainId === draft.owner);
  if (legacyCap) {
    const assignment = session.performanceConfig.assignments.find((a) => a.capabilityId === legacyCap.id);
    if (assignment) {
      return session.participants.find((p) => p.id === assignment.participantId);
    }
  }
  return session.participants.find((p) => p.performanceBrain === draft.owner);
}

export function authorColorForParticipant(
  session: ProductionSession,
  participant?: Participant,
): string {
  if (!participant) return "#929caf";
  const assignment = session.performanceConfig.assignments.find((a) => a.participantId === participant.id);
  const cap = assignment
    ? session.performanceConfig.capabilities.find((c) => c.id === assignment.capabilityId)
    : undefined;
  return cap?.color ?? "#929caf";
}

export function legacyBrainsInActiveView(session: ProductionSession): import("../types").BrainId[] {
  const view = session.performanceConfig.views.find((v) => v.id === session.performanceConfig.activeViewId)
    ?? session.performanceConfig.views[0];
  if (!view) return [];
  const brains = new Set<import("../types").BrainId>();
  for (const capId of view.capabilityIds) {
    const cap = session.performanceConfig.capabilities.find((c) => c.id === capId);
    if (cap?.legacyBrainId) brains.add(cap.legacyBrainId);
  }
  return [...brains];
}
