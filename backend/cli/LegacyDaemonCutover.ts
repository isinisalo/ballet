import { execFile } from "node:child_process";
import { access, mkdir, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ProjectContext } from "../project/ProjectContext.js";

const execFileAsync = promisify(execFile);
const LEGACY_LABEL = "ai.ballet.daemon";

export const hasLegacyDaemonState = async (project: ProjectContext): Promise<boolean> =>
  anyExists([path.join(project.stateRoot, "control-plane.sqlite")]);

export const stopLegacyGlobalDaemon = async (): Promise<void> => {
  if (process.platform !== "darwin") return;
  const plist = path.join(os.homedir(), "Library", "LaunchAgents", `${LEGACY_LABEL}.plist`);
  const domain = `gui/${process.getuid?.() ?? os.userInfo().uid}`;
  await execFileAsync("launchctl", ["bootout", domain, plist]).catch(() => undefined);
};

export const archiveLegacyDaemonState = async (project: ProjectContext): Promise<void> => {
  const candidates = [
    ...["", "-wal", "-shm"].map((suffix) => ({
      source: path.join(project.stateRoot, `control-plane.sqlite${suffix}`), name: `control-plane.sqlite${suffix}`
    })),
    { source: path.join(os.homedir(), ".ballet", "daemon", "config.json"), name: "global-daemon-config.json" },
    { source: path.join(os.homedir(), "Library", "LaunchAgents", `${LEGACY_LABEL}.plist`), name: `${LEGACY_LABEL}.plist` }
  ];
  if (!await anyExists(candidates.map(({ source }) => source))) return;
  const archive = path.join(project.stateRoot, "archive", `local-only-${timestamp()}`);
  await mkdir(archive, { recursive: true, mode: 0o700 });
  for (const candidate of candidates) {
    await rename(candidate.source, path.join(archive, candidate.name)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  if (process.platform === "darwin") {
    for (let index = 0; index < 32; index += 1) {
      const removed = await execFileAsync("security", ["delete-generic-password", "-s", LEGACY_LABEL])
        .then(() => true, () => false);
      if (!removed) break;
    }
  }
};

const anyExists = async (paths: string[]): Promise<boolean> => (
  await Promise.all(paths.map((candidate) => access(candidate).then(() => true, () => false)))
).some(Boolean);
const timestamp = (): string => new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
