import * as Tone from "tone";
import type { AudioEngine } from "../audioEngine";
import { materialRefForDraft } from "../domain/sessionMaterialBank";
import { loadReconstructionPack } from "../domain/packLoader";
import type { ReconstructionPack } from "../domain/reconstructionPack";
import type { DemoAct, LiveStructuralOperation } from "../domain/sessionTypes";
import type { RuntimeState } from "../types";
import { resolveSceneAtBar, provenanceForScene } from "./canonicalPlayback";
import { DemoRuntime } from "./demoRuntime";
import { DemoDirector } from "./demoDirector";
import { enterAct, registerCanonicalSchedules, registerLiveSchedules } from "./actScheduleRegistry";
import { projectSessionMusicalState } from "../runtimeState";
import type { PerformanceScriptEvent } from "../types";
import type { CapabilityOperationEvidence } from "./capabilityLiveOperations";
import type { CapabilityLiveOperation } from "../types";

export interface DemoControllerHooks {
  getState: () => RuntimeState;
  refreshUi: () => void;
  refreshProductionUi: () => void;
  audioEngine: AudioEngine;
  onProductionAction: (label: string, participantId: string) => void;
  onActChange: (act: DemoAct) => void;
  runLivePerformance: () => void;
  showComparison: (summary: string) => void;
  scheduleCanonicalPlayback: (onDone: () => void) => void;
  clearTransportSchedules: (ids: number[]) => void;
}

export class DemoController {
  readonly runtime: DemoRuntime;
  readonly director: DemoDirector;
  private hooks: DemoControllerHooks;
  private productionTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private paused = false;

  constructor(hooks: DemoControllerHooks) {
    this.hooks = hooks;
    const pack = loadReconstructionPack();
    this.runtime = new DemoRuntime(pack, (act) => {
      this.publishToAudioEngine(act);
      hooks.onActChange(act);
    });
    this.director = this.runtime.director;
    this.hooks.audioEngine.setSoundDesign(pack.soundDesign);
    this.publishToAudioEngine("production");
  }

  private publishToAudioEngine(act: DemoAct): void {
    const bank = this.runtime.publishBank();
    this.hooks.audioEngine.setMaterialBank(bank);
    this.hooks.audioEngine.setBaselineMix(this.runtime.syncRuntimeMix());
    this.hooks.audioEngine.setCurrentAct(act);
    if (act === "production" || act === "canonicalPlayback") {
      this.hooks.audioEngine.clearLaunchBoundaries();
    }
  }

  isRunning(): boolean { return this.running; }
  isPaused(): boolean { return this.paused; }

  setSpeed(multiplier: number): void {
    this.runtime.setSpeed(multiplier);
  }

  loadPack(pack: ReconstructionPack): void {
    this.stop();
    this.runtime.loadPack(pack);
    this.hooks.audioEngine.setSoundDesign(pack.soundDesign);
    this.syncSessionToState();
    this.publishToAudioEngine("production");
    this.hooks.refreshUi();
    this.hooks.refreshProductionUi();
  }

  skipToAct(act: DemoAct): void {
    this.stopProductionTimer();
    this.runtime.skipToAct(act, this.hooks.clearTransportSchedules);
    this.syncSessionToState();
    this.publishToAudioEngine(act);
    this.hooks.refreshUi();
    this.hooks.refreshProductionUi();
  }

  syncSessionToState(): void {
    const state = this.hooks.getState();
    const drafts = this.runtime.syncRuntimeDrafts();
    const mix = this.runtime.syncRuntimeMix();
    for (const [id, draft] of Object.entries(drafts)) {
      state.drafts[id] = draft;
    }
    state.mix = mix;
  }

  projectSessionMusicalState(): void {
    projectSessionMusicalState(this.hooks.getState(), this.runtime.session);
  }

  applyLiveMusicalEvent(event: PerformanceScriptEvent, transportTime: number): void {
    const result = this.runtime.applyLiveMusicalEvent(event);
    if (result.contentChanged) {
      this.hooks.audioEngine.setMaterialBank(this.runtime.materialBank);
    }
    if (result.mixChanged && result.mixPatch) {
      this.hooks.audioEngine.setMixParams(result.mixPatch, 0.18, transportTime);
    }
    this.projectSessionMusicalState();
  }

