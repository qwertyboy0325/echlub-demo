import * as Tone from "tone";
import { AudioEngine } from "../../audioEngine";
import { materialRefForDraft } from "../../domain/sessionMaterialBank";
import { compileSessionMaterialBank } from "../../domain/sessionMaterialBank";
import { dockUpdatesFromMix, mixPatchFromDockParam } from "./dockMixSync";
import { musicalDomain, type MusicalDomainStore } from "../domain/musicalDomain";
import type { ShellCommand, ShellState } from "../domain/shellTypes";
import { shellStore } from "../domain/shellStore";

type ShellListener = (state: ShellState) => void;

function publicPackUrl(): string {
  const path = `${import.meta.env.BASE_URL}shiki-no-uta.demo.pack.json`;
  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin).href;
  }
  return path;
}

export interface ShellAudioAdapterEvidence {
  packSha256?: string;
  packLoaded: boolean;
  audioReady: boolean;
  transportState: string;
  cueActive: boolean;
  activeMasterDraftId: string | null;
  domainEvents: number;
}

export class ShellAudioAdapter {
  private engine: AudioEngine | null = null;
  private initialized = false;
  private initToken: { cancelled: boolean } | null = null;
  private initPromise: Promise<void> | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastTransportPlaying = false;
  private pendingPreviewDraftId: string | null = null;
  private readyListeners = new Set<() => void>();
  readonly evidence: ShellAudioAdapterEvidence = {
    packLoaded: false,
    audioReady: false,
    transportState: "stopped",
    cueActive: false,
    activeMasterDraftId: null,
    domainEvents: 0,
  };

  constructor(private readonly domain: MusicalDomainStore = musicalDomain) {}

  isAudioReady(): boolean {
    return this.evidence.audioReady;
  }

  subscribeReady(listener: () => void): () => void {
    this.readyListeners.add(listener);
    return () => this.readyListeners.delete(listener);
  }

