import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { parseConfigStatus, readProjectConfigStatus } from "../project/configGitStatus.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project config Git status", () => {
  it("normalizes and sorts config changes without invoking Git mutations", () => {
    expect(parseConfigStatus([
      " M .ballet/project.json",
      "?? .ballet/runtime.json",
      "R  .codex/agents/new.toml",
      ".codex/agents/old.toml",
      ""
    ].join("\0"))).toEqual([
      { path: ".ballet/project.json", status: "modified" },
      { path: ".ballet/runtime.json", status: "untracked" },
      { path: ".codex/agents/new.toml", status: "renamed" },
      { path: ".codex/agents/old.toml", status: "deleted" }
    ]);
  });

  it("reports only portable config roots and leaves HEAD and the index untouched", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-config-status-"));
    roots.push(root);
    await execFileAsync("git", ["init", "-b", "main"], { cwd: root });
    await execFileAsync("git", ["config", "user.name", "Ballet Test"], { cwd: root });
    await execFileAsync("git", ["config", "user.email", "ballet@example.test"], { cwd: root });
    await mkdir(path.join(root, ".ballet"), { recursive: true });
    await mkdir(path.join(root, ".codex", "agents"), { recursive: true });
    await mkdir(path.join(root, ".agents", "skills", "review"), { recursive: true });
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, ".ballet", "project.json"), "{}\n");
    await writeFile(path.join(root, ".codex", "agents", "review.toml"), "name = \"Review\"\n");
    await writeFile(path.join(root, ".agents", "skills", "review", "SKILL.md"), "# Review\n");
    await writeFile(path.join(root, "src", "app.ts"), "export {};\n");
    await execFileAsync("git", ["add", "-A"], { cwd: root });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: root });
    const headBefore = (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
    const indexBefore = await readFile(path.join(root, ".git", "index"));

    await writeFile(path.join(root, ".ballet", "runtime.json"), "{\"version\":1,\"agents\":{}}\n");
    await writeFile(path.join(root, ".codex", "agents", "review.toml"), "name = \"Strict review\"\n");
    await rm(path.join(root, ".agents", "skills", "review", "SKILL.md"));
    await writeFile(path.join(root, "src", "app.ts"), "export const changed = true;\n");

    await expect(readProjectConfigStatus(root)).resolves.toEqual({
      clean: false,
      changes: [
        { path: ".agents/skills/review/SKILL.md", status: "deleted" },
        { path: ".ballet/runtime.json", status: "untracked" },
        { path: ".codex/agents/review.toml", status: "modified" }
      ]
    });
    expect((await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim()).toBe(headBefore);
    expect(await readFile(path.join(root, ".git", "index"))).toEqual(indexBefore);
  });
});
