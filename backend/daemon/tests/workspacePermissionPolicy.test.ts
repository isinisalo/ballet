import { describe, expect, it } from "vitest";
import { WorkspacePermissionPolicy } from "../jobs/WorkspacePermissionPolicy.js";

const command = (value: string) => ({
  provider: "copilot" as const,
  kind: "command" as const,
  operation: "shell",
  path: "/worktree",
  command: value
});

describe("WorkspacePermissionPolicy", () => {
  it("allows ordinary workspace commands but rejects filesystem and shell escapes", () => {
    const policy = new WorkspacePermissionPolicy("/worktree", { network: false, readOnlyRoots: [] });

    expect(policy.authorize(command("npm test"))).toBe(true);
    expect(policy.authorize(command("git diff -- src/app.ts"))).toBe(true);
    expect(policy.authorize(command("echo changed > /tmp/result"))).toBe(false);
    expect(policy.authorize(command("cat /etc/passwd"))).toBe(false);
    expect(policy.authorize(command("node -e 'require(\"fs\").writeFileSync(\"/tmp/x\", \"x\")'"))).toBe(false);
    expect(policy.authorize(command("echo $HOME"))).toBe(false);
  });

  it("rejects network-capable commands unless network access is explicit", () => {
    const denied = new WorkspacePermissionPolicy("/worktree", { network: false, readOnlyRoots: [] });
    const allowed = new WorkspacePermissionPolicy("/worktree", { network: true, readOnlyRoots: [] });

    expect(denied.authorize(command("git fetch origin"))).toBe(false);
    expect(denied.authorize(command("curl https://example.test"))).toBe(false);
    expect(allowed.authorize(command("curl https://example.test"))).toBe(true);
  });

  it("limits reads to the worktree and explicit read-only roots", () => {
    const policy = new WorkspacePermissionPolicy("/worktree", {
      network: false,
      readOnlyRoots: ["/reference"]
    });

    expect(policy.authorize({ provider: "copilot", kind: "read", operation: "read", path: "/reference/spec.md" })).toBe(true);
    expect(policy.authorize({ provider: "copilot", kind: "read", operation: "read", path: "/private/secret" })).toBe(false);
    expect(policy.authorize({ provider: "copilot", kind: "write", operation: "write", path: "/reference/spec.md" })).toBe(false);
  });
});
