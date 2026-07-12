import { runGit } from "./gitProcess.js";

export const changedFiles = async (root: string, baseSha: string, signal?: AbortSignal): Promise<string[]> => {
  const committed = (await runGit(["diff", "--name-only", `${baseSha}..HEAD`], { cwd: root, signal })).stdout.split("\n");
  const working = (await runGit(["status", "--porcelain=v1"], { cwd: root, signal })).stdout
    .split("\n")
    .map((line) => line.slice(3));
  return [...new Set([...committed, ...working].map((entry) => entry.trim()).filter(Boolean))];
};
