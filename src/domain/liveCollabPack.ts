import type { SoundDesignPreset } from "./reconstructionPack";
import type { MixParams } from "../types";

export const SHIKI_LIVE_COLLAB_PACK_PATH = "public/shiki-no-uta.live-collab.pack.json";
export const SHIKI_LIVE_COLLAB_PACK_ID = "shiki-no-uta-live-collab-demo-v1";
export const SHIKI_SOURCE_PACK_SHA = "85fafb0a95d81f92e87e26a4941fbdd4dff783bc6c5d0743e1f6019cd7def7af";

export type LiveCollabDeskId = "rhythm" | "keys" | "horns" | "guitar";
export type LoopUnitMethod = "extract" | "collapse" | "verbatim" | "mutate-fork";

export interface LoopUnitEvent {
  type: "note" | "chord" | "drum";
  bar: number;
  step: number;
  pitch?: number | string;
  duration?: string;
  velocity?: number;
  instrument?: string;
  voice?: string;
  notes?: string[];
}

export interface LoopUnitProvenance {
  sourceDraftIds: string[];
  method: LoopUnitMethod;
}

export interface LoopUnit {
  id: string;
  desk: LiveCollabDeskId;
  role: string;
  patternBars: number;
  trackIds: string[];
  events: LoopUnitEvent[];
  provenance: LoopUnitProvenance;
  loop: boolean;
}

export interface LoopUnitSpec extends Omit<LoopUnit, "events" | "provenance"> {
  sourceDraftIds: string[];
  method: LoopUnitMethod;
  build?: () => LoopUnitEvent[];
}

export interface ArrangementMapEntry {
  sectionId: string;
  placements: Record<string, string>;
}

export interface LiveCollabPackDerivedFrom {
  packId: string;
  packSha256: string;
}

export interface LiveCollabPack {
  schemaVersion: 1;
  id: string;
  derivedFrom: LiveCollabPackDerivedFrom;
  metadata: {
    title: string;
    bpm: number;
    totalBars: number;
    sectionCount: number;
  };
  deskBus: { enabled: boolean; version: number };
  participants: Array<{
    id: string;
    name: string;
    desk: LiveCollabDeskId;
    trackIds: string[];
  }>;
  loopUnits: LoopUnit[];
  arrangementMap: ArrangementMapEntry[];
  soundDesign: SoundDesignPreset;
  defaultMix: MixParams;
  sections: Array<{ id: string; label: string; startBar: number; bars: number }>;
}

export const HORN_HOOK_UNIT_IDS = [
  "mei-tenor-entry-8",
  "mei-alto-themeA-8",
  "mei-alto-themeB-8",
  "mei-alto-trade-8",
  "mei-outro-4",
] as const;

export const VERBATIM_HORN_SOURCE_DRAFTS: Record<string, string> = {
  "mei-tenor-entry-8": "midi-entry-tenor",
  "mei-alto-themeA-8": "midi-lead-a-alto",
  "mei-alto-themeB-8": "midi-lead-c-alto",
  "mei-alto-trade-8": "midi-trade-alto",
};

export function parseLiveCollabPackJson(json: string): LiveCollabPack {
  const pack = JSON.parse(json) as LiveCollabPack;
  if (pack.schemaVersion !== 1) throw new Error("Unsupported live-collab pack schema");
  if (pack.id !== SHIKI_LIVE_COLLAB_PACK_ID) throw new Error(`Unexpected pack id: ${pack.id}`);
  return pack;
}
