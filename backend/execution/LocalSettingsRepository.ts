import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

export interface LocalSettings {
  version: 1;
  codexCommand?: string;
  copilotCommand?: string;
  readOnlyRoots?: string[];
  agentReadOnlyRoots?: Record<string, string[]>;
}

export class LocalSettingsRepository {
  constructor(readonly filename: string) {}

  async load(): Promise<LocalSettings> {
    try {
      const value = JSON.parse(await readFile(this.filename, "utf8")) as unknown;
      return validate(value);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1 };
      throw error;
    }
  }

  async write(settings: LocalSettings): Promise<void> {
    const validated = validate(settings);
    await mkdir(path.dirname(this.filename), { recursive: true, mode: 0o700 });
    const temporary = `${this.filename}.${process.pid}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(`${JSON.stringify(validated, null, 2)}\n`, "utf8");
        await file.sync();
      } finally { await file.close(); }
      await rename(temporary, this.filename);
      const directory = await open(path.dirname(this.filename), "r");
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { await rm(temporary, { force: true }); }
  }

  async rootsFor(agentId: string): Promise<string[]> {
    const settings = await this.load();
    return [...(settings.agentReadOnlyRoots?.[agentId] ?? settings.readOnlyRoots ?? [])];
  }
}

const validate = (value: unknown): LocalSettings => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Local Ballet settings must be a JSON object.");
  const source = value as Record<string, unknown>;
  if (source.version !== 1) throw new Error("Local Ballet settings version must be 1.");
  const commands = ["codexCommand", "copilotCommand"] as const;
  for (const key of commands) {
    if (source[key] !== undefined && (typeof source[key] !== "string" || !source[key].trim())) {
      throw new Error(`${key} must be a non-empty command.`);
    }
    if (typeof source[key] === "string" && source[key].includes("/") && !path.isAbsolute(source[key])) {
      throw new Error(`${key} must be a command name or an absolute path.`);
    }
  }
  const readOnlyRoots = roots(source.readOnlyRoots, "readOnlyRoots");
  const agentReadOnlyRoots: Record<string, string[]> = {};
  if (source.agentReadOnlyRoots !== undefined) {
    if (!source.agentReadOnlyRoots || typeof source.agentReadOnlyRoots !== "object" || Array.isArray(source.agentReadOnlyRoots)) {
      throw new Error("agentReadOnlyRoots must be an object.");
    }
    for (const [agentId, value] of Object.entries(source.agentReadOnlyRoots as Record<string, unknown>)) {
      if (!agentId.trim()) throw new Error("agentReadOnlyRoots keys must be non-empty agent ids.");
      agentReadOnlyRoots[agentId] = roots(value, `agentReadOnlyRoots.${agentId}`) ?? [];
    }
  }
  return {
    version: 1,
    ...(typeof source.codexCommand === "string" ? { codexCommand: source.codexCommand } : {}),
    ...(typeof source.copilotCommand === "string" ? { copilotCommand: source.copilotCommand } : {}),
    ...(readOnlyRoots ? { readOnlyRoots } : {}),
    ...(Object.keys(agentReadOnlyRoots).length > 0 ? { agentReadOnlyRoots } : {})
  };
};

const roots = (value: unknown, label: string): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 32 || value.some((root) => typeof root !== "string" || !path.isAbsolute(root))) {
    throw new Error(`${label} must contain at most 32 absolute paths.`);
  }
  return [...new Set(value.map((root) => path.resolve(root)))];
};
