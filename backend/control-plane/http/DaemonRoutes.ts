import express from "express";
import {
  daemonCancelBodySchema,
  daemonClaimBodySchema,
  daemonCompleteBodySchema,
  daemonDiagnosticsBodySchema,
  daemonEventBatchBodySchema,
  daemonFailBodySchema,
  daemonHeartbeatBodySchema,
  daemonLeaseBodySchema,
  daemonPairingPollBodySchema,
  daemonRootFinalizationBodySchema,
  daemonTaskStateBodySchema,
  executionTaskParamsSchema,
  pairingSessionCreateBodySchema,
  rootRunParamsSchema
} from "../../../shared/api/runtime-schemas.js";
import { asyncHandler, daemonAuth, daemonIdentity, FixedWindowRateLimiter, parseBody, parseParams } from "./HttpSupport.js";
import type { ControlPlaneRouterOptions } from "./types.js";

export const createDaemonRouter = (options: ControlPlaneRouterOptions): express.Router => {
  const router = express.Router();
  const authenticated = daemonAuth(options.service);
  const pairingCreateLimiter = new FixedWindowRateLimiter(10, 10 * 60 * 1000);
  const pairingPollLimiter = new FixedWindowRateLimiter(360, 10 * 60 * 1000);

  router.post("/daemon/pairing/sessions", (req, res) => {
    pairingCreateLimiter.check(req.ip || req.socket.remoteAddress || "unknown");
    const pairing = options.service.createPairing(parseBody(pairingSessionCreateBodySchema, req).displayName);
    res.status(201).json({
      pairingId: pairing.id,
      deviceCode: pairing.deviceCode,
      userCode: pairing.userCode,
      expiresAt: pairing.expiresAt,
      verificationUri: options.verificationUri?.(req, pairing)
        ?? `${req.protocol}://${req.get("host") ?? "localhost"}/runtimes?pairing=${encodeURIComponent(pairing.id)}`,
      intervalSeconds: 2,
      installCommand: options.installCommand?.({ request: req, pairing })
    });
  });
  router.post("/daemon/pairing/poll", (req, res) => {
    pairingPollLimiter.check(req.ip || req.socket.remoteAddress || "unknown");
    const result = options.service.pollPairing(parseBody(daemonPairingPollBodySchema, req));
    res.status(result.status === "pending" ? 202 : 200).json(result);
  });

  router.post("/daemon/heartbeat", authenticated, (req, res) => {
    res.json(options.service.heartbeat(daemonIdentity(res), parseBody(daemonHeartbeatBodySchema, req)));
  });
  router.post("/daemon/diagnostics", authenticated, (req, res) => {
    const identity = daemonIdentity(res);
    const { lines } = parseBody(daemonDiagnosticsBodySchema, req);
    options.service.appendDeviceDiagnostics(identity.deviceId, lines);
    res.status(202).json({ accepted: lines.length });
  });
  router.post("/daemon/tasks/claim", authenticated, (req, res) => {
    const { runtimeBackendId } = parseBody(daemonClaimBodySchema, req);
    const claim = options.service.claimTask(daemonIdentity(res), runtimeBackendId);
    if (!claim) { res.status(204).end(); return; }
    res.json(claim);
  });
  router.post("/daemon/tasks/:taskId/lease", authenticated, (req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    res.json(options.service.renewLease(daemonIdentity(res), taskId, parseBody(daemonLeaseBodySchema, req)));
  });
  router.post("/daemon/tasks/:taskId/state", authenticated, (req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    res.json(options.service.setTaskState(daemonIdentity(res), taskId, parseBody(daemonTaskStateBodySchema, req)));
  });
  router.post("/daemon/tasks/:taskId/events", authenticated, (req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    res.status(202).json(options.service.appendEvents(daemonIdentity(res), taskId, parseBody(daemonEventBatchBodySchema, req)));
  });
  router.post("/daemon/tasks/:taskId/complete", authenticated, asyncHandler(async (req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    res.json(await options.service.completeTask(daemonIdentity(res), taskId, parseBody(daemonCompleteBodySchema, req)));
  }));
  router.post("/daemon/tasks/:taskId/fail", authenticated, asyncHandler(async (req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    res.json(await options.service.failTask(daemonIdentity(res), taskId, parseBody(daemonFailBodySchema, req)));
  }));
  router.post("/daemon/tasks/:taskId/cancel", authenticated, asyncHandler(async (req, res) => {
    const { taskId } = parseParams(executionTaskParamsSchema, req);
    res.json(await options.service.cancelClaimedTask(daemonIdentity(res), taskId, parseBody(daemonCancelBodySchema, req)));
  }));
  router.post("/daemon/root-runs/:rootRunId/finalize", authenticated, (req, res) => {
    const { rootRunId } = parseParams(rootRunParamsSchema, req);
    const body = parseBody(daemonRootFinalizationBodySchema, req);
    if ("taskToken" in body) options.service.reportRootFinalization(daemonIdentity(res), rootRunId, body);
    else options.service.reportRequestedRootFinalization(daemonIdentity(res), rootRunId, body);
    res.status(204).end();
  });
  return router;
};
