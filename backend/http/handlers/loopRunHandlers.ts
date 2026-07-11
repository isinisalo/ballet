import type { RequestHandler } from "express";
import { store } from "../../store.js";
import {
  loopParamsSchema,
  loopRunParamsSchema,
  respondToStepRunSchema,
  startLoopRunSchema,
  stepRunParamsSchema
} from "../validation/schemas.js";
import { parseBody, parseParams } from "../validation/httpValidation.js";

export const startLoopRun: RequestHandler = async (req, res, next) => {
  try {
    const { loopId } = parseParams(loopParamsSchema, req);
    const { input } = parseBody(startLoopRunSchema, req);
    res.status(201).json(await store.startLoopRun(loopId, input));
  } catch (error) {
    next(error);
  }
};

export const latestLoopRun: RequestHandler = async (req, res, next) => {
  try {
    const { loopId } = parseParams(loopParamsSchema, req);
    res.json(await store.latestLoopRun(loopId));
  } catch (error) {
    next(error);
  }
};

export const respondToStepRun: RequestHandler = async (req, res, next) => {
  try {
    const { runId, stepRunId } = parseParams(stepRunParamsSchema, req);
    const { result, input } = parseBody(respondToStepRunSchema, req);
    res.json(await store.respondToStepRun(runId, stepRunId, result, input));
  } catch (error) {
    next(error);
  }
};

export const cancelLoopRun: RequestHandler = (req, res, next) => {
  try {
    const { runId } = parseParams(loopRunParamsSchema, req);
    res.json(store.cancelLoopRun(runId));
  } catch (error) {
    next(error);
  }
};

export const stepRunConsole: RequestHandler = (req, res) => {
  const { runId, stepRunId } = parseParams(stepRunParamsSchema, req);
  const afterId = nonNegativeInteger(req.query.afterId, 0);
  const limit = positiveInteger(req.query.limit, 500);
  const page = store.getStepRunConsole(runId, stepRunId, afterId, limit);
  if (!page) {
    res.status(404).json({ error: `Step run ${stepRunId} was not found in loop run ${runId}.` });
    return;
  }
  res.json(page);
};

export const stepRunConsoleStream: RequestHandler = (req, res) => {
  const { runId, stepRunId } = parseParams(stepRunParamsSchema, req);
  let cursor = nonNegativeInteger(req.header("last-event-id") ?? req.query.afterId, 0);
  if (!store.getStepRunConsole(runId, stepRunId, cursor, 1)) {
    res.status(404).json({ error: `Step run ${stepRunId} was not found in loop run ${runId}.` });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  let runRevision = "";
  const send = () => {
    let page = store.getStepRunConsole(runId, stepRunId, cursor, 500);
    if (!page) return;
    while (page.entries.length > 0) {
      page.entries.forEach((entry) => {
        res.write(`id: ${entry.id}\n`);
        res.write("event: console\n");
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
        cursor = entry.id;
      });
      if (!page.hasMore) break;
      page = store.getStepRunConsole(runId, stepRunId, cursor, 500) ?? page;
    }
    const run = store.getLoopRun(runId);
    if (run) {
      const revision = `${run.updatedAt}:${run.stepRuns.map((stepRun) => stepRun.updatedAt).join(":")}`;
      if (revision !== runRevision) {
        runRevision = revision;
        res.write("event: run\n");
        res.write(`data: ${JSON.stringify(run)}\n\n`);
      }
    }
  };

  send();
  const poll = setInterval(send, 250);
  const heartbeat = setInterval(() => res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`), 15000);
  req.on("close", () => {
    clearInterval(poll);
    clearInterval(heartbeat);
    res.end();
  });
};

function nonNegativeInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000) : fallback;
}
