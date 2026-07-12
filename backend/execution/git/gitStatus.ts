import { realpath } from "node:fs/promises";
import path from "node:path";
import { runGit } from "./gitProcess.js";
export interface GitCheckoutStatus {
  root: string;
  headSha: string;
  branch?: string;
  dirtyPaths: string[];
  ignoredRuntimePaths: string[];
  codeDirty: boolean;
}

const allowedRuntimePrefixes = [".ballet/", ".codex/agents/", ".agents/skills/"];

export const isAllowedRuntimePath = (value: string): boolean => {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  return allowedRuntimePrefixes.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
};

export const inspectGitCheckout = async (root: string, signal?: AbortSignal): Promise<GitCheckoutStatus> => {
  const top = (await runGit(["rev-parse", "--show-toplevel"], { cwd: root, signal })).stdout.trim();
  const resolvedTop = await realpath(path.resolve(top));
  const headSha = (await runGit(["rev-parse", "HEAD"], { cwd: resolvedTop, signal })).stdout.trim();
  const branchResult = await runGit(["symbolic-ref", "--quiet", "--short", "HEAD"], {
    cwd: resolvedTop,
    signal,
    allowedExitCodes: [1]
  });
  const status = await runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: resolvedTop, signal });
  const paths = parsePorcelainPaths(status.stdout);
  const ignoredRuntimePaths = paths.filter(isAllowedRuntimePath);
  const dirtyPaths = paths.filter((entry) => !isAllowedRuntimePath(entry));
  return {
    root: resolvedTop,
    headSha,
    branch: branchResult.exitCode === 0 ? branchResult.stdout.trim() : undefined,
    dirtyPaths,
    ignoredRuntimePaths,
    codeDirty: dirtyPaths.length > 0
  };
};

const parsePorcelainPaths = (output: string): string[] => {
  const fields = output.split("\0").filter(Boolean);
  const paths: string[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!;
    const status = field.slice(0, 2);
    paths.push(field.slice(3));
    if (status.includes("R") || status.includes("C")) {
      const original = fields[index + 1];
      if (original) paths.push(original);
      index += 1;
    }
  }
  return [...new Set(paths)];
};
