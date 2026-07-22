import type { SceneDefinition } from "../types";
import type { ProductionSession } from "../domain/sessionTypes";
import type { CanonicalVsLiveComparison } from "../domain/sessionTypes";
import type { SessionMaterialBank } from "../domain/sessionMaterialBank";
import { abbreviateFingerprint } from "../domain/sessionMaterialBank";

export interface CanonicalPlaybackState {
  currentSceneId: string;
  currentBar: number;
  provenanceRefs: { draftId: string; revision: number; fingerprint: string }[];
}

export function resolveSceneAtBar(session: ProductionSession, bar: number): SceneDefinition | undefined {
  const ref = [...session.arrangement.scenes].reverse().find((s) => bar >= s.startBar);
  return ref ? session.scenes.find((s) => s.id === ref.sceneId) : undefined;
}

export function provenanceForScene(session: ProductionSession, sceneId: string): string[] {
  const scene = session.scenes.find((s) => s.id === sceneId);
  if (!scene) return [];
  return [
    ...Object.values(scene.layers),
    ...Object.values(scene.layerStacks ?? {}).flat(),
  ]
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .map((ref) => `${ref.draftId}@r${ref.revision}:${abbreviateFingerprint(ref.fingerprint)}`);
}

export function canonicalPlaybackDurationBars(session: ProductionSession): number {
  return session.arrangement.totalBars;
}

export function buildCanonicalVsLiveComparison(
  canonicalSession: ProductionSession,
  _canonicalBank: SessionMaterialBank | null,
  liveSession: ProductionSession,
  // liveBank reserved for future fingerprint-level diffing
  _liveBank: SessionMaterialBank,
  liveSceneIds: string[],
  jamMemoryCount: number,
): CanonicalVsLiveComparison {
  const canonicalSceneIds = canonicalSession.arrangement.scenes.map((s) => s.sceneId);
  const changedScenes = liveSceneIds.filter((id, i) => canonicalSceneIds[i] !== id);

  const sameIdContentChanges: CanonicalVsLiveComparison["sameIdContentChanges"] = [];
  const changedDrafts: string[] = [];

  for (const scene of canonicalSession.scenes) {
    const liveScene = liveSession.scenes.find((s) => s.id === scene.id);
    if (!liveScene) continue;
    for (const layer of Object.keys(scene.layers) as (keyof typeof scene.layers)[]) {
      const canonRef = scene.layers[layer];
      const liveRef = liveScene.layers[layer];
      if (!canonRef && !liveRef) continue;
      if (!canonRef || !liveRef) {
        changedDrafts.push(`${scene.id}/${layer}`);
        continue;
      }
      if (canonRef.draftId === liveRef.draftId && canonRef.fingerprint !== liveRef.fingerprint) {
        sameIdContentChanges.push({
          sceneId: scene.id,
          layer,
          draftId: canonRef.draftId,
          canonicalRevision: canonRef.revision,
          liveRevision: liveRef.revision,
          canonicalFingerprint: canonRef.fingerprint,
          liveFingerprint: liveRef.fingerprint,
        });
      } else if (canonRef.draftId !== liveRef.draftId) {
        changedDrafts.push(`${scene.id}/${layer}:${canonRef.draftId}→${liveRef.draftId}`);
      }
    }
  }

  const changedFx: string[] = [];
  if (canonicalSession.mix.filter !== liveSession.mix.filter) changedFx.push("filter");
  if (canonicalSession.mix.delayWet !== liveSession.mix.delayWet) changedFx.push("delayWet");
  if (canonicalSession.mix.reverbWet !== liveSession.mix.reverbWet) changedFx.push("reverbWet");
  if (canonicalSession.mix.masterGain !== liveSession.mix.masterGain) changedFx.push("masterGain");
  const faderKeys = new Set([
    ...Object.keys(canonicalSession.mix.faders),
    ...Object.keys(liveSession.mix.faders),
  ]);
  for (const key of faderKeys) {
    if (canonicalSession.mix.faders[key] !== liveSession.mix.faders[key]) {
      changedFx.push(`faders.${key}`);
    }
  }

  return {
    canonicalSceneIds,
    liveSceneIds,
    changedScenes,
    changedDrafts,
    sameIdContentChanges,
    changedFx,
    structuralChanges: liveSession.liveStructure.applied.map((entry) => entry.description),
    canonicalTotalBars: canonicalSession.arrangement.totalBars,
    liveTotalBars: liveSession.arrangement.totalBars,
    jamMemoryCount,
  };
}

export function buildTopologyTransformation(session: ProductionSession): string {
  const view = session.performanceViews[0];
  if (!view) return "";
  const roleLabels = session.participants.map((p) => p.displayName);
  const brainLabels = view.brainOrder.map((b) => b.charAt(0).toUpperCase() + b.slice(1));
  return [
    "Production responsibilities (8):",
    roleLabels.join(" · "),
    "",
    "Performance view regrouping (4 capabilities):",
    brainLabels.join(" · "),
    "",
    "Note: eight production roles regroup into four performance capabilities — not fewer people.",
  ].join("\n");
}
