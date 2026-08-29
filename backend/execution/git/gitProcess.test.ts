import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runGit } from "./gitProcess.js";

describe("internal Git boundary", () => {
  let root: string | undefined;
  afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

  test("disables repository hooks for managed commits", async () => {
    root = mkdtempSync(path.join(tmpdir(), "ballet-git-boundary-"));
    execFileSync("git", ["init", "-q"], { cwd: root });
    const hook = path.join(root, ".git", "hooks", "pre-commit");
    const marker = path.join(root, "hook-ran");
    writeFileSync(hook, `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o755 });
    writeFileSync(path.join(root, "tracked.txt"), "content\n");
    await runGit(["add", "tracked.txt"], { cwd: root });
    await runGit(["-c", "user.name=Test", "-c", "user.email=test@localhost", "commit", "-m", "test"], { cwd: root });
    expect(existsSync(marker)).toBe(false);
  });
});
