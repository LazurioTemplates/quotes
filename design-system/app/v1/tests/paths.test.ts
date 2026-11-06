import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

// A content repository checks on Linux that every path can be checked out on
// Windows, reading the real names from Git (Lazurio Module Standard, CI).
const root = resolve(import.meta.dir, "../../..");
const RESERVED = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$/i;
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what Windows refuses
const FORBIDDEN = /[<>:"|?*\\\u0000-\u001f]/;

function trackedPaths(): string[] {
  const run = Bun.spawnSync(["git", "-c", "core.quotePath=false", "ls-files", "-z"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (run.exitCode !== 0) throw new Error(`git ls-files failed: ${run.stderr.toString()}`);
  return run.stdout.toString().split("\0").filter(Boolean);
}

describe("paths", () => {
  const paths = trackedPaths();

  test("every tracked path is a valid Windows path", () => {
    const invalid = paths.filter((path) =>
      path
        .split("/")
        .some(
          (segment) =>
            FORBIDDEN.test(segment) ||
            RESERVED.test(segment) ||
            segment.endsWith(".") ||
            segment.endsWith(" "),
        ),
    );
    expect(invalid).toEqual([]);
  });

  test("no two tracked paths differ only in case", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const path of paths) {
      const key = path.toLowerCase();
      const other = seen.get(key);
      if (other) clashes.push(`${other} ~ ${path}`);
      seen.set(key, path);
    }
    expect(clashes).toEqual([]);
  });
});
