import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { InstalledLoopModuleV1, InstalledLoopModulesFileV1 } from "../../shared/domain/loopModules.js";
import { resolveSafeProjectPath } from "../documents/safeProjectPath.js";
import { canonicalLoopModuleJson } from "./canonicalLoopModule.js";

const stateContractSchema = z.object({
  id: z.string(), version: z.string(), description: z.string(), initial: z.unknown(), requiredKeys: z.array(z.string())
}).strict();
const capabilitiesSchema = z.object({
  requires: z.array(z.string()),
  accepts: z.array(z.string()),
  provides: z.array(z.string()),
  recommendedConnections: z.array(z.object({
    kind: z.enum(["flow", "repair"]), direction: z.enum(["incoming", "outgoing"]), capability: z.string(), description: z.string()
  }).strict())
}).strict();
const installedSchema = z.object({
  moduleId: z.string(), moduleVersion: z.string(), title: z.string(), source: z.string(), packageSha256: z.string(),
  loopId: z.string(), installedAt: z.string(), profileMappings: z.record(z.string(), z.string()),
  idRemapping: z.object({
    loop: z.record(z.string(), z.string()),
    nodes: z.record(z.string(), z.string()),
    edges: z.record(z.string(), z.string()),
    instructions: z.record(z.string(), z.string()),
    skills: z.record(z.string(), z.string())
  }).strict(),
  stateContract: stateContractSchema,
  capabilities: capabilitiesSchema,
  ownedResources: z.array(z.object({
    kind: z.enum(["instruction", "skill"]), resourceId: z.string(), relativePath: z.string(), installedSha256: z.string()
  }).strict()),
  installedContentSha256: z.string()
}).strict();
const fileSchema = z.object({ version: z.literal(1), installed: z.array(installedSchema) }).strict();

export class InstalledLoopModuleRepository {
  relativePath = ".ballet/loop-modules/installed.json" as const;

  async load(root: string): Promise<InstalledLoopModulesFileV1> {
    const filename = await resolveSafeProjectPath(root, this.relativePath);
    try {
      const source = await readFile(filename, { encoding: "utf8", flag: constants.O_RDONLY | constants.O_NOFOLLOW });
      return fileSchema.parse(JSON.parse(source)) as InstalledLoopModulesFileV1;
    } catch (error) {
      if (isMissing(error)) return { version: 1, installed: [] };
      throw error;
    }
  }

  async put(root: string, file: InstalledLoopModulesFileV1): Promise<void> {
    const parsed = fileSchema.parse(file) as InstalledLoopModulesFileV1;
    const filename = await resolveSafeProjectPath(root, this.relativePath);
    const directory = path.dirname(filename);
    await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `.installed.${process.pid}.${randomUUID()}.tmp`);
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o666);
    try {
      await handle.writeFile(canonicalLoopModuleJson(parsed), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, filename);
    const dir = await open(directory, "r");
    try { await dir.sync(); } finally { await dir.close(); }
  }

  async add(root: string, record: InstalledLoopModuleV1): Promise<void> {
    const file = await this.load(root);
    if (file.installed.some((candidate) => candidate.loopId === record.loopId)) {
      throw new Error(`Loop ${record.loopId} already has module provenance.`);
    }
    await this.put(root, { version: 1, installed: [...file.installed, record].sort((a, b) => a.loopId.localeCompare(b.loopId)) });
  }

  async remove(root: string, loopId: string): Promise<void> {
    const file = await this.load(root);
    const installed = file.installed.filter((record) => record.loopId !== loopId);
    if (installed.length === file.installed.length) return;
    if (installed.length === 0) {
      const filename = await resolveSafeProjectPath(root, this.relativePath);
      await rm(filename, { force: true });
      return;
    }
    await this.put(root, { version: 1, installed });
  }
}

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
