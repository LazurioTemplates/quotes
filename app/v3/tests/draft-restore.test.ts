import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { restoringOnFailure } from "../src/data/draft-restore.ts";

describe("a draft of several records that fails midway takes back what it wrote", () => {
  test("a write that fails midway gets every file back and rethrows", () => {
    const root = mkdtempSync(join(tmpdir(), "draft-restore-"));
    try {
      const kept = join(root, "kept.yaml");
      const created = join(root, "created.yaml");
      writeFileSync(kept, "before\n");
      expect(() =>
        restoringOnFailure((remember) => {
          remember(kept);
          writeFileSync(kept, "after\n");
          remember(created);
          writeFileSync(created, "new\n");
          throw new Error("disk full");
        }),
      ).toThrow("disk full");
      expect(readFileSync(kept, "utf8")).toBe("before\n");
      expect(existsSync(created)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a write that succeeds keeps what it wrote", () => {
    const root = mkdtempSync(join(tmpdir(), "draft-restore-"));
    try {
      const file = join(root, "a.yaml");
      writeFileSync(file, "before\n");
      const result = restoringOnFailure((remember) => {
        remember(file);
        writeFileSync(file, "after\n");
        return "ok";
      });
      expect(result).toBe("ok");
      expect(readFileSync(file, "utf8")).toBe("after\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
