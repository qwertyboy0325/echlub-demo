import * as Tone from "tone";
import { AudioEngine } from "../../audioEngine";
import { materialRefForDraft, type MaterialRef } from "../../domain/sessionMaterialBank";
import { compileSessionMaterialBank } from "../../domain/sessionMaterialBank";
import type { MixParams } from "../../types";
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
  transportState: string;
  cueActive: boolean;
  activeMasterDraftId: string | null;
  domainEvents: number;
}

export class ShellAudioAdapter {
  private engine: AudioEngine | null = null;
  private initialized = false;
  private initToken: { cancelled: boolean } | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastTransportPlaying = false;
  readonly evidence: ShellAudioAdapterEvidence = {
    packLoaded: false,
    transportState: "stopped",
    cueActive: false,
    activeMasterDraftId: null,
    domainEvents: 0,
  };

  constructor(private readonly domain: MusicalDomainStore = musicalDomain) {}

  async initialize(): Promise<void> {
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
      engine.stop();
      return;
    }
    await engine.initialize();
    if (token.cancelled) {
      engine.stop();
      return;
    }
    this.engine = engine;
    this.engine.setSoundDesign(pack.soundDesign);
    this.engine.setBaseBpm(pack.metadata.bpm);
    this.engine.setTempoMap(pack.tempoMap);
    this.engine.setTotalBars(pack.arrangement.totalBars);
    this.publishBank("production");
    this.unsubscribe = shellStore.subscribe((state) => this.onShellState(state));
    this.initialized = true;
    this.evidence.packLoaded = true;
  }

  dispose(): void {
    if (this.initToken) this.initToken.cancelled = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.engine?.stop();
    this.engine = null;
    this.initialized = false;
    this.evidence.packLoaded = false;
  }

  getEngine(): AudioEngine | null {
    return this.engine;
  }

  private onShellState(state: ShellState): void {
    if (!this.engine) return;
    if (state.transportPlaying !== this.lastTransportPlaying) {
      this.lastTransportPlaying = state.transportPlaying;
      void this.handleTransportToggle(state.transportPlaying);
    }
    this.evidence.transportState = this.engine.state;
    this.evidence.cueActive = this.engine.isCueActive();
    this.evidence.activeMasterDraftId = this.domain.getActiveMasterDraftId();
    this.evidence.domainEvents = this.domain.eventLog.length;
  }

  private async handleTransportToggle(playing: boolean): Promise<void> {
    if (!this.engine) return;
    await Tone.start();
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
        if (patch) this.engine.setMixParams(patch, 0.18);
        break;
      }
      case "SET_DOCK_VALUE": {
        const slot = after.dockSlots[command.slotIndex];
        if (!slot?.mapped || !slot.sourceParam) break;
        const patch = this.paramPatchFromDockSlot(slot.sourceParam, command.value, after.dockMode);
        if (patch) this.engine.setMixParams(patch, 0.12);
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
        this.domain.restart();
        this.publishBank("production");
        break;
      case "PREVIEW_WORKSPACE":
        this.previewDraft(command.draftId);
        break;
      default:
        break;
    }
  }

  private applyDraftEdit(result: ReturnType<MusicalDomainStore["moveNoteStep"]>): void {
    if (!result || !this.engine) return;
    this.publishBank(this.domain.getAuthority() === "shared-master" ? "livePerformance" : "production");
    const draft = this.domain.draftForId(result.draftId);
    if (draft) this.startPrivateCueAfterAudioUnlock(materialRefForDraft(draft));
  }

  previewDraft(draftId: string): void {
    if (!this.engine) return;
    const draft = this.domain.draftForId(draftId);
    if (!draft) return;
    this.publishBank("production");
    this.startPrivateCueAfterAudioUnlock(materialRefForDraft(draft));
  }

  private startPrivateCueAfterAudioUnlock(materialRef: MaterialRef): void {
    void Tone.start().then(() => {
      this.engine?.startPrivateCue(materialRef);
    });
  }

  private publishBank(act: "production" | "livePerformance"): void {
    const session = this.domain.getSession();
    if (!session || !this.engine) return;
    const bank = compileSessionMaterialBank(session);
    this.engine.setMaterialBank(bank);
    this.engine.setBaselineMix(session.mix);
    this.engine.setCurrentAct(act);
  }

  private paramPatchFromDockSlot(
    sourceParam: string,
    value: number,
    mode: ShellState["dockMode"],
  ): Partial<MixParams> | null {
    void mode;
    const label = sourceParam.toLowerCase();
    if (label.includes("cutoff") || label.includes("filter")) return { filter: 200 + value * 7800 };
    if (label.includes("delay") || label.includes("wet")) return { delayWet: value * 0.65 };
    if (label.includes("reverb") || label.includes("send")) return { reverbWet: value * 0.85 };
    if (label.includes("level")) return { masterGain: -24 + value * 18 };
    return null;
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

export function installShellAudioDispatchBridge(): () => void {
  const original = shellStore.dispatch.bind(shellStore);
  shellStore.dispatch = (command: ShellCommand) => {
    const before = shellStore.getState();
    original(command);
    shellAudioAdapter.handleCommand(command, before, shellStore.getState());
  };
  return () => {
    shellStore.dispatch = original;
  };
}
