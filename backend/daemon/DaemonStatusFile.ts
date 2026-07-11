import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DaemonStatusSnapshot {
  state: "starting" | "running" | "stopping" | "error";
  pid: number;
  daemonId: string;
  deviceId: string;
  startedAt: string;
  updatedAt: string;
  activeTasks: number;
  websocketConnected: boolean;
  recentError?: string;
}

export const writeDaemonStatus = async (target: string, snapshot: DaemonStatusSnapshot): Promise<void> => {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, target);
};
