import type { LayerId, NoteEvent, PatternDraft } from "../types";
import type { ReconstructionPack } from "../domain/reconstructionPack";
import { compileDraftMaterial, materialRefForDraft } from "../domain/sessionMaterialBank";
import type { MaterialRef, ProductionAction, ProductionMutationResult, ProductionSession } from "../domain/sessionTypes";

function emptyDraftShell(id: string, target: PatternDraft): PatternDraft {
  return {
    id,
    owner: target.owner,
    title: target.title,
    kind: target.kind,
    status: "editing",
    revision: 0,
    notes: target.kind === "bass" || target.kind === "melody" ? [] : undefined,
    steps: target.kind === "drums" ? [] : undefined,
    harmonyChords: target.kind === "harmony" ? [] : undefined,
    textureParams: target.kind === "texture" && target.textureParams
      ? { ...structuredClone(target.textureParams), level: 0 }
      : undefined,
  };
}

function bumpRevision(draft: PatternDraft): void {
  draft.revision = (draft.revision ?? 0) + 1;
}

function seedNoteFromPack(pack: ReconstructionPack, draftId: string, noteIdx: number): NoteEvent | undefined {
  const src = pack.drafts.find((d) => d.id === draftId);
  return src?.notes?.[noteIdx] ?? src?.notes?.[0];
}

/** Incomplete project seed — real drafts exist but are empty shells. */
export function createIncompleteSession(pack: ReconstructionPack): ProductionSession {
  const drafts: Record<string, PatternDraft> = {};
  for (const d of pack.drafts) {
    drafts[d.id] = emptyDraftShell(d.id, d);
  }
  return {
    packId: pack.metadata.id,
    participants: structuredClone(pack.participants),
    workspaces: structuredClone(pack.workspaces),
    tracks: structuredClone(pack.tracks),
    drafts,
    scenes: pack.scenes.map((s) => ({
      ...structuredClone(s),
      layers: { drums: null, bass: null, harmony: null, melody: null, texture: null },
    })),
    arrangement: {
      id: pack.arrangement.id,
      title: pack.arrangement.title,
      totalBars: pack.arrangement.totalBars,
      scenes: [],
    },
    liveStructure: {
      pending: [],
      applied: [],
      removedLayerRefs: {},
    },
    performanceViews: structuredClone(pack.performanceViews),
    mix: structuredClone(pack.defaultMix),
    productionComplete: false,
    canonicalPlaybackComplete: false,
    liveTakeComplete: false,
  };
}

export function createCompletedProductionSession(pack: ReconstructionPack): ProductionSession {
  const session = createIncompleteSession(pack);
  for (const action of pack.productionChoreography) {
    applyProductionAction(session, action, pack);
  }
  session.productionComplete = true;
  return session;
}

