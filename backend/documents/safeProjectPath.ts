import { lstat } from "node:fs/promises";
import path from "node:path";
import { MarkdownEntityValidationError } from "./MarkdownEntityErrors.js";

export const assertInsideRoot = (root: string, target: string): string => {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new MarkdownEntityValidationError(`Path traversal blocked: ${target}`);
  }
  return resolvedTarget;
};

export const resolveSafeProjectPath = async (root: string, target: string): Promise<string> => {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = assertInsideRoot(resolvedRoot, target);
  const segments = path.relative(resolvedRoot, resolvedTarget).split(path.sep).filter(Boolean);
  let current = resolvedRoot;

  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new MarkdownEntityValidationError(`Symbolic links are not allowed in project document paths: ${target}`);
      }
    } catch (error) {
      if (isMissing(error)) break;
      throw error;
    }
  }

  return resolvedTarget;
};

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
