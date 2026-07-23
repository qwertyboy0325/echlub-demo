import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DemoRuntime } from "../demo/demoRuntime";
import { parseReconstructionPackJson } from "../domain/packLoader";
import { resolveMaterial } from "../domain/sessionMaterialBank";

describe("public MIDI-authority song form", () => {
  it("rebuilds all musical content and the full arrangement from the single MIDI authority", () => {
    const pack = parseReconstructionPackJson(readFileSync(
      resolve(process.cwd(), "public/shiki-no-uta.demo.pack.json"),
      "utf8",
    ));
    const runtime = new DemoRuntime(pack);
    runtime.completeProductionInstantly();

    expect(pack.provenance.sourceDescription).toContain("only from one owner-provided Standard MIDI file");
    expect(pack.provenance.sourceDescription).toContain("no PDF, MP3, screenshot, prior transcription");
    expect(pack.metadata.bpm).toBeCloseTo(92, 4);
    expect(pack.timeSignatures).toEqual([{ bar: 0, numerator: 4, denominator: 4 }]);

    expect(runtime.session.arrangement.totalBars).toBe(104);
    expect(runtime.session.arrangement.scenes).toHaveLength(13);
    expect(runtime.session.arrangement.scenes.map(({ startBar }) => startBar)).toEqual([
      0, 4, 12, 20, 28, 36, 44, 52, 60, 68, 72, 80, 88,
    ]);
    expect(pack.sections.map(({ bars }) => bars)).toEqual([
      4, 8, 8, 8, 8, 8, 8, 8, 8, 4, 8, 8, 16,
    ]);

    const sourceTrackEventCounts = Object.fromEntries(pack.tracks.map((track) => [
      track.id,
      track.draftIds.reduce((sum, draftId) => {
        const draft = pack.drafts.find(({ id }) => id === draftId);
        return sum
          + (draft?.notes?.length
            ?? draft?.harmonyChords?.reduce((count, chord) => count + chord.notes.length, 0)
            ?? draft?.drumHits?.length
            ?? 0);
      }, 0),
    ]));
    expect(sourceTrackEventCounts).toEqual({
      "track-alto": 396,
      "track-tenor": 410,
      "track-piano-rh": 576,
      "track-piano-lh": 484,
      "track-guitar": 363,
      "track-bass": 514,
      "track-drums": 972,
    });
    expect(Object.values(sourceTrackEventCounts).reduce((sum, count) => sum + count, 0)).toBe(3715);

    const drumVoices = new Set(pack.drafts.flatMap((draft) =>
      draft.drumHits?.map(({ voice }) => voice) ?? []));
    expect(drumVoices).toEqual(new Set([
      "kick", "snare", "hat", "rim", "tomLow", "tomMid", "tomHigh", "crash", "ride",
    ]));

    const microtimed = pack.drafts.flatMap((draft) => [
      ...(draft.notes ?? []),
      ...(draft.harmonyChords ?? []),
      ...(draft.drumHits ?? []),
    ]).filter(({ timingOffset }) => timingOffset !== undefined);
    expect(microtimed.length).toBeGreaterThan(1_000);
    expect(microtimed.every(({ timingOffset }) =>
      timingOffset !== undefined && timingOffset >= 0 && timingOffset <= 0.99)).toBe(true);

    expect(pack.drafts.find(({ id }) => id === "memory-opening")?.notes?.map((note) => ({
      bar: note.bar,
      step: note.step,
      note: note.note,
      duration: note.duration,
    }))).toEqual([
      { bar: 3, step: 10, note: "Eb4", duration: "96i" },
      { bar: 3, step: 12, note: "Eb4", duration: "96i" },
      { bar: 3, step: 14, note: "F4", duration: "96i" },
    ]);

    expect(pack.scenePlacements.opening).toEqual({
      bass: "midi-opening-bass",
      harmony: "midi-opening-piano-rh",
      melody: "memory-opening",
    });
    expect(pack.sceneLayerStacks?.opening).toEqual({
      bass: ["midi-opening-piano-lh"],
      melody: ["midi-opening-guitar"],
    });
    expect(pack.scenePlacements.entry?.melody).toBe("midi-entry-tenor");
    expect(pack.sceneLayerStacks?.entry?.melody).toEqual([
      "midi-entry-guitar",
      "midi-entry-alto",
    ]);
    expect(pack.scenePlacements.interlude?.melody).toBeUndefined();
    expect(pack.scenePlacements["instrumental-a"]?.drums).toBeUndefined();
    expect(pack.scenePlacements["instrumental-a"]?.melody).toBe("midi-instrumental-a-guitar");
    expect(pack.scenePlacements.outro?.drums).toBeUndefined();
    expect(pack.scenePlacements.outro?.melody).toBe("midi-outro-alto");
    expect(pack.sceneLayerStacks?.outro?.melody).toEqual(["midi-outro-tenor"]);

    for (const scene of runtime.session.scenes) {
      const refs = [
        ...Object.values(scene.layers).filter((ref) => ref !== null),
        ...Object.values(scene.layerStacks ?? {}).flatMap((refs) => refs ?? []),
      ];
      expect(refs.length, `${scene.id} should contain MIDI-derived clips`).toBeGreaterThan(0);
      for (const ref of refs) {
        const material = resolveMaterial(runtime.materialBank, ref!);
        expect(material, `${scene.id}/${ref!.draftId} should resolve`).toBeDefined();
      }
    }

    expect(pack.productionChoreography.some(({ kind, target }) =>
      kind === "previewDraft" && target === "memory-opening")).toBe(true);
    expect(pack.livePerformanceChoreography.filter(({ action }) => action === "launch").map(({ target }) => target))
      .toEqual(pack.sections.map(({ id }) => id));
  });
});
