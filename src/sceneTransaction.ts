import type { MixParams, RuntimeState, SceneDefinition } from "./types";
import { formatPosition, type MusicalPosition } from "./musicalPosition";
import type { AudioEngine } from "./audioEngine";
import { applyLaunchRuntimeState, finalizeQueueForTransaction } from "./queueLifecycle";
import { captureJamMemoryForTransaction } from "./jamMemory";
import { executionLog } from "./executionLog";
import { sceneById, type SceneExecutionAuthority } from "./sceneExecution";
import type { PerformanceScriptEvent } from "./types";

export interface SceneTransactionContext {
  state: RuntimeState;
  sceneAuthority: SceneExecutionAuthority;
  audioEngine: AudioEngine;
  event: PerformanceScriptEvent;
  bar: number;
  transportTime: number;
  resolveScene?: (sceneId: string) => SceneDefinition | undefined;
  authoritativeMix?: MixParams;
}

export function executeSceneTransaction(ctx: SceneTransactionContext): boolean {
  const { state, sceneAuthority, audioEngine, event, bar, transportTime } = ctx;
  const sceneId = event.target;
  if (!sceneId) return false;
  const scene = ctx.resolveScene?.(sceneId) ?? sceneById(sceneId);
  if (!scene) return false;

  const position: MusicalPosition = { bar, beat: 0, sixteenth: 0 };
  const queuedItem = state.queue.find((q) => q.sceneId === sceneId);
  const queuedPosition: MusicalPosition = queuedItem?.queuedAt ?? position;

  if (!sceneAuthority.canExecute(sceneId, position)) return false;

  const record = sceneAuthority.executeScene(sceneId, position, queuedPosition, {
    onAudio: (tx) => {
      audioEngine.activateSceneAtBoundary(scene, transportTime);
      tx.audioActivatedAt = formatPosition(position);
      executionLog.markField(tx.boundaryId, "audioActivatedAt", position);
    },
    onRuntime: (tx) => {
      applyLaunchRuntimeState(state, sceneId, event.detail);
      const mix = ctx.authoritativeMix ?? scene.fx;
      state.mix = { ...mix, faders: { ...mix.faders } };
      tx.runtimeActivatedAt = formatPosition(position);
      executionLog.markField(tx.boundaryId, "runtimeActivatedAt", position);
    },
    onQueue: (tx) => {
      finalizeQueueForTransaction(state, tx, position);
      executionLog.markField(tx.boundaryId, "queueUpdatedAt", position);
    },
    onMemory: (tx) => {
      const captured = captureJamMemoryForTransaction(state, tx);
      if (captured) {
        tx.jamMemoryCapturedAt = formatPosition(position);
        executionLog.markField(tx.boundaryId, "jamMemoryCapturedAt", position);
      }
    },
  });

  executionLog.logTransaction(record.transaction);
  return true;
}
