import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalDaemonStore } from "../../orchestration/persistence/LocalDaemonStore.js";
import { createLocalDaemonRouter } from "./LocalDaemonRouter.js";

const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

describe("LocalDaemonRouter", () => {
  it("rejects a wrong daemon bearer token before touching runtime state", async () => {
    const heartbeat = vi.fn();
    const app = express(); app.use(express.json());
    app.use("/api", createLocalDaemonRouter({ store: { heartbeat } as unknown as LocalDaemonStore, token: "a".repeat(64), listAgentIds: () => [], actionExists: () => false }));
    const server = app.listen(0, "127.0.0.1"); servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/daemon/heartbeat`, { method: "POST", headers: { authorization: `Bearer ${"b".repeat(64)}`, "content-type": "application/json" }, body: "{}" });
    expect(response.status).toBe(401); expect(heartbeat).not.toHaveBeenCalled();
  });

  it("validates the State/Action pair and strict Action execution role", async () => {
    const actionRoleBinding = vi.fn().mockReturnValue({ version: 1, actionId: "action-1", role: "validation" });
    const app = express(); app.use(express.json());
    app.use("/api", createLocalDaemonRouter({ store: { actionRoleBinding } as unknown as LocalDaemonStore,
      token: "a".repeat(64), listAgentIds: () => [], actionExists: (stateId, actionId) => stateId === "state-1" && actionId === "action-1" }));
    app.use(((error, _req, res, _next) => { void _next; res.status(400).json({ error: String(error) }); }) as ErrorRequestHandler);
    const server = app.listen(0, "127.0.0.1"); servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo; const base = `http://127.0.0.1:${port}/api/environment/states`;
    let response = await fetch(`${base}/state-1/actions/action-1/execution/validation`);
    expect(response.status).toBe(200); expect(actionRoleBinding).toHaveBeenCalledWith("action-1", "validation");
    response = await fetch(`${base}/wrong-state/actions/action-1/execution/validation`);
    expect(response.status).toBe(404);
    response = await fetch(`${base}/state-1/actions/action-1/execution/critic`);
    expect(response.status).toBe(400);
  });
});
