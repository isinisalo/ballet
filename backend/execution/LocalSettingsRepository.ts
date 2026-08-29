import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

export interface LocalSettings {
  version: 1;
  codexCommand?: string;
  copilotCommand?: string;
  readOnlyRoots?: string[];
}

export class LocalSettingsRepository {
  constructor(readonly filename: string) {}

  async load(): Promise<LocalSettings> {
    try {
      const value = JSON.parse(await readFile(this.filename, "utf8")) as unknown;
      return validate(value);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { version: 1 };
      }
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

  async readOnlyRootsForRun(): Promise<string[]> {
    return [...((await this.load()).readOnlyRoots ?? [])];
  }
}

const validate = (value: unknown): LocalSettings => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Local Ballet settings must be a JSON object.");
  const source = value as Record<string, unknown>;
  const unknown = Object.keys(source).filter((key) => !["version", "codexCommand", "copilotCommand", "readOnlyRoots"].includes(key));
  if (unknown.length > 0) throw new Error(`Local Ballet settings contain unsupported fields: ${unknown.join(", ")}.`);
  if (source.version !== 1) throw new Error("Local Ballet settings version must be 1.");
  const codexCommand = command(source.codexCommand, "codexCommand");
  const copilotCommand = command(source.copilotCommand, "copilotCommand");
  const readOnlyRoots = roots(source.readOnlyRoots, "readOnlyRoots");
  return {
    version: 1,
    ...(codexCommand ? { codexCommand } : {}),
    ...(copilotCommand ? { copilotCommand } : {}),
    ...(readOnlyRoots ? { readOnlyRoots } : {})
  };
};

const command = (value: unknown, label: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty command.`);
  if (value.includes("/") && !path.isAbsolute(value)) throw new Error(`${label} must be a command name or an absolute path.`);
  return value;
};

const roots = (value: unknown, label: string): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 32 || value.some((root) => typeof root !== "string" || !path.isAbsolute(root))) {
    throw new Error(`${label} must contain at most 32 absolute paths.`);
  }
  return [...new Set(value.map((root) => path.resolve(root)))];
};