  applyLiveSceneMix(sceneId: string, eventId: string): void {
    this.runtime.applyLiveSceneMix(sceneId, eventId);
    this.projectSessionMusicalState();
  }

  queueLiveStructuralOperation(operation: LiveStructuralOperation): void {
    this.runtime.queueLiveStructuralOperation(operation);
  }

  applyLiveStructuralBoundary(
    bar: number,
    transportTime: number,
  ): import("./liveStructuralMutations").LiveStructuralBoundaryResult {
    const result = this.runtime.applyLiveStructuralBoundary(bar);
    if (result.applied.length) {
      const scene = this.runtime.getSceneAtBar(bar);
      if (scene) {
        this.runtime.applyLiveSceneMix(scene.id, `structure-boundary-${bar}`);
      }
      this.hooks.audioEngine.setMaterialBank(this.runtime.materialBank);
      if (scene) this.hooks.audioEngine.activateSceneAtBoundary(scene, transportTime);
      this.projectSessionMusicalState();
      this.hooks.refreshUi();
    }
    return result;
  }

  async startFullDemo(): Promise<void> {
    this.running = true;
    this.paused = false;
    this.runtime.skipToAct("production", this.hooks.clearTransportSchedules);
    this.syncSessionToState();
    this.publishToAudioEngine("production");
    this.hooks.refreshUi();
    this.hooks.refreshProductionUi();
    await this.runProductionAct();
    if (!this.running) return;
    await this.runCanonicalAct();
    if (!this.running) return;
    this.runtime.beginLivePerformance();
    this.syncSessionToState();
    this.publishToAudioEngine("livePerformance");
    this.hooks.onActChange("livePerformance");
    this.hooks.runLivePerformance();
  }

  pause(): void {
    this.paused = !this.paused;
    if (this.paused) this.stopProductionTimer();
    else if (this.runtime.act === "production" && !this.runtime.session.productionComplete) {
      this.runProductionAct().catch(() => {});
    }
  }

  restart(): void {
    this.stopProductionTimer();
    this.running = false;
    this.paused = false;
    this.runtime.restartCurrentAct(this.hooks.clearTransportSchedules);
    this.syncSessionToState();
    this.publishToAudioEngine(this.runtime.act);
    this.hooks.refreshUi();
    this.hooks.refreshProductionUi();
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.stopProductionTimer();
  }

  handlePreviewDraft(draftId: string): void {
    const draft = this.runtime.session.drafts[draftId];
    if (!draft) return;
    const ref = materialRefForDraft(draft);
    this.runtime.publishBank();
    this.hooks.audioEngine.setMaterialBank(this.runtime.materialBank);
    this.hooks.audioEngine.startPrivateCue(ref);
  }

  executeCapabilityOperation(
    capabilityId: string,
    operation: CapabilityLiveOperation,
  ): CapabilityOperationEvidence | null {
    if (this.runtime.act !== "livePerformance") return null;
    const evidence = this.runtime.applyCapabilityOperation(capabilityId, operation);
    if (!evidence) return null;

    if (evidence.cueStarted) {
      this.hooks.audioEngine.setMaterialBank(this.runtime.materialBank);
      this.hooks.audioEngine.startPrivateCue(evidence.materialRef);
    } else {
      this.hooks.audioEngine.setMaterialBank(this.runtime.materialBank);
      if (operation === "revision" && capabilityId === "cap-harmony") {
        this.hooks.audioEngine.startPrivateCue(evidence.materialRef);
      }
    }

    this.syncSessionToState();
    const state = this.hooks.getState();
    state.activeDraftId = evidence.context.draftId;
    state.previewBrain = null;
    this.hooks.refreshUi();
    this.hooks.refreshProductionUi();
    return evidence;
  }

  private stopProductionTimer(): void {
    if (this.productionTimer !== null) {
      clearTimeout(this.productionTimer);
      this.productionTimer = null;
    }
  }

