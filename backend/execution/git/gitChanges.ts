import { runGit } from "./gitProcess.js";
import { parsePorcelainPaths } from "./gitStatus.js";

export const changedFiles = async (root: string, baseSha: string, signal?: AbortSignal): Promise<string[]> => {
  const committed = (await runGit(["diff", "--name-only", "-z", `${baseSha}..HEAD`], { cwd: root, signal }))
    .stdout.split("\0").filter(Boolean);
  const working = parsePorcelainPaths((await runGit(
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd: root, signal }
  )).stdout);
  return [...new Set([...committed, ...working])];
};
