import { compileDraftMaterial, materialRefForDraft } from "../domain/sessionMaterialBank";
import type { ProductionSession } from "../domain/sessionTypes";
import type { LayerId, MixParams, PerformanceScriptEvent } from "../types";

export interface RepinnedSceneLayer {
  sceneId: string;
  layer: LayerId;
  draftId: string;
  revision: number;
  fingerprint: string;
}

export interface LiveMutationEvidence {
  eventId: string;
  draftId?: string;
  mixField?: string;
  beforeRevision?: number;
  afterRevision?: number;
  beforeValue?: unknown;
  afterValue?: unknown;
  beforeFingerprint?: string;
  afterFingerprint?: string;
  repinnedSceneRefs: RepinnedSceneLayer[];
  bankVersion: number;
}

export interface LiveMusicalMutationResult {
  contentChanged: boolean;
  mixChanged: boolean;
  mixPatch?: Partial<MixParams>;
  evidence?: LiveMutationEvidence;
}

export function repinDraftReferences(session: ProductionSession, draftId: string): RepinnedSceneLayer[] {
  const draft = session.drafts[draftId];
  if (!draft) return [];
  const nextRef = materialRefForDraft(draft);
  const repinned: RepinnedSceneLayer[] = [];

  // Prototype rule: every Live-session Scene layer using the edited Draft ID
  // follows the new Live revision. The frozen canonical snapshot is separate.
  for (const scene of session.scenes) {
    for (const layer of Object.keys(scene.layers) as LayerId[]) {
      if (scene.layers[layer]?.draftId !== draftId) continue;
      scene.layers[layer] = { ...nextRef };
      repinned.push({ sceneId: scene.id, layer, ...nextRef });
    }
    for (const [layer, refs] of Object.entries(scene.layerStacks ?? {})) {
      if (!refs?.length) continue;
      let touched = false;
      const nextRefs = refs.map((ref) => {
        if (ref.draftId !== draftId) return ref;
        touched = true;
        return { ...nextRef };
      });
      if (!touched) continue;
      scene.layerStacks ??= {};
      scene.layerStacks[layer as LayerId] = nextRefs;
      repinned.push({ sceneId: scene.id, layer: layer as LayerId, ...nextRef });
    }
  }
  return repinned;
}

function applyDraftContentEvent(
  session: ProductionSession,
  event: PerformanceScriptEvent,
): LiveMusicalMutationResult {
  const draft = event.target ? session.drafts[event.target] : undefined;
  if (!draft) return { contentChanged: false, mixChanged: false };

  const before = compileDraftMaterial(draft);
  let changed = false;

  if (event.action === "addNote" && typeof event.value === "string" && draft.notes) {
    const parsed = JSON.parse(event.value) as { step: number; pitch: number; note: string };
    const id = `note-${draft.id}-${parsed.step}`;
    if (!draft.notes.some((note) => note.id === id)) {
      draft.notes.push({
        id,
        step: parsed.step,
        pitch: parsed.pitch,
        note: parsed.note,
        duration: "8n",
        velocity: 0.6,
      });
      draft.notes.sort((a, b) => a.step - b.step);
      changed = true;
    }
  } else if (event.action === "moveNote" && typeof event.value === "string") {
    const [noteId, newStepText] = event.value.split(":");
    const newStep = Number(newStepText);
    const note = draft.notes?.find((candidate) => candidate.id === noteId);
    if (note && Number.isFinite(newStep) && note.step !== newStep) {
      note.step = newStep;
      draft.notes!.sort((a, b) => a.step - b.step);
      changed = true;
    }
  } else if (event.action === "toggleStep" && draft.steps && typeof event.value === "number") {
    const index = draft.steps.indexOf(event.value);
    if (index >= 0) draft.steps.splice(index, 1);
    else draft.steps.push(event.value);
    draft.steps.sort((a, b) => a - b);
    changed = true;
  }

  if (!changed) return { contentChanged: false, mixChanged: false };

  draft.revision = before.revision + 1;
  const after = compileDraftMaterial(draft);
  const repinnedSceneRefs = repinDraftReferences(session, draft.id);
  return {
    contentChanged: true,
    mixChanged: false,
    evidence: {
      eventId: event.id,
      draftId: draft.id,
      beforeRevision: before.revision,
      afterRevision: after.revision,
      beforeFingerprint: before.contentFingerprint,
      afterFingerprint: after.contentFingerprint,
      repinnedSceneRefs,
      bankVersion: 0,
    },
  };
}

function applyMixEvent(
  session: ProductionSession,
  event: PerformanceScriptEvent,
): LiveMusicalMutationResult {
  let mixField: string | undefined;
  let beforeValue: number | undefined;
  let afterValue: number | undefined;
  let mixPatch: Partial<MixParams> | undefined;

  if (event.action === "filter" && typeof event.value === "number") {
    mixField = "filter";
    beforeValue = session.mix.filter;
    afterValue = event.value;
    session.mix.filter = afterValue;
    mixPatch = { filter: afterValue };
  } else if (event.action === "delay" && typeof event.value === "number") {
    mixField = "delayWet";
    beforeValue = session.mix.delayWet;
    afterValue = event.value;
    session.mix.delayWet = afterValue;
    mixPatch = { delayWet: afterValue };
  } else if (event.action === "fader" && event.target && typeof event.value === "number") {
    mixField = `faders.${event.target}`;
    beforeValue = session.mix.faders[event.target];
    afterValue = event.value;
    session.mix.faders[event.target] = afterValue;
    mixPatch = { faders: { [event.target]: afterValue } };
  }

  if (!mixField || beforeValue === afterValue) {
    return { contentChanged: false, mixChanged: false };
  }
  return {
    contentChanged: false,
    mixChanged: true,
    mixPatch,
    evidence: {
      eventId: event.id,
      mixField,
      beforeValue,
      afterValue,
      repinnedSceneRefs: [],
      bankVersion: 0,
    },
  };
}

export function applyLiveMusicalEvent(
  session: ProductionSession,
  event: PerformanceScriptEvent,
): LiveMusicalMutationResult {
  if (event.action === "addNote" || event.action === "moveNote" || event.action === "toggleStep") {
    return applyDraftContentEvent(session, event);
  }
  if (event.action === "filter" || event.action === "delay" || event.action === "fader") {
    return applyMixEvent(session, event);
  }
  return { contentChanged: false, mixChanged: false };
}

export function applyLiveSceneMix(
  session: ProductionSession,
  sceneId: string,
  eventId: string,
): LiveMusicalMutationResult {
  const scene = session.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) return { contentChanged: false, mixChanged: false };
  const beforeValue = structuredClone(session.mix);
  session.mix = structuredClone(scene.fx);
  return {
    contentChanged: false,
    mixChanged: true,
    mixPatch: structuredClone(scene.fx),
    evidence: {
      eventId,
      mixField: "sceneFx",
      beforeValue,
      afterValue: structuredClone(session.mix),
      repinnedSceneRefs: [],
      bankVersion: 0,
    },
  };
}
