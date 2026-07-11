import { createHash } from "node:crypto";
import path from "node:path";

export const safeProjectName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "project";

export const deriveProjectId = (repositoryUrl: string): string => {
  const normalized = repositoryUrl.trim().replace(/\/+$/, "").replace(/\.git$/i, "");
  const pathname = (() => {
    try { return new URL(normalized).pathname; } catch { return normalized; }
  })();
  const label = safeProjectName(path.basename(pathname));
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `${label}-${digest}`.slice(0, 200);
};
