import { spawn } from "node:child_process";
import { access, realpath } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { parseSemanticVersion } from "./semanticVersion.js";

export interface CommandProbeResult {
  installed: boolean;
  version?: string;
  stdout: string;
  stderr: string;
  reason?: string;
}

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export const runCommandCapture = (
  command: string,
  args: readonly string[],
  signal?: AbortSignal
): Promise<CommandResult> => new Promise((resolve, reject) => {
  const child = spawn(command, [...args], {
    stdio: ["ignore", "pipe", "pipe"],
    signal,
    env: providerChildEnvironment()
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
  child.on("error", reject);
  child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
});

export const probeCommandVersion = (
  command: string,
  args: readonly string[] = ["--version"],
  signal?: AbortSignal
): Promise<CommandProbeResult> => new Promise((resolve) => {
  const child = spawn(command, [...args], {
    stdio: ["ignore", "pipe", "pipe"],
    signal,
    env: process.env
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
  child.on("error", (error: NodeJS.ErrnoException) => {
    resolve({
      installed: false,
      stdout,
      stderr,
      reason: error.code === "ENOENT" ? `${command} was not found in PATH.` : error.message
    });
  });
  child.on("close", (code) => {
    if (code !== 0) {
      resolve({ installed: true, stdout, stderr, reason: `${command} --version exited with code ${code}.` });
      return;
    }
    const parsed = parseSemanticVersion(`${stdout}\n${stderr}`);
    resolve({
      installed: true,
      version: parsed?.join("."),
      stdout,
      stderr,
      reason: parsed ? undefined : `${command} returned an unrecognized version string.`
    });
  });
});

export const resolveCommandPath = async (command: string): Promise<string> => {
  const candidates = path.isAbsolute(command)
    ? [command]
    : (process.env.PATH ?? "").split(path.delimiter).filter(Boolean).map((directory) => path.join(directory, command));
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return await realpath(candidate);
    } catch {
      // Continue through PATH without invoking a shell.
    }
  }
  throw new Error(`${command} was not found as an executable in PATH.`);
};

export const providerChildEnvironment = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => {
  return { ...process.env, ...extra };
};
