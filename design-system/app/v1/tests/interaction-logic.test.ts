import { describe, expect, test } from "bun:test";
import { focusReturn } from "../src/lib/focus-return";
import { rowsMatching } from "../src/lib/search";

describe("search on a table page", () => {
  const rows = [
    "price comparison pages refurbished laptops",
    "localized spreadsheet templates template marketplace",
  ];

  test("matches name or mechanism, ignoring case and surrounding spaces", () => {
    expect(rowsMatching(rows, "  SpreadSheet ")).toEqual([false, true]);
    expect(rowsMatching(rows, "laptops")).toEqual([true, false]);
  });

  test("an empty query shows every row, a query without a match none", () => {
    expect(rowsMatching(rows, "")).toEqual([true, true]);
    expect(rowsMatching(rows, "zzz")).toEqual([false, false]);
  });
});

describe("focus after a toast leaves", () => {
  const usable = { connected: true, inClosedDialog: false, disabled: false };

  test("returns to where it came from when that can take focus", () => {
    expect(focusReturn(usable)).toBe("origin");
  });

  test("goes to the main region when the origin is gone, in a closed dialog or disabled", () => {
    expect(focusReturn(null)).toBe("main");
    expect(focusReturn({ ...usable, connected: false })).toBe("main");
    expect(focusReturn({ ...usable, inClosedDialog: true })).toBe("main");
    expect(focusReturn({ ...usable, disabled: true })).toBe("main");
  });
});
