import express from "express";
import { z } from "zod";
import {
  adminBootstrapBodySchema,
  adminLoginBodySchema,
  agentExecutionParamsSchema,
  agentRunParamsV1Schema,
  executionBindingBodySchema,
  executionEventsQuerySchema,
  executionTaskParamsSchema,
  pairingApprovalBodySchema,
  pairingParamsSchema,
  pairingSessionCreateBodySchema,
  projectRegistrationSchema,
  runtimeDeviceParamsSchema,
  runtimeListQuerySchema,
  startRunBodySchema
} from "../../../shared/api/runtime-schemas.js";
import { ControlPlaneConflictError, ControlPlaneNotFoundError } from "../errors.js";
import { adminAuth, asyncHandler, clearSessionCookies, FixedWindowRateLimiter, parseBody, parseParams, parseQuery, readCookie, setSessionCookies } from "./HttpSupport.js";
import { executionConsoleStream } from "./ExecutionStreamHandler.js";
import type { ControlPlaneRouterOptions } from "./types.js";

const loopParams = z.object({ loopId: z.string().min(1).max(200) }).strict();
const logQuery = z.object({ limit: z.coerce.number().int().min(1).max(1000).default(200) }).strict();

export const createUiRouter = (options: ControlPlaneRouterOptions): express.Router => {
  const router = express.Router();
  const read = adminAuth(options.service, false);
  const write = adminAuth(options.service, true);
  const secure = options.secureCookies ?? false;
  const adminLimiter = new FixedWindowRateLimiter(10, 10 * 60 * 1000);

  router.get("/admin/status", (req, res) => {
    const bootstrapped = options.service.adminBootstrapped();
    const session = readCookie(req, "ballet_session");
    const csrfToken = readCookie(req, "ballet_csrf");
    try {
      if (session) options.service.authenticateAdmin(session);
      res.json({ bootstrapped, authenticated: Boolean(session), csrfToken });
    } catch {
      res.json({ bootstrapped, authenticated: false });
    }
  });
  router.post("/admin/bootstrap", (req, res) => {
    adminLimiter.check(req.ip || req.socket.remoteAddress || "unknown");
    const { password } = parseBody(adminBootstrapBodySchema, req);
    options.service.bootstrapAdmin(password);
    const session = options.service.loginAdmin(password);
    setSessionCookies(res, session, secure);
    res.status(201).json({ bootstrapped: true, authenticated: true, csrfToken: session.csrfToken });
  });
  router.post("/admin/login", (req, res) => {
    adminLimiter.check(req.ip || req.socket.remoteAddress || "unknown");
    const { password } = parseBody(adminLoginBodySchema, req);
    const session = options.service.loginAdmin(password);
    setSessionCookies(res, session, secure);
    res.json({ bootstrapped: true, authenticated: true, csrfToken: session.csrfToken });
  });
  router.post("/admin/logout", write, (req, res) => {
    const session = readCookie(req, "ballet_session");
    if (session) options.service.logoutAdmin(session);
    clearSessionCookies(res, secure);
    res.status(204).end();
  });

  router.put("/projects/active", write, (req, res) => res.json(options.service.registerProject(parseBody(projectRegistrationSchema, req))));
  router.get("/runtimes/devices", read, (req, res) => {
    const query = parseQuery(runtimeListQuerySchema, req);
    res.json(options.service.listDevices(query.search, query.status));
  });
  router.get("/runtimes/devices/:deviceId", read, (req, res) => res.json(options.service.getDevice(parseParams(runtimeDeviceParamsSchema, req).deviceId)));
  router.post("/runtimes/devices/:deviceId/refresh", write, (req, res) => { parseBody(pairingApprovalBodySchema, req); res.json(options.service.requestDeviceRefresh(parseParams(runtimeDeviceParamsSchema, req).deviceId)); });
  router.post("/runtimes/devices/:deviceId/restart", write, (req, res) => { parseBody(pairingApprovalBodySchema, req); res.json(options.service.requestDeviceRestart(parseParams(runtimeDeviceParamsSchema, req).deviceId)); });
  router.get("/runtimes/devices/:deviceId/logs", read, (req, res) => {
    const { deviceId } = parseParams(runtimeDeviceParamsSchema, req);
    res.json({ entries: options.service.deviceLogs(deviceId, parseQuery(logQuery, req).limit) });
  });
  router.delete("/runtimes/devices/:deviceId", write, asyncHandler(async (req, res) => { await options.service.revokeDevice(parseParams(runtimeDeviceParamsSchema, req).deviceId); res.status(204).end(); }));

  router.post("/pairing/sessions", write, (req, res) => {
    const pairing = options.service.createPairing(parseBody(pairingSessionCreateBodySchema, req).displayName);
    res.status(201).json(pairingResponse(options, req, pairing));
  });
  router.get("/pairing/sessions/:pairingId", read, (req, res) => {
    const pairing = options.service.getPairing(parseParams(pairingParamsSchema, req).pairingId);
    res.json(pairingResponse(options, req, pairing));
  });
  router.post("/pairing/sessions/:pairingId/approve", write, (req, res) => {
    parseBody(pairingApprovalBodySchema, req);
    const pairing = options.service.approvePairing(parseParams(pairingParamsSchema, req).pairingId);
    res.json(pairingResponse(options, req, pairing));
  });

  router.get("/agents/execution-states", read, asyncHandler(async (_req, res) => { res.json(await options.service.executionStates()); }));
  router.get("/agents/:agentId/execution-binding", read, (req, res) => res.json(options.service.getBinding(parseParams(agentExecutionParamsSchema, req).agentId) ?? null));
  router.put("/agents/:agentId/execution-binding", write, (req, res) => {
    const { agentId } = parseParams(agentExecutionParamsSchema, req);
    res.json(options.service.putBinding(agentId, parseBody(executionBindingBodySchema, req)));
  });
  router.post("/agents/:agentId/runs", write, asyncHandler(async (req, res) => {
    const { agentId } = parseParams(agentExecutionParamsSchema, req);
    const run = await options.service.startAgentRun(agentId, parseBody(startRunBodySchema, req).input);
    res.status(201).json(run);
  }));
  router.get("/agents/:agentId/runs/latest", read, (req, res) => res.json(options.service.latestRun(parseParams(agentExecutionParamsSchema, req).agentId) ?? null));
  router.get("/agent-runs/:runId", read, (req, res) => res.json(options.service.getRun(parseParams(agentRunParamsV1Schema, req).runId)));
  router.post("/agent-runs/:runId/cancel", write, asyncHandler(async (req, res) => { parseBody(pairingApprovalBodySchema, req); res.json(await options.service.cancelRun(parseParams(agentRunParamsV1Schema, req).runId)); }));

  router.get("/execution-tasks/:taskId/events", read, (req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    const query = parseQuery(executionEventsQuerySchema, req);
    res.json(options.service.eventPage(taskId, query.after, query.limit));
  });
  router.get("/execution-tasks/:taskId/console/stream", read, executionConsoleStream(options.service));
  router.get("/loops/:loopId/preflight", read, asyncHandler(async (req, res) => {
    if (!options.resolveLoopSnapshot) throw new ControlPlaneConflictError("Loop snapshot resolver is not configured.");
    const { loopId } = parseParams(loopParams, req);
    const loop = await options.resolveLoopSnapshot(loopId);
    if (!loop) throw new ControlPlaneNotFoundError(`Loop ${loopId} was not found.`);
    res.json(options.service.preflightLoop(loop));
  }));
  return router;
};

const pairingResponse = (options: ControlPlaneRouterOptions, request: express.Request, pairing: ReturnType<ControlPlaneRouterOptions["service"]["getPairing"]>) => ({
  ...pairing,
  claimedDevice: pairing.deviceId ? options.service.getDevice(pairing.deviceId) : undefined,
  verificationUri: options.verificationUri?.(request, pairing)
    ?? `${request.protocol}://${request.get("host") ?? "localhost"}/runtimes?pairing=${encodeURIComponent(pairing.id)}`,
  interval: 2,
  installCommand: options.installCommand?.({ request, pairing })
});
