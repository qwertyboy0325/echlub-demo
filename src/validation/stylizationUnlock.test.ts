import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_REED_SOUND_DESIGN,
  inspectReconstructionPack,
  resolveMixDrumDefaults,
  resolveReedSoundDesign,
  type MixAutomationEvent,
} from "../domain/reconstructionPack";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import { schedulePackMixAutomation, filterMixAutomationEvents } from "../demo/mixAutomationSchedule";
import { parsePosition, positionToTicks } from "../musicalPosition";
import type { AudioEngine } from "../audioEngine";
import { mixEquals } from "../mixMapping";
import {
  createActScheduleRegistry,
  enterAct,
  registerCanonicalSchedules,
  registerLiveSchedules,
} from "../demo/actScheduleRegistry";

describe("stylization unlock contracts", () => {
  it("preserves hard-coded reed defaults when pack omits soundDesign.reed", () => {
    const resolved = resolveReedSoundDesign(placeholderReconstructionPack.soundDesign);
    expect(resolved).toEqual(DEFAULT_REED_SOUND_DESIGN);
  });

  it("merges pack-owned reed values over fallback defaults", () => {
    const soundDesign = structuredClone(placeholderReconstructionPack.soundDesign);
    soundDesign.reed = { attack: 0.006, altAttack: 0.007, release: 0.14, altRelease: 0.13 };
    expect(resolveReedSoundDesign(soundDesign)).toMatchObject({
      attack: 0.006,
      altAttack: 0.007,
      release: 0.14,
      altRelease: 0.13,
      drive: DEFAULT_REED_SOUND_DESIGN.drive,
    });
  });

  it("resolves drum mix defaults from soundDesign when scene fields are absent", () => {
    const mix = placeholderReconstructionPack.defaultMix;
    expect(resolveMixDrumDefaults(mix, placeholderReconstructionPack.soundDesign)).toEqual({
      drumFilter: placeholderReconstructionPack.soundDesign.drums.filterFrequency,
      drumReverbWet: 0,
    });
  });

  it("keeps old packs valid without mixAutomation or reed fields", () => {
    expect(inspectReconstructionPack(placeholderReconstructionPack)).toEqual([]);
  });

  it("rejects malformed mixAutomation events", () => {
    const pack = structuredClone(placeholderReconstructionPack);
    pack.mixAutomation = [{
      id: "",
      act: "canonicalPlayback",
      at: "bad-position",
      rampSeconds: -1,
      patch: { delayWet: 2 },
    } as MixAutomationEvent];
    const issues = inspectReconstructionPack(pack);
    expect(issues.some((issue) => issue.path === "mixAutomation[0].id")).toBe(true);
    expect(issues.some((issue) => issue.path === "mixAutomation[0].at")).toBe(true);
    expect(issues.some((issue) => issue.path === "mixAutomation[0].rampSeconds")).toBe(true);
    expect(issues.some((issue) => issue.path === "mixAutomation[0].patch.delayWet")).toBe(true);
  });

  it("rejects malformed reed and drum automation fields", () => {
    const pack = structuredClone(placeholderReconstructionPack);
    pack.soundDesign.reed = { attack: -0.1, drive: 2 };
    pack.mixAutomation = [{
      id: "bad-drum",
      act: "canonicalPlayback",
      at: "4:0:0",
      rampSeconds: 0.1,
      patch: { drumFilter: 0 },
    }];
    const issues = inspectReconstructionPack(pack);
    expect(issues.some((issue) => issue.path === "soundDesign.reed.attack")).toBe(true);
    expect(issues.some((issue) => issue.path === "soundDesign.reed.drive")).toBe(true);
    expect(issues.some((issue) => issue.path === "mixAutomation[0].patch.drumFilter")).toBe(true);
  });

  it("compares optional drum mix fields in mixEquals", () => {
    const base = placeholderReconstructionPack.defaultMix;
    expect(mixEquals(base, { ...base, drumFilter: 9000 })).toBe(false);
    expect(mixEquals({ ...base, drumReverbWet: 0.1 }, { ...base, drumReverbWet: 0.1 })).toBe(true);
    expect(mixEquals({ ...base, drumTrimDb: 1 }, { ...base, drumTrimDb: 1 })).toBe(true);
  });
});

