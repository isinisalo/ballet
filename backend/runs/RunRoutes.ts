import express from "express";
import { z } from "zod";
import type { RunInvalidationEvent, RootRunListQuery } from "../../shared/domain/runs.js";
import type { RunInvalidationBroadcaster } from "./RunInvalidationBroadcaster.js";
import type { RunReadModelService } from "./RunReadModelService.js";
import type { RunTargetService } from "./RunTargetService.js";

export interface RunRoutesOptions {
  runs: RunReadModelService;
  targets: RunTargetService;
  invalidations: RunInvalidationBroadcaster;
}

const listQuerySchema = z.object({
  state: z.enum(["active", "recent"]).optional(),
  kind: z.enum(["loop", "agent"]).optional(),
  cursor: z.string().min(1).max(1_000).regex(/^[A-Za-z0-9_-]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
}).strict();

const emptyQuerySchema = z.object({}).strict();

export const createRunRouter = (options: RunRoutesOptions): express.Router => {
  const router = express.Router();
  router.get("/runs", (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid run list query.", issues: parsed.error.issues });
      return;
    }
    res.json(options.runs.list(parsed.data as RootRunListQuery));
  });
  router.get("/runs/stream", (req, res) => streamInvalidations(req, res, options.invalidations));
  router.get("/runs/:rootRunId", (req, res) => {
    if (!emptyQuerySchema.safeParse(req.query).success) {
      res.status(400).json({ error: "Invalid Run detail query." });
      return;
    }
    const rootRunId = String(req.params.rootRunId ?? "").trim();
    if (!rootRunId || rootRunId.length > 200) {
      res.status(400).json({ error: "Invalid root Run id." });
      return;
    }
    const detail = options.runs.detail(rootRunId);
    if (!detail) {
      res.status(404).json({ error: `Root Run ${rootRunId} was not found.` });
      return;
    }
    res.json(detail);
  });
  router.get("/run-targets", async (req, res, next) => {
    if (!emptyQuerySchema.safeParse(req.query).success) {
      res.status(400).json({ error: "Invalid Run targets query." });
      return;
    }
    try {
      res.json(await options.targets.list());
    } catch (error) {
      next(error);
    }
  });
  return router;
};

const streamInvalidations = (
  req: express.Request,
  res: express.Response,
  invalidations: RunInvalidationBroadcaster
): void => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const lastEventIdHeader = req.get("last-event-id");
  const lastId = parseLastEventId(lastEventIdHeader);
  const send = (event: RunInvalidationEvent) => {
    res.write(`id: ${event.id}\n`);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const replay = lastEventIdHeader === undefined
    ? { events: [], reset: false }
    : lastId === undefined
      ? { events: [], reset: true }
      : invalidations.replayAfter(lastId);
  // Event ids are process-local. If the server restarted while the browser was
  // disconnected, its Last-Event-ID can be ahead of the new broadcaster. A
  // retained-history gap is equivalent: the client cannot know which roots it
  // missed. An unnumbered invalidation guarantees one full refetch without
  // poisoning the browser's reconnect cursor.
  if (replay.reset) {
    res.write("event: runs-invalidated\n");
    res.write(`data: ${JSON.stringify({ type: "runs-invalidated", reason: "reconnected" })}\n\n`);
  } else {
    replay.events.forEach(send);
  }
  const unsubscribe = invalidations.subscribe(send);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
  heartbeat.unref();
  req.once("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};

const parseLastEventId = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};
