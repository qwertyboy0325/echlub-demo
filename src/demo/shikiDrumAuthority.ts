/**
 * Drumset onsets transcribed from the owner-provided 34-page full score.
 *
 * The score uses more cymbal/tom articulations than the prototype's three
 * drum voices. Cymbal, ride and cross-stick noteheads map to `hat`; upper-drum
 * notes map to `snare`; low-drum notes map to `kick`. Pitch/orchestration is
 * simplified, but the printed onsets, rests, fills and section density remain.
 */

export type ScoreDrumVoice = "kick" | "snare" | "hat";

export interface ScoreDrumEvent {
  step: number;
  voice: ScoreDrumVoice;
  velocity: number;
}

export interface ScoreDrumMeasure {
  measure: number;
  events: readonly ScoreDrumEvent[];
}

const velocityFor = (voice: ScoreDrumVoice, step: number, sparse: boolean): number => {
  if (voice === "kick") return step % 4 === 0 ? 0.78 : 0.58;
  if (voice === "snare") return step === 4 || step === 12 ? 0.64 : 0.48;
  if (sparse) return step === 0 ? 0.42 : 0.3;
  return step === 0 ? 0.38 : (step % 4 === 0 ? 0.28 : 0.21);
};

const measure = (measureNumber: number, encoded: string): ScoreDrumMeasure => {
  const sparse = measureNumber < 13;
  return {
    measure: measureNumber,
    events: encoded.trim() === "" ? [] : encoded.trim().split(/\s+/).map((token) => {
      const [rawStep, code] = token.split(":");
      const voice = ({ k: "kick", s: "snare", h: "hat" } as const)[code as "k" | "s" | "h"];
      const step = Number(rawStep);
      return { step, voice, velocity: velocityFor(voice, step, sparse) };
    }),
  };
};

