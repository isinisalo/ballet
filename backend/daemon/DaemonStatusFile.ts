import { chmod, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

export interface DaemonStatusSnapshot {
  state: "starting" | "running" | "stopping" | "error";
  pid: number;
  instanceId: string;
  startedAt: string;
  updatedAt: string;
  activeTasks: number;
  recentError?: string;
}

export const writeDaemonStatus = async (target: string, snapshot: DaemonStatusSnapshot): Promise<void> => {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, target); await chmod(target, 0o600);
  } finally { await rm(temporary, { force: true }); }
};
