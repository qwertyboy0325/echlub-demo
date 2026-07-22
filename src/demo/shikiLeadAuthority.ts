/**
 * Concert-pitch lead extracted from the owner-provided 34-page full score.
 *
 * A uses the written tenor-sax melody. B/C/D use the written alto-sax upper
 * melody when both saxes sound; the other sax remains a separate harmony
 * voice. Steps use EchLub's 16-step-per-4/4-bar grid.
 */

export interface ScoreLeadEvent {
  step: number;
  note: string;
  duration?: "16n" | "8n" | "8n." | "4n" | "2n";
}

export interface ScoreLeadMeasure {
  measure: number;
  sourceStaff: "tenor-sax" | "alto-sax";
  events: readonly ScoreLeadEvent[];
}

const e = (step: number, note: string, duration?: ScoreLeadEvent["duration"]): ScoreLeadEvent => ({
  step,
  note,
  ...(duration ? { duration } : {}),
});

const measure = (
  measureNumber: number,
  sourceStaff: ScoreLeadMeasure["sourceStaff"],
  steps: readonly number[],
  notes: readonly string[],
  sustainedIndexes: Readonly<Record<number, ScoreLeadEvent["duration"]>> = {},
): ScoreLeadMeasure => ({
  measure: measureNumber,
  sourceStaff,
  events: notes.map((note, index) => e(steps[index]!, note, sustainedIndexes[index])),
});

const A_PICKUP = [13, 14, 15];
const A_8A = [0, 2, 4, 6, 8, 10, 12, 15];
const A_8B = [0, 1, 4, 6, 8, 10, 12, 14];
const A_6 = [0, 2, 4, 6, 8, 15];
const STRAIGHT_8 = [0, 2, 4, 6, 8, 10, 12, 14];
const B_7 = [0, 3, 6, 8, 10, 12, 15];
const B_6 = [0, 3, 4, 13, 14, 15];
const B_10 = [0, 3, 6, 7, 8, 9, 10, 12, 13, 14];
const B_10_CONNECTED = [0, 2, 3, 4, 5, 6, 8, 13, 14, 15];
const B_8 = [0, 3, 6, 8, 10, 12, 14, 15];
const B_9 = [1, 3, 5, 7, 9, 11, 13, 14, 15];
const B_8_TURN = [0, 3, 4, 6, 8, 9, 12, 14];
const B_6_END = [0, 2, 3, 5, 6, 8];

