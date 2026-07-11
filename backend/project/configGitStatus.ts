import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProjectConfigChange, ProjectConfigChangeStatus, ProjectConfigStatus } from "../../shared/domain/projectStatus.js";

const execFileAsync = promisify(execFile);
const configRoots = [".ballet", ".codex/agents", ".agents/skills"];

export const readProjectConfigStatus = async (root: string): Promise<ProjectConfigStatus> => {
  const output = await execFileAsync("git", [
    "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...configRoots
  ], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
  const changes = parseConfigStatus(output.stdout);
  return { clean: changes.length === 0, changes };
};

export const parseConfigStatus = (source: string): ProjectConfigChange[] => {
  const fields = source.split("\0").filter(Boolean);
  const changes: ProjectConfigChange[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!;
    const code = field.slice(0, 2);
    const path = field.slice(3);
    changes.push({ path, status: statusFromCode(code) });
    if (code.includes("R") || code.includes("C")) {
      const original = fields[++index];
      if (original) changes.push({ path: original, status: "deleted" });
    }
  }
  return [...new Map(changes.map((change) => [change.path, change])).values()]
    .sort((left, right) => left.path.localeCompare(right.path));
};

const statusFromCode = (code: string): ProjectConfigChangeStatus => {
  if (code === "??") return "untracked";
  if (code.includes("R") || code.includes("C")) return "renamed";
  if (code.includes("D")) return "deleted";
  if (code.includes("A")) return "added";
  return "modified";
};
