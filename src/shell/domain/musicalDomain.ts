import { compileDraftMaterial, materialRefForDraft } from "../../domain/sessionMaterialBank";
import { parseReconstructionPackJson } from "../../domain/packLoader";
import type { ReconstructionPack } from "../../domain/reconstructionPack";
import { createIncompleteSession } from "../../demo/productionMutations";
import type { ProductionSession } from "../../domain/sessionTypes";
import type { LayerId, NoteEvent, PatternDraft } from "../../types";
import {
  adaptLiveCollabPack,
  buildScenePlacementMaps,
  filterTrackPlacements,
  type TrackPlacementMap,
} from "../../domain/liveCollabSessionAdapter";
import { parseLiveCollabPackJson, type LiveCollabPack, type LiveCollabPackMode } from "../../domain/liveCollabPack";
import {
  SHIKI_SEVEN_TRACK_IDS,
  SHIKI_SEVEN_TRACK_INSTRUMENTS,
  type ShikiSevenTrackId,
} from "../../domain/shikiSevenTracks";

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

export interface MasterTrackPlacement {
  sceneId: string;
  draftId: string;
  revision: number;
  source: "layer" | "stack";
  eventCount: number;
}

export interface MasterTrackInventoryEntry {
  trackId: ShikiSevenTrackId;
  instrument: string;
  label: string;
  layerKind: string;
  packClipSources: string[];
  activePlacements: MasterTrackPlacement[];
  audibleInPayoff: boolean;
}

export interface ActiveMasterTrackSummary {
  trackId: string;
  instrument: string;
  draftId: string;
  revision: number;
  sceneId: string;
}

function countDraftEvents(draft: PatternDraft): number {
  if (draft.notes?.length) return draft.notes.length;
  if (draft.drumHits?.length) return draft.drumHits.length;
  if (draft.harmonyChords?.length) {
    return draft.harmonyChords.reduce((sum, chord) => sum + chord.notes.length, 0);
  }
  return 0;
}

const DEMO_WORKSPACE_DRAFT = "midi-opening-bass";

