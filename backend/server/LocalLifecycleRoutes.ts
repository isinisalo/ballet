import { timingSafeEqual } from "node:crypto";
import express from "express";
import type { ControlPlaneService } from "../control-plane/ControlPlaneService.js";
import type { ControlPlaneDatabase } from "../control-plane/ControlPlaneDatabase.js";
import type { LoopRunDetails } from "../../shared/domain/runtime.js";

export interface LocalLifecycleLoopStore {
  listActiveLoopRuns(): LoopRunDetails[];
  cancelLoopRun(runId: string): Promise<unknown> | unknown;
}

export interface LocalLifecycleDependencies {
  token: string;
  projectId: string;
  controlPlane: ControlPlaneService;
  database: ControlPlaneDatabase;
  store: LocalLifecycleLoopStore;
}

export const createLocalLifecycleRouter = (dependencies: LocalLifecycleDependencies): express.Router => {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!isLoopback(req.socket.remoteAddress) || !matchesBearer(req.get("authorization"), dependencies.token)) {
      res.status(401).json({ error: "Local lifecycle authentication failed." });
      return;
    }
    next();
  });
  router.get("/", (_req, res) => res.json(lifecycleStatus(dependencies)));
  router.post("/", async (req, res, next) => {
    try {
      await cancelAll(dependencies);
      res.json(lifecycleStatus(dependencies));
    } catch (error) {
      next(error);
    }
  });
  return router;
};

const cancelAll = async (dependencies: LocalLifecycleDependencies): Promise<void> => {
  const connection = dependencies.database.connection();
  const directRuns = connection.prepare(`
    SELECT run_id FROM agent_runs
    WHERE project_id = ? AND status IN ('queued','claimed','preparing','running')
    ORDER BY created_at
  `).all(dependencies.projectId) as Array<{ run_id: string }>;
  for (const run of directRuns) await dependencies.controlPlane.cancelRun(run.run_id);

  for (const run of dependencies.store.listActiveLoopRuns()) {
    await dependencies.store.cancelLoopRun(run.runId);
  }
};

const lifecycleStatus = (dependencies: LocalLifecycleDependencies) => {
  const connection = dependencies.database.connection();
  const taskRoots = connection.prepare(`
    SELECT DISTINCT root_run_id FROM execution_tasks
    WHERE project_id = ? AND status IN ('queued','claimed','preparing','running')
  `).all(dependencies.projectId) as Array<{ root_run_id: string }>;
  const loopRoots = dependencies.store.listActiveLoopRuns().map((run) => run.rootRunId);
  const activeRuns = new Set([...taskRoots.map((row) => row.root_run_id), ...loopRoots]).size;
  const finalization = connection.prepare(`
    SELECT COUNT(*) AS count FROM root_run_finalizations
    WHERE project_id = ? AND status = 'pending'
  `).get(dependencies.projectId) as { count: number };
  return {
    activeRuns,
    pendingFinalizations: finalization.count,
    idle: activeRuns === 0 && finalization.count === 0
  };
};

const isLoopback = (address?: string): boolean =>
  Boolean(address && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address));

const matchesBearer = (authorization: string | undefined, expected: string): boolean => {
  const value = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
};