  initialize(): Promise<void> {
    if (this.initialized && this.engine) {
      this.syncTransportFromStore();
      return Promise.resolve();
    }
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initializeInternal().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async initializeInternal(): Promise<void> {
    if (this.initialized) return;
    const token = { cancelled: false };
    if (this.initToken) this.initToken.cancelled = true;
    this.initToken = token;
    const response = await fetch(publicPackUrl(), { cache: "no-store" });
    if (token.cancelled) return;
    if (!response.ok) throw new Error(`Failed to load public pack: ${response.status}`);
    const json = await response.text();
    if (token.cancelled) return;
    const pack = this.domain.loadPackJson(json);
    this.evidence.packLoaded = true;
    this.notifyReady();
    const engine = new AudioEngine({
      onStep: (bar, beat, sixteenth) => {
        shellStore.dispatch({
          type: "SYNC_TRANSPORT",
          bar,
          beat,
          sixteenth,
          playing: Tone.getTransport().state === "started",
        });
      },
      onFinished: () => {
        shellStore.dispatch({ type: "SYNC_TRANSPORT", bar: 0, beat: 0, sixteenth: 0, playing: false });
      },
      onBoundary: (bar) => {
        this.evidence.domainEvents += 1;
        void bar;
      },
    });
    if (token.cancelled) {
      engine.dispose();
      return;
    }
    engine.setSoundDesign(pack.soundDesign);
    engine.setBaseBpm(pack.metadata.bpm);
    engine.setTempoMap(pack.tempoMap);
    engine.setTotalBars(pack.arrangement.totalBars);
    if (token.cancelled) {
      engine.dispose();
      return;
    }
    await engine.initialize();
    if (token.cancelled) {
      engine.dispose();
      return;
    }
    this.engine = engine;
    this.publishBank("production", { resetMix: true });
    this.unsubscribe = shellStore.subscribe((state) => this.onShellState(state));
    this.initialized = true;
    this.evidence.audioReady = true;
    this.syncTransportFromStore();
    this.notifyReady();
    if (import.meta.env.DEV) {
      console.info("[shell-audio] ready · pack loaded · engine initialized");
    }
    exposeShellAudioDiagnostics(this);
    const pending = this.pendingPreviewDraftId;
    this.pendingPreviewDraftId = null;
    if (pending) void this.playPreviewDraft(pending);
  }

  dispose(): void {
    if (this.initToken) this.initToken.cancelled = true;
    this.initToken = null;
    this.initPromise = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.engine?.dispose();
    this.engine = null;
    this.initialized = false;
    this.lastTransportPlaying = false;
    this.pendingPreviewDraftId = null;
    this.evidence.packLoaded = false;
    this.evidence.audioReady = false;
    this.notifyReady();
  }

  private syncTransportFromStore(): void {
    const { transportPlaying } = shellStore.getState();
    this.lastTransportPlaying = transportPlaying;
    // Resume engine only — AudioContext must already be unlocked from the Play click.
    if (transportPlaying) {
      void this.applyTransportPlaying(true);
    }
  }

  getEngine(): AudioEngine | null {
    return this.engine;
  }

  private onShellState(state: ShellState): void {
    if (!this.engine) return;
    if (state.transportPlaying !== this.lastTransportPlaying) {
      this.lastTransportPlaying = state.transportPlaying;
      void this.applyTransportPlaying(state.transportPlaying);
    }
    this.evidence.transportState = this.engine.state;
    this.evidence.cueActive = this.engine.isCueActive();
    this.evidence.activeMasterDraftId = this.domain.getActiveMasterDraftId();
    this.evidence.domainEvents = this.domain.eventLog.length;
  }

  private async applyTransportPlaying(playing: boolean): Promise<void> {
    if (!this.engine) return;
    if (playing) {
      if (this.domain.getAuthority() === "shared-master") {
        this.engine.setCurrentAct("livePerformance");
        this.publishBank("livePerformance");
      }
      this.engine.start();
    } else {
      this.engine.pause();
    }
  }

  handleCommand(command: ShellCommand, before: ShellState, after: ShellState): void {
    if (command.type === "TOGGLE_TRANSPORT") {
      if (after.transportPlaying && !before.transportPlaying) {
        void Tone.start();
      }
      return;
    }
    if (command.type === "PREVIEW_WORKSPACE") {
      void Tone.start();
      if (!this.engine) {
        this.pendingPreviewDraftId = command.draftId;
        return;
      }
      this.previewDraft(command.draftId);
      return;
    }
    if (!this.engine) return;
    switch (command.type) {
      case "EDIT_NOTE_STEP":
        this.applyDraftEdit(this.domain.moveNoteStep(command.draftId, command.noteId, command.step));
        break;
      case "SET_NOTE_VELOCITY":
        this.applyDraftEdit(this.domain.setNoteVelocity(command.draftId, command.noteId, command.velocity));
        break;
      case "INSERT_NOTE":
        this.applyDraftEdit(this.domain.insertNoteFromPack(command.draftId, command.noteIndex));
        break;
      case "TOGGLE_STEP":
        this.applyDraftEdit(this.domain.toggleStep(command.draftId, command.step));
        break;
      case "SET_DEVICE_PARAM": {
        const patch = this.domain.deviceMixPatch(command.deviceId, command.value);
        if (patch) {
          this.engine.setMixParams(patch, 0.18);
          this.syncDockFromMix(after);
        }
        break;
      }
      case "SET_DOCK_VALUE": {
        const slot = after.dockSlots[command.slotIndex];
        if (!slot?.mapped || !slot.sourceParam) break;
        const patch = mixPatchFromDockParam(slot.sourceParam, command.value);
        if (patch) {
          this.engine.setMixParams(patch, 0.12);
          this.syncDockFromMix(after);
        }
        break;
      }
      case "FORK_CLIP": {
        const fork = after.exchangeClips.find((c) => c.forkOf === command.clipId);
        const source = before.exchangeClips.find((c) => c.id === command.clipId);
        if (fork?.draftId && source?.draftId) {
          this.domain.forkDraft(source.draftId, fork.draftId, fork.title);
          this.domain.assignDraftToWorkspace(fork.draftId);
        }
        break;
      }
      case "CLAIM_CLIP": {
        const clip = after.exchangeClips.find((c) => c.id === command.clipId);
        if (clip?.draftId) this.domain.assignDraftToWorkspace(clip.draftId);
        break;
      }
      case "SHARE_CLIP": {
        const clip = after.exchangeClips[after.exchangeClips.length - 1];
        if (clip?.draftId) this.domain.setBleed("low");
        break;
      }
      case "ACTIVATE_SLOT": {
        const slot = after.arrangementSlots.find((s) => s.id === command.slotId);
        const clip = slot?.clipId ? after.exchangeClips.find((c) => c.id === slot.clipId) : undefined;
        if (clip?.draftId) {
          this.domain.activateSharedMaster(clip.draftId, 0);
          this.publishBank("livePerformance");
          this.engine.setCurrentAct("livePerformance");
        }
        break;
      }
      case "RESTART_SESSION":
        this.engine.stop();
        this.engine.clearArrangementSceneBoundaries();
        this.domain.restart();
        this.publishBank("production", { resetMix: true });
        break;
      default:
        break;
    }
  }

  private applyDraftEdit(result: ReturnType<MusicalDomainStore["moveNoteStep"]>): void {
    if (!result || !this.engine) return;
    this.publishBank(
      this.domain.getAuthority() === "shared-master" ? "livePerformance" : "production",
      { resetMix: false },
    );
    const draft = this.domain.draftForId(result.draftId);
    if (draft) {
      void Tone.start();
      void this.playDraftCue(draft.id);
    }
  }

  private async playDraftCue(draftId: string): Promise<void> {
    await Tone.start();
    if (!this.engine) return;
    this.publishBank(this.domain.getAuthority() === "shared-master" ? "livePerformance" : "production", { resetMix: false });
    const draft = this.domain.draftForId(draftId);
    if (draft) this.engine.startPrivateCue(materialRefForDraft(draft));
  }

  previewDraft(draftId: string): void {
    void Tone.start();
    void this.playPreviewDraft(draftId);
  }

  private async playPreviewDraft(draftId: string): Promise<void> {
    await Tone.start();
    if (!this.engine) {
      this.pendingPreviewDraftId = draftId;
      return;
    }
    const draft = this.domain.draftForId(draftId);
    if (!draft) return;
    this.publishBank("production", { resetMix: false });
    this.engine.startPrivateCue(materialRefForDraft(draft));
  }

  private notifyReady(): void {
    this.readyListeners.forEach((listener) => listener());
  }

  private publishBank(act: "production" | "livePerformance", options?: { resetMix?: boolean }): void {
    const session = this.domain.getSession();
    if (!session || !this.engine) return;
    const bank = compileSessionMaterialBank(session);
    this.engine.setMaterialBank(bank);
    if (options?.resetMix !== false) {
      this.engine.setBaselineMix(session.mix);
    }
    this.engine.setCurrentAct(act);
    if (act === "livePerformance") {
      const boundaries = session.scenes
        .filter((scene) => session.arrangement.scenes.some((entry) => entry.sceneId === scene.id))
        .map((scene) => ({ startBar: scene.startBar, scene }));
      this.engine.setArrangementSceneBoundaries(boundaries);
      const opening = session.scenes.find((scene) => scene.id === "opening") ?? session.scenes[0];
      if (opening) this.engine.activateSceneAtBoundary(opening);
    } else {
      this.engine.clearArrangementSceneBoundaries();
    }
  }

  private syncDockFromMix(state: ShellState): void {
    if (!this.engine) return;
    const updates = dockUpdatesFromMix(state, this.engine.getMix());
    if (!updates.length) return;
    shellStore.dispatch({ type: "SYNC_DOCK_FROM_MIX", updates });
  }
}

export const shellAudioAdapter = new ShellAudioAdapter();

export function bindShellAudioAdapter(): () => void {
  let prior = shellStore.getState();
  const listener: ShellListener = (next) => {
    // Commands are applied by intercepting dispatch — see shellCommands wrapper.
    void prior;
    void next;
  };
  const unsub = shellStore.subscribe(listener);
  return unsub;
}

let dispatchBridgeInstalled = false;

export function installShellAudioDispatchBridge(): () => void {
  if (dispatchBridgeInstalled) return () => {};
  dispatchBridgeInstalled = true;
  const original = shellStore.dispatch.bind(shellStore);
  shellStore.dispatch = (command: ShellCommand) => {
    const before = shellStore.getState();
    original(command);
    shellAudioAdapter.handleCommand(command, before, shellStore.getState());
  };
  return () => {
    shellStore.dispatch = original;
    dispatchBridgeInstalled = false;
  };
}

if (typeof window !== "undefined") {
  installShellAudioDispatchBridge();
}

function exposeShellAudioDiagnostics(adapter: ShellAudioAdapter): void {
  if (typeof window === "undefined") return;
  const globalWindow = window as typeof window & {
    __shellAudioEvidence?: () => Record<string, unknown>;
    __startShellAudioCapture?: () => void;
    __stopShellAudioCapture?: () => Promise<{ byteLength: number; base64: string }>;
    __phase4AudioCapture?: {
      recorder: MediaRecorder;
      chunks: Blob[];
      disconnect: () => void;
    };
  };
  globalWindow.__startShellAudioCapture = () => {
    const engine = adapter.getEngine();
    if (!engine) throw new Error("AudioEngine not ready");
    const rawContext = Tone.getContext().rawContext as AudioContext;
    const destination = rawContext.createMediaStreamDestination();
    const disconnect = engine.connectMasterTap(destination);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    globalWindow.__phase4AudioCapture = { recorder, chunks, disconnect };
    recorder.start(250);
  };
  globalWindow.__stopShellAudioCapture = async () => {
    const bag = globalWindow.__phase4AudioCapture;
    if (!bag) throw new Error("Audio capture not started");
    await new Promise<void>((resolve) => bag.recorder.addEventListener("stop", () => resolve(), { once: true }));
    bag.recorder.stop();
    bag.disconnect();
    const blob = new Blob(bag.chunks, { type: "audio/webm;codecs=opus" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    delete globalWindow.__phase4AudioCapture;
    return { byteLength: bytes.length, base64: btoa(binary) };
  };
  globalWindow.__shellAudioEvidence = () => {
    const engine = adapter.getEngine();
    const shell = shellStore.getState();
    const mix = engine?.getMix();
    const domainEvents = musicalDomain.eventLog.slice(0, 16);
    const masterInventory = musicalDomain.getSevenTrackMasterInventory();
    const activeMasterTracks = musicalDomain.getActiveMasterTracksList();
    const exchangeRevisions = shell.exchangeClips.map((clip) => ({
      id: clip.id,
      title: clip.title,
      revision: clip.revision,
      lifecycle: clip.lifecycle,
      draftId: clip.draftId,
      forkOf: clip.forkOf,
    }));
    const stagedSlots = shell.arrangementSlots
      .filter((slot) => slot.state === "staged")
      .map((slot) => ({ id: slot.id, clipId: slot.clipId, label: slot.label }));
    const activeSlots = shell.arrangementSlots
      .filter((slot) => slot.state === "active")
      .map((slot) => ({ id: slot.id, clipId: slot.clipId, label: slot.label }));
    const dockMappings = shell.dockSlots
      .filter((slot) => slot.mapped)
      .map((slot) => ({
        index: slot.index,
        param: slot.sourceParam,
        value: slot.value,
        mode: shell.dockMode,
      }));
    return {
      ...adapter.evidence,
      capturedAt: new Date().toISOString(),
      engineExists: Boolean(engine),
      toneContextState: Tone.context.state,
      toneTransportState: Tone.getTransport().state,
      transportPlaying: shell.transportPlaying,
      transportBar: shell.transportBar,
      transportBeat: shell.transportBeat,
      previewPendingDraftId: (adapter as unknown as { pendingPreviewDraftId: string | null }).pendingPreviewDraftId ?? null,
      cueActive: engine?.isCueActive() ?? false,
      cueDraftId: engine?.getCueDraftId() ?? null,
      cueNoteCount: engine?.getCueNoteCount() ?? 0,
      cueScheduleCount: engine?.getCueScheduleCount() ?? 0,
      masterLevelDb: engine?.getMasterLevelDb() ?? Number.NEGATIVE_INFINITY,
      masterStepCount: engine?.getMasterStepCount() ?? 0,
      playbackGeneration: engine?.getPlaybackGeneration() ?? 0,
      mixFilter: mix?.filter ?? null,
      mixDelayWet: mix?.delayWet ?? null,
      mixReverbWet: mix?.reverbWet ?? null,
      mixMasterGain: mix?.masterGain ?? null,
      deviceParams: {
        filter: mix?.filter ?? null,
        delayWet: mix?.delayWet ?? null,
        reverbWet: mix?.reverbWet ?? null,
      },
      dockSlot0: shell.dockSlots[0]?.value ?? null,
      dockMappings,
      dockMode: shell.dockMode,
      workspaceDraftId: shell.workspaceDraftId,
      workspaceBleed: shell.workspaceBleed,
      authority: musicalDomain.getAuthority(),
      restartEpoch: musicalDomain.getRestartEpoch(),
      domainEventTrace: domainEvents,
      exchangeRevisions,
      stagedSlots,
      activeSlots,
      activeMasterTracks,
      sevenTrackMasterInventory: masterInventory,
      sevenTrackAudibleCount: masterInventory.filter((track) => track.audibleInPayoff).length,
      schedulerHealth: {
        transportState: Tone.getTransport().state,
        cueScheduleCount: engine?.getCueScheduleCount() ?? 0,
        playbackGeneration: engine?.getPlaybackGeneration() ?? 0,
        masterStepCount: engine?.getMasterStepCount() ?? 0,
      },
    };
  };
}
