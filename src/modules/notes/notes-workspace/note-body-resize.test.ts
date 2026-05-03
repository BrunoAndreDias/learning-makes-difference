import { describe, expect, it } from "vitest";

import {
  getNoteBodyFractionFromBodyWidth,
  getNoteBodyFractionFromPointer,
} from "./note-body-resize";

describe("note body resize", () => {
  it("maps the pointer to the center of the divider inside the available resize track", () => {
    const fraction = getNoteBodyFractionFromPointer(
      {
        columnGap: 16,
        layoutLeft: 100,
        layoutWidth: 1000,
        pointerClientX: 100 + 16 + 8 + 0.5 * (1000 - 16 - 32),
        splitterWidth: 16,
      },
      {
        maxFraction: 0.95,
        minFraction: 0.35,
      },
    );

    expect(fraction).toBe(0.5);
  });

  it("clamps pointer movement to the supported body width range", () => {
    const limits = {
      maxFraction: 0.95,
      minFraction: 0.35,
    };

    expect(
      getNoteBodyFractionFromPointer(
        {
          columnGap: 16,
          layoutLeft: 100,
          layoutWidth: 1000,
          pointerClientX: 0,
          splitterWidth: 16,
        },
        limits,
      ),
    ).toBe(0.35);

    expect(
      getNoteBodyFractionFromPointer(
        {
          columnGap: 16,
          layoutLeft: 100,
          layoutWidth: 1000,
          pointerClientX: 1200,
          splitterWidth: 16,
        },
        limits,
      ),
    ).toBe(0.95);
  });

  it("maps measured body width to the same available resize track", () => {
    expect(
      getNoteBodyFractionFromBodyWidth(
        0.75 * (1000 - 16 - 32),
        {
          columnGap: 16,
          layoutLeft: 100,
          layoutWidth: 1000,
          splitterWidth: 16,
        },
        {
          maxFraction: 0.95,
          minFraction: 0.35,
        },
      ),
    ).toBe(0.75);
  });
});
