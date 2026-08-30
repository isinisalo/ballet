import { timingSafeEqual } from "node:crypto";
import express from "express";
import { z } from "zod";
import {
  actionRoleExecutionParamsSchema, agentExecutionParamsSchema, emptyRuntimeBodySchema, executionBindingBodySchema,
  executionTaskParamsSchema, localDaemonClaimBodySchema, localDaemonCompleteBodySchema,
  localDaemonDiagnosticsBodySchema, localDaemonEventBatchBodySchema, localDaemonFailBodySchema,
  localDaemonHeartbeatBodySchema, localDaemonLeaseBodySchema, runtimeLogQuerySchema
} from "../../../shared/api/runtime-schemas.js";
import { parseBody, parseParams, parseUnknown } from "../../http/validation/httpValidation.js";
import type { LocalDaemonStore } from "../../orchestration/persistence/LocalDaemonStore.js";

export const createLocalDaemonRouter = (options: {
  store: LocalDaemonStore; token: string; listAgentIds(): string[];
  actionExists(stateId: string, actionId: string): boolean;
}): express.Router => {
  const router = express.Router();
  const authenticated = daemonAuth(options.token);
  const route = (handler: (req: express.Request, res: express.Response) => void | Promise<void>): express.RequestHandler =>
    (req, res, next) => { void Promise.resolve(handler(req, res)).catch(next); };

  router.get("/runtimes/local", route((_req, res) => { res.json(options.store.status()); }));
  router.post("/runtimes/local/refresh", route((req, res) => {
    parseBody(emptyRuntimeBodySchema, req); res.json(options.store.request("refresh"));
  }));
  router.post("/runtimes/local/restart", route((req, res) => {
    parseBody(emptyRuntimeBodySchema, req); res.json(options.store.request("restart"));
  }));
  router.get("/runtimes/local/logs", route((req, res) => {
    const { limit } = parseUnknown(runtimeLogQuerySchema, req.query); res.json({ entries: options.store.logs(limit) });
  }));

  router.get("/agents/execution-states", route((_req, res) => {
    res.json(options.store.executionStates(options.listAgentIds()));
  }));
  router.get("/agents/:agentId/execution", route((req, res) => {
    res.json(options.store.binding(parseParams(agentExecutionParamsSchema, req).agentId) ?? null);
  }));
  router.put("/agents/:agentId/execution", route((req, res) => {
    const { agentId } = parseParams(agentExecutionParamsSchema, req);
    res.json(options.store.putBinding(agentId, parseBody(executionBindingBodySchema, req)));
  }));
  router.get("/environment/states/:stateId/actions/:actionId/execution/:role", route((req, res) => {
    const { stateId, actionId, role } = parseParams(actionRoleExecutionParamsSchema, req);
    if (!options.actionExists(stateId, actionId)) { res.status(404).json({ error: `Action ${actionId} was not found in State ${stateId}.` }); return; }
    res.json(options.store.actionRoleBinding(actionId, role) ?? null);
  }));
  router.put("/environment/states/:stateId/actions/:actionId/execution/:role", route((req, res) => {
    const { stateId, actionId, role } = parseParams(actionRoleExecutionParamsSchema, req);
    if (!options.actionExists(stateId, actionId)) { res.status(404).json({ error: `Action ${actionId} was not found in State ${stateId}.` }); return; }
    res.json(options.store.putActionRoleBinding(actionId, role, parseBody(executionBindingBodySchema, req)));
  }));

  router.post("/daemon/heartbeat", authenticated, route((req, res) => {
    res.json(options.store.heartbeat(parseBody(localDaemonHeartbeatBodySchema, req)));
  }));
  router.post("/daemon/diagnostics", authenticated, route((req, res) => {
    const { lines } = parseBody(localDaemonDiagnosticsBodySchema, req);
    res.status(202).json({ accepted: options.store.appendLogs(lines) });
  }));
  router.post("/daemon/tasks/claim", authenticated, route((req, res) => {
    const claim = options.store.claim(parseBody(localDaemonClaimBodySchema, req).provider);
    if (!claim) { res.status(204).end(); return; }
    res.json(claim);
  }));
  router.post("/daemon/tasks/:taskId/lease", authenticated, route((req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    res.json(options.store.renew(taskId, parseBody(localDaemonLeaseBodySchema, req).fencing));
  }));
  router.post("/daemon/tasks/:taskId/events", authenticated, route((req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    const input = parseBody(localDaemonEventBatchBodySchema, req);
    res.status(202).json({ accepted: options.store.appendEvents(taskId, input.fencing, input.events) });
  }));
  router.post("/daemon/tasks/:taskId/complete", authenticated, route((req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    const input = parseBody(localDaemonCompleteBodySchema, req);
    res.json({ applied: options.store.complete(taskId, input.fencing, input.providerOutcomeKey, input.rawOutput) });
  }));
  router.post("/daemon/tasks/:taskId/fail", authenticated, route((req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    const input = parseBody(localDaemonFailBodySchema, req);
    res.json({ applied: options.store.fail(taskId, input.fencing, input.providerOutcomeKey, input.errorMessage) });
  }));
  router.post("/daemon/requests/:kind/ack", authenticated, route((req, res) => {
    parseBody(emptyRuntimeBodySchema, req);
    const { kind } = parseParams(z.object({ kind: z.enum(["refresh", "restart"]) }).strict(), req);
    options.store.acknowledgeRequest(kind); res.status(204).end();
  }));
  return router;
};

const daemonAuth = (expected: string): express.RequestHandler => (req, res, next) => {
  const value = req.get("authorization");
  const token = value?.startsWith("Bearer ") ? value.slice(7) : "";
  const left = Buffer.from(token); const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    res.status(401).json({ error: "Local daemon authentication failed." }); return;
  }
  next();
};
