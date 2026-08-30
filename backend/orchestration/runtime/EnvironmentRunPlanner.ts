import type { ProjectConfigurationV22 } from "../../../shared/orchestration/environment.js";
import { projectConfigurationV22Schema } from "../../../shared/orchestration/schemas/environmentSchemas.js";
import { canonicalJson, sha256 } from "../../../shared/orchestration/primitives.js";
import { useCaseApprovalHash } from "../../../shared/orchestration/direction.js";
import { validateRunnableEnvironment } from "../../../shared/orchestration/gates.js";
import type {
  RootSnapshotV16, RuntimeCapabilitySnapshot, RuntimePermissionSnapshot
} from "../../../shared/orchestration/runtime.js";
import type { CreateEnvironmentRunInput } from "../../../shared/orchestration/persistence.js";
import { mapProviderPermissions } from "./ProviderPermissions.js";
import { resolveOrchestrationResources, type ProjectResourceInput } from "./ResourceContextBuilder.js";
import { ConflictError } from "../persistence/PersistenceErrors.js";

export interface ProjectDefinition {
  config: ProjectConfigurationV22;
  configSha256: string;
  baseCommit: string;
  checkoutRoot: string;
  resources: ProjectResourceInput[];
  directionDocumentHashes: {
    goals: Record<string, string>;
    adrs: Record<string, string>;
    constraints: Record<string, string>;
  };
  agentDocumentHashes: Record<string, string>;
}

export interface ProjectDefinitionPort {
  load(): Promise<ProjectDefinition>;
}

export interface OrchestrationProviderPreflightPort {
  inspectAgent(
    profile: ProjectConfigurationV22["agents"][number],
    project: { headSha: string; configHash: string }
  ): Promise<RuntimeCapabilitySnapshot>;
  inspectActionRole(
    actionId: string, role: "validation" | "work",
    project: { headSha: string; configHash: string }
  ): Promise<RuntimeCapabilitySnapshot>;
}

export interface PlannedEnvironmentRun {
  snapshot: RootSnapshotV16;
  snapshotSha256: string;
  createInput(input: {
    environmentRunId: string; worktreePath: string; branch: string; createdAt: string; input?: string;
  }): CreateEnvironmentRunInput;
}

export class EnvironmentRunPlanner {
  constructor(
    private readonly projects: ProjectDefinitionPort,
    private readonly providers: OrchestrationProviderPreflightPort,
    private readonly now: () => string
  ) {}

  async plan(): Promise<PlannedEnvironmentRun> {
    const loaded = await this.projects.load();
    const config = projectConfigurationV22Schema.parse(loaded.config);
    const readinessIssues = validateRunnableEnvironment(config.environment, config.direction);
    if (readinessIssues.length > 0) {
      throw new ConflictError(`Environment is not runnable: ${readinessIssues.map(({ code, path }) => `${code}@${path}`).join(", ")}.`);
    }
    if (sha256(canonicalJson(config)) !== loaded.configSha256) throw new Error("Project Config hash differs from explicit input.");
    const resources = resolveOrchestrationResources(config, loaded.resources);
    const governanceAgentIds = new Set([config.critic.agent.agentId, config.refinement.agent.agentId]);
    const agents = config.agents.filter(({ id }) => governanceAgentIds.has(id))
      .sort((left, right) => left.id.localeCompare(right.id)).map((agent) => ({
      ...agent, contentSha256: requireDirectionHash("Agent", agent.id, loaded.agentDocumentHashes)
    }));
    const capabilities: RuntimeCapabilitySnapshot[] = [];
    for (const agent of agents) {
      const capability = await this.providers.inspectAgent(agent, { headSha: loaded.baseCommit, configHash: loaded.configSha256 });
      assertCapability({ kind: "agent", agentId: agent.id }, capability);
      capabilities.push(capability);
    }
    for (const state of config.environment.states) for (const action of state.actions) {
      for (const role of ["validation", "work"] as const) {
        const capability = await this.providers.inspectActionRole(action.id, role,
          { headSha: loaded.baseCommit, configHash: loaded.configSha256 });
        assertCapability({ kind: "action_role", actionId: action.id, role }, capability);
        capabilities.push(capability);
      }
    }
    const permissions = permissionSnapshot(config, capabilities, loaded.checkoutRoot);
    const referencedUseCaseIds = new Set(config.environment.states.flatMap((state) => state.useCaseIds));
    const approvedUseCases = config.direction.useCases.filter(({ id }) => referencedUseCaseIds.has(id)).map((useCase) => ({
      useCase, contentSha256: useCaseApprovalHash(useCase)
    })).sort((left, right) => left.useCase.id.localeCompare(right.useCase.id));
    const direction = {
      goals: config.direction.goals.map((value) => ({
        ...value, contentSha256: requireDirectionHash("Goal", value.id, loaded.directionDocumentHashes.goals)
      })),
      adrs: config.direction.adrs.map((value) => ({
        ...value, contentSha256: requireDirectionHash("ADR", value.id, loaded.directionDocumentHashes.adrs)
      })),
      constraints: config.direction.constraints.map((value) => ({
        ...value, contentSha256: requireDirectionHash("Constraint", value.id, loaded.directionDocumentHashes.constraints)
      }))
    };
    const snapshot: RootSnapshotV16 = {
      version: 16,
      projectHeadSha: loaded.baseCommit,
      projectConfigSha256: loaded.configSha256,
      directionSha256: contentHash(config.direction),
      environmentSha256: contentHash(config.environment),
      resourceSha256: contentHash(resources),
      environment: config.environment,
      approvedUseCases,
      direction,
      agents,
      runtimeCapabilities: capabilities,
      resources,
      permissions,
      governance: { critic: config.critic.agent, refinement: config.refinement.agent },
      createdAt: this.now()
    };
    const snapshotSha256 = contentHash(snapshot);
    return {
      snapshot, snapshotSha256,
      createInput: ({ environmentRunId, worktreePath, branch, createdAt, input }) => ({
        environmentRunId, environmentDefinitionId: config.environment.id, source: "manual",
        input,
        baseCommit: loaded.baseCommit, worktreePath, branch, executionSnapshot: snapshot,
        executionSnapshotHash: snapshotSha256, transitionLimit: transitionLimit(config),
        states: config.environment.states.map((state) => ({
          stateExecutionId: `${environmentRunId}:state:${state.id}`, definition: state, definitionHash: contentHash(state),
          actions: state.actions.map((action) => ({
            actionExecutionId: `${environmentRunId}:action:${action.id}`, definition: action, definitionHash: contentHash(action)
          }))
        })),
        createdAt
      })
    };
  }
}

