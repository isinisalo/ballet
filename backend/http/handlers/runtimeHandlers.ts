import type { RequestHandler } from "express";
import { onRuntimeChanged } from "../../runtime-events.js";
import { workspaceService } from "../../services/workspaceService.js";
import { agentRunParamsSchema } from "../validation/eventSchemas.js";
import { parseParams } from "../validation/httpValidation.js";

export const runtimeHealth: RequestHandler = (_req, res, next) => {
  try {
    res.json(workspaceService.runtimeHealth());
  } catch (error) {
    next(error);
  }
};

export const runtimeStream: RequestHandler = (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const send = (type: string, payload: Record<string, unknown>) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send("ready", { ok: true, at: new Date().toISOString() });
  const unsubscribe = onRuntimeChanged((signal) => send("change", { signal, at: new Date().toISOString() }));
  const heartbeat = setInterval(() => send("heartbeat", { at: new Date().toISOString() }), 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
};

export const listAgentRuns: RequestHandler = (_req, res, next) => {
  try {
    res.json(workspaceService.listAgentRuns());
  } catch (error) {
    next(error);
  }
};

export const listRunLogs: RequestHandler = (req, res, next) => {
  try {
    const { id } = parseParams(agentRunParamsSchema, req);
    res.json(workspaceService.listRunLogs(id));
  } catch (error) {
    next(error);
  }
};

export const retryAgentRun: RequestHandler = (req, res, next) => {
  try {
    const { id } = parseParams(agentRunParamsSchema, req);
    res.json(workspaceService.retryAgentRun(id));
  } catch (error) {
    next(error);
  }
};
