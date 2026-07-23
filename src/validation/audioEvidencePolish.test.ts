import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  inspectReconstructionPack,
  resolveMixSubgroupTrims,
  SUBGROUP_TRIM_DB_MAX,
  SUBGROUP_TRIM_DB_MIN,
} from "../domain/reconstructionPack";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import { parseReconstructionPackJson } from "../domain/packLoader";
import { mixEquals } from "../mixMapping";
import { parsePosition, positionToTicks } from "../musicalPosition";

const PRIVATE_PACK_PATH = join(process.cwd(), "local-reconstruction/shiki-no-uta.midi-only.pack.json");
const PROTECTED_PACK_DIGEST = "d947b7206042199766d35acd70853878ddc5fa25415cf00d8f28e7ca7e7c0840";

function loadPrivateShikiPack() {
  if (!existsSync(PRIVATE_PACK_PATH)) return null;
  return parseReconstructionPackJson(readFileSync(PRIVATE_PACK_PATH, "utf8"));
}

function protectedPackDigest(pack: { arrangement: unknown; drafts: unknown }): string {
  return createHash("sha256")
    .update(JSON.stringify({ arrangement: pack.arrangement, drafts: pack.drafts }))
    .digest("hex");
}

function noteTransportTicks(sceneStartBar: number, bar: number, step: number, timingOffset = 0): number {
  return sceneStartBar * 16 + bar * 16 + step + timingOffset;
}

describe("subgroup trim contracts", () => {
  it("resolves absent trims to 0 dB for old packs", () => {
    expect(resolveMixSubgroupTrims(placeholderReconstructionPack.defaultMix)).toEqual({
      drumTrimDb: 0,
      bassTrimDb: 0,
    });
    expect(resolveMixSubgroupTrims({})).toEqual({ drumTrimDb: 0, bassTrimDb: 0 });
  });

  it("compares optional subgroup trims in mixEquals", () => {
    const base = placeholderReconstructionPack.defaultMix;
    expect(mixEquals(base, { ...base, drumTrimDb: 1.25 })).toBe(false);
    expect(mixEquals({ ...base, bassTrimDb: -2.5 }, { ...base, bassTrimDb: -2.5 })).toBe(true);
  });

  it("rejects out-of-range subgroup trims in mixAutomation patches", () => {
    const pack = structuredClone(placeholderReconstructionPack);
    pack.mixAutomation = [{
      id: "bad-trim",
      act: "canonicalPlayback",
      at: "4:0:0",
      rampSeconds: 0.1,
      patch: { drumTrimDb: SUBGROUP_TRIM_DB_MAX + 0.1 },
    }];
    const issues = inspectReconstructionPack(pack);
    expect(issues.some((issue) => issue.path === "mixAutomation[0].patch.drumTrimDb")).toBe(true);

    pack.mixAutomation![0]!.patch = { bassTrimDb: SUBGROUP_TRIM_DB_MIN - 0.1 };
    const bassIssues = inspectReconstructionPack(pack);
    expect(bassIssues.some((issue) => issue.path === "mixAutomation[0].patch.bassTrimDb")).toBe(true);
  });
});

describe("AudioEngine subgroup routing", () => {
  const graphSource = readFileSync(join(process.cwd(), "src/audio/masterAudioGraph.ts"), "utf8");
  const mixSource = readFileSync(join(process.cwd(), "src/audio/mixApplication.ts"), "utf8");
  const engineSource = readFileSync(join(process.cwd(), "src/audioEngine.ts"), "utf8");

  it("routes drums and bass through independent trims before the shared grooveGain parent", () => {
    expect(graphSource).toContain("drumBus.connect(drumTrim)");
    expect(graphSource).toContain("drumTrim.connect(grooveGain)");
    expect(graphSource).toContain("bass.chain(bassDrive, bassTrim)");
    expect(graphSource).toContain("bassTrim.connect(grooveGain)");
    expect(graphSource).toContain("drumBus.connect(drumReverbSend)");
    expect(graphSource).not.toContain("bassTrim.connect(drum");
    expect(engineSource).toContain("createMasterAudioGraph");
  });

  it("ramps, resets, scenes, and automation all patch subgroup trims", () => {
    expect(mixSource).toContain("params.drumTrimDb !== undefined");
    expect(mixSource).toContain("params.bassTrimDb !== undefined");
    expect(mixSource).toContain("graph.drumTrim.volume.setValueAtTime(subgroupTrims.drumTrimDb, atTime)");
    expect(mixSource).toContain("graph.bassTrim.volume.setValueAtTime(subgroupTrims.bassTrimDb, atTime)");
    expect(mixSource).toContain("graph.drumTrim.volume.linearRampToValueAtTime(subgroupTrims.drumTrimDb, targetTime)");
    expect(mixSource).toContain("graph.bassTrim.volume.linearRampToValueAtTime(subgroupTrims.bassTrimDb, targetTime)");
  });
});