const assertCapability = (
  subject: RuntimeCapabilitySnapshot["subject"], capability: RuntimeCapabilitySnapshot
): void => {
  if (canonicalJson(capability.subject) !== canonicalJson(subject)
    || !capability.supportedModels.includes(capability.model)
    || !capability.supportedReasoningEfforts.includes(capability.reasoningEffort)
    || !capability.supportsReadOnly) {
    throw new Error(`Execution binding ${canonicalJson(subject)} is not supported by provider preflight.`);
  }
  const expectedHash = contentHash({
    subject: capability.subject, provider: capability.provider, model: capability.model, reasoningEffort: capability.reasoningEffort,
    networkAccess: capability.networkAccess, readOnlyRoots: capability.readOnlyRoots,
    cliVersion: capability.cliVersion, supportedModels: capability.supportedModels,
    supportedReasoningEfforts: capability.supportedReasoningEfforts,
    supportsReadOnly: capability.supportsReadOnly, supportsWorkspaceWrite: capability.supportsWorkspaceWrite
  });
  if (capability.capabilitySha256 !== expectedHash) throw new Error(`Capability hash for ${canonicalJson(subject)} differs.`);
};

const permissionSnapshot = (
  config: ProjectConfigurationV22, capabilities: RuntimeCapabilitySnapshot[], worktreePath: string
): RuntimePermissionSnapshot[] => {
  const rows: RuntimePermissionSnapshot[] = [];
  for (const state of config.environment.states) for (const action of state.actions) {
    for (const role of ["validation", "work"] as const) {
      const capability = capabilities.find(({ subject }) => subject.kind === "action_role"
        && subject.actionId === action.id && subject.role === role)!;
      const toolPolicy = role === "work" ? "workspace_write" : "read_only";
      if (toolPolicy === "workspace_write" && !capability.supportsWorkspaceWrite) {
        throw new Error(`Action ${action.id} Work binding cannot provide workspace-write.`);
      }
      const mapped = mapProviderPermissions({
        provider: capability.provider, role, toolPolicy,
        networkAccess: capability.networkAccess, worktreePath
      });
      rows.push({ role, actionId: action.id, toolPolicy,
        networkAccess: mapped.networkAccess, approvalPolicy: mapped.approvalPolicy });
    }
  }
  for (const [role, composition] of [["critic", config.critic.agent], ["refinement", config.refinement.agent]] as const) {
    const capability = capabilities.find(({ subject }) => subject.kind === "agent" && subject.agentId === composition.agentId)!;
    const mapped = mapProviderPermissions({ provider: capability.provider, role,
      toolPolicy: "read_only", networkAccess: capability.networkAccess, worktreePath });
    rows.push({ role, toolPolicy: "read_only", networkAccess: mapped.networkAccess, approvalPolicy: "never" });
  }
  return rows;
};

const contentHash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value))));
const requireDirectionHash = (label: string, id: string, hashes: Record<string, string>): string => {
  const value = hashes[id];
  if (!value || !/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} ${id} has no source content hash.`);
  return value;
};
const transitionLimit = (config: ProjectConfigurationV22): number => 16 + config.environment.states.reduce(
  (total, state) => total + state.actions.reduce((count, action) => count + 4 + action.maxRetries * 3, 0), 0
);
