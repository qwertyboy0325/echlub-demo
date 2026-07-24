import type { CSSProperties } from "react";
import type { ExchangeClip } from "../shell/domain/shellTypes";

/** Stable MIDI/rhythm thumbnail pattern per clip identity. */
export function thumbnailStyle(clip: ExchangeClip): CSSProperties {
  let hash = 0;
  for (let i = 0; i < clip.id.length; i++) hash = (hash * 31 + clip.id.charCodeAt(i)) >>> 0;

  if (clip.thumbnail === "steps") {
    const stepPattern = [0.2, 0, 0.55, 0, 0.35, 0, 0.7, 0, 0.45, 0.15, 0.6, 0];
    return {
      backgroundImage: stepPattern
        .map((h, i) => {
          const active = (hash >> i) & 1;
          const height = active ? h : 0.08;
          const top = Math.round((1 - height) * 100);
          return `linear-gradient(to bottom, transparent ${top}%, var(--text) ${top}%)`;
        })
        .join(", "),
      backgroundSize: stepPattern.map(() => "6px 100%").join(", "),
      backgroundPosition: stepPattern.map((_, i) => `${i * 8 + 2}px 0`).join(", "),
      backgroundRepeat: "no-repeat",
      opacity: 0.75,
    };
  }

  if (clip.thumbnail === "notes") {
    const noteHeights = [0.35, 0.55, 0.25, 0.65, 0.4, 0.5, 0.3, 0.6, 0.45, 0.35];
    return {
      backgroundImage: noteHeights
        .map((h) => {
          const top = Math.round((1 - h) * 100);
          return `linear-gradient(to bottom, transparent ${top}%, var(--selection) ${top}%)`;
        })
        .join(", "),
      backgroundSize: noteHeights.map(() => "8px 100%").join(", "),
      backgroundPosition: noteHeights.map((_, i) => `${i * 10 + 2}px 0`).join(", "),
      backgroundRepeat: "no-repeat",
      opacity: 0.8,
    };
  }

  const waveHeights = [0.3, 0.5, 0.7, 0.45, 0.85, 0.55, 0.4, 0.75, 0.35, 0.6, 0.5, 0.8];
  return {
    backgroundImage: waveHeights
      .map((h) => {
        const top = Math.round((1 - h) * 100);
        return `linear-gradient(to bottom, transparent ${top}%, var(--meter) ${top}%)`;
      })
      .join(", "),
    backgroundSize: waveHeights.map(() => "3px 100%").join(", "),
    backgroundPosition: waveHeights.map((_, i) => `${i * 5 + 1}px 0`).join(", "),
    backgroundRepeat: "no-repeat",
    opacity: 0.85,
  };
}