describe("filterMixAutomationEvents", () => {
  const events: MixAutomationEvent[] = [
    {
      id: "restore",
      act: "canonicalPlayback",
      at: "4:0:0",
      rampSeconds: 0.18,
      patch: { delayWet: 0.08 },
    },
    {
      id: "throw",
      act: "canonicalPlayback",
      at: "3:3:0",
      rampSeconds: 0.04,
      patch: { delayWet: 0.28 },
    },
    {
      id: "live-only",
      act: "livePerformance",
      at: "8:0:0",
      rampSeconds: 0.1,
      patch: { reverbWet: 0.2 },
    },
  ];

  it("sorts canonical events in musical-position order", () => {
    expect(filterMixAutomationEvents(events, "canonicalPlayback").map((event) => event.id)).toEqual([
      "throw",
      "restore",
    ]);
  });

  it("filters automation by act without mutating the source array", () => {
    const copy = structuredClone(events);
    expect(filterMixAutomationEvents(events, "livePerformance").map((event) => event.id)).toEqual(["live-only"]);
    expect(events).toEqual(copy);
  });

  it("uses deterministic transport positions for phrase gestures", () => {
    const throwAt = parsePosition("27:0:0");
    const restoreAt = parsePosition("27:1:0");
    expect(positionToTicks(restoreAt) - positionToTicks(throwAt)).toBe(4);
  });
});

const OUTRO_SCENE_BOUNDARY = "88:0:0";
const SONG_END_BOUNDARY = "104:0:0";
const FINAL_REED_NOTE_GRID_ONSET = "103:2:3";
const FINAL_REED_NOTE_OFFSET_SIXTEENTHS = 0.2;

function finalReedOffsetOnsetTicks(): number {
  return positionToTicks(parsePosition(FINAL_REED_NOTE_GRID_ONSET)) + FINAL_REED_NOTE_OFFSET_SIXTEENTHS;
}

