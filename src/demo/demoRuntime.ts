import type { DemoAct, ProductionSession, CanonicalVsLiveComparison, LiveStructuralOperation } from "../domain/sessionTypes";
import type { ReconstructionPack } from "../domain/reconstructionPack";
import { compileSessionMaterialBank, materialRefForDraft } from "../domain/sessionMaterialBank";
import type { SessionMaterialBank } from "../domain/sessionMaterialBank";
import type { SceneDefinition } from "../types";
import {
  applyProductionAction,
  createCompletedProductionSession,
  createIncompleteSession,
  sessionMix,
  sessionToRuntimeDrafts,
  validateSessionRelationships,
  validateSceneMaterialRefs,
} from "./productionMutations";
import { DemoDirector } from "./demoDirector";
import { buildCanonicalVsLiveComparison } from "./canonicalPlayback";
import { enterAct, createActScheduleRegistry, type ActScheduleRegistry } from "./actScheduleRegistry";
import { setSceneResolver } from "../sceneExecution";
import type { PerformanceScriptEvent } from "../types";
import {
  applyLiveMusicalEvent,
  applyLiveSceneMix,
  type LiveMusicalMutationResult,
  type LiveMutationEvidence,
} from "./liveMutations";
import { prepareLiveStructuralPlan } from "./liveStructuralPlan";
import {
  applyLiveStructuralBoundary,
  queueLiveStructuralOperation,
  type LiveStructuralBoundaryResult,
} from "./liveStructuralMutations";
import {
  applyCapabilityLiveOperation,
  type CapabilityLiveOperation,
  type CapabilityOperationEvidence,
} from "./capabilityLiveOperations";

export type ActChangeCallback = (act: DemoAct, session: ProductionSession) => void;

export class DemoRuntime {
  pack: ReconstructionPack;
  session: ProductionSession;
  readonly director = new DemoDirector();
  readonly scheduleRegistry: ActScheduleRegistry = createActScheduleRegistry();
  materialBank: SessionMaterialBank;
  canonicalSnapshot: ProductionSession | null = null;
  canonicalBank: SessionMaterialBank | null = null;
  readonly liveMutationLog: LiveMutationEvidence[] = [];
  lastCapabilityOperation: CapabilityOperationEvidence | null = null;
  act: DemoAct = "production";
  speedMultiplier = 1;
  productionActionIndex = 0;
  private onActChange?: ActChangeCallback;

  constructor(pack: ReconstructionPack, onActChange?: ActChangeCallback) {
    this.pack = pack;
    this.session = createIncompleteSession(pack);
    this.materialBank = compileSessionMaterialBank(this.session);
    this.onActChange = onActChange;
    this.bindSceneResolver();
  }

  loadPack(pack: ReconstructionPack): void {
    this.pack = structuredClone(pack);
    this.act = "production";
    this.productionActionIndex = 0;
    this.liveMutationLog.length = 0;
    this.director.reset();
    this.session = createIncompleteSession(this.pack);
    this.canonicalSnapshot = null;
    this.canonicalBank = null;
    this.materialBank = compileSessionMaterialBank(this.session);
    this.bindSceneResolver();
    this.onActChange?.(this.act, this.session);
  }

  private bindSceneResolver(): void {
    setSceneResolver((id) => this.session.scenes.find((s) => s.id === id));
  }

  publishBank(): SessionMaterialBank {
    this.materialBank = compileSessionMaterialBank(this.session, this.materialBank);
    const unresolved = validateSceneMaterialRefs(this.session, this.materialBank);
    if (unresolved.length) {
      throw new Error(`Material bank publication left unresolved Scene refs: ${unresolved.join("; ")}`);
    }
    return this.materialBank;
  }

