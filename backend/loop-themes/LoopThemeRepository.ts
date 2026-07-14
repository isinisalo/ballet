import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { loopThemeSchema } from "../../shared/api/workspace-schemas.js";
import {
  defaultLoopTheme,
  type LoopTheme,
  type LoopThemeIssue
} from "../../shared/domain/loopThemes.js";
import { LoopThemeConflictError } from "./LoopThemeErrors.js";
import { parseLoopTheme } from "./loopThemeValidation.js";

export interface LoopThemeLoadResult {
  theme: LoopTheme;
  issues: LoopThemeIssue[];
}

const themeRelativePath = ".ballet/theme.json";

export class LoopThemeRepository {
  async load(root: string): Promise<LoopThemeLoadResult> {
    const fallback = structuredClone(defaultLoopTheme);
    const balletDirectory = path.join(root, ".ballet");
    const balletStatus = await status(balletDirectory);
    if (balletStatus && (!balletStatus.isDirectory() || balletStatus.isSymbolicLink())) {
      return {
        theme: fallback,
        issues: [{ path: ".ballet", message: ".ballet must be an ordinary directory." }]
      };
    }

    const filename = themeFilename(root);
    const fileStatus = await status(filename);
    if (!fileStatus) return { theme: fallback, issues: [] };
    if (!fileStatus.isFile() || fileStatus.isSymbolicLink()) {
      return {
        theme: fallback,
        issues: [{ path: themeRelativePath, message: "Theme must be an ordinary JSON file." }]
      };
    }

    let value: unknown;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (!(await handle.stat()).isFile()) throw new Error("Theme must be an ordinary JSON file.");
      value = JSON.parse(await handle.readFile("utf8")) as unknown;
    } catch (error) {
      return {
        theme: fallback,
        issues: [{
          path: themeRelativePath,
          message: error instanceof Error ? error.message : "Theme is not valid JSON."
        }]
      };
    } finally {
      await handle?.close().catch(() => undefined);
    }

    const parsed = loopThemeSchema.safeParse(value);
    if (!parsed.success) {
      return {
        theme: fallback,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length > 0
            ? `${themeRelativePath}.${issue.path.map(String).join(".")}`
            : themeRelativePath,
          message: issue.message
        }))
      };
    }
    return { theme: parsed.data, issues: [] };
  }

  async update(root: string, value: unknown): Promise<LoopTheme> {
    const theme = parseLoopTheme(value);
    const directory = await ensureBalletDirectory(root);
    const filename = themeFilename(root);
    const fileStatus = await status(filename);
    if (fileStatus && (!fileStatus.isFile() || fileStatus.isSymbolicLink())) {
      throw new LoopThemeConflictError("Theme is not backed by an ordinary JSON file.");
    }

    const temporary = path.join(directory, `.theme.${process.pid}.${randomUUID()}.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(
        temporary,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
        0o666
      );
      await handle.writeFile(`${JSON.stringify(theme, null, 2)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporary, filename);
      await syncDirectory(directory);
      return theme;
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }
}

const themeFilename = (root: string): string => path.join(root, themeRelativePath);

const status = async (target: string) => lstat(target).catch((error: NodeJS.ErrnoException) => {
  if (error.code === "ENOENT") return undefined;
  throw error;
});

const ensureBalletDirectory = async (root: string): Promise<string> => {
  const directory = path.join(root, ".ballet");
  await mkdir(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
  const directoryStatus = await status(directory);
  if (!directoryStatus?.isDirectory() || directoryStatus.isSymbolicLink()) {
    throw new LoopThemeConflictError(".ballet must be an ordinary directory.");
  }
  return directory;
};

const syncDirectory = async (directory: string): Promise<void> => {
  const handle = await open(directory, "r");
  try { await handle.sync(); } finally { await handle.close(); }
};