function trackIdsFromActiveLanes(activeLanes: ReadonlySet<ShikiSevenTrackId>): ShikiSevenTrackId[] {
  return SHIKI_SEVEN_TRACK_IDS.filter((trackId) => activeLanes.has(trackId));
}

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
  private liveCollabPack: LiveCollabPack | null = null;
  private packMode: LiveCollabPackMode = "public";
  private trackPlacements: TrackPlacementMap = {};
  private activeLanes = new Set<ShikiSevenTrackId>();
  private session: ProductionSession | null = null;
  private bleed: WorkspaceBleed = "low";
  private authority: AudioAuthority = "clip-preview";
  private activeMasterDraftId: string | null = null;
  private workspaceDraftId: string | null = null;
  private restartEpoch = 0;
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

  getRestartEpoch(): number {
    return this.restartEpoch;
  }

  getWorkspaceDraftId(): string | null {
    return this.workspaceDraftId;
  }

  getPackMode(): LiveCollabPackMode {
    return this.packMode;
  }

  getActiveLanes(): ReadonlySet<ShikiSevenTrackId> {
    return this.activeLanes;
  }

  getLiveCollabPack(): LiveCollabPack | null {
    return this.liveCollabPack;
  }

  loadPackJson(json: string): ReconstructionPack {
    const pack = parseReconstructionPackJson(json);
    if (pack.metadata.id !== SHIKI_PUBLIC_PACK_ID) {
      throw new Error(`Expected public pack ${SHIKI_PUBLIC_PACK_ID}, got ${pack.metadata.id}`);
    }
    this.packMode = "public";
    this.liveCollabPack = null;
    this.trackPlacements = {};
    this.activeLanes.clear();
    this.pack = pack;
    this.session = createIncompleteSession(pack);
    this.seedWorkspaceDraft(DEMO_WORKSPACE_DRAFT);
    this.log("pack-loaded", `Loaded ${pack.metadata.id} · ${pack.drafts.length} drafts`);
    return pack;
  }

  loadLiveCollabPackJson(json: string): LiveCollabPack {
    const livePack = parseLiveCollabPackJson(json);
    const { pack, trackPlacements } = adaptLiveCollabPack(livePack);
    this.packMode = "live-collab";
    this.liveCollabPack = livePack;
    this.trackPlacements = trackPlacements;
    this.activeLanes.clear();
    this.pack = pack;
    this.session = createIncompleteSession(pack);
    this.seedWorkspaceDraft("kai-lh-sparse-4");
    this.log("pack-loaded", `Loaded ${livePack.id} · ${livePack.loopUnits.length} loop units`);
    return livePack;
  }

  restart(): void {
    if (!this.pack) return;
    this.restartEpoch += 1;
    this.session = createIncompleteSession(this.pack);
    this.bleed = "low";
    this.authority = "clip-preview";
    this.activeMasterDraftId = null;
    this.activeLanes.clear();
    this.seedWorkspaceDraft(this.packMode === "live-collab" ? "kai-lh-sparse-4" : DEMO_WORKSPACE_DRAFT);
    this.eventLog.length = 0;
    this.log("restart", `Sparse session restored · epoch ${this.restartEpoch}`);
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
    if (!this.session || !this.pack) return false;
    if (this.packMode === "live-collab") {
      void draftId;
      void startBar;
      return this.activateAllLanes();
    }
    if (!this.session.drafts[draftId]) return false;
    const draft = this.session.drafts[draftId];
    const scene = this.session.scenes.find((s) => s.startBar === startBar) ?? this.session.scenes[0];
    if (!scene) return false;

    for (const id of this.collectPlacementDraftIds()) {
      this.hydrateDraftFromPack(id);
    }

    this.applyPackPlacementsToSession(draftId, scene.id, draft.kind);
    this.finalizeSharedMasterActivation(draftId, draft.revision ?? 0, scene);
    return true;
  }

  activateLane(trackId: ShikiSevenTrackId, draftId?: string): boolean {
    if (this.packMode !== "live-collab" || !this.pack || !this.session) return false;
    if (!(SHIKI_SEVEN_TRACK_IDS as readonly string[]).includes(trackId)) return false;
    this.activeLanes.add(trackId);
    if (draftId) this.hydrateDraftFromPack(draftId);
    return this.rebuildArrangementFromActiveLanes(draftId ? { [trackId]: draftId } : undefined);
  }

  activateAllLanes(): boolean {
    if (this.packMode !== "live-collab" || !this.pack || !this.session) return false;
    for (const trackId of SHIKI_SEVEN_TRACK_IDS) this.activeLanes.add(trackId);
    return this.rebuildArrangementFromActiveLanes();
  }

  private rebuildArrangementFromActiveLanes(
    overrides?: Partial<Record<ShikiSevenTrackId, string>>,
  ): boolean {
    if (!this.pack || !this.session || this.packMode !== "live-collab") return false;

    const filtered = filterTrackPlacements(this.trackPlacements, this.activeLanes);
    for (const placements of Object.values(filtered)) {
      for (const unitId of Object.values(placements)) {
        if (unitId) this.hydrateDraftFromPack(unitId);
      }
    }
    if (overrides) {
      for (const draftId of Object.values(overrides)) {
        if (draftId) this.hydrateDraftFromPack(draftId);
      }
    }

    const { scenePlacements, sceneLayerStacks } = buildScenePlacementMaps(filtered);
    for (const sessionScene of this.session.scenes) {
      sessionScene.layers = { drums: null, bass: null, harmony: null, melody: null, texture: null };
      sessionScene.layerStacks = {};
      const hints = scenePlacements[sessionScene.id] ?? {};
      for (const [layer, placementDraftId] of Object.entries(hints)) {
        if (!placementDraftId) continue;
        const layerDraft = this.session.drafts[placementDraftId];
        if (!layerDraft) continue;
        sessionScene.layers[layer as LayerId] = materialRefForDraft(layerDraft);
      }
      const stackHints = sceneLayerStacks[sessionScene.id] ?? {};
      for (const [layer, draftIds] of Object.entries(stackHints)) {
        const refs = draftIds.flatMap((id) => {
          const layerDraft = this.session!.drafts[id];
          return layerDraft ? [materialRefForDraft(layerDraft)] : [];
        });
        if (refs.length) sessionScene.layerStacks[layer as LayerId] = refs;
      }
    }

    if (overrides) {
      const opening = this.session.scenes.find((scene) => scene.id === "opening") ?? this.session.scenes[0];
      if (opening) {
        for (const [trackId, overrideDraftId] of Object.entries(overrides)) {
          if (!overrideDraftId) continue;
          const layerDraft = this.session.drafts[overrideDraftId];
          if (!layerDraft) continue;
          const layer = this.layerForTrack(trackId as ShikiSevenTrackId);
          if (layer === "bass" && trackId === "track-piano-lh") {
            opening.layerStacks ??= {};
            opening.layerStacks.bass = [materialRefForDraft(layerDraft)];
          } else if (layer === "melody" && trackId !== "track-tenor") {
            opening.layerStacks ??= {};
            const stack = opening.layerStacks.melody ?? [];
            opening.layerStacks.melody = [...stack.filter((ref) => ref.draftId !== overrideDraftId), materialRefForDraft(layerDraft)];
          } else {
            opening.layers[layer] = materialRefForDraft(layerDraft);
          }
        }
      }
    }

    this.session.arrangement.scenes = this.session.scenes
      .filter(
        (s) =>
          Object.values(s.layers).some((ref) => ref !== null)
          || Object.values(s.layerStacks ?? {}).some((refs) => refs && refs.length > 0),
      )
      .map((s) => ({ sceneId: s.id, startBar: s.startBar }));

    this.activeMasterDraftId = overrides
      ? Object.values(overrides)[0] ?? `${trackIdsFromActiveLanes(this.activeLanes)[0]}-lane`
      : `${this.activeLanes.size}-lanes`;
    this.authority = "shared-master";
    this.bleed = "low";
    const audible = this.getSevenTrackMasterInventory().filter((track) => track.audibleInPayoff).length;
    this.log(
      "activate-lane",
      `${[...this.activeLanes].join(", ")} · ${audible}/7 tracks audible`,
    );
    return true;
  }

  private applyPackPlacementsToSession(
    stagedDraftId: string,
    stagedSceneId: string,
    stagedKind: PatternDraft["kind"],
  ): void {
    if (!this.pack || !this.session) return;
    for (const sessionScene of this.session.scenes) {
      const hints = this.pack.scenePlacements[sessionScene.id] ?? {};
      for (const [layer, placementDraftId] of Object.entries(hints)) {
        if (!placementDraftId) continue;
        const useDraftId =
          sessionScene.id === stagedSceneId && layer === stagedKind ? stagedDraftId : placementDraftId;
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
  }

  private finalizeSharedMasterActivation(draftId: string, revision: number, scene: ProductionSession["scenes"][number]): void {
    this.session!.arrangement.scenes = this.session!.scenes
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
      `${draftId} r${revision} → @ bar ${scene.startBar} · ${layerCount} layers · ${stackCount} stack refs · tracks ${this.getSevenTrackMasterInventory().filter((t) => t.audibleInPayoff).length}/7`,
    );
  }

  private layerForTrack(trackId: ShikiSevenTrackId): LayerId {
    switch (trackId) {
      case "track-drums":
        return "drums";
      case "track-piano-rh":
        return "harmony";
      case "track-bass":
      case "track-piano-lh":
        return "bass";
      default:
        return "melody";
    }
  }

  getSevenTrackMasterInventory(): MasterTrackInventoryEntry[] {
    if (!this.pack || !this.session) return [];
    const resolveSourceDraftId = (draftId: string): string => {
      const forkMatch = draftId.match(/^(.+)-fork-\d+$/);
      return forkMatch?.[1] ?? draftId;
    };
    const trackForDraftId = (draftId: string): ShikiSevenTrackId | null => {
      const sourceId = resolveSourceDraftId(draftId);
      const track = this.pack!.tracks.find((entry) => entry.draftIds.includes(sourceId));
      if (!track || !(SHIKI_SEVEN_TRACK_IDS as readonly string[]).includes(track.id)) return null;
      return track.id as ShikiSevenTrackId;
    };
    return SHIKI_SEVEN_TRACK_IDS.map((trackId) => {
      const track = this.pack!.tracks.find((entry) => entry.id === trackId);
      const packClipSources = track?.draftIds ?? [];
      const activePlacements: MasterTrackPlacement[] = [];
      for (const sessionScene of this.session!.scenes) {
        const pushRef = (draftId: string | undefined, source: "layer" | "stack") => {
          if (!draftId || trackForDraftId(draftId) !== trackId) return;
          const layerDraft = this.session!.drafts[draftId];
          if (!layerDraft) return;
          activePlacements.push({
            sceneId: sessionScene.id,
            draftId,
            revision: layerDraft.revision ?? 0,
            source,
            eventCount: countDraftEvents(layerDraft),
          });
        };
        for (const ref of Object.values(sessionScene.layers)) {
          pushRef(ref?.draftId, "layer");
        }
        for (const refs of Object.values(sessionScene.layerStacks ?? {})) {
          for (const ref of refs ?? []) pushRef(ref?.draftId, "stack");
        }
      }
      return {
        trackId,
        instrument: SHIKI_SEVEN_TRACK_INSTRUMENTS[trackId],
        label: track?.label ?? trackId,
        layerKind: track?.layerKind ?? "unknown",
        packClipSources,
        activePlacements,
        audibleInPayoff: activePlacements.some((placement) => placement.eventCount > 0),
      };
    });
  }

  getActiveMasterTracksList(): ActiveMasterTrackSummary[] {
    const opening = this.session?.scenes.find((scene) => scene.id === "opening") ?? this.session?.scenes[0];
    if (!opening) return [];
    const seen = new Set<string>();
    const rows: ActiveMasterTrackSummary[] = [];
    const push = (draftId: string | undefined) => {
      if (!draftId || seen.has(draftId) || !this.pack) return;
      const track = this.pack.tracks.find((entry) => entry.draftIds.includes(draftId));
      if (!track || !(SHIKI_SEVEN_TRACK_IDS as readonly string[]).includes(track.id)) return;
      seen.add(draftId);
      rows.push({
        trackId: track.id,
        instrument: SHIKI_SEVEN_TRACK_INSTRUMENTS[track.id as ShikiSevenTrackId],
        draftId,
        revision: this.session!.drafts[draftId]?.revision ?? 0,
        sceneId: opening.id,
      });
    };
    for (const ref of Object.values(opening.layers)) push(ref?.draftId);
    for (const refs of Object.values(opening.layerStacks ?? {})) {
      for (const ref of refs ?? []) push(ref?.draftId);
    }
    return rows;
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
    if (deviceId === "desk-rhythm-delay") return { desk: { rhythm: { delaySend: normalized * 0.35 } } };
    if (deviceId === "desk-keys-delay") return { desk: { keys: { delaySend: normalized * 0.45 } } };
    if (deviceId === "desk-horns-delay") return { desk: { horns: { delaySend: normalized * 0.65 } } };
    if (deviceId === "desk-guitar-delay") return { desk: { guitar: { delaySend: normalized * 0.55 } } };
    if (deviceId === "desk-horns-reverb") return { desk: { horns: { reverbSend: normalized * 0.5 } } };
    return null;
  }

  deskBusPatch(
    desk: import("../../types").DeskBusId,
    params: import("../../types").DeskBusParams,
  ): Partial<import("../../types").MixParams> {
    return { desk: { [desk]: params } };
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
