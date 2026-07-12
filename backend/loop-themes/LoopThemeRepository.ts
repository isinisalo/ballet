import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { loopThemeIdSchema, loopThemeSchema } from "../../shared/api/workspace-schemas.js";
import {
  builtInLoopThemes,
  type LoopTheme,
  type LoopThemeId,
  type LoopThemeIssue
} from "../../shared/domain/loopThemes.js";
import { LoopThemeConflictError } from "./LoopThemeErrors.js";
import { parseLoopTheme } from "./loopThemeValidation.js";

export interface LoopThemeLoadResult {
  themes: LoopTheme[];
  issues: LoopThemeIssue[];
}

export class LoopThemeRepository {
  async load(root: string): Promise<LoopThemeLoadResult> {
    const themes = new Map(builtInLoopThemes.map((theme) => [theme.id, structuredClone(theme)]));
    const issues: LoopThemeIssue[] = [];
    const balletDirectory = path.join(root, ".ballet");
    const balletStatus = await status(balletDirectory);
    if (balletStatus && (!balletStatus.isDirectory() || balletStatus.isSymbolicLink())) {
      return {
        themes: [...themes.values()],
        issues: [{ path: ".ballet", message: ".ballet must be an ordinary directory." }]
      };
    }
    const directory = themesDirectory(root);
    const directoryStatus = await status(directory);
    if (!directoryStatus) return { themes: [...themes.values()], issues };
    if (!directoryStatus.isDirectory() || directoryStatus.isSymbolicLink()) {
      return {
        themes: [...themes.values()],
        issues: [{ path: themesRelativePath, message: "Theme directory must be an ordinary directory." }]
      };
    }

    const entries = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.name.endsWith(".json"))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = `${themesRelativePath}/${entry.name}`;
      const themeId = entry.name.slice(0, -".json".length);
      const parsedId = loopThemeIdSchema.safeParse(themeId);
      if (!parsedId.success) {
        issues.push({ path: relativePath, message: "Theme filename must be a valid <theme-id>.json name." });
        continue;
      }
      if (!entry.isFile() || entry.isSymbolicLink()) {
        issues.push({ path: relativePath, message: "Theme file must be an ordinary JSON file.", themeId });
        continue;
      }
      const loaded = await this.loadFile(path.join(directory, entry.name), relativePath, themeId);
      if ("issue" in loaded) {
        issues.push(...loaded.issue);
        continue;
      }
      themes.set(themeId, loaded.theme);
    }
    return { themes: sortedThemes(themes), issues };
  }

  async hasFile(root: string, themeId: LoopThemeId): Promise<boolean> {
    const parsedId = loopThemeIdSchema.parse(themeId);
    const directory = themesDirectory(root);
    await assertBalletDirectoryWhenPresent(root);
    await assertOrdinaryDirectoryWhenPresent(directory);
    const fileStatus = await status(path.join(directory, `${parsedId}.json`));
    if (!fileStatus) return false;
    if (!fileStatus.isFile() || fileStatus.isSymbolicLink()) {
      throw new LoopThemeConflictError(`Theme ${parsedId} is not backed by an ordinary JSON file.`);
    }
    return true;
  }

  async create(root: string, value: unknown): Promise<LoopTheme> {
    return this.write(root, value, false);
  }

  async update(root: string, value: unknown): Promise<LoopTheme> {
    return this.write(root, value, true);
  }

  async remove(root: string, themeId: LoopThemeId): Promise<void> {
    const parsedId = loopThemeIdSchema.parse(themeId);
    const directory = themesDirectory(root);
    await assertBalletDirectoryWhenPresent(root);
    await assertOrdinaryDirectoryWhenPresent(directory);
    const filename = path.join(directory, `${parsedId}.json`);
    const fileStatus = await status(filename);
    if (!fileStatus) return;
    if (!fileStatus.isFile() || fileStatus.isSymbolicLink()) {
      throw new LoopThemeConflictError(`Theme ${parsedId} is not backed by an ordinary JSON file.`);
    }
    await unlink(filename);
    await syncDirectory(directory);
  }

  private async loadFile(
    filename: string,
    relativePath: string,
    filenameThemeId: string
  ): Promise<{ theme: LoopTheme } | { issue: LoopThemeIssue[] }> {
    let value: unknown;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (!(await handle.stat()).isFile()) throw new Error("Theme file must be an ordinary JSON file.");
      value = JSON.parse(await handle.readFile("utf8")) as unknown;
    } catch (error) {
      return { issue: [{
        path: relativePath,
        message: error instanceof Error ? error.message : "Theme file is not valid JSON.",
        themeId: filenameThemeId
      }] };
    } finally {
      await handle?.close().catch(() => undefined);
    }
    const parsed = loopThemeSchema.safeParse(value);
    if (!parsed.success) {
      return { issue: parsed.error.issues.map((issue) => ({
        path: issue.path.length > 0 ? `${relativePath}.${issue.path.map(String).join(".")}` : relativePath,
        message: issue.message,
        themeId: filenameThemeId
      })) };
    }
    if (parsed.data.id !== filenameThemeId) {
      return { issue: [{
        path: `${relativePath}.id`,
        message: `Theme id ${parsed.data.id} must match filename ${filenameThemeId}.json.`,
        themeId: filenameThemeId
      }] };
    }
    return { theme: parsed.data };
  }

  private async write(root: string, value: unknown, overwrite: boolean): Promise<LoopTheme> {
    const theme = parseLoopTheme(value);
    const directory = await ensureThemesDirectory(root);
    const filename = path.join(directory, `${theme.id}.json`);
    const fileStatus = await status(filename);
    if (fileStatus && (!fileStatus.isFile() || fileStatus.isSymbolicLink())) {
      throw new LoopThemeConflictError(`Theme ${theme.id} is not backed by an ordinary JSON file.`);
    }
    if (!overwrite && fileStatus) throw new LoopThemeConflictError(`Theme ${theme.id} already exists.`);

    const temporary = path.join(directory, `.${theme.id}.${process.pid}.${randomUUID()}.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o666);
      await handle.writeFile(`${JSON.stringify(theme, null, 2)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      if (overwrite) {
        await rename(temporary, filename);
      } else {
        try {
          await link(temporary, filename);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EEXIST") {
            throw new LoopThemeConflictError(`Theme ${theme.id} already exists.`);
          }
          throw error;
        }
        await unlink(temporary);
      }
      await syncDirectory(directory);
      return theme;
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }
}

