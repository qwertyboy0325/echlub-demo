import { placeholderReconstructionPack } from "./placeholderPack";
import {
  assertValidReconstructionPack,
  type ReconstructionPack,
} from "./reconstructionPack";

export const DEV_LOCAL_PACK_GLOBAL = "__ECHLUB_RECONSTRUCTION_PACK__" as const;

export interface ReconstructionPackTextFile {
  name?: string;
  text(): Promise<string>;
}

function cloneValidatedPack(input: unknown): ReconstructionPack {
  assertValidReconstructionPack(input);
  return structuredClone(input);
}

/** Parse owner-local JSON without retaining a reference to mutable input data. */
export function parseReconstructionPackJson(json: string): ReconstructionPack {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid reconstruction pack JSON: ${detail}`);
  }
  return cloneValidatedPack(parsed);
}

/** Browser/dev-local File adapter. The selected file is never uploaded by this code. */
export async function importReconstructionPackFile(file: ReconstructionPackTextFile): Promise<ReconstructionPack> {
  try {
    return parseReconstructionPackJson(await file.text());
  } catch (error) {
    const label = file.name ? ` ${file.name}` : "";
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not import reconstruction pack${label}: ${detail}`);
  }
}

function readDevLocalInjection(): unknown {
  const globals = globalThis as typeof globalThis & {
    __ECHLUB_RECONSTRUCTION_PACK__?: unknown;
  };
  return globals[DEV_LOCAL_PACK_GLOBAL];
}

/**
 * Load a validated pack synchronously.
 *
 * Dev-local use can pass parsed JSON directly or set
 * `globalThis.__ECHLUB_RECONSTRUCTION_PACK__` before the app starts. A JSON
 * string is accepted for convenient script-tag injection. No private pack or
 * reference asset is bundled by the application.
 */
export function loadReconstructionPack(source: unknown = readDevLocalInjection()): ReconstructionPack {
  if (source === undefined) return cloneValidatedPack(placeholderReconstructionPack);
  if (typeof source === "string") return parseReconstructionPackJson(source);
  return cloneValidatedPack(source);
}
