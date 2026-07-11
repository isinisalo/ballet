import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RootRunDetail,
  RootRunListQuery,
  RootRunListResponse,
  RootRunSummary,
  RunTargetsResponse
} from "../../shared/domain/runs.js";
import {
  createRunRouter,
  RunInvalidationBroadcaster,
  type RunReadModelService,
  type RunTargetService
} from "../runs/index.js";

const servers: Server[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(async (server) => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }));
});

const summary: RootRunSummary = {
  rootRunId: "root-run",
  projectId: "project",
  kind: "loop",
  targetId: "delivery",
  source: "manual",
  status: "running",
  createdAt: "2026-07-11T08:00:00.000Z",
  updatedAt: "2026-07-11T08:01:00.000Z"
};

const detail: RootRunDetail = { ...summary, loopRuns: [], tasks: [] };
const targetResponse: RunTargetsResponse = {
  loops: [{ kind: "loop", id: "delivery", name: "Delivery", ready: true, issues: [] }],
  agents: [{ kind: "agent", id: "developer", name: "Developer", ready: true, issues: [] }]
};

interface Harness {
  url: string;
  list: ReturnType<typeof vi.fn<(query?: RootRunListQuery) => RootRunListResponse>>;
  readDetail: ReturnType<typeof vi.fn<(rootRunId: string) => RootRunDetail | undefined>>;
  listTargets: ReturnType<typeof vi.fn<() => Promise<RunTargetsResponse>>>;
  invalidations: RunInvalidationBroadcaster;
}

