/**
 * Song-specific score authority for the recordable Shiki No Uta prototype.
 *
 * This is deliberately not a generic score-import model. It records only the
 * written form facts needed to keep the demo's clips, scenes and UI attached
 * to the owner-provided full score. Audio analysis may influence sound design,
 * never pitch or form in this file.
 */

export type ScoreSectionId =
  | "intro"
  | "a"
  | "b"
  | "sax-trading"
  | "c"
  | "d"
  | "interlude"
  | "solos"
  | "post-solo"
  | "drum-solo"
  | "coda";

export interface WrittenScoreMeasure {
  measure: number;
  section: ScoreSectionId;
  harmony: "Gbmaj9/Fm7" | "Bbm" | "carry-notated-voicing";
  lead: "rest" | "tenor" | "alto" | "tenor-and-alto" | "improvised";
  navigation?: "segno" | "to-coda" | "solo-repeat-start" | "solo-first-ending" | "solo-second-ending" | "ds-al-coda" | "coda";
}

export interface ScorePlaybackScene {
  id: string;
  label: string;
  startBar: number;
  bars: number;
  writtenMeasures: readonly number[];
  pass: "preroll" | "first" | "solo-alto-1" | "solo-alto-2" | "solo-tenor-1" | "solo-tenor-2" | "ds" | "coda";
  template: "opening" | "groove" | "tease" | "release" | "recompose" | "return";
  description: string;
}

const range = (start: number, end: number): number[] =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const sectionForMeasure = (measure: number): ScoreSectionId => {
  if (measure <= 3) return "intro";
  if (measure <= 12) return "a";
  if (measure <= 20) return "b";
  if (measure <= 28) return "sax-trading";
  if (measure <= 36) return "c";
  if (measure <= 44) return "d";
  if (measure <= 52) return "interlude";
  if (measure <= 61) return "solos";
  if (measure <= 65) return "post-solo";
  if (measure === 66) return "drum-solo";
  return "coda";
};

const harmonyForMeasure = (measure: number): WrittenScoreMeasure["harmony"] => {
  if (measure >= 66) return "carry-notated-voicing";
  if (measure === 61 || measure === 63 || measure === 65) return "Bbm";
  if (measure >= 62) return "Gbmaj9/Fm7";
  return measure % 2 === 1 ? "Gbmaj9/Fm7" : "Bbm";
};

const leadForMeasure = (measure: number): WrittenScoreMeasure["lead"] => {
  if (measure <= 3 || (measure >= 45 && measure <= 52) || (measure >= 62 && measure <= 65)) return "rest";
  if (measure >= 53 && measure <= 60) return "improvised";
  if (measure === 66) return "tenor-and-alto";
  if (measure >= 67) return "tenor-and-alto";
  if (measure >= 21 && measure <= 28) return measure % 2 === 1 ? "tenor" : "alto";
  if (measure >= 29 && measure <= 44) return "alto";
  return "tenor-and-alto";
};

const navigationForMeasure = (measure: number): WrittenScoreMeasure["navigation"] | undefined => ({
  29: "segno",
  44: "to-coda",
  53: "solo-repeat-start",
  60: "solo-first-ending",
  61: "solo-second-ending",
  65: "ds-al-coda",
  66: "coda",
})[measure] as WrittenScoreMeasure["navigation"] | undefined;

export const SHIKI_WRITTEN_MEASURES: readonly WrittenScoreMeasure[] = range(1, 73).map((measure) => ({
  measure,
  section: sectionForMeasure(measure),
  harmony: harmonyForMeasure(measure),
  lead: leadForMeasure(measure),
  ...(navigationForMeasure(measure) ? { navigation: navigationForMeasure(measure) } : {}),
}));

/**
 * One concept-video preroll bar plus the score traversal:
 * 1-60, three further 53-60 solo passes, 61-65, D.S. 29-44, Coda 66-73.
 * This produces the existing 114-bar browser duration without inventing
 * additional scored measures.
 */
