import type { CSSProperties } from "react";
import type { ExchangeClip } from "../shell/domain/shellTypes";

/** Stable abstract bar pattern per clip identity (fixture waveforms). */
export function thumbnailStyle(clip: ExchangeClip): CSSProperties {
  let hash = 0;
  for (let i = 0; i < clip.id.length; i++) hash = (hash * 31 + clip.id.charCodeAt(i)) >>> 0;
  const bars = 12 + (hash % 8);
  const gap = 3 + (hash % 3);
  const opacity = 0.45 + (hash % 30) / 100;
  return {
    background: `repeating-linear-gradient(90deg, var(--separator) 0 1px, transparent 1px ${gap + 1}px)`,
    backgroundSize: `${bars}px 100%`,
    opacity,
  };
}
