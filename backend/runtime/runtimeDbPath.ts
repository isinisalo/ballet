import path from "node:path";
import os from "node:os";

export const resolveRuntimeDbPath = (root: string): string => {
  const configured = process.env.BALLET_CONTROL_PLANE_DB_PATH?.trim();
  if (configured) return path.isAbsolute(configured) ? configured : path.resolve(root, configured);
  return path.join(os.homedir(), ".ballet", "control-plane.sqlite");
};
