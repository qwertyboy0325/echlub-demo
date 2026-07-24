import { compileDraftMaterial, materialRefForDraft } from "../../domain/sessionMaterialBank";
import { parseReconstructionPackJson } from "../../domain/packLoader";
import type { ReconstructionPack } from "../../domain/reconstructionPack";
import { createIncompleteSession } from "../../demo/productionMutations";
import type { ProductionSession } from "../../domain/sessionTypes";
import type { LayerId, NoteEvent, PatternDraft } from "../../types";

const SHIKI_PUBLIC_PACK_ID = "shiki-no-uta-cover-public-demo-v1";

export type WorkspaceBleed = "low" | "medium" | "high";
export type AudioAuthority = "clip-preview" | "workspace-preview" | "shared-master";

export interface MusicalDomainEvent {
  type: string;
  at: string;
  detail: string;
}

export interface DraftEditResult {
  changed: boolean;
  draftId: string;
  revision: number;
  fingerprint: string;
}

const DEMO_WORKSPACE_DRAFT = "midi-opening-bass";

function bumpRevision(draft: PatternDraft): void {
  draft.revision = (draft.revision ?? 0) + 1;
}

function cloneDraft(source: PatternDraft, nextId: string, title: string): PatternDraft {
  return {
    ...structuredClone(source),
    id: nextId,
    title,
    status: "editing",
    revision: (source.revision ?? 0) + 1,
  };
}

export class MusicalDomainStore {
  private pack: ReconstructionPack | null = null;
  private session: ProductionSession | null = null;
  private bleed: WorkspaceBleed = "low";
  private authority: AudioAuthority = "clip-preview";
  private activeMasterDraftId: string | null = null;
  private workspaceDraftId: string | null = null;
  readonly eventLog: MusicalDomainEvent[] = [];
  private listeners = new Set<() => void>();

  getPack(): ReconstructionPack | null {
    return this.pack;
  }

  getSession(): ProductionSession | null {
    return this.session;
  }

  getBleed(): WorkspaceBleed {
    return this.bleed;
  }

  getAuthority(): AudioAuthority {
    return this.authority;
  }

  getActiveMasterDraftId(): string | null {
    return this.activeMasterDraftId;
  }

  getWorkspaceDraftId(): string | null {
    return this.workspaceDraftId;
  }

  loadPackJson(json: string): ReconstructionPack {
    const pack = parseReconstructionPackJson(json);
    if (pack.metadata.id !== SHIKI_PUBLIC_PACK_ID) {
      throw new Error(`Expected public pack ${SHIKI_PUBLIC_PACK_ID}, got ${pack.metadata.id}`);
    }
    this.pack = pack;
    this.session = createIncompleteSession(pack);
    this.seedWorkspaceDraft(DEMO_WORKSPACE_DRAFT);
    this.log("pack-loaded", `Loaded ${pack.metadata.id} · ${pack.drafts.length} drafts`);
    return pack;
  }

  restart(): void {
    if (!this.pack) return;
    this.session = createIncompleteSession(this.pack);
    this.bleed = "low";
    this.authority = "clip-preview";
    this.activeMasterDraftId = null;
    this.seedWorkspaceDraft(DEMO_WORKSPACE_DRAFT);
    this.eventLog.length = 0;
    this.log("restart", "Sparse session restored");
  }

  private seedWorkspaceDraft(draftId: string): void {
    if (!this.pack || !this.session) return;
    const source = this.pack.drafts.find((d) => d.id === draftId);
    if (!source) return;
    this.session.drafts[draftId] = {
      ...structuredClone(source),
      status: "editing",
      revision: source.revision ?? 0,
    };
    this.workspaceDraftId = draftId;
  }

  forkDraft(sourceDraftId: string, nextDraftId: string, title: string): string | null {
    if (!this.session) return null;
    const source = this.session.drafts[sourceDraftId];
    if (!source) return null;
    const fork = cloneDraft(source, nextDraftId, title);
    this.session.drafts[nextDraftId] = fork;
    this.log("fork", `${sourceDraftId} → ${nextDraftId} @ r${fork.revision}`);
    return nextDraftId;
  }

  assignDraftToWorkspace(draftId: string): boolean {
    if (!this.session?.drafts[draftId]) return false;
    this.workspaceDraftId = draftId;
    this.authority = "workspace-preview";
    this.log("workspace-assign", `Editing ${draftId}`);
    return true;
  }

  activateSharedMaster(draftId: string, startBar = 0): boolean {
    if (!this.session?.drafts[draftId] || !this.pack) return false;
    const draft = this.session.drafts[draftId];
    const scene = this.session.scenes.find((s) => s.startBar === startBar) ?? this.session.scenes[0];
    if (!scene) return false;

    for (const id of this.collectPlacementDraftIds()) {
      this.hydrateDraftFromPack(id);
    }

    for (const sessionScene of this.session.scenes) {
      const hints = this.pack.scenePlacements[sessionScene.id] ?? {};
      for (const [layer, placementDraftId] of Object.entries(hints)) {
        if (!placementDraftId) continue;
        const useDraftId =
          sessionScene.id === scene.id && layer === draft.kind ? draftId : placementDraftId;
        const layerDraft = this.session.drafts[useDraftId];
        if (!layerDraft) continue;
        sessionScene.layers[layer as LayerId] = materialRefForDraft(layerDraft);
      }

      const stackHints = this.pack.sceneLayerStacks?.[sessionScene.id] ?? {};
      sessionScene.layerStacks ??= {};
      for (const [layer, draftIds] of Object.entries(stackHints)) {
        const refs = draftIds.flatMap((id) => {
          const layerDraft = this.session!.drafts[id];
          return layerDraft ? [materialRefForDraft(layerDraft)] : [];
        });
        if (refs.length) sessionScene.layerStacks[layer as LayerId] = refs;
      }
    }

    this.session.arrangement.scenes = this.session.scenes
      .filter(
        (s) =>
          Object.values(s.layers).some((ref) => ref !== null)
          || Object.values(s.layerStacks ?? {}).some((refs) => refs && refs.length > 0),
      )
      .map((s) => ({ sceneId: s.id, startBar: s.startBar }));

    this.activeMasterDraftId = draftId;
    this.authority = "shared-master";
    this.bleed = "low";
    const layerCount = Object.values(scene.layers).filter(Boolean).length;
    const stackCount = Object.values(scene.layerStacks ?? {}).reduce((n, refs) => n + (refs?.length ?? 0), 0);
    this.log(
      "activate-master",
      `${draftId} r${draft.revision} → ${draft.kind} @ bar ${scene.startBar} · ${layerCount} layers · ${stackCount} stack refs`,
    );
    return true;
  }

