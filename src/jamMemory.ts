import { jamMemories } from "./performanceScript";
import type { SceneExecutionTransaction } from "./sceneExecution";
import type { CapturedJamMemory, RuntimeState } from "./types";

export interface JamMemoryBinding {
  memoryId: string;
  sceneId: string;
  boundaryId: string;
}

const BINDINGS: JamMemoryBinding[] = [
  { memoryId: "m1", sceneId: "opening", boundaryId: "opening@bar-7" },
  { memoryId: "m2", sceneId: "groove", boundaryId: "groove@bar-15" },
  { memoryId: "m3", sceneId: "tease", boundaryId: "tease@bar-23" },
  { memoryId: "m4", sceneId: "release", boundaryId: "release@bar-29" },
  { memoryId: "m5", sceneId: "recompose", boundaryId: "recompose@bar-35" },
  { memoryId: "m6", sceneId: "return", boundaryId: "return@bar-39" },
];

export function bindingForBoundary(boundaryId: string): JamMemoryBinding | undefined {
  return BINDINGS.find((b) => b.boundaryId === boundaryId);
}

export function captureJamMemoryForTransaction(
  state: RuntimeState,
  tx: SceneExecutionTransaction,
): CapturedJamMemory | null {
  const exactBinding = BINDINGS.find((b) => b.boundaryId === tx.boundaryId);
  const template = exactBinding
    ? jamMemories.find((m) => m.id === exactBinding.memoryId)
    : jamMemories.find((memory) => !state.history.some((captured) => captured.id === memory.id));
  if (!template) return null;
  if (state.history.some((h) => h.id === template.id)) return null;
  const captured: CapturedJamMemory = {
    ...template,
    at: tx.transportObservedAt,
    boundaryId: tx.boundaryId,
    sceneExecutionId: tx.sceneExecutionId,
    sceneId: tx.sceneId,
    description: `${template.description} [${tx.boundaryId}]`,
  };
  state.history.push(captured);
  return captured;
}

export function jamMemoryBindings(): readonly JamMemoryBinding[] {
  return BINDINGS;
}