export const SHIKI_SCORE_LEAD: readonly ScoreLeadMeasure[] = [
  measure(4, "tenor-sax", A_PICKUP, ["Eb4", "Eb4", "F4"]),
  measure(5, "tenor-sax", A_8A, ["Eb4", "F4", "Bb3", "Db4", "Eb4", "F4", "Ab4", "F4"]),
  measure(6, "tenor-sax", A_8B, ["Ab4", "Bb4", "Ab4", "Bb4", "Db5", "C5", "Ab4", "F4"]),
  measure(7, "tenor-sax", A_6, ["Eb4", "F4", "Bb3", "Db4", "Ab4", "Eb4"]),
  measure(8, "tenor-sax", STRAIGHT_8, ["Eb4", "F4", "Bb3", "Db4", "Bb4", "Ab4", "F4", "Eb4"]),
  measure(9, "tenor-sax", A_8A, ["Eb4", "F4", "Bb3", "Db4", "Eb4", "F4", "Ab4", "F4"]),
  measure(10, "tenor-sax", A_8B, ["Ab4", "Bb4", "Ab4", "Bb4", "Db5", "C5", "Ab4", "F4"]),
  measure(11, "tenor-sax", A_6, ["Eb4", "F4", "Bb3", "Db4", "Ab4", "Eb4"]),
  measure(12, "tenor-sax", STRAIGHT_8, ["Eb4", "F4", "Eb4", "F4", "Bb4", "F4", "F4", "F4"]),

  measure(13, "alto-sax", B_7, ["Ab4", "Bb4", "F4", "F4", "Eb4", "Db4", "Eb4"]),
  measure(14, "alto-sax", B_6, ["Eb4", "Db4", "B3", "Bb4", "Bb4", "Bb4"], { 2: "2n" }),
  measure(15, "alto-sax", B_10, ["Ab4", "Bb4", "Db4", "F4", "F4", "F4", "F4", "F4", "F4", "F4"]),
  measure(16, "alto-sax", B_10_CONNECTED, ["Eb4", "F4", "Gb4", "Gb4", "F4", "F4", "F4", "Bb4", "Bb4", "Bb4"]),
  measure(17, "alto-sax", B_8, ["Ab4", "Bb4", "F4", "F4", "F4", "F4", "F4", "F4"]),
  measure(18, "alto-sax", B_9, ["F4", "F4", "Db4", "Eb4", "Db4", "Bb3", "Bb4", "Bb4", "Bb4"]),
  measure(19, "alto-sax", B_8_TURN, ["B4", "F4", "F4", "F4", "Eb4", "Eb4", "B3", "Db4"]),
  measure(20, "alto-sax", B_6_END, ["B3", "Bb3", "B3", "Db4", "B3", "B3"], { 5: "2n" }),

  measure(29, "alto-sax", A_8A, ["Eb4", "F4", "Bb3", "Db4", "Eb4", "F4", "Ab4", "F4"]),
  measure(30, "alto-sax", A_8B, ["Ab4", "Bb4", "Ab4", "Bb4", "Db5", "B4", "Ab4", "F4"]),
  measure(31, "alto-sax", A_6, ["Eb4", "F4", "Bb3", "Db4", "Ab4", "Eb4"]),
  measure(32, "alto-sax", B_9, ["Eb4", "F4", "Bb3", "Db4", "Ab4", "Bb4", "Ab4", "F4", "Eb4"]),
  measure(33, "alto-sax", A_8A, ["Eb4", "F4", "Bb3", "Db4", "Eb4", "F4", "Ab4", "F4"]),
  measure(34, "alto-sax", A_8B, ["Ab4", "Bb4", "Ab4", "Bb4", "Db5", "B4", "Ab4", "F4"]),
  measure(35, "alto-sax", A_6, ["Eb4", "F4", "Bb3", "Db4", "Ab4", "Eb4"]),
  measure(36, "alto-sax", B_9, ["Eb4", "F4", "Eb4", "F4", "Bb4", "F4", "Bb4", "Bb4", "Bb4"]),

  measure(37, "alto-sax", B_7, ["Ab4", "Bb4", "F4", "F4", "Eb4", "Db4", "Eb4"]),
  measure(38, "alto-sax", B_6, ["Eb4", "Db4", "B3", "Bb4", "Bb4", "Bb4"], { 2: "2n" }),
  measure(39, "alto-sax", B_10, ["Ab4", "Bb4", "Db4", "F4", "F4", "F4", "F4", "F4", "F4", "F4"]),
  measure(40, "alto-sax", B_10_CONNECTED, ["Eb4", "F4", "Gb4", "Gb4", "F4", "F4", "F4", "Bb4", "Bb4", "Bb4"]),
  measure(41, "alto-sax", B_8, ["Ab4", "Bb4", "F4", "F4", "F4", "F4", "F4", "F4"]),
  measure(42, "alto-sax", B_9, ["F4", "F4", "Db4", "Eb4", "Db4", "Bb3", "Bb4", "Bb4", "Bb4"]),
  measure(43, "alto-sax", B_8_TURN, ["B4", "F4", "F4", "F4", "Eb4", "Eb4", "B3", "Db4"]),
  measure(44, "alto-sax", B_6_END, ["B3", "Bb3", "B3", "Db4", "B3", "B3"], { 5: "2n" }),
];

export const leadMeasures = (start: number, end: number): readonly ScoreLeadMeasure[] =>
  SHIKI_SCORE_LEAD.filter(({ measure }) => measure >= start && measure <= end);
