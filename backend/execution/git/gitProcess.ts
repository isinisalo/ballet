import { spawn } from "node:child_process";

export class GitCommandError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly exitCode: number | null,
    readonly stdout: string,
    readonly stderr: string
  ) {
    super(`git ${args.join(" ")} failed (${exitCode ?? "signal"}): ${stderr.trim() || stdout.trim()}`);
    this.name = "GitCommandError";
  }
}

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export const runGit = (
  args: readonly string[],
  options: { cwd?: string; signal?: AbortSignal; allowedExitCodes?: readonly number[] } = {}
): Promise<GitResult> => new Promise((resolve, reject) => {
  const child = spawn("git", [...args], {
    cwd: options.cwd,
    signal: options.signal,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
  child.on("error", reject);
  child.on("close", (code) => {
    const exitCode = code ?? -1;
    if (exitCode === 0 || options.allowedExitCodes?.includes(exitCode)) {
      resolve({ stdout, stderr, exitCode });
    } else {
      reject(new GitCommandError(args, code, stdout, stderr));
    }
  });
});
