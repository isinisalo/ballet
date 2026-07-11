import type { Server } from "node:http";
import type { ExecutionAgentSnapshot, ExecutionTask, RootRunDisposition } from "../../shared/domain/runtime.js";
import type { AgentRun } from "../../shared/domain/runtime.js";
import { AdminAuthStore } from "./AdminAuthStore.js";
import { AgentExecutionStore } from "./AgentExecutionStore.js";
import { ControlPlaneDatabase } from "./ControlPlaneDatabase.js";
import { ControlPlaneService } from "./ControlPlaneService.js";
import { ControlPlaneMaintenance } from "./ControlPlaneMaintenance.js";
import { DaemonWebSocketHub } from "./DaemonWebSocketHub.js";
import { ExecutionEventStore } from "./ExecutionEventStore.js";
import { ExecutionTaskStore } from "./ExecutionTaskStore.js";
import { PairingStore } from "./PairingStore.js";
import { ProjectStore } from "./ProjectStore.js";
import { RuntimePreflightService } from "./RuntimePreflightService.js";
import { RuntimeRegistryStore } from "./RuntimeRegistryStore.js";
import { RootFinalizationStore } from "./RootFinalizationStore.js";
import { createControlPlaneRouter } from "./http/router.js";
import type { ControlPlaneRouterOptions } from "./http/types.js";

export interface CreateControlPlaneOptions extends Omit<ControlPlaneRouterOptions, "service"> {
  dbPath?: string;
  now?: () => Date;
  leaseSeconds?: number;
  project?: { id: string; repositoryUrl: string; checkoutPath: string };
  resolveAgentSnapshot?: (agentId: string) => Promise<ExecutionAgentSnapshot> | ExecutionAgentSnapshot;
  listAgentIds?: () => Promise<string[]> | string[];
  onTaskState?: (task: ExecutionTask) => Promise<void> | void;
  onTaskTerminal?: (task: ExecutionTask, run?: AgentRun) => Promise<RootRunDisposition | void> | RootRunDisposition | void;
  maintenance?: boolean;
  offlineAfterMs?: number;
  maintenanceIntervalMs?: number;
  freshCheckoutBeforeRun?: boolean;
  freshCheckoutTimeoutMs?: number;
}

export const createControlPlane = (options: CreateControlPlaneOptions = {}) => {
  const now = options.now ?? (() => new Date());
  const database = new ControlPlaneDatabase(options.dbPath);
  const connection = () => database.connection();
  const admin = new AdminAuthStore(connection, now);
  const pairing = new PairingStore(connection, now);
  const projects = new ProjectStore(connection, now);
  const registry = new RuntimeRegistryStore(connection, now);
  const agents = new AgentExecutionStore(connection, now);
  const tasks = new ExecutionTaskStore(connection, now);
  const events = new ExecutionEventStore(connection);
  const finalizations = new RootFinalizationStore(connection, now);
  const preflight = new RuntimePreflightService(projects, registry, agents);
  const service = new ControlPlaneService({
    database, admin, pairing, projects, registry, agents, tasks, events, finalizations, preflight, now,
    leaseSeconds: options.leaseSeconds, resolveAgentSnapshot: options.resolveAgentSnapshot,
    listAgentIds: options.listAgentIds, onTaskState: options.onTaskState, onTaskTerminal: options.onTaskTerminal,
    freshCheckoutBeforeRun: options.freshCheckoutBeforeRun,
    freshCheckoutTimeoutMs: options.freshCheckoutTimeoutMs
  });
  if (options.project) service.registerProject(options.project);
  const router = createControlPlaneRouter({
    service,
    secureCookies: options.secureCookies,
    resolveLoopSnapshot: options.resolveLoopSnapshot,
    installCommand: options.installCommand,
    verificationUri: options.verificationUri
  });
  const webSocket = new DaemonWebSocketHub({ service });
  const maintenance = new ControlPlaneMaintenance(service, now, options.offlineAfterMs, options.maintenanceIntervalMs);
  if (options.maintenance !== false) maintenance.start();
  return {
    database,
    service,
    router,
    webSocket,
    maintenance,
    attachWebSocket: (server: Server) => webSocket.attach(server),
    close: () => { maintenance.stop(); webSocket.close(); database.close(); }
  };
};
