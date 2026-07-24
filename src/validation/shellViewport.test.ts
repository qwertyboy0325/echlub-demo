import { describe, expect, it } from "vitest";
import { viewportModeForSize } from "../shell/domain/shellTypes";

describe("viewportModeForSize", () => {
  it("selects wide at 1440", () => {
    expect(viewportModeForSize(1440, 900)).toBe("wide");
    expect(viewportModeForSize(1440, 810)).toBe("wide");
  });

  it("selects drawer between 1280 and 1359", () => {
    expect(viewportModeForSize(1280, 800)).toBe("drawer");
    expect(viewportModeForSize(1359, 900)).toBe("drawer");
  });

  it("selects compact at 1280x720", () => {
    expect(viewportModeForSize(1280, 720)).toBe("compact");
  });
});