describe("private shiki audio-evidence polish pack", () => {
  it("keeps arrangement and MIDI drafts unchanged", () => {
    const pack = loadPrivateShikiPack();
    if (!pack) return;
    expect(protectedPackDigest(pack)).toBe(PROTECTED_PACK_DIGEST);
    expect(pack.arrangement.totalBars).toBe(104);
    expect(pack.drafts.length).toBeGreaterThan(0);
  });

  it("applies interlude drum-forward subgroup trims without retuning global bass volume", () => {
    const pack = loadPrivateShikiPack();
    if (!pack) return;
    const interlude = pack.scenes.find((scene) => scene.id === "interlude");
    expect(interlude?.fx).toMatchObject({
      faders: { groove: 80 },
      drumTrimDb: 1.25,
      bassTrimDb: -2.5,
      drumFilter: 10800,
      drumReverbWet: 0,
      masterGain: 4.0,
    });
    expect(pack.soundDesign.bass.volume).toBe(-13);
  });

  it("opens Trade delay send at the target phrase boundary before restore", () => {
    const pack = loadPrivateShikiPack();
    if (!pack) return;
    const tradeStartBar = pack.scenes.find((scene) => scene.id === "trade")!.startBar;
    const targetOnsetTicks = noteTransportTicks(tradeStartBar, 6, 14, 0.6667);
    const throwEvent = pack.mixAutomation!.find((event) => event.id === "trade-delay-throw-1");
    const restoreEvent = pack.mixAutomation!.find((event) => event.id === "trade-delay-restore-1");
    expect(throwEvent?.at).toBe("26:3:3");
    expect(positionToTicks(parsePosition(throwEvent!.at))).toBeLessThanOrEqual(targetOnsetTicks + 1);
    expect(positionToTicks(parsePosition(restoreEvent!.at))).toBeGreaterThan(targetOnsetTicks);
  });

  it("opens Return-B delay send at the final sustained reed onset", () => {
    const pack = loadPrivateShikiPack();
    if (!pack) return;
    const returnBStartBar = pack.scenes.find((scene) => scene.id === "return-b")!.startBar;
    const finalReedOnsetTicks = noteTransportTicks(returnBStartBar, 7, 6);
    const throwEvent = pack.mixAutomation!.find((event) => event.id === "return-b-delay-throw-1");
    expect(throwEvent?.at).toBe("87:1:2");
    expect(positionToTicks(parsePosition(throwEvent!.at))).toBe(finalReedOnsetTicks);
  });

  it("opens Outro delay send at grid onset before the offset final reed note", () => {
    const pack = loadPrivateShikiPack();
    if (!pack) return;
    const outroStartBar = pack.scenes.find((scene) => scene.id === "outro")!.startBar;
    const gridOnsetTicks = noteTransportTicks(outroStartBar, 15, 11);
    const offsetOnsetTicks = gridOnsetTicks + 0.2;
    const throwEvent = pack.mixAutomation!.find((event) => event.id === "outro-tail-throw-1");
    expect(throwEvent?.at).toBe("103:2:3");
    expect(positionToTicks(parsePosition(throwEvent!.at))).toBeLessThanOrEqual(offsetOnsetTicks);
    expect(pack.mixAutomation?.some((event) => event.id.includes("outro-tail-restore"))).toBe(false);
  });

  it("retains macro-dynamic masterGain spread and reed attack values", () => {
    const pack = loadPrivateShikiPack();
    if (!pack) return;
    expect(pack.scenes.find((scene) => scene.id === "opening")?.fx.masterGain).toBeLessThan(
      pack.scenes.find((scene) => scene.id === "return-a")?.fx.masterGain ?? 0,
    );
    expect(pack.soundDesign.reed?.attack).toBe(0.006);
    expect(pack.soundDesign.reed?.altAttack).toBe(0.007);
  });
});
