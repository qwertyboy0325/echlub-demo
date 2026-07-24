import * as Tone from "tone";

export function transportStartOffsetSeconds(): string {
  return "+0.12";
}

export function notePlayDeferSeconds(): number {
  return 0.008;
}

export function reverbDecaySeconds(requested: number): number {
  return Math.min(requested, 1.25);
}

let playbackContextConfigured = false;

/**
 * Replace Tone's default "interactive" context (smallest render quantum,
 * prone to underruns) with a "playback" context so the browser allocates a
 * larger output buffer. Must run before any Tone node is created.
 */
export function configurePlaybackAudioContext(): void {
  if (playbackContextConfigured) return;
  playbackContextConfigured = true;
  const context = new Tone.Context({
    latencyHint: "playback",
    lookAhead: 0.3,
    updateInterval: 0.1,
  });
  Tone.setContext(context);
}
