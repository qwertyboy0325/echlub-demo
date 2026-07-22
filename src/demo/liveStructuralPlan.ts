import { parsePosition } from "../musicalPosition";
import { performanceScript } from "../performanceScript";
import type { LiveStructuralOperation, ProductionSession } from "../domain/sessionTypes";
import { queueLiveStructuralOperation } from "./liveStructuralMutations";

/**
 * The deterministic concept-film take begins with the scripted launch form,
 * then changes that authoritative Session arrangement at musical boundaries.
 */
export function arrangementLaunchBoundaries(session: ProductionSession): Map<number, string> {
  return new Map(session.arrangement.scenes.map((ref) => [ref.startBar, ref.sceneId]));
}

export function prepareLiveStructuralPlan(
  session: ProductionSession,
  script = performanceScript,
  operations: readonly LiveStructuralOperation[] = [],
): void {
  const launches = script
    .filter((event) => event.action === "launch" && event.target)
    .map((event) => ({ sceneId: event.target!, startBar: parsePosition(event.at).bar }));

  session.arrangement.scenes = launches.map((ref) => ({ ...ref }));
  session.arrangement.totalBars = Math.max(session.arrangement.totalBars, launches.at(-1)?.startBar ?? 0);
  session.liveStructure = { pending: [], applied: [], removedLayerRefs: {} };

  for (let index = 0; index < launches.length; index += 1) {
    const ref = launches[index]!;
    const scene = session.scenes.find((candidate) => candidate.id === ref.sceneId);
    if (!scene) throw new Error(`Live plan references unknown Scene ${ref.sceneId}`);
    const nextStart = launches[index + 1]?.startBar ?? session.arrangement.totalBars;
    scene.startBar = ref.startBar;
    scene.bars = nextStart - ref.startBar;
  }

  for (const operation of operations) {
    queueLiveStructuralOperation(session, operation);
  }
}
