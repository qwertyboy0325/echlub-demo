import type { MusicalPosition } from "./musicalPosition";

export function boundaryIdForScene(sceneId: string, executeAtBar: number): string {
  return `${sceneId}@bar-${executeAtBar + 1}`;
}

export function boundaryIdFromPosition(sceneId: string, position: MusicalPosition): string {
  return `${sceneId}@bar-${position.bar + 1}`;
}