  private runProductionAct(): Promise<void> {
    return new Promise((resolve) => {
      const tick = () => {
        if (!this.running || this.paused) {
          this.productionTimer = setTimeout(tick, 200);
          return;
        }
        const hasMore = this.runtime.stepProduction();
        this.syncSessionToState();
        this.publishToAudioEngine("production");
        const action = this.runtime.pack.productionChoreography[this.runtime.productionActionIndex - 1];
        if (action) {
          this.hooks.onProductionAction(action.label, action.participantId);
          if (action.kind === "previewDraft" && action.target) {
            this.handlePreviewDraft(action.target);
          }
        }
        this.hooks.refreshUi();
        this.hooks.refreshProductionUi();
        if (!hasMore) {
          this.stopProductionTimer();
          resolve();
          return;
        }
        const delay = this.hooks.getState().recordingMode ? 700 : 550 / this.runtime.speedMultiplier;
        this.productionTimer = setTimeout(tick, delay);
      };
      tick();
    });
  }

  private runCanonicalAct(): Promise<void> {
    return new Promise((resolve) => {
      this.runtime.beginCanonicalPlayback();
      enterAct(this.runtime.scheduleRegistry, "canonicalPlayback", this.hooks.clearTransportSchedules);
      this.syncSessionToState();
      this.publishToAudioEngine("canonicalPlayback");
      this.hooks.onActChange("canonicalPlayback");
      this.hooks.refreshUi();
      this.hooks.refreshProductionUi();
      this.hooks.scheduleCanonicalPlayback(() => {
        this.runtime.session.canonicalPlaybackComplete = true;
        resolve();
      });
    });
  }

  onLivePerformanceFinished(liveSceneIds: string[], jamMemoryCount: number): void {
    enterAct(this.runtime.scheduleRegistry, "comparison", this.hooks.clearTransportSchedules);
    const comparison = this.runtime.beginComparison(liveSceneIds, jamMemoryCount);
    const summary = [
      `Canonical scenes: ${comparison.canonicalSceneIds.join(" → ")}`,
      `Live scenes: ${comparison.liveSceneIds.join(" → ")}`,
      `Same-ID content changes: ${comparison.sameIdContentChanges.length ? comparison.sameIdContentChanges.map((c) => `${c.sceneId}/${c.layer} ${c.draftId}`).join(", ") : "none"}`,
      `Changed drafts: ${comparison.changedDrafts.length ? comparison.changedDrafts.join(", ") : "none"}`,
      `Structural changes: ${comparison.structuralChanges.length ? comparison.structuralChanges.join("; ") : "none"}`,
      `Duration: ${comparison.canonicalTotalBars} → ${comparison.liveTotalBars} bars`,
      `Jam Memory captures: ${comparison.jamMemoryCount}`,
    ].join("\n");
    this.hooks.showComparison(summary);
    this.running = false;
  }

  getProvenanceLabel(bar: number): string {
    const scene = resolveSceneAtBar(this.runtime.session, bar);
    if (!scene) return "—";
    return provenanceForScene(this.runtime.session, scene.id).join(", ") || "—";
  }

  registerLiveSchedules(ids: number[]): void {
    registerLiveSchedules(this.runtime.scheduleRegistry, ids);
  }

  registerCanonicalSchedules(ids: number[]): void {
    registerCanonicalSchedules(this.runtime.scheduleRegistry, ids);
  }
}

export function scheduleArrangementPlayback(
  audioEngine: AudioEngine,
  scenes: { scene: import("../types").SceneDefinition; startBar: number }[],
  totalBars: number,
  onStep: (bar: number) => void,
  onDone: () => void,
): number[] {
  const transport = Tone.getTransport();
  const ids: number[] = [];
  for (const { scene, startBar } of scenes) {
    const at = `${startBar}:0:0`;
    ids.push(transport.schedule((time) => {
      audioEngine.activateSceneAtBoundary(scene, time);
      Tone.getDraw().schedule(() => onStep(startBar), time);
    }, at));
  }
  ids.push(transport.schedule(() => onDone(), `${totalBars}:0:0`));
  return ids;
}
