import path from "node:path";

export const resolveRuntimeDbPath = (root: string): string => {
  const configured = process.env.BALLET_DB_PATH?.trim();
  if (configured) return path.isAbsolute(configured) ? configured : path.resolve(root, configured);
  return path.join(root, "data", "ballet-runtime.sqlite");
};
