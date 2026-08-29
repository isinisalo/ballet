import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import type { ProjectContext } from "../project/ProjectContext.js";

export interface ServiceState {
  version: 1;
  instanceId: string;
  checkoutRoot: string;
  serviceLabel: string;
  port: number;
  createdAt: string;
}

export const serviceStatePath = (project: ProjectContext): string => path.join(project.stateRoot, "service.json");
export const applicationLogPath = (project: ProjectContext): string => project.logsPath;

export const loadOrCreateServiceState = async (project: ProjectContext): Promise<ServiceState> => {
  const existing = await loadServiceState(project);
  if (existing) return existing;
  const state: ServiceState = {
    version: 1,
    instanceId: project.instanceId,
    checkoutRoot: project.root,
    serviceLabel: project.serviceLabel,
    port: await findFreeLoopbackPort(),
    createdAt: new Date().toISOString()
  };
  await saveServiceState(project, state);
  return state;
};

export const loadServiceState = async (project: ProjectContext): Promise<ServiceState | undefined> => {
  const existing = await readJson(serviceStatePath(project));
  return existing === undefined ? undefined : parseServiceState(existing, project);
};

export const saveServiceState = async (project: ProjectContext, state: ServiceState): Promise<void> => {
  parseServiceState(state, project);
  await writeJsonAtomic(serviceStatePath(project), state);
};

export const isLoopbackPortAvailable = (port: number): Promise<boolean> => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" || error.code === "EACCES") resolve(false);
    else reject(error);
  });
  server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
    server.close((error) => error ? reject(error) : resolve(true));
  });
});

export const findFreeLoopbackPort = (): Promise<number> => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.unref();
  server.once("error", reject);
  server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      reject(new Error("Ballet could not allocate a local loopback port."));
      return;
    }
    const { port } = address;
    server.close((error) => error ? reject(error) : resolve(port));
  });
});

const parseServiceState = (value: unknown, project: ProjectContext): ServiceState => {
  if (!isRecord(value)
    || value.version !== 1
    || value.instanceId !== project.instanceId
    || value.checkoutRoot !== project.root
    || value.serviceLabel !== project.serviceLabel
    || !Number.isSafeInteger(value.port)
    || Number(value.port) < 1
    || Number(value.port) > 65_535
    || typeof value.createdAt !== "string") {
    throw new Error(`Invalid checkout service state at ${serviceStatePath(project)}.`);
  }
  return value as unknown as ServiceState;
};

const readJson = async (target: string): Promise<unknown | undefined> => {
  try {
    return JSON.parse(await readFile(target, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON in ${target}.`);
    throw error;
  }
};

const writeJsonAtomic = async (target: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, target);
    await chmod(target, 0o600);
  } finally {
    await rm(temporary, { force: true });
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
