import path from "node:path";
import type { ExecutionPolicy } from "../../shared/domain/runtime.js";
import type { RuntimePermissionPolicy, RuntimePermissionRequest } from "./providers/CliRuntimeAdapter.js";

export class WorkspacePermissionPolicy implements RuntimePermissionPolicy {
  private readonly workspace: string;
  private readonly readOnlyRoots: string[];

  constructor(workspace: string, private readonly policy: ExecutionPolicy) {
    this.workspace = path.resolve(workspace);
    this.readOnlyRoots = policy.readOnlyRoots.map((root) => path.resolve(root));
  }

  authorize(request: RuntimePermissionRequest): boolean {
    switch (request.kind) {
      case "network":
        return this.policy.network;
      case "read":
        return Boolean(request.path && (within(request.path, this.workspace) || this.readOnlyRoots.some((root) => within(request.path!, root))));
      case "write":
        return Boolean(request.path && within(request.path, this.workspace));
      case "command":
        return Boolean(request.path && within(request.path, this.workspace) && commandIsWorkspaceScoped(request.command ?? "", this.policy.network));
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

const commandIsWorkspaceScoped = (command: string, networkAllowed: boolean): boolean => {
  if (/[;&|`<>$\n\r]/.test(command)) return false;
  if (/(?:^|\s)~(?:\/|\s|$)/.test(command)) return false;
  if (/(?:^|[\s='"])(?:\/(?:Users|Volumes|private|tmp|etc|var|opt|usr|Library|System)\/|\/dev\/)/.test(command)) return false;
  if (/\.{2}(?:\/|\\)/.test(command)) return false;
  if (/\b(?:sudo|su|ssh|scp|rsync)\b/.test(command)) return false;
  if (/\b(?:bash|dash|fish|node|perl|python\d*|ruby|sh|zsh)\s+(?:-[a-z]*[ce]|--eval|--command)\b/i.test(command)) return false;
  if (!networkAllowed && /\b(?:curl|wget|nc|ncat|ftp|telnet|git\s+(?:fetch|pull|push|clone)|gh\s+|npm\s+(?:install|publish|exec)|npx\s+|pnpm\s+(?:install|publish|dlx)|yarn\s+(?:add|dlx)|pip\d*\s+install|cargo\s+install|brew\s+)\b/i.test(command)) {
    return false;
  }
  return true;
};