export const SHIKI_SCORE_DRUMS: readonly ScoreDrumMeasure[] = [
  measure(4, ""),
  measure(5, "0:h 1:h 6:h 8:h 15:h"),
  measure(6, "0:h 7:h 8:h 15:h"),
  measure(7, "0:h 1:h 7:h 8:h 15:h"),
  measure(8, "0:h 7:h 9:h 11:h 14:h 15:h"),
  measure(9, "0:h 1:h 7:h 8:h 11:h 12:h 13:h 15:h"),
  measure(10, "0:h 7:h 9:h 12:h 14:h 15:h"),
  measure(11, "0:h 7:h 8:h 11:h 12:h 13:h 15:h"),
  measure(12, "0:h 9:h 9:s 11:h 11:k 12:s 13:h 13:k 15:k"),

  measure(13, "0:h 0:k 2:h 4:h 4:s 6:h 8:h 8:k 10:h 10:k 13:h 13:s 15:h"),
  measure(14, "0:h 0:k 2:h 4:h 4:s 6:h 8:k 9:h 9:k 10:h 11:h 11:k 12:h 14:s 15:s"),
  measure(15, "0:h 0:k 2:h 4:h 4:s 6:h 8:h 8:k 10:h 10:k 12:h 12:s 15:h"),
  measure(16, "0:h 0:k 2:h 4:h 4:s 6:h 8:k 9:h 9:k 10:h 11:h 11:k 13:h 14:s 15:s"),
  measure(17, "0:h 0:k 2:h 4:h 4:s 6:h 8:h 8:k 10:h 10:k 12:h 12:s 15:h"),
  measure(18, "0:h 0:k 2:h 4:h 5:h 6:h 7:h 8:h 9:k 10:h 10:k 11:h 12:h 12:k 13:h 14:s 15:s"),
  measure(19, "0:h 0:k 1:s 2:s 3:h 3:k 4:s 5:s 6:h 6:k 7:s 8:s 9:h 9:k 10:s 11:s 12:h 12:k 13:h 14:h 15:h"),
  measure(20, "0:k 3:s 4:k 6:s 7:k 12:h 14:h 15:k"),

  measure(21, "0:h 0:k 2:h 4:h 4:s 6:h 8:h 8:k 10:h 10:k 12:h 12:s 15:h"),
  measure(22, "0:h 0:k 2:h 4:h 4:s 6:h 8:k 9:h 9:k 10:h 11:h 11:k 12:h 14:s 15:s"),
  measure(23, "0:h 0:k 2:h 4:h 4:s 6:h 8:h 8:k 10:h 10:k 12:h 12:s 15:h"),
  measure(24, "0:h 0:k 2:h 4:h 4:s 6:h 8:k 9:h 9:k 10:h 11:h 11:k 12:h 14:s 15:s"),
  measure(25, "0:h 0:k 2:h 4:h 4:s 6:h 8:h 8:k 10:h 10:k 12:h 12:s 15:h"),
  measure(26, "0:h 0:k 2:h 4:h 4:s 6:h 8:k 9:h 9:k 10:h 11:h 11:k 13:h 14:s 15:s"),
  measure(27, "0:h 0:k 2:h 4:h 4:s 6:h 8:h 8:k 10:h 10:k 12:h 12:s 14:h"),
  measure(28, "0:h 0:k 2:h 4:h 4:s 6:h 8:k 9:h 9:k 10:h 11:h 11:k 12:h 13:s 15:s"),

  measure(29, "0:h 0:k 2:h 4:h 4:s 6:h 8:h 8:k 10:h 10:k 12:h 12:s 15:h"),
  measure(30, "0:h 0:k 3:h 4:h 4:s 6:h 8:k 9:h 9:k 10:h 11:h 11:k 12:h 14:s 15:s"),
  measure(31, "0:h 0:k 2:h 4:h 4:s 6:h 8:h 8:k 10:h 10:k 12:h 12:s 15:h"),
  measure(32, "0:h 0:k 2:h 4:h 4:s 6:h 7:h 8:k 9:h 9:k 10:h 11:h 11:k 12:h 14:s 15:s"),
  measure(33, "0:h 0:k 2:h 3:s 4:h 4:k 6:h 6:s 8:h 8:k 10:h 11:s 13:h 13:k 15:h 15:s"),
  measure(34, "0:h 0:k 2:h 4:s 5:h 5:k 6:h 6:s 8:h 8:k 10:h 11:s 13:h 13:k 15:h 15:s"),
  measure(35, "0:h 0:k 2:h 3:s 4:h 4:k 6:h 6:s 8:h 8:k 10:h 10:k 12:h 12:k 15:h 15:k"),
  measure(36, "0:k 0:s 9:h 9:k 10:h 12:h 12:k 13:h 14:s 15:s"),

  measure(37, "0:h 0:k 2:h 3:s 4:h 4:k 6:h 6:s 8:h 8:k 10:h 11:s 12:h 12:k 15:h 15:s"),
  measure(38, "0:h 0:k 2:h 3:s 4:h 4:k 6:h 6:s 8:h 8:k 10:h 11:s 13:h 13:k 15:h 15:s"),
  measure(39, "0:h 0:k 2:h 3:s 4:h 4:k 6:h 6:s 8:h 8:k 10:h 11:s 12:h 12:k 15:h 15:s"),
  measure(40, "0:h 0:k 2:h 3:s 4:h 4:k 6:h 6:s 8:h 8:k 10:h 11:s 13:h 13:k 15:h 15:s"),
  measure(41, "0:h 0:k 2:h 3:s 4:h 4:k 6:h 6:s 8:h 8:k 10:h 11:s 12:h 12:k 14:h 14:s"),
  measure(42, "0:h 0:k 2:h 3:s 4:h 5:h 6:h 7:h 8:h 9:k 10:h 10:k 11:h 12:h 12:k 13:h 14:s 15:s"),
  measure(43, "0:h 0:k 1:s 2:s 3:h 3:k 4:s 5:s 6:h 6:k 7:s 8:s 9:h 9:k 10:s 11:s 12:h 12:k 13:h 14:h 15:h"),
  measure(44, "0:k 3:s 4:k 6:s 8:k 12:h 14:h 15:k"),
];

export const drumMeasures = (start: number, end: number): readonly ScoreDrumMeasure[] =>
  SHIKI_SCORE_DRUMS.filter(({ measure }) => measure >= start && measure <= end);