async function loadPrivateShikiPack() {
  const { readFileSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const packPath = join(process.cwd(), "local-reconstruction/shiki-no-uta.midi-only.pack.json");
  if (!existsSync(packPath)) return null;
  const { parseReconstructionPackJson } = await import("../domain/packLoader");
  return parseReconstructionPackJson(readFileSync(packPath, "utf8"));
}

describe("private shiki midi-only pack", () => {
  it("validates after stylization unlock fields are added", async () => {
    const pack = await loadPrivateShikiPack();
    if (!pack) return;
    expect(pack.soundDesign.reed?.attack).toBe(0.006);
    expect(pack.mixAutomation?.length).toBeGreaterThanOrEqual(2);
    expect(pack.scenes.find((scene) => scene.id === "bridge")?.fx.drumReverbWet).toBeGreaterThan(0.08);
  });

  it("keeps Return-B automation from overwriting Outro mix after the scene boundary", async () => {
    const pack = await loadPrivateShikiPack();
    if (!pack) return;
    const outroBoundaryTicks = positionToTicks(parsePosition(OUTRO_SCENE_BOUNDARY));
    const returnBEvents = pack.mixAutomation?.filter((event) => event.id.startsWith("return-b-delay")) ?? [];
    const postOutroReturnB = returnBEvents.filter(
      (event) => positionToTicks(parsePosition(event.at)) >= outroBoundaryTicks,
    );
    expect(postOutroReturnB).toEqual([]);
    expect(pack.mixAutomation?.some((event) => event.id === "return-b-delay-restore-1")).toBe(false);
    expect(pack.arrangement.scenes.find((scene) => scene.sceneId === "outro")?.startBar).toBe(
      parsePosition(OUTRO_SCENE_BOUNDARY).bar,
    );
  });

  it("opens Outro delay send at or before the offset final reed onset without an early restore", async () => {
    const pack = await loadPrivateShikiPack();
    if (!pack) return;
    const offsetOnsetTicks = finalReedOffsetOnsetTicks();
    const outroTailThrow = pack.mixAutomation?.find((event) => event.id === "outro-tail-throw-1");
    expect(outroTailThrow).toBeDefined();
    expect(outroTailThrow!.at).toBe(FINAL_REED_NOTE_GRID_ONSET);
    expect(positionToTicks(parsePosition(outroTailThrow!.at))).toBeLessThanOrEqual(offsetOnsetTicks);
    expect(pack.mixAutomation?.some((event) => event.id === "outro-tail-restore-1")).toBe(false);
    const preEndRestores = pack.mixAutomation?.filter((event) => {
      if (!event.id.includes("restore")) return false;
      const ticks = positionToTicks(parsePosition(event.at));
      return ticks > offsetOnsetTicks && ticks < positionToTicks(parsePosition(SONG_END_BOUNDARY));
    }) ?? [];
    expect(preEndRestores).toEqual([]);
  });
});

describe("schedulePackMixAutomation", () => {
  it("returns no schedule ids for absent automation", () => {
    const engine = { applyMixAutomationEvent: vi.fn() } as unknown as AudioEngine;
    expect(schedulePackMixAutomation(engine, undefined, "canonicalPlayback")).toEqual([]);
  });

  it("isolates canonical and live automation by act", () => {
    const events: MixAutomationEvent[] = [
      { id: "canon", act: "canonicalPlayback", at: "4:0:0", rampSeconds: 0.1, patch: { delayWet: 0.1 } },
      { id: "live", act: "livePerformance", at: "4:0:0", rampSeconds: 0.1, patch: { delayWet: 0.2 } },
      { id: "both", act: "both", at: "8:0:0", rampSeconds: 0.1, patch: { delayWet: 0.3 } },
    ];
    expect(filterMixAutomationEvents(events, "canonicalPlayback").map((event) => event.id)).toEqual(["canon", "both"]);
    expect(filterMixAutomationEvents(events, "livePerformance").map((event) => event.id)).toEqual(["live", "both"]);
  });
});

describe("reed graph construction", () => {
  // Tone graph nodes cannot be safely instantiated in Vitest; inspect the builder wiring.
  const graphSource = readFileSync(join(process.cwd(), "src/audio/masterAudioGraph.ts"), "utf8");

  it("consumes resolved pack reed values in synth envelopes, not generic melody envelope", () => {
    expect(graphSource).toContain("resolveReedSoundDesign(sound)");
    expect(graphSource).toContain("envelope: { attack: reed.attack");
    expect(graphSource).toContain("envelope: { attack: reed.altAttack");
    expect(graphSource).toContain("distortion: reed.drive");
    expect(graphSource).not.toContain("sound.melody.envelope.attack");
  });
});

describe("act schedule lifecycle", () => {
  it("clears prior canonical schedules on restart without duplicating ids", () => {
    const registry = createActScheduleRegistry();
    const cleared: number[][] = [];
    enterAct(registry, "canonicalPlayback", (ids) => cleared.push([...ids]));
    registerCanonicalSchedules(registry, [11, 12]);
    enterAct(registry, "canonicalPlayback", (ids) => cleared.push([...ids]));
    registerCanonicalSchedules(registry, [21]);
    expect(cleared).toEqual([[11, 12]]);
    expect(registry.canonicalPlaybackIds).toEqual([21]);
  });

  it("keeps live and canonical schedule buckets isolated", () => {
    const registry = createActScheduleRegistry();
    enterAct(registry, "livePerformance", () => undefined);
    registerLiveSchedules(registry, [31, 32]);
    enterAct(registry, "canonicalPlayback", () => undefined);
    registerCanonicalSchedules(registry, [41]);
    expect(registry.liveScriptIds).toEqual([]);
    expect(registry.canonicalPlaybackIds).toEqual([41]);
  });
});

describe("canonical playback registration order", () => {
  // Scene FX must be scheduled before same-boundary automation in main.ts.
  const mainSource = readFileSync(join(process.cwd(), "src/main.ts"), "utf8");
  const mixSource = readFileSync(join(process.cwd(), "src/audio/mixApplication.ts"), "utf8");

  it("registers arrangement scene FX before pack mix automation", () => {
    const arrangementIdx = mainSource.indexOf("canonicalPlaybackIds = scheduleArrangementPlayback(");
    const automationIdx = mainSource.indexOf("schedulePackMixAutomation(\n    audioEngine,\n    demoController.runtime.pack.mixAutomation,\n    \"canonicalPlayback\",");
    expect(arrangementIdx).toBeGreaterThan(-1);
    expect(automationIdx).toBeGreaterThan(arrangementIdx);
  });

  it("ramps drum filter and room on scene changes and restores baseline on reset", () => {
    expect(mixSource).toContain("graph.drumFilter.frequency.exponentialRampToValueAtTime(drumDefaults.drumFilter, targetTime)");
    expect(mixSource).toContain("graph.drumReverbSend.gain.linearRampToValueAtTime(drumDefaults.drumReverbWet, targetTime)");
    expect(mixSource).toContain("graph.drumFilter.frequency.setValueAtTime(drumDefaults.drumFilter, atTime)");
    expect(mixSource).toContain("graph.drumReverbSend.gain.setValueAtTime(drumDefaults.drumReverbWet, atTime)");
  });
});