const listen = async (invalidations = new RunInvalidationBroadcaster()): Promise<Harness> => {
  const list = vi.fn<(query?: RootRunListQuery) => RootRunListResponse>(() => ({ items: [summary] }));
  const readDetail = vi.fn<(rootRunId: string) => RootRunDetail | undefined>((rootRunId) =>
    rootRunId === detail.rootRunId ? detail : undefined);
  const listTargets = vi.fn<() => Promise<RunTargetsResponse>>(async () => targetResponse);
  const app = express();
  app.use("/api", createRunRouter({
    runs: { list, detail: readDetail } as unknown as RunReadModelService,
    targets: { list: listTargets } as unknown as RunTargetService,
    invalidations
  }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Run route test server did not bind.");
  return { url: `http://127.0.0.1:${address.port}/api`, list, readDetail, listTargets, invalidations };
};

describe("unified Run HTTP API", () => {
  it("validates and forwards list filters", async () => {
    const harness = await listen();
    const response = await fetch(`${harness.url}/runs?state=active&kind=loop&cursor=next-page&limit=17`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [summary] });
    expect(harness.list).toHaveBeenCalledWith({ state: "active", kind: "loop", cursor: "next-page", limit: 17 });
  });

  it.each([
    "state=all",
    "kind=direct",
    "limit=0",
    "limit=1.5",
    "limit=201",
    "cursor=%25invalid",
    "extra=value"
  ])("rejects an invalid list query: %s", async (query) => {
    const harness = await listen();
    const response = await fetch(`${harness.url}/runs?${query}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid run list query.", issues: expect.any(Array) });
    expect(harness.list).not.toHaveBeenCalled();
  });

  it("returns Run detail and launch targets with explicit missing and invalid detail responses", async () => {
    const harness = await listen();

    const found = await fetch(`${harness.url}/runs/root-run`);
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual(detail);
    expect(harness.readDetail).toHaveBeenCalledWith("root-run");

    const missing = await fetch(`${harness.url}/runs/missing-run`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Root Run missing-run was not found." });

    const invalidDetailQuery = await fetch(`${harness.url}/runs/root-run?include=tasks`);
    expect(invalidDetailQuery.status).toBe(400);
    expect(await invalidDetailQuery.json()).toEqual({ error: "Invalid Run detail query." });

    const invalid = await fetch(`${harness.url}/runs/${"x".repeat(201)}`);
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "Invalid root Run id." });

    const targets = await fetch(`${harness.url}/run-targets`);
    expect(targets.status).toBe(200);
    expect(await targets.json()).toEqual(targetResponse);
    expect(harness.listTargets).toHaveBeenCalledOnce();

    const invalidTargetsQuery = await fetch(`${harness.url}/run-targets?state=active`);
    expect(invalidTargetsQuery.status).toBe(400);
    expect(await invalidTargetsQuery.json()).toEqual({ error: "Invalid Run targets query." });
    expect(harness.listTargets).toHaveBeenCalledOnce();
  });
});

describe("Run invalidation SSE", () => {
  it("starts a fresh stream at the live edge instead of replaying process history", async () => {
    const broadcaster = new RunInvalidationBroadcaster();
    broadcaster.publish({ reason: "before-connect" });
    const harness = await listen(broadcaster);
    const stream = await openSse(`${harness.url}/runs/stream`);
    try {
      broadcaster.publish({ reason: "after-connect" });
      expect(await stream.read()).toEqual({
        id: "2",
        event: "runs-invalidated",
        data: expect.objectContaining({ id: 2, reason: "after-connect" })
      });
    } finally {
      await stream.close();
    }
  });

  it("frames retained replay events and then streams live invalidations", async () => {
    const broadcaster = new RunInvalidationBroadcaster(() => new Date("2026-07-11T10:00:00.000Z"));
    broadcaster.publish({ rootRunId: "root-one", reason: "task_state" });
    broadcaster.publish({ rootRunId: "root-two", reason: "loop-runs" });
    const harness = await listen(broadcaster);
    const stream = await openSse(`${harness.url}/runs/stream`, "1");
    try {
      expect(stream.contentType).toContain("text/event-stream");
      expect(await stream.read()).toEqual({
        id: "2",
        event: "runs-invalidated",
        data: expect.objectContaining({ id: 2, rootRunId: "root-two", reason: "loop-runs" })
      });

      broadcaster.publish({ rootRunId: "root-three", reason: "execution_event" });
      expect(await stream.read()).toEqual({
        id: "3",
        event: "runs-invalidated",
        data: expect.objectContaining({ id: 3, rootRunId: "root-three", reason: "execution_event" })
      });
    } finally {
      await stream.close();
    }
  });

  it("waits for the next event when reconnecting at the current cursor", async () => {
    const broadcaster = new RunInvalidationBroadcaster();
    broadcaster.publish({ reason: "first" });
    broadcaster.publish({ reason: "second" });
    const harness = await listen(broadcaster);
    const stream = await openSse(`${harness.url}/runs/stream`, "2");
    try {
      broadcaster.publish({ reason: "third" });
      expect(await stream.read()).toEqual({
        id: "3",
        event: "runs-invalidated",
        data: expect.objectContaining({ id: 3, reason: "third" })
      });
    } finally {
      await stream.close();
    }
  });

  it.each([
    { name: "ahead-of-server cursor", cursor: "42", populate: () => undefined },
    {
      name: "retained-history gap",
      cursor: "1",
      populate: (events: RunInvalidationBroadcaster) => {
        events.publish();
        events.publish();
        events.publish();
        events.publish();
      }
    },
    { name: "malformed cursor", cursor: "not-a-number", populate: () => undefined }
  ])("sends an unnumbered reset for a $name", async ({ cursor, populate }) => {
    const broadcaster = new RunInvalidationBroadcaster(undefined, 2);
    populate(broadcaster);
    const harness = await listen(broadcaster);
    const stream = await openSse(`${harness.url}/runs/stream`, cursor);
    try {
      expect(await stream.read()).toEqual({
        id: undefined,
        event: "runs-invalidated",
        data: { type: "runs-invalidated", reason: "reconnected" }
      });
    } finally {
      await stream.close();
    }
  });
});

interface ParsedSseEvent {
  id?: string;
  event?: string;
  data?: unknown;
}

const openSse = async (url: string, lastEventId?: string) => {
  const controller = new AbortController();
  const response = await fetch(url, {
    signal: controller.signal,
    headers: lastEventId === undefined ? undefined : { "Last-Event-ID": lastEventId }
  });
  if (!response.ok || !response.body) throw new Error(`SSE request failed with ${response.status}.`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  return {
    contentType: response.headers.get("content-type") ?? "",
    read: async (): Promise<ParsedSseEvent> => {
      while (!buffer.includes("\n\n")) {
        const chunk = await Promise.race([
          reader.read(),
          new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("Timed out reading SSE event.")), 2_000))
        ]);
        if (chunk.done) throw new Error("SSE stream ended before an event arrived.");
        buffer += decoder.decode(chunk.value, { stream: true });
      }
      const boundary = buffer.indexOf("\n\n");
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      return parseSseFrame(frame);
    },
    close: async () => {
      controller.abort();
      await reader.cancel().catch(() => undefined);
    }
  };
};

const parseSseFrame = (frame: string): ParsedSseEvent => {
  const parsed: ParsedSseEvent = {};
  for (const line of frame.split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator);
    const value = line.slice(separator + 1).trimStart();
    if (field === "id") parsed.id = value;
    if (field === "event") parsed.event = value;
    if (field === "data") parsed.data = JSON.parse(value) as unknown;
  }
  return parsed;
};