  freezeCanonicalSnapshot(): void {
    this.canonicalSnapshot = structuredClone(this.session);
    this.canonicalBank = compileSessionMaterialBank(this.canonicalSnapshot);
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.25, Math.min(8, multiplier));
  }

  skipToAct(act: DemoAct, clearTransport?: (ids: number[]) => void): void {
    enterAct(this.scheduleRegistry, act, clearTransport ?? (() => {}));
    this.act = act;
    this.productionActionIndex = 0;
    this.director.reset();

    if (act === "production") {
      this.liveMutationLog.length = 0;
      this.session = createIncompleteSession(this.pack);
      this.canonicalSnapshot = null;
      this.canonicalBank = null;
      this.publishBank();
    } else if (act === "canonicalPlayback") {
      this.session = createCompletedProductionSession(this.pack);
      this.freezeCanonicalSnapshot();
      this.director.transitionToCanonicalPlayback();
    } else if (act === "livePerformance") {
      if (!this.canonicalSnapshot) {
        this.session = createCompletedProductionSession(this.pack);
        this.freezeCanonicalSnapshot();
      } else {
        this.session = structuredClone(this.canonicalSnapshot);
      }
      prepareLiveStructuralPlan(this.session, this.pack.livePerformanceChoreography, this.pack.liveStructuralOperations);
      this.publishBank();
      this.liveMutationLog.length = 0;
      this.director.transitionToLivePerformance();
    } else {
      if (!this.canonicalSnapshot) {
        this.session = createCompletedProductionSession(this.pack);
        this.freezeCanonicalSnapshot();
      }
      this.session.liveTakeComplete = true;
      this.director.transitionToComparison();
    }
    this.bindSceneResolver();
    this.onActChange?.(this.act, this.session);
  }

  restartCurrentAct(clearTransport?: (ids: number[]) => void): void {
    this.skipToAct(this.act, clearTransport);
  }

  stepProduction(): boolean {
    const ordered = this.director.getOrderedActions(this.pack.productionChoreography);
    if (this.productionActionIndex >= ordered.length) {
      this.session.productionComplete = true;
      return false;
    }
    const action = ordered[this.productionActionIndex]!;
    const result = applyProductionAction(this.session, action, this.pack);
    if (result.contentChanged) this.publishBank();
    this.director.onProductionAction(
      action,
      this.session.participants.map((p) => p.id),
    );
    this.productionActionIndex += 1;
    if (this.productionActionIndex >= ordered.length) {
      this.session.productionComplete = true;
      this.freezeCanonicalSnapshot();
    }
    return this.productionActionIndex < ordered.length;
  }

  completeProductionInstantly(): void {
    this.session = createCompletedProductionSession(this.pack);
    this.productionActionIndex = this.pack.productionChoreography.length;
    this.session.productionComplete = true;
    this.publishBank();
    this.freezeCanonicalSnapshot();
  }

  beginCanonicalPlayback(): void {
    if (!this.session.productionComplete) this.completeProductionInstantly();
    this.act = "canonicalPlayback";
    this.director.transitionToCanonicalPlayback();
    this.onActChange?.(this.act, this.session);
  }

  beginLivePerformance(): void {
    if (!this.session.productionComplete) this.completeProductionInstantly();
    if (!this.canonicalSnapshot) this.freezeCanonicalSnapshot();
    this.session = structuredClone(this.canonicalSnapshot!);
    prepareLiveStructuralPlan(this.session, this.pack.livePerformanceChoreography, this.pack.liveStructuralOperations);
    this.publishBank();
    this.liveMutationLog.length = 0;
    this.act = "livePerformance";
    this.director.transitionToLivePerformance();
    this.onActChange?.(this.act, this.session);
  }

  beginComparison(liveSceneIds: string[], jamMemoryCount: number): CanonicalVsLiveComparison {
    this.act = "comparison";
    this.session.liveTakeComplete = true;
    this.publishBank();
    this.director.transitionToComparison();
    this.onActChange?.(this.act, this.session);
    return buildCanonicalVsLiveComparison(
      this.canonicalSnapshot ?? this.session,
      this.canonicalBank,
      this.session,
      this.materialBank,
      liveSceneIds,
      jamMemoryCount,
    );
  }

  syncRuntimeDrafts(): Record<string, import("../types").PatternDraft> {
    return sessionToRuntimeDrafts(this.session);
  }

  syncRuntimeMix(): import("../types").MixParams {
    return sessionMix(this.session);
  }

  getSceneAtBar(bar: number): SceneDefinition | undefined {
    const ref = [...this.session.arrangement.scenes].reverse().find((s) => bar >= s.startBar);
    return ref ? this.session.scenes.find((s) => s.id === ref.sceneId) : undefined;
  }

  getMaterialRefForDraft(draftId: string): import("../types").MaterialRef | undefined {
    const draft = this.session.drafts[draftId];
    return draft ? materialRefForDraft(draft) : undefined;
  }

  applyCapabilityOperation(
    capabilityId: string,
    operation: CapabilityLiveOperation,
  ): CapabilityOperationEvidence | null {
    const evidence = applyCapabilityLiveOperation(this.session, this.pack, capabilityId, operation);
    if (!evidence) return null;
    this.publishBank();
    this.lastCapabilityOperation = structuredClone(evidence);
    return evidence;
  }

  applyLiveMusicalEvent(event: PerformanceScriptEvent): LiveMusicalMutationResult {
    const result = applyLiveMusicalEvent(this.session, event);
    if (result.contentChanged) this.publishBank();
    if (result.evidence) {
      result.evidence.bankVersion = this.materialBank.version;
      this.liveMutationLog.push(structuredClone(result.evidence));
    }
    return result;
  }

  applyLiveSceneMix(sceneId: string, eventId: string): LiveMusicalMutationResult {
    const result = applyLiveSceneMix(this.session, sceneId, eventId);
    if (result.evidence) {
      result.evidence.bankVersion = this.materialBank.version;
      this.liveMutationLog.push(structuredClone(result.evidence));
    }
    return result;
  }

  queueLiveStructuralOperation(operation: LiveStructuralOperation): void {
    queueLiveStructuralOperation(this.session, operation);
  }

  applyLiveStructuralBoundary(bar: number): LiveStructuralBoundaryResult {
    const result = applyLiveStructuralBoundary(this.session, bar);
    if (result.applied.length) this.publishBank();
    return result;
  }

  previewComparison(liveSceneIds: string[], jamMemoryCount: number): CanonicalVsLiveComparison {
    return buildCanonicalVsLiveComparison(
      this.canonicalSnapshot ?? this.session,
      this.canonicalBank,
      this.session,
      this.materialBank,
      liveSceneIds,
      jamMemoryCount,
    );
  }

  validate(): string[] {
    return [
      ...validateSessionRelationships(this.session),
      ...validateSceneMaterialRefs(this.session, this.materialBank),
    ];
  }

  participantCount(): number {
    return this.session.participants.length;
  }

  trackCount(): number {
    return this.session.tracks.length;
  }
}
