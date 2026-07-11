import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { AppData } from "../../shared/api/workspaceData.js";

const execFileAsync = promisify(execFile);

export interface ActiveProjectRegistration {
  id: string;
  repositoryUrl: string;
  checkoutPath: string;
}

export const resolveActiveProject = async (root: string, data: AppData): Promise<ActiveProjectRegistration> => ({
  id: process.env.BALLET_PROJECT_ID?.trim() || data.projects[0]?.id || path.basename(root),
  repositoryUrl: process.env.BALLET_REPOSITORY_URL?.trim() || await gitRemote(root) || `file://${root}`,
  checkoutPath: root
});

const gitRemote = async (root: string): Promise<string | undefined> => {
  try {
    const result = await execFileAsync("git", ["config", "--get", "remote.origin.url"], { cwd: root });
    return result.stdout.trim() || undefined;
  } catch {
    return undefined;
  }
};