export function applyProductionAction(
  session: ProductionSession,
  action: ProductionAction,
  pack: ReconstructionPack,
): ProductionMutationResult {
  let contentChanged = false;
  let materialRef: MaterialRef | undefined;

  const targetDraft = action.target ? pack.drafts.find((d) => d.id === action.target) : undefined;

  switch (action.kind) {
    case "createDraft": {
      if (!action.target || !targetDraft) break;
      session.drafts[action.target] = {
        ...structuredClone(targetDraft),
        status: "editing",
        revision: 1,
      };
      contentChanged = true;
      materialRef = materialRefForDraft(session.drafts[action.target]!);
      break;
    }
    case "addNote": {
      if (!action.target) break;
      const draft = session.drafts[action.target];
      if (!draft) break;
      const noteIdx = Number(action.value ?? 0);
      const src = seedNoteFromPack(pack, action.target, noteIdx);
      if (!src || draft.notes?.some((n) => n.id === src.id)) break;
      draft.notes = [...(draft.notes ?? []), structuredClone(src)];
      bumpRevision(draft);
      contentChanged = true;
      materialRef = materialRefForDraft(draft);
      break;
    }
    case "moveNote": {
      if (!action.target || typeof action.value !== "number") break;
      const draft = session.drafts[action.target];
      const note = draft?.notes?.[0];
      if (!note || note.step === action.value) break;
      note.step = action.value;
      bumpRevision(draft);
      contentChanged = true;
      materialRef = materialRefForDraft(draft);
      break;
    }
    case "setVelocity": {
      if (!action.target || typeof action.value !== "number") break;
      const draft = session.drafts[action.target];
      const note = draft?.notes?.[0];
      if (!note || note.velocity === action.value) break;
      note.velocity = action.value;
      bumpRevision(draft);
      contentChanged = true;
      materialRef = materialRefForDraft(draft);
      break;
    }
    case "toggleStep": {
      if (!action.target) break;
      const draft = session.drafts[action.target];
      if (!draft) break;
      const step = Number(action.value ?? 0);
      const steps = new Set(draft.steps ?? []);
      if (steps.has(step)) steps.delete(step);
      else steps.add(step);
      draft.steps = [...steps].sort((a, b) => a - b);
      bumpRevision(draft);
      contentChanged = true;
      materialRef = materialRefForDraft(draft);
      break;
    }
    case "createVariation": {
      if (!action.target) break;
      const draft = session.drafts[action.target];
      if (!draft?.steps) break;
      const extra = Number(action.value ?? 3);
      if (draft.steps.includes(extra)) break;
      draft.steps = [...draft.steps, extra].sort((a, b) => a - b);
      bumpRevision(draft);
      contentChanged = true;
      materialRef = materialRefForDraft(draft);
      break;
    }
    case "editBass": {
      if (!action.target) break;
      const draft = session.drafts[action.target];
      if (!draft || draft.kind !== "bass") break;
      const seed = pack.drafts.find((d) => d.id === action.target);
      const pitch = String(action.value ?? "A2");
      let changed = false;
      const note: NoteEvent = {
        id: `bass-${draft.revision}-${draft.notes?.length ?? 0}`,
        step: (draft.notes?.length ?? 0) * 2,
        pitch: 0,
        note: pitch,
        duration: "8n",
        velocity: 0.48,
      };
      if (!seed?.notes?.length) {
        draft.notes = [note];
        changed = true;
      } else {
        const idx = Number(action.value ?? 0);
        const src = seed.notes[idx % seed.notes.length];
        if (src && !draft.notes?.some((n) => n.id === src.id)) {
          draft.notes = [...(draft.notes ?? []), structuredClone(src)];
          changed = true;
        }
      }
      if (!changed) break;
      bumpRevision(draft);
      contentChanged = true;
      materialRef = materialRefForDraft(draft);
      break;
    }
    case "editHarmony": {
      if (!action.target) break;
      const draft = session.drafts[action.target];
      if (!draft || draft.kind !== "harmony") break;
      const seed = pack.drafts.find((d) => d.id === action.target);
      const barIdx = Number(action.value ?? 0);
      const chord = seed?.harmonyChords?.[barIdx];
      let changed = false;
      if (chord && !draft.harmonyChords?.some((c) => c.bar === chord.bar)) {
        draft.harmonyChords = [...(draft.harmonyChords ?? []), structuredClone(chord)];
        changed = true;
      }
      if (!changed) break;
      bumpRevision(draft);
      contentChanged = true;
      materialRef = materialRefForDraft(draft);
      break;
    }
    case "editTexture": {
      if (!action.target) break;
      const draft = session.drafts[action.target];
      if (!draft || draft.kind !== "texture") break;
      const beforeFingerprint = compileDraftMaterial(draft).contentFingerprint;
      const seed = pack.drafts.find((d) => d.id === action.target);
      draft.textureParams = structuredClone(seed?.textureParams ?? {
        noise: "brown",
        level: 0.1,
        duration: "2n",
        patchId: draft.id,
      });
      if (typeof action.value === "number") draft.textureParams.level = action.value;
      if (compileDraftMaterial(draft).contentFingerprint === beforeFingerprint) break;
      bumpRevision(draft);
      contentChanged = true;
      materialRef = materialRefForDraft(draft);
      break;
    }
    case "adjustGain": {
      if (action.target && typeof action.value === "number") {
        session.mix.faders[action.target] = action.value;
      }
      break;
    }
    case "adjustFilter": {
      if (typeof action.value === "number") session.mix.filter = action.value;
      break;
    }
    case "adjustDelay": {
      if (typeof action.value === "number") session.mix.delayWet = action.value;
      break;
    }
    case "captureFx": {
      session.mix.reverbWet = Math.min(0.7, session.mix.reverbWet + 0.05);
      break;
    }
    case "previewDraft": {
      if (!action.target) break;
      const d = session.drafts[action.target];
      if (d) d.status = "preview";
      break;
    }
    case "offerDraft": {
      if (!action.target) break;
      const d = session.drafts[action.target];
      if (d) d.status = "offered";
      break;
    }
    case "acceptDraft": {
      if (!action.target) break;
      const d = session.drafts[action.target];
      if (d) d.status = "ready";
      break;
    }
    case "reviseDraft": {
      if (!action.target) break;
      const d = session.drafts[action.target];
      if (d) {
        d.status = "editing";
      }
      break;
    }
    case "placeInScene": {
      const sceneId = action.target;
      if (!sceneId) break;
      const scene = session.scenes.find((s) => s.id === sceneId);
      if (!scene) break;
      const hints = pack.scenePlacements[sceneId] ?? {};
      const layersToPlace = action.layerId
        ? { [action.layerId]: String(action.value ?? "") }
        : hints;
      for (const [layer, draftId] of Object.entries(layersToPlace)) {
        if (!draftId) continue;
        const draft = session.drafts[draftId];
        if (!draft) continue;
        const ref = materialRefForDraft(draft);
        scene.layers[layer as LayerId] = ref;
        materialRef = ref;
      }
      contentChanged = true;
      break;
    }
    case "createTransition": {
      if (!action.target) break;
      const scene = session.scenes.find((s) => s.id === action.target);
      if (scene) scene.fx.delayWet = Math.min(0.6, scene.fx.delayWet + 0.08);
      break;
    }
    case "assembleArrangement": {
      session.arrangement.scenes = session.scenes
        .filter((s) => Object.values(s.layers).some((ref) => ref !== null))
        .map((s) => ({ sceneId: s.id, startBar: s.startBar }));
      if (!session.arrangement.scenes.length) {
        session.arrangement.scenes = pack.sections.map((sec) => ({
          sceneId: sec.id,
          startBar: sec.startBar,
        }));
      }
      session.productionComplete = true;
      break;
    }
  }

  return { bankVersion: 0, materialRef, contentChanged };
}

