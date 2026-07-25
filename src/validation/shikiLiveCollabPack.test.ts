import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseReconstructionPackJson } from "../domain/packLoader";
import {
  HORN_HOOK_UNIT_IDS,
  parseLiveCollabPackJson,
  SHIKI_LIVE_COLLAB_PACK_ID,
  SHIKI_LIVE_COLLAB_PACK_PATH,
  SHIKI_SOURCE_PACK_SHA,
  VERBATIM_HORN_SOURCE_DRAFTS,
} from "../domain/liveCollabPack";
import {
  SHIKI_PRIVATE_PACK_RELATIVE,
  SHIKI_PUBLIC_PACK_PATH,
  sha256Hex,
} from "./shikiPackIntegrity";
import {
  eventsMatchSourceNotes,
  expectedVerbatimEvents,
  loopEventsFingerprint,
  loopUnitInventorySummary,
} from "./liveCollabPackIntegrity";

const PUBLIC_PACK_RAW = readFileSync(join(process.cwd(), SHIKI_PUBLIC_PACK_PATH), "utf8");
const LIVE_COLLAB_RAW = readFileSync(join(process.cwd(), SHIKI_LIVE_COLLAB_PACK_PATH), "utf8");
const sourcePack = parseReconstructionPackJson(PUBLIC_PACK_RAW);
const livePack = parseLiveCollabPackJson(LIVE_COLLAB_RAW);

describe("Shiki live-collab derived pack integrity", () => {
  it("preserves original public pack SHA unchanged", () => {
    expect(sha256Hex(PUBLIC_PACK_RAW)).toBe(SHIKI_SOURCE_PACK_SHA);
  });

  it("declares derivedFrom with original pack id and SHA", () => {
    expect(livePack.id).toBe(SHIKI_LIVE_COLLAB_PACK_ID);
    expect(livePack.derivedFrom).toEqual({
      packId: "shiki-no-uta-cover-public-demo-v1",
      packSha256: SHIKI_SOURCE_PACK_SHA,
    });
  });

  it("contains 20 loop units with desk ownership", () => {
    expect(livePack.loopUnits).toHaveLength(20);
    const byDesk = Object.fromEntries(
      ["rhythm", "keys", "horns", "guitar"].map((desk) => [
        desk,
        livePack.loopUnits.filter((unit) => unit.desk === desk).length,
      ]),
    );
    expect(byDesk).toEqual({ rhythm: 5, keys: 5, horns: 6, guitar: 4 });
  });

  it("maps all 13 arrangement sections", () => {
    expect(livePack.arrangementMap).toHaveLength(13);
    expect(livePack.arrangementMap.map((entry) => entry.sectionId)).toEqual([
      "opening", "entry", "lead-a", "trade", "lead-c", "lead-d", "interlude",
      "instrumental-a", "instrumental-b", "bridge", "return-a", "return-b", "outro",
    ]);
  });

  it("keeps verbatim horn hooks aligned with source draft events", () => {
    for (const [unitId, draftId] of Object.entries(VERBATIM_HORN_SOURCE_DRAFTS)) {
      const unit = livePack.loopUnits.find((entry) => entry.id === unitId);
      expect(unit, unitId).toBeDefined();
      expect(unit?.provenance.method).toBe("verbatim");
      const expected = expectedVerbatimEvents(sourcePack, draftId, unit!.patternBars);
      expect(eventsMatchSourceNotes(unit!.events, expected)).toBe(true);
    }
  });

  it("includes recognizability horn hooks themeA trade entry tenor outro", () => {
    for (const unitId of HORN_HOOK_UNIT_IDS) {
      expect(livePack.loopUnits.some((unit) => unit.id === unitId)).toBe(true);
    }
    expect(livePack.loopUnits.some((unit) => unit.id === "mei-alto-themeA-8")).toBe(true);
    expect(livePack.loopUnits.some((unit) => unit.id === "mei-alto-trade-8")).toBe(true);
    expect(livePack.loopUnits.some((unit) => unit.id === "mei-tenor-entry-8")).toBe(true);
  });

  it("enables desk bus metadata and default desk sends", () => {
    expect(livePack.deskBus).toEqual({ enabled: true, version: 1 });
    expect(livePack.defaultMix.desk?.horns?.delaySend).toBeGreaterThan(livePack.defaultMix.desk?.rhythm?.delaySend ?? 0);
  });

  it("keeps loop units musically distinct except the known guitar duplicate", () => {
    // ren-comp-2 and ren-comp-lift-2 are byte-identical because every 8-bar guitar
    // draft in the source shares one 2-bar comp figure (clusters differ by a single
    // note at bar 6-7). No honest distinct guitar lift exists; owner decision pending
    // (drop to 19 units vs keep as a separate launch slot).
    const byFingerprint = new Map<string, string[]>();
    for (const unit of livePack.loopUnits) {
      const key = loopEventsFingerprint(unit.events);
      byFingerprint.set(key, [...(byFingerprint.get(key) ?? []), unit.id]);
    }
    const duplicateGroups = [...byFingerprint.values()].filter((ids) => ids.length > 1);
    expect(duplicateGroups).toEqual([["ren-comp-2", "ren-comp-lift-2"]]);
  });

  it("gives the harmony lift unit real material distinct from the pad", () => {
    const pad = livePack.loopUnits.find((unit) => unit.id === "kai-rh-pad-4")!;
    const lift = livePack.loopUnits.find((unit) => unit.id === "kai-rh-lift-4")!;
    expect(loopEventsFingerprint(lift.events)).not.toBe(loopEventsFingerprint(pad.events));
    expect(lift.provenance.sourceDraftIds).toEqual(["midi-interlude-piano-rh"]);
    expect(lift.events.length).toBeGreaterThan(pad.events.length);
  });

  it("places the dense RH lift only in the interlude section, pad elsewhere", () => {
    for (const entry of livePack.arrangementMap) {
      const rh = entry.placements["track-piano-rh"];
      if (!rh) continue;
      if (entry.sectionId === "interlude") expect(rh).toBe("kai-rh-lift-4");
      else expect(rh).toBe("kai-rh-pad-4");
    }
  });

  it("does not embed private pack paths", () => {
    expect(LIVE_COLLAB_RAW).not.toContain("local-reconstruction/");
    expect(LIVE_COLLAB_RAW).not.toContain(SHIKI_PRIVATE_PACK_RELATIVE);
    expect(LIVE_COLLAB_RAW).not.toContain("shiki-no-uta-midi-only-private-v1");
  });

  it("exposes unit inventory summary for evidence", () => {
    const summary = loopUnitInventorySummary(livePack);
    expect(summary).toHaveLength(20);
    expect(summary.every((row) => row.eventCount > 0 || row.method === "extract")).toBe(true);
  });
});
