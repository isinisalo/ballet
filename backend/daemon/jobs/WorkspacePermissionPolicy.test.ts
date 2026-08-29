import { describe, expect, it } from "vitest";
import { WorkspacePermissionPolicy } from "./WorkspacePermissionPolicy.js";

const workspace = "/tmp/ballet-managed-worktree";
const request = (kind: "read" | "write" | "command") => ({
  provider: "codex" as const,
  kind,
  operation: kind,
  path: `${workspace}/src/index.ts`,
  command: kind === "command" ? "npm test" : undefined
});

describe("WorkspacePermissionPolicy", () => {
  it("allows reads but denies writes and commands for read-only roles", () => {
    const policy = new WorkspacePermissionPolicy(workspace, { network: false, readOnlyRoots: [] }, "read-only");

    expect(policy.authorize(request("read"))).toBe(true);
    expect(policy.authorize(request("write"))).toBe(false);
    expect(policy.authorize(request("command"))).toBe(false);
  });

  it("allows scoped writes and commands for workspace-write roles", () => {
    const policy = new WorkspacePermissionPolicy(workspace, { network: false, readOnlyRoots: [] }, "workspace-write");

    expect(policy.authorize(request("write"))).toBe(true);
    expect(policy.authorize(request("command"))).toBe(true);
    expect(policy.authorize({ ...request("write"), path: "/tmp/outside.txt" })).toBe(false);
  });
});
