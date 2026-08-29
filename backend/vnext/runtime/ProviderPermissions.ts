import type { RuntimeProvider } from "../../../shared/vnext/environment.js";
import type { AgentRunRole } from "../../../shared/vnext/runtime.js";
import path from "node:path";

export type RuntimeToolPolicy = "read_only" | "workspace_write";

export interface ProviderPermissionSpec {
  provider: RuntimeProvider;
  role: AgentRunRole;
  approvalPolicy: "never";
  networkAccess: boolean;
  sandbox: "read-only" | "workspace-write";
  readableRoots: string[];
  writableRoots: string[];
}

export interface PermissionAuditEvent {
  role: AgentRunRole;
  requestedPath?: string;
  requestedPolicy: RuntimeToolPolicy;
  decision: "allowed" | "denied";
  reason: string;
}

export const mapProviderPermissions = (input: {
  provider: RuntimeProvider;
  role: AgentRunRole;
  toolPolicy: RuntimeToolPolicy;
  networkAccess: boolean;
  worktreePath: string;
}): ProviderPermissionSpec => {
  const required = input.role === "work" ? "workspace_write" : "read_only";
  if (input.toolPolicy !== required) throw new Error(`${input.role} requires ${required} permissions.`);
  return {
    provider: input.provider,
    role: input.role,
    approvalPolicy: "never",
    networkAccess: input.networkAccess,
    sandbox: input.toolPolicy === "read_only" ? "read-only" : "workspace-write",
    readableRoots: [path.resolve(input.worktreePath)],
    writableRoots: input.toolPolicy === "read_only" ? [] : [input.worktreePath]
  };
};

export const authorizeProviderReadPath = (spec: ProviderPermissionSpec, requestedPath: string): boolean => {
  const normalized = path.resolve(requestedPath);
  return spec.readableRoots.some((root) => normalized === path.resolve(root)
    || normalized.startsWith(`${path.resolve(root)}${path.sep}`));
};

export const authorizeProviderPath = (
  spec: ProviderPermissionSpec,
  requestedPath: string,
  audit: (event: PermissionAuditEvent) => void
): boolean => {
  const normalized = path.resolve(requestedPath);
  const allowed = spec.writableRoots.some((root) => normalized === path.resolve(root)
    || normalized.startsWith(`${path.resolve(root)}${path.sep}`));
  audit({
    role: spec.role, requestedPath, requestedPolicy: spec.sandbox === "read-only" ? "read_only" : "workspace_write",
    decision: allowed ? "allowed" : "denied",
    reason: allowed ? "inside managed worktree" : "role cannot write requested path"
  });
  return allowed;
};

export const denyPermissionEscalation = (
  role: AgentRunRole,
  requestedPolicy: RuntimeToolPolicy,
  audit: (event: PermissionAuditEvent) => void
): never => {
  audit({ role, requestedPolicy, decision: "denied", reason: "provider permission escalation is prohibited" });
  throw new Error("Provider permission escalation is prohibited.");
};