  private collectPlacementDraftIds(): Set<string> {
    const ids = new Set<string>();
    if (!this.pack) return ids;
    for (const placement of Object.values(this.pack.scenePlacements)) {
      for (const draftId of Object.values(placement)) {
        if (draftId) ids.add(draftId);
      }
    }
    if (this.pack.sceneLayerStacks) {
      for (const stacks of Object.values(this.pack.sceneLayerStacks)) {
        for (const draftIds of Object.values(stacks)) {
          for (const id of draftIds ?? []) ids.add(id);
        }
      }
    }
    return ids;
  }

  private hydrateDraftFromPack(draftId: string): void {
    if (!this.pack || !this.session) return;
    const source = this.pack.drafts.find((d) => d.id === draftId);
    if (!source) return;
    const existing = this.session.drafts[draftId];
    if (existing && (existing.notes?.length || existing.drumHits?.length || existing.harmonyChords?.length)) {
      return;
    }
    this.session.drafts[draftId] = {
      ...structuredClone(source),
      status: existing?.status ?? "ready",
      revision: existing?.revision ?? source.revision ?? 0,
    };
  }

  setBleed(level: WorkspaceBleed): void {
    this.bleed = level;
    this.log("bleed", `Workspace bleed ${level}`);
  }

  draftForId(draftId: string | null | undefined): PatternDraft | undefined {
    if (!draftId || !this.session) return undefined;
    return this.session.drafts[draftId];
  }

  workspaceDraft(): PatternDraft | undefined {
    return this.draftForId(this.workspaceDraftId);
  }

  moveNoteStep(draftId: string, noteId: string, step: number): DraftEditResult | null {
    const draft = this.draftForId(draftId);
    const note = draft?.notes?.find((n) => n.id === noteId);
    if (!draft || !note || note.step === step) return null;
    note.step = Math.max(0, Math.min(15, step));
    bumpRevision(draft);
    const after = compileDraftMaterial(draft);
    this.log("move-note", `${noteId} → step ${note.step} · r${draft.revision}`);
    return { changed: true, draftId, revision: draft.revision ?? 0, fingerprint: after.contentFingerprint };
  }

  setNoteVelocity(draftId: string, noteId: string, velocity: number): DraftEditResult | null {
    const draft = this.draftForId(draftId);
    const note = draft?.notes?.find((n) => n.id === noteId);
    if (!draft || !note) return null;
    const clamped = Math.max(0.05, Math.min(1, velocity));
    if (note.velocity === clamped) return null;
    note.velocity = clamped;
    bumpRevision(draft);
    const after = compileDraftMaterial(draft);
    this.log("set-velocity", `${noteId} → ${clamped.toFixed(2)} · r${draft.revision}`);
    return { changed: true, draftId, revision: draft.revision ?? 0, fingerprint: after.contentFingerprint };
  }

  insertNoteFromPack(draftId: string, noteIndex = 0): DraftEditResult | null {
    if (!this.pack || !this.session) return null;
    const draft = this.session.drafts[draftId];
    const src = this.pack.drafts.find((d) => d.id === draftId)?.notes?.[noteIndex];
    if (!draft || !src || draft.notes?.some((n) => n.id === src.id)) return null;
    draft.notes = [...(draft.notes ?? []), structuredClone(src) as NoteEvent];
    bumpRevision(draft);
    const after = compileDraftMaterial(draft);
    this.log("insert-note", `${src.id} · r${draft.revision}`);
    return { changed: true, draftId, revision: draft.revision ?? 0, fingerprint: after.contentFingerprint };
  }

  toggleStep(draftId: string, step: number): DraftEditResult | null {
    const draft = this.draftForId(draftId);
    if (!draft) return null;
    const steps = new Set(draft.steps ?? []);
    if (steps.has(step)) steps.delete(step);
    else steps.add(step);
    draft.steps = [...steps].sort((a, b) => a - b);
    bumpRevision(draft);
    const after = compileDraftMaterial(draft);
    this.log("toggle-step", `step ${step} · r${draft.revision}`);
    return { changed: true, draftId, revision: draft.revision ?? 0, fingerprint: after.contentFingerprint };
  }

  deviceMixPatch(deviceId: string, normalized: number): Partial<import("../../types").MixParams> | null {
    if (deviceId === "filter") return { filter: 200 + normalized * 7800 };
    if (deviceId === "delay") return { delayWet: normalized * 0.65 };
    if (deviceId === "reverb") return { reverbWet: normalized * 0.85 };
    return null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  private log(type: string, detail: string): void {
    this.eventLog.unshift({ type, at: new Date().toISOString(), detail });
    if (this.eventLog.length > 32) this.eventLog.length = 32;
    this.notify();
  }
}

export const musicalDomain = new MusicalDomainStore();
