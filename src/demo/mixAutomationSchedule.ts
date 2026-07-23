import * as Tone from "tone";
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

export function schedulePackMixAutomation(
  audioEngine: AudioEngine,
  events: readonly MixAutomationEvent[] | undefined,
  act: DemoAct,
): number[] {
  if (!events?.length) return [];
  const transport = Tone.getTransport();
  const ids: number[] = [];
  for (const event of filterMixAutomationEvents(events, act)) {
    const id = transport.schedule((time) => {
      audioEngine.applyMixAutomationEvent(event, time);
    }, event.at);
    ids.push(id);
  }
  return ids;
}
