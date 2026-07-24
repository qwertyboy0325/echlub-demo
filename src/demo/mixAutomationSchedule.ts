import type { MixAutomationEvent } from "../domain/reconstructionPack";
import type { DemoAct } from "../domain/sessionTypes";
import type { AudioEngine } from "../audioEngine";
import { parsePosition, positionToTicks } from "../musicalPosition";

function eventMatchesAct(event: MixAutomationEvent, act: DemoAct): boolean {
  return event.act === "both" || event.act === act;
}

export function filterMixAutomationEvents(
  events: readonly MixAutomationEvent[],
  act: DemoAct,
): MixAutomationEvent[] {
  return events
    .filter((event) => eventMatchesAct(event, act))
    .sort((a, b) => positionToTicks(parsePosition(a.at)) - positionToTicks(parsePosition(b.at)));
}

/** Group pack automation by transport sixteenth tick for clock-coherent playback. */
export function indexMixAutomationByTick(
  events: readonly MixAutomationEvent[] | undefined,
  act: DemoAct,
): Map<number, MixAutomationEvent[]> {
  const indexed = new Map<number, MixAutomationEvent[]>();
  if (!events?.length) return indexed;
  for (const event of filterMixAutomationEvents(events, act)) {
    const tick = positionToTicks(parsePosition(event.at));
    const bucket = indexed.get(tick) ?? [];
    bucket.push(event);
    indexed.set(tick, bucket);
  }
  for (const [tick, bucket] of indexed) {
    bucket.sort((a, b) => a.id.localeCompare(b.id));
    indexed.set(tick, bucket);
  }
  return indexed;
}

/** Register automation on the musical clock instead of independent Transport callbacks. */
export function schedulePackMixAutomation(
  audioEngine: AudioEngine,
  events: readonly MixAutomationEvent[] | undefined,
  act: DemoAct,
): number[] {
  audioEngine.setPackMixAutomation(events, act);
  return [];
}
