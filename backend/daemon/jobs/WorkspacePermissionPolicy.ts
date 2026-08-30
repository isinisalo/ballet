import path from "node:path";
import type { WorkspaceAccess } from "../../../shared/domain/runtime.js";
import type { RuntimePermissionPolicy, RuntimePermissionRequest } from "../providers/CliRuntimeAdapter.js";

export class WorkspacePermissionPolicy implements RuntimePermissionPolicy {
  private readonly workspace: string;
  constructor(workspace: string, private readonly workspaceAccess: WorkspaceAccess) {
    this.workspace = path.resolve(workspace);
  }

  authorize(request: RuntimePermissionRequest): boolean {
    switch (request.kind) {
      case "network":
        return false;
      case "read":
        return Boolean(request.path && within(request.path, this.workspace));
      case "write":
        return this.workspaceAccess === "workspace-write" && Boolean(request.path && within(request.path, this.workspace));
      case "command":
        return this.workspaceAccess === "workspace-write"
          && Boolean(request.path && within(request.path, this.workspace) && commandIsWorkspaceScoped(request.command ?? ""));
      case "mcp":
      case "unknown":
        return false;
    }
  }
}

const within = (candidate: string, root: string): boolean => {
  const resolved = path.resolve(candidate);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
};

const commandIsWorkspaceScoped = (command: string): boolean => {
  if (/[;&|`<>$\n\r]/.test(command)) return false;
  if (/(?:^|\s)~(?:\/|\s|$)/.test(command)) return false;
  if (/(?:^|[\s='"])(?:\/(?:Users|Volumes|private|tmp|etc|var|opt|usr|Library|System)\/|\/dev\/)/.test(command)) return false;
  if (/\.{2}(?:\/|\\)/.test(command)) return false;
  if (/\b(?:sudo|su|ssh|scp|rsync)\b/.test(command)) return false;
  if (/\b(?:bash|dash|fish|node|perl|python\d*|ruby|sh|zsh)\s+(?:-[a-z]*[ce]|--eval|--command)\b/i.test(command)) return false;
  if (/\b(?:curl|wget|nc|ncat|ftp|telnet|git\s+(?:fetch|pull|push|clone)|gh\s+|npm\s+(?:install|publish|exec)|npx\s+|pnpm\s+(?:install|publish|dlx)|yarn\s+(?:add|dlx)|pip\d*\s+install|cargo\s+install|brew\s+)\b/i.test(command)) {
    return false;
  }
  return true;
};
