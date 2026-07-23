/**
 * Performance capability model — decouples participants from live control grouping.
 * BrainId remains a legacy choreography label mapped through capabilities.
 */
import type { BrainId } from "../types";
import type { Participant, PerformanceViewPreset } from "./sessionTypes";
import type { ReconstructionPack } from "./reconstructionPack";

export interface PerformanceCapability {
  id: string;
  label: string;
  description?: string;
  /** Maps to choreography actor when using legacy Four-Brain script events. */
  legacyBrainId?: BrainId;
  color?: string;
}

export interface CapabilityAssignment {
  id: string;
  participantId: string;
  capabilityId: string;
  act: "production" | "live";
  trackIds?: string[];
  sceneIds?: string[];
  priority?: number;
}

export interface PerformanceViewGroup {
  id: string;
  label: string;
  capabilityIds?: string[];
  participantIds?: string[];
}

export interface PerformanceView {
  id: string;
  label: string;
  capabilityIds: string[];
  assignmentIds: string[];
  groups?: PerformanceViewGroup[];
  /** Legacy preset marker — compressed Four-Brain control surface. */
  legacyPreset?: "four-capability";
}

export interface PerformanceConfiguration {
  capabilities: PerformanceCapability[];
  assignments: CapabilityAssignment[];
  views: PerformanceView[];
  activeViewId: string;
}

export const LEGACY_BRAIN_CAPABILITIES: Record<BrainId, PerformanceCapability> = {
  memory: { id: "cap-material", label: "Material", description: "Cue, audition and replace musical phrases", legacyBrainId: "memory", color: "#67e8f9" },
  pulse: { id: "cap-rhythm", label: "Rhythm", description: "Reshape groove, timing and musical gaps", legacyBrainId: "pulse", color: "#f9a8d4" },
  blend: { id: "cap-mixfx", label: "Mix / FX", description: "Balance, filter, echo and space", legacyBrainId: "blend", color: "#86efac" },
  story: { id: "cap-structure", label: "Structure", description: "Queue, hold and redirect song form", legacyBrainId: "story", color: "#c4b5fd" },
};

const EXTENDED_CAPABILITIES: PerformanceCapability[] = [
  { id: "cap-lowend", label: "Low End", description: "Bass and sub harmonic control", color: "#fbbf24" },
  { id: "cap-harmony", label: "Harmony", description: "Chords, voicing and harmonic texture", color: "#a78bfa" },
  { id: "cap-lead", label: "Lead", description: "Melodic lead selection and articulation", color: "#67e8f9" },
];

export function capabilityForBrain(brain: BrainId): PerformanceCapability {
  return LEGACY_BRAIN_CAPABILITIES[brain];
}

export function brainForCapability(capabilityId: string): BrainId | undefined {
  const all = [...Object.values(LEGACY_BRAIN_CAPABILITIES), ...EXTENDED_CAPABILITIES];
  return all.find((c) => c.id === capabilityId)?.legacyBrainId;
}

function assignmentId(participantId: string, capabilityId: string, act: "production" | "live"): string {
  return `assign-${act}-${participantId}-${capabilityId}`;
}

function buildLegacyAssignments(participants: Participant[], act: "live"): CapabilityAssignment[] {
  const assignments: CapabilityAssignment[] = [];
  for (const participant of participants) {
    if (!participant.performanceBrain) continue;
    const cap = LEGACY_BRAIN_CAPABILITIES[participant.performanceBrain];
    const wsTrackIds: string[] = [];
    assignments.push({
      id: assignmentId(participant.id, cap.id, act),
      participantId: participant.id,
      capabilityId: cap.id,
      act,
      trackIds: wsTrackIds.length ? wsTrackIds : undefined,
      priority: participant.workspaceIds.length,
    });
  }
  return assignments;
}

function buildFourCapabilityView(
  preset: PerformanceViewPreset,
  assignments: CapabilityAssignment[],
): PerformanceView {
  const capabilityIds = preset.brainOrder.map((b) => LEGACY_BRAIN_CAPABILITIES[b].id);
  const assignmentIds = assignments
    .filter((a) => capabilityIds.includes(a.capabilityId))
    .map((a) => a.id);
  return {
    id: preset.id,
    label: preset.label,
    capabilityIds,
    assignmentIds,
    groups: preset.brainOrder.map((brain) => ({
      id: `group-${brain}`,
      label: LEGACY_BRAIN_CAPABILITIES[brain].label,
      capabilityIds: [LEGACY_BRAIN_CAPABILITIES[brain].id],
    })),
    legacyPreset: "four-capability",
  };
}

