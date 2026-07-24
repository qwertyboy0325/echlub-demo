import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseReconstructionPackJson } from "../domain/packLoader";
import {
  SHIKI_PUBLIC_PACK_ID,
  SHIKI_PUBLIC_PACK_PATH,
  SHIKI_PRIVATE_PACK_RELATIVE,
  buildArrangementSectionSnapshot,
  buildClipRevisionSnapshot,
  buildTempoSnapshot,
  buildTrackAssignmentSnapshot,
  buildTrackEventCounts,
  buildTrackFingerprints,
  collectTrackMusicalEvents,
  sha256Hex,
} from "./shikiPackIntegrity";

const PUBLIC_PACK_ABSOLUTE = join(process.cwd(), SHIKI_PUBLIC_PACK_PATH);
const PUBLIC_PACK_RAW = readFileSync(PUBLIC_PACK_ABSOLUTE, "utf8");
const pack = parseReconstructionPackJson(PUBLIC_PACK_RAW);

describe("Shiki No Uta public pack integrity", () => {
  it("preserves pack identity and file hash", () => {
    expect(pack.metadata.id).toBe(SHIKI_PUBLIC_PACK_ID);
    expect(pack.metadata.source).toBe("public-demo");
    expect(sha256Hex(PUBLIC_PACK_RAW)).toBe(
      "85fafb0a95d81f92e87e26a4941fbdd4dff783bc6c5d0743e1f6019cd7def7af",
    );
  });

  it("preserves tempo and meter snapshots", () => {
    expect(buildTempoSnapshot(pack)).toEqual({
      bpm: 91.999988,
      tempoMap: [
        { bar: 0, bpm: 91.999988 },
        { bar: 59, bpm: 91.999988 },
      ],
      timeSignatures: [{ bar: 0, numerator: 4, denominator: 4 }],
    });
  });

  it("preserves per-track note event counts", () => {
    expect(buildTrackEventCounts(pack)).toEqual({
      "track-alto": 396,
      "track-tenor": 410,
      "track-piano-rh": 576,
      "track-piano-lh": 484,
      "track-guitar": 363,
      "track-bass": 514,
      "track-drums": 972,
    });
    expect(Object.values(buildTrackEventCounts(pack)).reduce((sum, count) => sum + count, 0)).toBe(3715);
  });

  it("preserves per-track musical fingerprints", () => {
    expect(buildTrackFingerprints(pack)).toEqual({
      "track-alto": "8aca581d926c81888ba14275fe4073ec3e42b2001d7dc2ea2eec04a491910b5d",
      "track-tenor": "439eb6d9535aef2050937870dbdccedeacca17feab7a6b28c816c94e0bfc9f0a",
      "track-piano-rh": "9e3707f0bea0250e248a8770858592dbd749dd0372996a5c2ca83d90dda6df2a",
      "track-piano-lh": "eaf480c8649f7efb359691c8382e55fe339ef2f8c5b8253e48d5c58bd46c30db",
      "track-guitar": "84c4907ae969fd94f45dc18a3a382e08a4fc39fb845912c8f1c44891dbbc44a8",
      "track-bass": "0dcc7038e08121d41f57c1bff4b871bd7884f99bafcd3fb15d73d69c566a9a61",
      "track-drums": "9fd219257df6dc7e34a4a36b7c134ee3883f5703c91b55b1aa6316ebf22bf384",
    });
  });

  it("preserves opening tenor pickup pitch, timing, duration, and velocity", () => {
    expect(collectTrackMusicalEvents(pack, "track-tenor").slice(0, 3)).toEqual([
      { bar: 3, step: 10, pitch: 63, duration: "96i", velocity: 0.6299 },
      { bar: 3, step: 12, pitch: 63, duration: "96i", velocity: 0.6299 },
      { bar: 3, step: 14, pitch: 65, duration: "96i", velocity: 0.6299 },
    ]);
  });

  it("preserves clip identity and revision references", () => {
    const revisions = buildClipRevisionSnapshot(pack);
    expect(Object.keys(revisions)).toHaveLength(80);
    expect(Object.values(revisions).every((revision) => revision === 0)).toBe(true);
    expect(revisions["memory-opening"]).toBe(0);
    expect(revisions["midi-outro-alto"]).toBe(0);
  });

  it("preserves required track assignments", () => {
    expect(buildTrackAssignmentSnapshot(pack)).toEqual({
      "track-alto": {
        label: "Alto Saxophone",
        layerKind: "melody",
        draftIds: [
          "midi-entry-alto",
          "midi-lead-a-alto",
          "midi-trade-alto",
          "midi-lead-c-alto",
          "midi-lead-d-alto",
          "midi-instrumental-b-alto",
          "midi-bridge-alto",
          "midi-return-a-alto",
          "midi-return-b-alto",
          "midi-outro-alto",
        ],
      },
      "track-tenor": {
        label: "Tenor Saxophone",
        layerKind: "melody",
        draftIds: [
          "memory-opening",
          "midi-entry-tenor",
          "midi-lead-a-tenor",
          "midi-trade-tenor",
          "midi-lead-c-tenor",
          "midi-lead-d-tenor",
          "midi-instrumental-b-tenor",
          "midi-bridge-tenor",
          "midi-return-a-tenor",
          "midi-return-b-tenor",
          "midi-outro-tenor",
        ],
      },
      "track-piano-rh": {
        label: "Piano RH",
        layerKind: "harmony",
        draftIds: [
          "midi-opening-piano-rh",
          "midi-entry-piano-rh",
          "midi-lead-a-piano-rh",
          "midi-trade-piano-rh",
          "midi-lead-c-piano-rh",
          "midi-lead-d-piano-rh",
          "midi-interlude-piano-rh",
          "midi-instrumental-a-piano-rh",
          "midi-instrumental-b-piano-rh",
          "midi-bridge-piano-rh",
          "midi-return-a-piano-rh",
          "midi-return-b-piano-rh",
          "midi-outro-piano-rh",
        ],
      },
      "track-piano-lh": {
        label: "Piano LH",
        layerKind: "bass",
        draftIds: [
          "midi-opening-piano-lh",
          "midi-entry-piano-lh",
          "midi-lead-a-piano-lh",
          "midi-trade-piano-lh",
          "midi-lead-c-piano-lh",
          "midi-lead-d-piano-lh",
          "midi-interlude-piano-lh",
          "midi-instrumental-a-piano-lh",
          "midi-instrumental-b-piano-lh",
          "midi-bridge-piano-lh",
          "midi-return-a-piano-lh",
          "midi-return-b-piano-lh",
        ],
      },
      "track-guitar": {
        label: "Guitar",
        layerKind: "melody",
        draftIds: [
          "midi-opening-guitar",
          "midi-entry-guitar",
          "midi-lead-a-guitar",
          "midi-trade-guitar",
          "midi-lead-c-guitar",
          "midi-lead-d-guitar",
          "midi-instrumental-a-guitar",
          "midi-instrumental-b-guitar",
          "midi-bridge-guitar",
          "midi-return-a-guitar",
          "midi-return-b-guitar",
        ],
      },
      "track-bass": {
        label: "Bass Guitar",
        layerKind: "bass",
        draftIds: [
          "midi-opening-bass",
          "midi-entry-bass",
          "midi-lead-a-bass",
          "midi-trade-bass",
          "midi-lead-c-bass",
          "midi-lead-d-bass",
          "midi-interlude-bass",
          "midi-instrumental-a-bass",
          "midi-instrumental-b-bass",
          "midi-bridge-bass",
          "midi-return-a-bass",
          "midi-return-b-bass",
          "midi-outro-bass",
        ],
      },
      "track-drums": {
        label: "Drumset",
        layerKind: "drums",
        draftIds: [
          "midi-entry-drums",
          "midi-lead-a-drums",
          "midi-trade-drums",
          "midi-lead-c-drums",
          "midi-lead-d-drums",
          "midi-interlude-drums",
          "midi-instrumental-b-drums",
          "midi-bridge-drums",
          "midi-return-a-drums",
          "midi-return-b-drums",
        ],
      },
    });
  });

  it("preserves arrangement section inventory", () => {
    expect(buildArrangementSectionSnapshot(pack)).toEqual([
      { id: "opening", startBar: 0, bars: 4 },
      { id: "entry", startBar: 4, bars: 8 },
      { id: "lead-a", startBar: 12, bars: 8 },
      { id: "trade", startBar: 20, bars: 8 },
      { id: "lead-c", startBar: 28, bars: 8 },
      { id: "lead-d", startBar: 36, bars: 8 },
      { id: "interlude", startBar: 44, bars: 8 },
      { id: "instrumental-a", startBar: 52, bars: 8 },
      { id: "instrumental-b", startBar: 60, bars: 8 },
      { id: "bridge", startBar: 68, bars: 4 },
      { id: "return-a", startBar: 72, bars: 8 },
      { id: "return-b", startBar: 80, bars: 8 },
      { id: "outro", startBar: 88, bars: 16 },
    ]);
    expect(pack.arrangement.totalBars).toBe(104);
  });
});

describe("Shiki No Uta private boundary", () => {
  it("does not commit private reconstruction packs", () => {
    const tracked = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(tracked).toContain("local-reconstruction/");
    expect(SHIKI_PRIVATE_PACK_RELATIVE.startsWith("local-reconstruction/")).toBe(true);
  });

  it("does not embed private pack paths in public or docs trees", () => {
    const publicPack = readFileSync(join(process.cwd(), "public/shiki-no-uta.demo.pack.json"), "utf8");
    const docsPack = readFileSync(join(process.cwd(), "docs/shiki-no-uta.demo.pack.json"), "utf8");
    for (const text of [publicPack, docsPack]) {
      expect(text).not.toContain("local-reconstruction/");
      expect(text).not.toContain("shiki-no-uta-midi-only-private-v1");
      expect(text).not.toContain(SHIKI_PRIVATE_PACK_RELATIVE);
    }
  });
});
