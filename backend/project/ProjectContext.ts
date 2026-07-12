import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { runGit } from "../execution/git/gitProcess.js";

export interface ProjectContext {
  readonly root: string;
  readonly gitDir: string;
  readonly stateRoot: string;
  readonly databasePath: string;
  readonly settingsPath: string;
  readonly worktreesRoot: string;
  readonly logsPath: string;
  readonly headSha: string;
  readonly instanceId: string;
  readonly serviceLabel: string;
}

export interface ResolveProjectContextOptions {
  root: string;
  stateRoot?: string;
}

export const resolveProjectContext = async (options: ResolveProjectContextOptions): Promise<ProjectContext> => {
  const requestedRoot = await realpath(path.resolve(options.root));
  const gitRoot = await realpath(path.resolve((await runGit(["rev-parse", "--show-toplevel"], { cwd: requestedRoot })).stdout.trim()));
  if (requestedRoot !== gitRoot) throw new Error(`Ballet must be started at the Git checkout root: ${gitRoot}`);

  const headSha = (await runGit(["rev-parse", "HEAD"], { cwd: gitRoot })).stdout.trim();
  if (!/^[0-9a-f]{40}$/i.test(headSha)) throw new Error("The Git checkout must have a HEAD commit before Ballet can start.");
  const gitDirOutput = (await runGit(["rev-parse", "--absolute-git-dir"], { cwd: gitRoot })).stdout.trim();
  const gitDir = await realpath(path.resolve(gitDirOutput));
  const rawStateRoot = path.resolve(options.stateRoot ?? path.join(gitDir, "ballet"));
  const requestedStateRoot = path.join(await realpath(path.dirname(rawStateRoot)), path.basename(rawStateRoot));
  assertStateRoot(gitDir, requestedStateRoot);
  if (requestedStateRoot !== path.join(gitDir, "ballet")) {
    throw new Error("Ballet state root must be this checkout's .git/ballet directory.");
  }
  await mkdir(requestedStateRoot, { recursive: true, mode: 0o700 });
  const stateRoot = await realpath(requestedStateRoot);
  assertStateRoot(gitDir, stateRoot);

  const instanceId = await readOrCreateInstanceId(stateRoot);
  const suffix = createHash("sha256").update(gitRoot).digest("hex").slice(0, 16);
  return Object.freeze({
    root: gitRoot,
    gitDir,
    stateRoot,
    databasePath: path.join(stateRoot, "state.sqlite"),
    settingsPath: path.join(stateRoot, "settings.json"),
    worktreesRoot: path.join(stateRoot, "worktrees"),
    logsPath: path.join(stateRoot, "logs", "ballet.log"),
    headSha,
    instanceId,
    serviceLabel: `ai.ballet.${suffix}`
  });
};

const assertStateRoot = (gitDir: string, stateRoot: string): void => {
  const relative = path.relative(gitDir, stateRoot);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error("Ballet state root must be a child of this checkout's Git directory.");
  }
};

const readOrCreateInstanceId = async (stateRoot: string): Promise<string> => {
  const filename = path.join(stateRoot, "instance-id");
  try {
    const value = (await readFile(filename, "utf8")).trim();
    if (/^[0-9a-f-]{36}$/i.test(value)) return value;
    throw new Error(`Invalid Ballet instance id at ${filename}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const value = randomUUID();
  try {
    await writeFile(filename, `${value}\n`, { mode: 0o600, flag: "wx" });
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = (await readFile(filename, "utf8")).trim();
    if (!/^[0-9a-f-]{36}$/i.test(existing)) throw new Error(`Invalid Ballet instance id at ${filename}.`);
    return existing;
  }
};
