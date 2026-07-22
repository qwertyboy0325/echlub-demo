import { describe, expect, it } from "vitest";
import {
  SHIKI_SCORE_AUTHORITY,
  SHIKI_SCORE_PLAYBACK_SCENES,
  SHIKI_WRITTEN_MEASURES,
} from "../demo/shikiScoreAuthority";

describe("Shiki No Uta score authority", () => {
  it("accounts for every written measure and the complete 114-bar performance traversal", () => {
    expect(SHIKI_WRITTEN_MEASURES.map(({ measure }) => measure)).toEqual(
      Array.from({ length: 73 }, (_, index) => index + 1),
    );
    expect(SHIKI_SCORE_PLAYBACK_SCENES[0]?.startBar).toBe(0);
    for (let index = 1; index < SHIKI_SCORE_PLAYBACK_SCENES.length; index += 1) {
      const previous = SHIKI_SCORE_PLAYBACK_SCENES[index - 1]!;
      expect(SHIKI_SCORE_PLAYBACK_SCENES[index]!.startBar).toBe(previous.startBar + previous.bars);
    }
    const finalScene = SHIKI_SCORE_PLAYBACK_SCENES.at(-1)!;
    expect(finalScene.startBar + finalScene.bars).toBe(SHIKI_SCORE_AUTHORITY.totalBars);
  });

  it("encodes the printed Segno, To Coda, solo endings, D.S. and Coda markers", () => {
    const navigation = Object.fromEntries(
      SHIKI_WRITTEN_MEASURES.filter(({ navigation }) => navigation)
        .map(({ measure, navigation }) => [measure, navigation]),
    );
    expect(navigation).toEqual({
      29: "segno",
      44: "to-coda",
      53: "solo-repeat-start",
      60: "solo-first-ending",
      61: "solo-second-ending",
      65: "ds-al-coda",
      66: "coda",
    });
  });

  it("keeps all four printed solo passes and the D.S. return traceable to written measures", () => {
    expect(SHIKI_SCORE_PLAYBACK_SCENES.filter(({ id }) => id.startsWith("solo-")))
      .toHaveLength(4);
    expect(SHIKI_SCORE_PLAYBACK_SCENES.filter(({ pass }) => pass === "ds").map(({ writtenMeasures }) => writtenMeasures))
      .toEqual([
        Array.from({ length: 8 }, (_, index) => index + 29),
        Array.from({ length: 8 }, (_, index) => index + 37),
      ]);
  });
});
