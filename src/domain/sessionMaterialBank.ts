import type { PatternDraft } from "../types";
import type { ProductionSession } from "./sessionTypes";
import type {
  DrumHit,
  MaterialContent,
  MaterialRef,
  ProducedMaterial,
  SessionMaterialBank,
} from "./materialTypes";
export type { MaterialRef, ProducedMaterial, SessionMaterialBank, MaterialContent } from "./materialTypes";
import { materialKey } from "./materialTypes";

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintContent(content: MaterialContent): string {
  const str = stableStringify(content);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return `fp-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function drumVoiceForStep(step: number): DrumHit["voice"] {
  if (step === 4 || step === 12) return "snare";
  if (step === 0 || step === 8) return "kick";
  return "hat";
}

function inferPatternBars(draft: PatternDraft): number {
  if (draft.patternBars && Number.isInteger(draft.patternBars) && draft.patternBars > 0) return draft.patternBars;
  const bars = [
    ...(draft.notes ?? []).map((event) => event.bar ?? 0),
    ...(draft.drumHits ?? []).map((event) => event.bar),
    ...(draft.harmonyChords ?? []).map((event) => event.bar),
  ];
  return Math.max(1, ...bars.map((bar) => bar + 1));
}

export function compileDraftMaterial(draft: PatternDraft): ProducedMaterial {
  const revision = draft.revision ?? 0;
  let content: MaterialContent;

  switch (draft.kind) {
    case "drums": {
      const hits: DrumHit[] = draft.drumHits?.length
        ? structuredClone(draft.drumHits)
        : (draft.steps ?? []).map((step) => ({
          bar: 0,
          step,
          voice: drumVoiceForStep(step),
          velocity: draft.stepVelocities?.[step] ?? 0.7,
        }));
      content = { kind: "drums", patternBars: inferPatternBars(draft), hits };
      break;
    }
    case "bass":
    case "melody":
      content = { kind: draft.kind, patternBars: inferPatternBars(draft), notes: structuredClone(draft.notes ?? []) };
      break;
    case "harmony":
      content = { kind: "harmony", patternBars: inferPatternBars(draft), chords: structuredClone(draft.harmonyChords ?? []) };
      break;
    case "texture":
      content = {
        kind: "texture",
        noise: draft.textureParams?.noise ?? "brown",
        level: draft.textureParams?.level ?? 0.1,
        duration: draft.textureParams?.duration ?? "2n",
        patchId: draft.textureParams?.patchId ?? draft.id,
      };
      break;
    default:
      throw new Error(`Unknown draft kind: ${draft.kind}`);
  }

  const contentFingerprint = fingerprintContent(content);
  return { draftId: draft.id, revision, kind: draft.kind, contentFingerprint, content };
}

export function compileSessionMaterialBank(
  session: ProductionSession,
  previous: number | SessionMaterialBank = 0,
): SessionMaterialBank {
  const previousBank = typeof previous === "number" ? undefined : previous;
  const previousVersion = typeof previous === "number" ? previous : previous.version;
  const materials = new Map<string, ProducedMaterial>(previousBank?.materials ?? []);
  const latestRevision: Record<string, number> = { ...(previousBank?.latestRevision ?? {}) };

  for (const draft of Object.values(session.drafts)) {
    const produced = compileDraftMaterial(draft);
    const key = materialKey(draft.id, produced.revision);
    const previousRevision = materials.get(key);
    if (previousRevision && previousRevision.contentFingerprint !== produced.contentFingerprint) {
      throw new Error(
        `Material revision collision for ${key}: ${previousRevision.contentFingerprint} != ${produced.contentFingerprint}`,
      );
    }
    materials.set(key, produced);
    latestRevision[draft.id] = produced.revision;
  }

  return { version: previousVersion + 1, materials, latestRevision };
}

export function resolveMaterial(
  bank: SessionMaterialBank,
  ref: MaterialRef,
): ProducedMaterial | undefined {
  const material = bank.materials.get(materialKey(ref.draftId, ref.revision));
  if (!material) return undefined;
  if (material.contentFingerprint !== ref.fingerprint) return undefined;
  return material;
}

export function materialRefForDraft(draft: PatternDraft): MaterialRef {
  const produced = compileDraftMaterial(draft);
  return {
    draftId: draft.id,
    revision: produced.revision,
    fingerprint: produced.contentFingerprint,
  };
}

export function abbreviateFingerprint(fp: string): string {
  return fp.replace("fp-", "").slice(0, 8);
}