const themesRelativePath = ".ballet/themes";
const themesDirectory = (root: string): string => path.join(root, ".ballet", "themes");

const status = async (target: string) => lstat(target).catch((error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") return undefined;
  throw error;
});

const assertOrdinaryDirectoryWhenPresent = async (directory: string): Promise<void> => {
  const directoryStatus = await status(directory);
  if (directoryStatus && (!directoryStatus.isDirectory() || directoryStatus.isSymbolicLink())) {
    throw new LoopThemeConflictError("Theme directory must be an ordinary directory.");
  }
};

const assertBalletDirectoryWhenPresent = async (root: string): Promise<void> => {
  const directory = path.join(root, ".ballet");
  const directoryStatus = await status(directory);
  if (directoryStatus && (!directoryStatus.isDirectory() || directoryStatus.isSymbolicLink())) {
    throw new LoopThemeConflictError(".ballet must be an ordinary directory.");
  }
};

const ensureThemesDirectory = async (root: string): Promise<string> => {
  const balletDirectory = path.join(root, ".ballet");
  await mkdir(balletDirectory).catch(ignoreExistingDirectory);
  await assertBalletDirectoryWhenPresent(root);
  const directory = themesDirectory(root);
  await mkdir(directory).catch(ignoreExistingDirectory);
  await assertOrdinaryDirectoryWhenPresent(directory);
  return directory;
};

const ignoreExistingDirectory = (error: NodeJS.ErrnoException): void => {
  if (error.code !== "EEXIST") throw error;
};

const syncDirectory = async (directory: string): Promise<void> => {
  const handle = await open(directory, "r");
  try { await handle.sync(); } finally { await handle.close(); }
};

const sortedThemes = (themes: ReadonlyMap<string, LoopTheme>): LoopTheme[] => {
  const builtInIds = new Set(builtInLoopThemes.map((theme) => theme.id));
  return [
    ...builtInLoopThemes.map((theme) => themes.get(theme.id)!),
    ...[...themes.values()]
      .filter((theme) => !builtInIds.has(theme.id))
      .sort((left, right) => left.id.localeCompare(right.id))
  ];
};
