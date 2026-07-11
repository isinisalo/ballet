import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const safeProjectName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "project";

export const deriveProjectId = (repositoryUrl: string): string => {
  const normalized = canonicalGitHubRepository(repositoryUrl);
  const label = safeProjectName(normalized.split("/").at(-1) ?? "project");
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `${label}-${digest}`.slice(0, 200);
};

export interface LocalGitProject {
  id: string;
  repositoryUrl: string;
  canonicalRepository: string;
  root: string;
}

export const canonicalGitHubRepository = (repositoryUrl: string): string => {
  const value = repositoryUrl.trim();
  const canonicalMatch = /^github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(value);
  if (canonicalMatch) return `github.com/${canonicalMatch[1]!.toLowerCase()}/${canonicalMatch[2]!.toLowerCase()}`;
  const scpMatch = /^(?:[^@\s]+@)?github\.com:([^\s]+)$/i.exec(value);
  const pathname = scpMatch?.[1] ?? (() => {
    try {
      const url = new URL(value);
      if (url.hostname.toLowerCase() !== "github.com") throw new Error();
      return url.pathname;
    } catch {
      throw new Error("Ballet requires a GitHub origin remote.");
    }
  })();
  const segments = pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").split("/").filter(Boolean);
  if (segments.length !== 2 || segments.some((segment) => !segment.trim())) {
    throw new Error("Ballet requires a GitHub repository origin in owner/repository form.");
  }
  return `github.com/${segments[0]!.toLowerCase()}/${segments[1]!.toLowerCase()}`;
};

export const resolveLocalGitProject = async (cwd = process.cwd()): Promise<LocalGitProject> => {
  let top: string;
  let repositoryUrl: string;
  try {
    top = (await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd })).stdout.trim();
    repositoryUrl = (await execFileAsync("git", ["remote", "get-url", "origin"], { cwd: top })).stdout.trim();
  } catch {
    throw new Error("Run `ballet` from a Git repository cloned from GitHub.");
  }
  const root = await realpath(path.resolve(top));
  const canonicalRepository = canonicalGitHubRepository(repositoryUrl);
  return { id: deriveProjectId(canonicalRepository), repositoryUrl, canonicalRepository, root };
};
