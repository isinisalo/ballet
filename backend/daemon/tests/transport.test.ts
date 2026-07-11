import { describe, expect, it } from "vitest";
import type { ExecutionTask } from "../../../shared/domain/runtime.js";
import { HttpWsDaemonTransport } from "../transport/HttpWsDaemonTransport.js";

const task = (): ExecutionTask => ({
  id: "10000000-0000-4000-8000-000000000001",
  projectId: "project-1",
  runtimeBackendId: "10000000-0000-4000-8000-000000000002",
  deviceId: "10000000-0000-4000-8000-000000000003",
  kind: "agent_run",
  rootRunId: "10000000-0000-4000-8000-000000000004",
  status: "claimed",
  fencing: 7,
  spec: {} as ExecutionTask["spec"],
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z"
});

describe("HttpWsDaemonTransport", () => {
  it("uses the daemon bearer token while fencing job calls with the scoped task token", async () => {
    const requests: Array<{ url: string; authorization: string | null; body: Record<string, unknown> }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("Authorization"),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>
      });
      return Response.json({ accepted: true, leaseUntil: "2026-07-11T00:01:00.000Z" });
    };
    const transport = new HttpWsDaemonTransport({
      baseUrl: "https://ballet.example.test",
      daemonToken: "daemon-secret-token-that-is-long-enough",
      fetch: fetchImpl
    });
    const claim = { task: task(), taskToken: "task-secret-token-that-is-long-enough", leaseDurationMs: 60_000, renewAfterMs: 20_000 };

    await transport.renewLease(claim);

    expect(requests[0]).toMatchObject({
      url: "https://ballet.example.test/api/daemon/tasks/10000000-0000-4000-8000-000000000001/lease",
      authorization: "Bearer daemon-secret-token-that-is-long-enough",
      body: { taskToken: "task-secret-token-that-is-long-enough", fencing: 7 }
    });
  });

  it("treats a 204 claim as an empty queue", async () => {
    const transport = new HttpWsDaemonTransport({
      baseUrl: "https://ballet.example.test",
      daemonToken: "daemon-secret-token-that-is-long-enough",
      fetch: async () => new Response(undefined, { status: 204 })
    });

    await expect(transport.claim("10000000-0000-4000-8000-000000000002")).resolves.toBeUndefined();
  });

  it("acknowledges a control-plane cancellation through the fenced cancel route", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const transport = new HttpWsDaemonTransport({
      baseUrl: "https://ballet.example.test",
      daemonToken: "daemon-secret-token-that-is-long-enough",
      fetch: async (input, init) => {
        requests.push({ url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
        return Response.json({ rootDisposition: { terminal: true, success: false } });
      }
    });
    const activeClaim = { task: task(), taskToken: "task-secret-token-that-is-long-enough", leaseDurationMs: 60_000, renewAfterMs: 20_000 };

    await expect(transport.cancel(activeClaim, { worktreePath: "/tmp/worktree" })).resolves.toEqual({
      rootDisposition: { terminal: true, success: false }
    });
    expect(requests[0]).toEqual({
      url: "https://ballet.example.test/api/daemon/tasks/10000000-0000-4000-8000-000000000001/cancel",
      body: { taskToken: activeClaim.taskToken, fencing: 7, worktreePath: "/tmp/worktree" }
    });
  });

  it("rejects the old task-shaped lease response instead of treating it as a valid renewal", async () => {
    const transport = new HttpWsDaemonTransport({
      baseUrl: "https://ballet.example.test",
      daemonToken: "daemon-secret-token-that-is-long-enough",
      fetch: async () => Response.json(task())
    });
    const activeClaim = { task: task(), taskToken: "task-secret-token-that-is-long-enough", leaseDurationMs: 60_000, renewAfterMs: 20_000 };

    await expect(transport.renewLease(activeClaim)).rejects.toThrow("invalid lease response");
  });

  it("reports requested root finalization with device auth and no task fencing", async () => {
    let request: { url: string; authorization: string | null; body: Record<string, unknown> } | undefined;
    const transport = new HttpWsDaemonTransport({
      baseUrl: "https://ballet.example.test",
      daemonToken: "daemon-secret-token-that-is-long-enough",
      fetch: async (input, init) => {
        request = {
          url: String(input),
          authorization: new Headers(init?.headers).get("Authorization"),
          body: JSON.parse(String(init?.body)) as Record<string, unknown>
        };
        return new Response(undefined, { status: 204 });
      }
    });
    await transport.reportRequestedRootFinalization("project-1", task().rootRunId, {
      success: true,
      retained: false,
      branch: "ballet/run/10000000-000",
      worktreePath: "/tmp/worktree",
      commitSha: "a".repeat(40),
      changedFiles: ["src/change.ts"],
      snapshotHash: "b".repeat(64)
    });

    expect(request).toMatchObject({
      url: `https://ballet.example.test/api/daemon/root-runs/${task().rootRunId}/finalize`,
      authorization: "Bearer daemon-secret-token-that-is-long-enough",
      body: { projectId: "project-1", success: true, retained: false }
    });
    expect(request?.body).not.toHaveProperty("taskToken");
    expect(request?.body).not.toHaveProperty("fencing");
  });

  it("uploads normalized events in fenced batches", async () => {
    let body: Record<string, unknown> | undefined;
    const transport = new HttpWsDaemonTransport({
      baseUrl: "https://ballet.example.test",
      daemonToken: "daemon-secret-token-that-is-long-enough",
      fetch: async (_input, init) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(undefined, { status: 204 });
      }
    });
    const claim = { task: task(), taskToken: "task-secret-token-that-is-long-enough", leaseDurationMs: 60_000, renewAfterMs: 20_000 };
    await transport.appendEvents(claim, [{
      sequence: 0,
      source: "codex",
      kind: "agent",
      level: "info",
      phase: "delta",
      message: "hello",
      terminal: false,
      createdAt: "2026-07-11T00:00:00.000Z"
    }]);

    expect(body).toMatchObject({ taskToken: claim.taskToken, fencing: 7, events: [{ sequence: 0, message: "hello" }] });
  });

  it("uploads daemon diagnostics with device authentication", async () => {
    let request: { url: string; body: Record<string, unknown> } | undefined;
    const transport = new HttpWsDaemonTransport({
      baseUrl: "https://ballet.example.test",
      daemonToken: "daemon-secret-token-that-is-long-enough",
      fetch: async (input, init) => {
        request = { url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> };
        return Response.json({ accepted: 1 }, { status: 202 });
      }
    });

    await transport.diagnostics(["daemon ready"]);

    expect(request).toEqual({
      url: "https://ballet.example.test/api/daemon/diagnostics",
      body: { lines: ["daemon ready"] }
    });
  });
});