export const SHIKI_SCORE_PLAYBACK_SCENES: readonly ScorePlaybackScene[] = [
  { id: "opening", label: "Preroll + Intro · score mm. 1–3", startBar: 0, bars: 4, writtenMeasures: range(1, 3), pass: "preroll", template: "opening", description: "One production preroll bar, then the score's three-measure Intro with piano, guitar and bass foundation." },
  { id: "section-a", label: "A · score mm. 4–12", startBar: 4, bars: 9, writtenMeasures: range(4, 12), pass: "first", template: "groove", description: "The first written theme enters; the scene length follows the score instead of an audio-derived loop." },
  { id: "section-b", label: "B · score mm. 13–20", startBar: 13, bars: 8, writtenMeasures: range(13, 20), pass: "first", template: "release", description: "The B section adds the denser ensemble response shown in the score." },
  { id: "sax-trading", label: "Sax trading · score mm. 21–28", startBar: 21, bars: 8, writtenMeasures: range(21, 28), pass: "first", template: "tease", description: "Written tenor and alto phrases trade over the continuing rhythm section." },
  { id: "section-c", label: "C · score mm. 29–36", startBar: 29, bars: 8, writtenMeasures: range(29, 36), pass: "first", template: "release", description: "The Segno section begins at written measure 29." },
  { id: "section-d", label: "D · score mm. 37–44", startBar: 37, bars: 8, writtenMeasures: range(37, 44), pass: "first", template: "release", description: "The written D section reaches the To Coda marker at measure 44." },
  { id: "interlude", label: "Interlude · score mm. 45–52", startBar: 45, bars: 8, writtenMeasures: range(45, 52), pass: "first", template: "recompose", description: "Sax rests while piano, guitar, bass and drums carry the eight-measure interlude." },
  { id: "solo-alto-1", label: "Solo · alto pass 1 · score mm. 53–60", startBar: 53, bars: 8, writtenMeasures: range(53, 60), pass: "solo-alto-1", template: "tease", description: "First improvised solo chorus over the score's notated harmonic framework." },
  { id: "solo-alto-2", label: "Solo · alto pass 2 · score mm. 53–60", startBar: 61, bars: 8, writtenMeasures: range(53, 60), pass: "solo-alto-2", template: "tease", description: "Second alto chorus; variation is performance-authored, harmony remains score-bound." },
  { id: "solo-tenor-1", label: "Solo · tenor pass 1 · score mm. 53–60", startBar: 69, bars: 8, writtenMeasures: range(53, 60), pass: "solo-tenor-1", template: "tease", description: "First tenor chorus over the same written eight-measure solo framework." },
  { id: "solo-tenor-2", label: "Solo · tenor pass 2 · score mm. 53–60", startBar: 77, bars: 8, writtenMeasures: range(53, 60), pass: "solo-tenor-2", template: "tease", description: "Second tenor chorus completes the score's 'Solos 2x each' instruction." },
  { id: "post-solo", label: "Second ending + D.S. · score mm. 61–65", startBar: 85, bars: 5, writtenMeasures: range(61, 65), pass: "first", template: "recompose", description: "The second ending leads to D.S. al Coda at written measure 65." },
  { id: "ds-section-c", label: "D.S. return · C · score mm. 29–36", startBar: 90, bars: 8, writtenMeasures: range(29, 36), pass: "ds", template: "release", description: "Playback obeys the Segno and returns to section C using the same materials." },
  { id: "ds-section-d", label: "D.S. return · D · score mm. 37–44", startBar: 98, bars: 8, writtenMeasures: range(37, 44), pass: "ds", template: "release", description: "The repeated D section reaches To Coda and jumps out at written measure 44." },
  { id: "drum-solo", label: "Coda entry · drum solo · score m. 66", startBar: 106, bars: 1, writtenMeasures: [66], pass: "coda", template: "recompose", description: "The score-marked one-measure drum feature clears all pitched layers." },
  { id: "coda", label: "Coda · score mm. 67–73", startBar: 107, bars: 7, writtenMeasures: range(67, 73), pass: "coda", template: "return", description: "The written ensemble hits close the score; no unrelated outro loop is substituted." },
];

export const SHIKI_SCORE_TOTAL_BARS = 114;

export const SHIKI_SCORE_AUTHORITY = {
  sourcePriority: ["owner-full-score", "owner-piano-reduction", "owner-tabs", "owner-recording-performance-only"] as const,
  meter: { numerator: 4, denominator: 4 },
  bpm: 92,
  writtenMeasureCount: 73,
  prerollBars: 1,
  writtenMeasures: SHIKI_WRITTEN_MEASURES,
  playbackScenes: SHIKI_SCORE_PLAYBACK_SCENES,
  totalBars: SHIKI_SCORE_TOTAL_BARS,
} as const;