function buildCurrentSongView(
  pack: ReconstructionPack,
  assignments: CapabilityAssignment[],
): PerformanceView {
  const capabilities = [
    LEGACY_BRAIN_CAPABILITIES.memory,
    LEGACY_BRAIN_CAPABILITIES.pulse,
    ...EXTENDED_CAPABILITIES.filter((c) => ["cap-lowend", "cap-harmony"].includes(c.id)),
    LEGACY_BRAIN_CAPABILITIES.blend,
    LEGACY_BRAIN_CAPABILITIES.story,
  ];

  const roleToCapability: Record<string, string> = {
    melody: "cap-material",
    rhythm: "cap-rhythm",
    percussion: "cap-rhythm",
    bass: "cap-lowend",
    harmony: "cap-harmony",
    texture: "cap-harmony",
    mix: "cap-mixfx",
    arrangement: "cap-structure",
  };

  const viewAssignments: string[] = [];
  for (const participant of pack.participants) {
    const capId = roleToCapability[participant.roleId]
      ?? (participant.performanceBrain
        ? LEGACY_BRAIN_CAPABILITIES[participant.performanceBrain].id
        : "cap-material");
    const id = assignmentId(participant.id, capId, "live");
    if (!assignments.some((a) => a.id === id)) {
      const trackIds = pack.workspaces
        .filter((ws) => ws.participantId === participant.id)
        .flatMap((ws) => ws.trackIds);
      assignments.push({
        id,
        participantId: participant.id,
        capabilityId: capId,
        act: "live",
        trackIds: trackIds.length ? trackIds : undefined,
        priority: pack.workspaces.find((ws) => ws.participantId === participant.id)?.focusPriority,
      });
    }
    viewAssignments.push(id);
  }

  return {
    id: "current-song-performance",
    label: "Current song performance view",
    capabilityIds: capabilities.map((c) => c.id),
    assignmentIds: viewAssignments,
    groups: [
      { id: "grp-lead", label: "Lead / Material", capabilityIds: ["cap-material"] },
      { id: "grp-rhythm", label: "Rhythm", capabilityIds: ["cap-rhythm"] },
      { id: "grp-lowend", label: "Low End", capabilityIds: ["cap-lowend"] },
      { id: "grp-harmony", label: "Harmony", capabilityIds: ["cap-harmony"] },
      { id: "grp-mix", label: "Mix / FX", capabilityIds: ["cap-mixfx"] },
      { id: "grp-structure", label: "Structure", capabilityIds: ["cap-structure"] },
    ],
  };
}

/** Resolve performance configuration from pack data with legacy migration. */
export function resolvePerformanceConfiguration(pack: ReconstructionPack): PerformanceConfiguration {
  const assignments = buildLegacyAssignments(pack.participants, "live");
  const views: PerformanceView[] = [];

  const currentSongView = buildCurrentSongView(pack, assignments);
  views.push(currentSongView);

  for (const preset of pack.performanceViews) {
    views.push(buildFourCapabilityView(preset, assignments));
  }

  const capabilityMap = new Map<string, PerformanceCapability>();
  for (const cap of [...Object.values(LEGACY_BRAIN_CAPABILITIES), ...EXTENDED_CAPABILITIES]) {
    capabilityMap.set(cap.id, cap);
  }
  for (const view of views) {
    for (const capId of view.capabilityIds) {
      if (!capabilityMap.has(capId)) {
        capabilityMap.set(capId, { id: capId, label: capId });
      }
    }
  }

  const isComplexSong = pack.participants.length > 4 || pack.tracks.length > 5;
  const activeViewId = isComplexSong ? currentSongView.id : (pack.performanceViews[0]?.id ?? currentSongView.id);

  return {
    capabilities: [...capabilityMap.values()],
    assignments,
    views,
    activeViewId,
  };
}

export function getActivePerformanceView(config: PerformanceConfiguration): PerformanceView {
  return config.views.find((v) => v.id === config.activeViewId) ?? config.views[0]!;
}

export function assignmentsForView(
  config: PerformanceConfiguration,
  view: PerformanceView,
): CapabilityAssignment[] {
  const ids = new Set(view.assignmentIds);
  return config.assignments.filter((a) => ids.has(a.id));
}

export function participantsForCapability(
  config: PerformanceConfiguration,
  capabilityId: string,
  participants: Participant[],
): Participant[] {
  const participantIds = new Set(
    config.assignments.filter((a) => a.capabilityId === capabilityId).map((a) => a.participantId),
  );
  return participants.filter((p) => participantIds.has(p.id));
}
