import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalGitHubRepository,
  deriveProjectId,
  resolveLocalGitProject
} from "../ProjectIdentity.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("local Git project identity", () => {
  it("normalizes GitHub SSH and HTTPS remotes to one stable project identity", () => {
    const remotes = [
      "git@github.com:Acme/Ballet.git",
      "ssh://git@github.com/Acme/Ballet.git",
      "https://github.com/Acme/Ballet.git",
      "github.com/Acme/Ballet"
    ];

    expect(remotes.map(canonicalGitHubRepository)).toEqual(remotes.map(() => "github.com/acme/ballet"));
    expect(new Set(remotes.map(deriveProjectId)).size).toBe(1);
  });

  it("resolves the checkout root and GitHub origin when invoked from a repository subdirectory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ballet-project-identity-"));
    roots.push(root);
    await execFileAsync("git", ["init", "-b", "main"], { cwd: root });
    await execFileAsync("git", ["remote", "add", "origin", "git@github.com:Acme/Ballet.git"], { cwd: root });
    const nested = path.join(root, "packages", "web", "src");
    await mkdir(nested, { recursive: true });

    await expect(resolveLocalGitProject(nested)).resolves.toEqual({
      id: deriveProjectId("https://github.com/acme/ballet.git"),
      repositoryUrl: "git@github.com:Acme/Ballet.git",
      canonicalRepository: "github.com/acme/ballet",
      root: await realpath(root)
    });
  });

  it("rejects non-GitHub origins", () => {
    expect(() => canonicalGitHubRepository("https://gitlab.com/acme/ballet.git"))
      .toThrow("requires a GitHub origin");
  });
});
