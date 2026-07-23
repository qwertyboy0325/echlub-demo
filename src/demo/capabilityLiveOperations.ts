import { compileDraftMaterial, materialRefForDraft } from "../domain/sessionMaterialBank";
import {
  resolveCapabilityOperationContext,
  type CapabilityOperationContext,
} from "../domain/capabilityOperations";
import type { ReconstructionPack } from "../domain/reconstructionPack";
import type { ProductionSession } from "../domain/sessionTypes";
import type { MaterialRef } from "../domain/sessionTypes";
import { repinDraftReferences, type LiveMutationEvidence } from "./liveMutations";

export type CapabilityLiveOperation = "privateCue" | "revision";

export interface CapabilityOperationEvidence {
  operation: CapabilityLiveOperation;
  context: CapabilityOperationContext;
  beforeRevision: number;
  afterRevision: number;
  beforeFingerprint: string;
  afterFingerprint: string;
  draftStatus: string;
  materialRef: MaterialRef;
  repinnedSceneRefs: LiveMutationEvidence["repinnedSceneRefs"];
  cueStarted: boolean;
}

function applyBoundedBassRevision(
  session: ProductionSession,
  pack: ReconstructionPack,
  draftId: string,
): boolean {
  const draft = session.drafts[draftId];
  if (!draft || draft.kind !== "bass") return false;
  const seed = pack.drafts.find((d) => d.id === draftId);
  const before = compileDraftMaterial(draft);

  if (!draft.notes?.length && seed?.notes?.length) {
    draft.notes = structuredClone(seed.notes.slice(0, Math.min(8, seed.notes.length)));
  } else if (draft.notes?.length) {
    const note = draft.notes[0];
    const nextVelocity = Math.min(0.95, (note.velocity ?? 0.5) + 0.1);
    if (note.velocity === nextVelocity) return false;
    note.velocity = nextVelocity;
  } else {
    return false;
  }

  return compileDraftMaterial(draft).contentFingerprint !== before.contentFingerprint;
}

function applyBoundedHarmonyRevision(
  session: ProductionSession,
  pack: ReconstructionPack,
  draftId: string,
): boolean {
  const draft = session.drafts[draftId];
  if (!draft || draft.kind !== "harmony") return false;
  const seed = pack.drafts.find((d) => d.id === draftId);
  const before = compileDraftMaterial(draft);

  if (!draft.harmonyChords?.length && seed?.harmonyChords?.length) {
    draft.harmonyChords = structuredClone(seed.harmonyChords.slice(0, 2));
  } else if (draft.harmonyChords?.[0]) {
    const chord = draft.harmonyChords[0];
    const passing = "Bb4";
    if (chord.notes.includes(passing)) {
      chord.notes[0] = chord.notes[0] === "C4" ? "C#4" : "C4";
    } else {
      chord.notes = [...chord.notes, passing];
    }
  } else {
    return false;
  }

  return compileDraftMaterial(draft).contentFingerprint !== before.contentFingerprint;
}

export function applyCapabilityLiveOperation(
  session: ProductionSession,
  pack: ReconstructionPack,
  capabilityId: string,
  operation: CapabilityLiveOperation,
): CapabilityOperationEvidence | null {
  const context = resolveCapabilityOperationContext(session, capabilityId);
  if (!context) return null;

  const draft = session.drafts[context.draftId];
  if (!draft) return null;

  const beforeMaterial = compileDraftMaterial(draft);

  if (operation === "privateCue") {
    draft.status = "preview";
    const materialRef = materialRefForDraft(draft);
    return {
      operation,
      context,
      beforeRevision: beforeMaterial.revision,
      afterRevision: draft.revision,
      beforeFingerprint: beforeMaterial.contentFingerprint,
      afterFingerprint: beforeMaterial.contentFingerprint,
      draftStatus: draft.status,
      materialRef,
      repinnedSceneRefs: [],
      cueStarted: true,
    };
  }

  const changed = context.layer === "bass"
    ? applyBoundedBassRevision(session, pack, context.draftId)
    : applyBoundedHarmonyRevision(session, pack, context.draftId);
  if (!changed) return null;

  draft.revision = beforeMaterial.revision + 1;
  draft.status = "offered";
  const afterMaterial = compileDraftMaterial(draft);
  const repinnedSceneRefs = repinDraftReferences(session, context.draftId);
  const materialRef = materialRefForDraft(draft);

  return {
    operation: "revision",
    context,
    beforeRevision: beforeMaterial.revision,
    afterRevision: afterMaterial.revision,
    beforeFingerprint: beforeMaterial.contentFingerprint,
    afterFingerprint: afterMaterial.contentFingerprint,
    draftStatus: draft.status,
    materialRef,
    repinnedSceneRefs,
    cueStarted: false,
  };
}