export function sessionToRuntimeDrafts(session: ProductionSession): Record<string, PatternDraft> {
  return structuredClone(session.drafts);
}

export function sessionMix(session: ProductionSession): import("../types").MixParams {
  return structuredClone(session.mix);
}

export function validateSessionRelationships(session: ProductionSession): string[] {
  const errors: string[] = [];
  for (const ws of session.workspaces) {
    if (!session.participants.find((p) => p.id === ws.participantId)) {
      errors.push(`workspace ${ws.id} orphan participant`);
    }
    for (const tid of ws.trackIds) {
      if (!session.tracks.find((t) => t.id === tid)) errors.push(`workspace ${ws.id} unknown track ${tid}`);
    }
  }
  for (const track of session.tracks) {
    for (const did of track.draftIds) {
      if (!session.drafts[did]) errors.push(`track ${track.id} missing draft ${did}`);
    }
  }
  for (const ref of session.arrangement.scenes) {
    if (!session.scenes.find((s) => s.id === ref.sceneId)) {
      errors.push(`arrangement missing scene ${ref.sceneId}`);
    }
  }
  return errors;
}

export function validateSceneMaterialRefs(
  session: ProductionSession,
  bank: import("../domain/materialTypes").SessionMaterialBank,
): string[] {
  const errors: string[] = [];
  for (const scene of session.scenes) {
    for (const [layer, ref] of Object.entries(scene.layers)) {
      if (!ref) continue;
      const material = bank.materials.get(`${ref.draftId}@${ref.revision}`);
      if (!material) {
        errors.push(`scene ${scene.id} layer ${layer} missing material ${ref.draftId}@${ref.revision}`);
      } else if (material.contentFingerprint !== ref.fingerprint) {
        errors.push(`scene ${scene.id} layer ${layer} fingerprint mismatch for ${ref.draftId}`);
      }
    }
  }
  return errors;
}

export const ALL_PRODUCTION_ACTION_KINDS = [
  "createDraft", "addNote", "moveNote", "setVelocity", "toggleStep", "createVariation",
  "editBass", "editHarmony", "editTexture", "adjustGain", "adjustFilter", "adjustDelay",
  "captureFx", "previewDraft", "offerDraft", "acceptDraft", "reviseDraft",
  "placeInScene", "createTransition", "assembleArrangement",
] as const;

export const PRODUCTION_ROLE_IDS = [
  "rhythm", "percussion", "bass", "harmony", "melody", "texture", "mix", "arrangement",
] as const;
