import { placeholderReconstructionPack } from "./placeholderPack";
import type { ReconstructionPack } from "./reconstructionPack";
import { validatePack } from "./reconstructionPack";

/**
 * Loads reconstruction pack. Private local packs are not bundled;
 * browser runtime uses placeholder unless owner injects via dev hook.
 */
export function loadReconstructionPack(): ReconstructionPack {
  const pack = placeholderReconstructionPack;
  const errors = validatePack(pack);
  if (errors.length) throw new Error(`Invalid reconstruction pack: ${errors.join("; ")}`);
  return pack;
}
