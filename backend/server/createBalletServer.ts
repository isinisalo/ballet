import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { emptyBodySchema } from "../../shared/api/runtime-schemas.js";
import { createApiRouter } from "../http/apiRouter.js";
import { parseBody } from "../http/validation/httpValidation.js";
import { LocalExecutionQueue } from "../execution/LocalExecutionQueue.js";
import { ExecutionStore } from "../execution/ExecutionStore.js";
import { LocalRuntimeService } from "../execution/LocalRuntimeService.js";
import { RuntimeConfigurationService } from "../execution/RuntimeConfigurationService.js";
import { LocalSettingsRepository } from "../execution/LocalSettingsRepository.js";
import { resolveProjectContext, type ProjectContext } from "../project/ProjectContext.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { LocalRunService } from "../runs/LocalRunService.js";
import { LocalRunTargetService } from "../runs/LocalRunTargetService.js";
import { RootRunStore } from "../runs/RootRunStore.js";
import { WorkspaceInvalidationBroadcaster } from "../runs/WorkspaceInvalidationBroadcaster.js";
import { LoopScheduler } from "../scheduling/LoopScheduler.js";
import { MarkdownStore } from "../store.js";
import { RotatingFileLogger } from "./RotatingFileLogger.js";

export interface CreateBalletServerOptions {
  root: string;
  port: number;
  stateRoot?: string;
  codexCommand?: string;
  copilotCommand?: string;
  webDist?: string;
  onShutdown?(): void;
}

export const createBalletServer = async (options: CreateBalletServerOptions) => {
  const context = await resolveProjectContext({ root: options.root, stateRoot: options.stateRoot });
  const logger = new RotatingFileLogger(context.logsPath);
  const database = new RuntimeDatabase(context.databasePath);
  database.connection();
  const roots = new RootRunStore(() => database.connection());
  const executions = new ExecutionStore(() => database.connection());
  const settings = new LocalSettingsRepository(context.settingsPath);
  const savedSettings = await settings.load();
  const runtime = new LocalRuntimeService({
    context, executionStore: executions, settings,
    codexCommand: options.codexCommand ?? savedSettings.codexCommand,
    copilotCommand: options.copilotCommand ?? savedSettings.copilotCommand
  });
  await runtime.start();
  const configurations = new RuntimeConfigurationService(context.root, settings, runtime, executions);
  const invalidations = new WorkspaceInvalidationBroadcaster();
  const store = new MarkdownStore(context.root, database);
  const targets = new LocalRunTargetService(roots, configurations);
  const runHolder: { service?: LocalRunService } = {};
  const queue = new LocalExecutionQueue({
    store: executions, runtime, worktreesRoot: context.worktreesRoot,
    onTerminal: (task) => runHolder.service!.handleTerminal(task),
    onStarted: (task) => runHolder.service!.handleStarted(task),
    onOrchestrationError: (error, task) => logger.error("Task terminal reconciliation failed.", {
      taskId: task.id, error: error instanceof Error ? error.message : String(error)
    }),
    onChanged: (rootRunId) => invalidations.publish("runs-changed", { rootRunId })
  });
  const runs = new LocalRunService({
    context, connection: () => database.connection(), database, roots, executions, runtime,
    configurations, queue, readData: () => store.read(),
    onChanged: (rootRunId) => invalidations.publish("runs-changed", { rootRunId })
  });
  runHolder.service = runs;
  store.setAgentRemovalHook((agentId) => configurations.remove(agentId));
  store.setWorkspaceEnricher(async (content) => {
    const agentIds = content.agents.map((agent) => agent.id);
    const agentRuntimeConfigurations = await configurations.list(agentIds);
    return {
      ...content,
      runtime: await runtime.snapshot(),
      agentRuntimeConfigurations,
      executionStates: await configurations.executionStates(agentIds, agentRuntimeConfigurations),
      runTargets: await targets.list(content, agentRuntimeConfigurations)
    };
  });
  await runs.reconcile();
  await queue.start();
  database.recoverReservedScheduleOccurrences();
  const scheduler = new LoopScheduler({
    readData: () => store.read(), database: () => database,
    dispatch: (input) => runs.dispatchScheduled(input),
    subscribeChanges: (listener) => invalidations.subscribe((event) => {
      if (event.type === "workspace-changed") listener(event.reason);
    }),
    onChanged: () => invalidations.publish("workspace-changed", { reason: "schedules" })
  });
  scheduler.start();

  const app = express();
  app.disable("x-powered-by");
  app.use(loopbackSecurity(options.port));
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", (_req, res) => res.json(health(context, options.port, runtime)));
  let shuttingDown = false;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
  app.post("/api/local/shutdown", (req, res, next) => {
    try { parseBody(emptyBodySchema, req); } catch (error) { next(error); return; }
    res.status(202).json({ accepted: true });
    setTimeout(() => { void shutdown(); }, 25).unref();
  });
  app.use("/api", createApiRouter({
    store, runtime, configurations, executions, runs, invalidations, logsPath: context.logsPath
  }));

  const clientDist = resolveClientDist(options.webDist);
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    logger.error("HTTP request failed.", error instanceof Error ? { message: error.message, stack: error.stack } : error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error." });
  });
  const server = createServer(app);

  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return closed;
    shuttingDown = true;
    logger.info("Ballet shutdown started.");
    await scheduler.stop();
    await Promise.race([
      queue.shutdown(85_000).then(() => runs.reconcile()),
      new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 90_000);
        timeout.unref();
      })
    ]);
    const serverClosed = new Promise<void>((resolve) => server.close(() => resolve()));
    server.closeAllConnections();
    await serverClosed;
    database.close();
    logger.info("Ballet shutdown completed.");
    await logger.flush();
    resolveClosed();
    options.onShutdown?.();
  };

  logger.info("Ballet server initialized.", { root: context.root, instanceId: context.instanceId, port: options.port });
  return { app, server, context, store, runtime, configurations, executions, runs, queue, scheduler, shutdown, logger };
};

const loopbackSecurity = (port: number): express.RequestHandler => (req, res, next) => {
  const host = (req.get("host") ?? "").toLowerCase();
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname)) {
    res.status(403).json({ error: "Ballet accepts loopback requests only." }); return;
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const fetchSite = req.get("sec-fetch-site");
    const allowed = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
    if ((origin && !allowed.has(origin)) || (fetchSite && !["same-origin", "none"].includes(fetchSite))) {
      res.status(403).json({ error: "Cross-origin mutation was blocked." }); return;
    }
  }
  next();
};

const health = (context: ProjectContext, port: number, runtime: LocalRuntimeService) => ({
  ok: true, instanceId: context.instanceId, checkoutRoot: context.root, port,
  version: process.env.BALLET_VERSION ?? "0.1.0",
  startedAt: runtime.startedAtIso
});

const resolveClientDist = (configured?: string): string => {
  const candidates = [configured, path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist"), path.resolve(process.cwd(), "dist")]
    .filter((candidate): candidate is string => Boolean(candidate)).map((candidate) => path.resolve(candidate));
  return candidates.find((candidate) => existsSync(path.join(candidate, "index.html"))) ?? candidates[0]!;
};
