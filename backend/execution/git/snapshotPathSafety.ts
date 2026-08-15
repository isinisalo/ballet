import { constants, type Stats } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";

export const assertOrdinarySnapshotDirectories = async (
  root: string,
  relativeDirectories: readonly string[]
): Promise<void> => assertOrdinaryPathComponents(root, relativeDirectories, true);

export const assertOrdinaryPathAncestors = async (
  root: string,
  relativePaths: readonly string[]
): Promise<void> => assertOrdinaryPathComponents(root, relativePaths, false);

const assertOrdinaryPathComponents = async (
  root: string,
  relativePaths: readonly string[],
  includeLeaf: boolean
): Promise<void> => {
  const resolvedRoot = path.resolve(root);
  const rootMetadata = await lstat(resolvedRoot);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("Run workspace must be an ordinary directory.");
  }
  for (const relativePath of relativePaths) {
    const segments = relativePath.split("/");
    assertRelativeWorkspacePath(relativePath, segments);
    let current = resolvedRoot;
    for (const segment of includeLeaf ? segments : segments.slice(0, -1)) {
      current = path.join(current, segment);
      const metadata = await lstat(current).catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      });
      if (!metadata) break;
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        const unsafePath = path.relative(resolvedRoot, current).split(path.sep).join("/");
        throw new Error(`Run workspace snapshot path must use ordinary directories: ${unsafePath}`);
      }
    }
  }
};

export const readSnapshotFile = async (
  root: string,
  relativePath: string
): Promise<{ metadata: Stats; bytes: Buffer } | undefined> => {
  const absolute = path.join(root, relativePath);
  const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error(`Snapshot path must be a regular file: ${relativePath}`);
    }
    throw error;
  });
  if (!handle) return undefined;
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) throw new Error(`Snapshot path must be a regular file: ${relativePath}`);
    return { metadata, bytes: await handle.readFile() };
  } finally {
    await handle.close();
  }
};

const assertRelativeWorkspacePath = (value: string, segments: readonly string[]): void => {
  if (value.includes("\\") || path.posix.isAbsolute(value)
    || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Unsafe Run workspace path: ${value}`);
  }
};
