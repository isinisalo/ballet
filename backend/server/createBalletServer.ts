import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createControlPlane, agentSnapshotFromAgent } from "../control-plane/index.js";
import { adminAuth, controlPlaneErrorHandler } from "../control-plane/http/HttpSupport.js";
import { LoopExecutionCoordinator, preflightLoopSnapshot } from "../integration/LoopExecutionCoordinator.js";
import { resolveActiveProject } from "../project/activeProject.js";
import { resolveRuntimeDbPath } from "../runtime-db.js";
import { apiRouter } from "../routes.js";
import { store } from "../store.js";

export const createBalletServer = async () => {
  const root = store.root;
  const initialData = await store.read();
  const project = await resolveActiveProject(root, initialData);
  process.env.BALLET_PROJECT_ID = project.id;
  store.runtimeDatabase();

  const execution: { coordinator?: LoopExecutionCoordinator } = {};
  const publicOrigin = resolvePublicOrigin();
  const controlPlane = createControlPlane({
    dbPath: resolveRuntimeDbPath(root),
    project,
    secureCookies: process.env.BALLET_SECURE_COOKIES === "1" || publicOrigin?.startsWith("https://"),
    resolveAgentSnapshot: async (agentId) => {
      const agent = (await store.read()).agents.find((candidate) => candidate.id === agentId);
      if (!agent) throw new Error(`Agent ${agentId} was not found.`);
      return agentSnapshotFromAgent(agent, createHash("sha256").update(JSON.stringify(agent)).digest("hex"));
    },
    listAgentIds: async () => (await store.read()).agents.map((agent) => agent.id),
    resolveLoopSnapshot: async (loopId) => preflightLoopSnapshot(await store.read(), loopId),
    freshCheckoutBeforeRun: true,
    installCommand: ({ request, pairing }) => [
      "ballet setup",
      `--server ${shellQuote(requestOrigin(request, publicOrigin))}`,
      `--repo ${shellQuote(project.repositoryUrl)}`,
      `--project ${shellQuote(project.id)}`,
      `--device-code ${shellQuote(pairing.deviceCode)}`
    ].join(" "),
    verificationUri: (request, pairing) => `${requestOrigin(request, publicOrigin)}/runtimes?pairing=${encodeURIComponent(pairing.id)}`,
    onTaskState: (task) => execution.coordinator?.markTaskState(task),
    onTaskTerminal: (task) => execution.coordinator?.handleTerminal(task)
  });
  const coordinator = new LoopExecutionCoordinator({
    controlPlane: controlPlane.service,
    database: () => store.runtimeDatabase(),
    readData: () => store.read()
  });
  execution.coordinator = coordinator;
  store.setLoopExecutionGateway(coordinator);

  const app = express();
  if (process.env.BALLET_TRUST_PROXY === "1") app.set("trust proxy", true);
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", controlPlane.router);
  // The launchd client must be able to identify the project bound to a local
  // server before an administrator session exists. Keep this single probe
  // public; every project-data route below remains session protected.
  app.get("/api/health", (_req, res) => res.json({ ok: true, projectId: project.id }));
  app.use("/api", (req, res, next) => adminAuth(controlPlane.service, !["GET", "HEAD", "OPTIONS"].includes(req.method))(req, res, next));
  app.use("/api", apiRouter);
  app.use(controlPlaneErrorHandler);

  const clientDistCandidates = [
    process.env.BALLET_WEB_DIST ? path.resolve(process.env.BALLET_WEB_DIST) : undefined,
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist"),
    path.resolve(process.cwd(), "dist")
  ].filter((candidate): candidate is string => Boolean(candidate));
  const clientDist = clientDistCandidates.find((candidate) => existsSync(path.join(candidate, "index.html"))) ?? clientDistCandidates[0]!;
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    void next;
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  });

  const server = createServer(app);
  controlPlane.attachWebSocket(server);
  return { app, server, controlPlane, coordinator, project };
};

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'"'"'`)}'`;

const resolvePublicOrigin = (): string | undefined => {
  const configured = process.env.BALLET_PUBLIC_URL?.trim();
  if (!configured) return undefined;
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("BALLET_PUBLIC_URL must be an HTTP(S) origin without credentials, query, or fragment.");
  }
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname.toLowerCase())) {
    throw new Error("Remote BALLET_PUBLIC_URL values must use HTTPS.");
  }
  return url.origin;
};

const requestOrigin = (request: express.Request, publicOrigin?: string): string =>
  publicOrigin ?? `${request.protocol}://${request.get("host") ?? "127.0.0.1:4317"}`;
