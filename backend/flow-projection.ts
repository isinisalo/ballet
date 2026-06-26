import type { AppData, EventDefinition } from "./shared/domain.js";
import type { AgentOperation } from "./shared/operations.js";
import type { EmissionPolicy } from "./shared/emission-policy.js";
import type { LoopDefinition } from "./shared/loop.js";
import type { RoutingPolicy } from "./shared/routing-policy.js";
import type { VersionedRef } from "./shared/json.js";

export type FlowHealth = "ready" | "warning" | "invalid";
export type FlowDiagnosticSeverity = "error" | "warning" | "info";

export interface FlowDiagnostic {
  severity: FlowDiagnosticSeverity;
  title: string;
  explanation: string;
  affectedResource: {
    type: "loop" | "event" | "routing-policy" | "operation" | "agent" | "emission-policy" | "contract";
    id: string;
    version?: number;
  };
  suggestedFix?: string;
}

export interface FlowEventNode {
  kind: "event";
  id: string;
  eventType: string;
  name: string;
  description: string;
  dataContract?: VersionedRef;
  active: boolean;
}

export interface FlowOperationNode {
  kind: "operation";
  id: string;
  operationId: string;
  version: number;
  name: string;
  description: string;
  agentId: string;
  agentName?: string;
  inputContract: VersionedRef;
  outputContract: VersionedRef;
  active: boolean;
}

export interface FlowRoutingEdge {
  kind: "routing";
  id: string;
  from: string;
  to: string;
  policyId: string;
  policyName: string;
  active: boolean;
}

export interface FlowEmissionEdge {
  kind: "emission";
  id: string;
  from: string;
  to: string;
  policyId: string;
  policyVersion: number;
  slot: string;
  policyName: string;
  active: boolean;
}

export interface FlowViewModel {
  id: string;
  version: number;
  name: string;
  description: string;
  active: boolean;
  entryEvents: FlowEventNode[];
  terminalEvents: FlowEventNode[];
  nodes: Array<FlowEventNode | FlowOperationNode>;
  edges: Array<FlowRoutingEdge | FlowEmissionEdge>;
  safetyLimits: {
    maxHops: number;
    maxRuns: number;
    maxIterationsPerStep: number;
    deadlineSeconds?: number;
  };
  diagnostics: FlowDiagnostic[];
  health: FlowHealth;
}

const refKey = (ref: VersionedRef): string => `${ref.id}@${ref.version}`;
const eventNodeId = (eventType: string): string => `event:${eventType}`;
const operationNodeId = (ref: VersionedRef): string => `operation:${refKey(ref)}`;

const healthFromDiagnostics = (diagnostics: FlowDiagnostic[]): FlowHealth => {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) return "invalid";
  if (diagnostics.some((diagnostic) => diagnostic.severity === "warning")) return "warning";
  return "ready";
};

const activePreferredEventsByType = (events: EventDefinition[]): Map<string, EventDefinition> => {
  const eventsByType = new Map<string, EventDefinition>();
  for (const event of events) {
    const existing = eventsByType.get(event.eventType);
    if (!existing || (!existing.active && event.active)) {
      eventsByType.set(event.eventType, event);
    }
  }
  return eventsByType;
};

const defaultLimits = {
  maxHops: 20,
  maxRuns: 50,
  maxIterationsPerStep: 5
};

interface ProjectionScope {
  flowId: string;
  flowVersion: number;
  name: string;
  description: string;
  active: boolean;
  entryEventTypes: string[];
  terminalEventTypes: string[];
  routingPolicies: RoutingPolicy[];
  emissionPolicies: EmissionPolicy[];
  limits: FlowViewModel["safetyLimits"];
  loop?: LoopDefinition;
}

class FlowProjectionBuilder {
  private readonly eventByType: Map<string, EventDefinition>;
  private readonly operationByKey: Map<string, AgentOperation>;
  private readonly agentById: Map<string, AppData["agents"][number]>;
  private readonly contractByKey: Set<string>;
  private readonly routingByEvent = new Map<string, RoutingPolicy[]>();
  private readonly emissionsByOperation = new Map<string, EmissionPolicy[]>();
  private readonly nodes = new Map<string, FlowEventNode | FlowOperationNode>();
  private readonly edges = new Map<string, FlowRoutingEdge | FlowEmissionEdge>();
  private readonly diagnostics: FlowDiagnostic[] = [];

  constructor(private readonly data: AppData, private readonly scope: ProjectionScope) {
    this.eventByType = activePreferredEventsByType(data.eventDefinitions);
    this.operationByKey = new Map(data.operations.map((operation) => [refKey(operation), operation]));
    this.agentById = new Map(data.agents.map((agent) => [agent.id, agent]));
    this.contractByKey = new Set(data.contracts.filter((contract) => contract.active).map((contract) => refKey(contract)));
    for (const policy of scope.routingPolicies) {
      const existing = this.routingByEvent.get(policy.consumes.eventType) ?? [];
      existing.push(policy);
      this.routingByEvent.set(policy.consumes.eventType, existing);
    }
    for (const policy of scope.emissionPolicies) {
      const key = refKey(policy.observes.operation);
      const existing = this.emissionsByOperation.get(key) ?? [];
      existing.push(policy);
      this.emissionsByOperation.set(key, existing);
    }
  }

  build(): FlowViewModel {
    this.addLoopMembershipDiagnostics();
    for (const eventType of [...this.scope.entryEventTypes, ...this.scope.terminalEventTypes]) {
      this.addEvent(eventType);
    }
    for (const eventType of this.scope.entryEventTypes) {
      this.walkEvent(eventType, new Set());
    }
    for (const policy of this.scope.routingPolicies) {
      this.walkEvent(policy.consumes.eventType, new Set());
    }
    for (const policy of this.scope.emissionPolicies) {
      const operation = this.operationByKey.get(refKey(policy.observes.operation));
      if (!operation) {
        this.addDiagnostic("error", "Missing observed operation", `Emission rule "${policy.name}" observes operation ${refKey(policy.observes.operation)}, but that operation is not available.`, "emission-policy", policy.id, policy.version, "Select an active operation for the emission rule.");
      } else {
        this.addOperation(operation);
      }
    }

    const entryEvents = this.scope.entryEventTypes.map((eventType) => this.nodes.get(eventNodeId(eventType))).filter((node): node is FlowEventNode => Boolean(node && node.kind === "event"));
    const terminalEvents = this.scope.terminalEventTypes.map((eventType) => this.nodes.get(eventNodeId(eventType))).filter((node): node is FlowEventNode => Boolean(node && node.kind === "event"));
    const diagnostics = this.diagnostics;
    return {
      id: this.scope.flowId,
      version: this.scope.flowVersion,
      name: this.scope.name,
      description: this.scope.description,
      active: this.scope.active,
      entryEvents,
      terminalEvents,
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      safetyLimits: this.scope.limits,
      diagnostics,
      health: healthFromDiagnostics(diagnostics)
    };
  }

  private walkEvent(eventType: string, visited: Set<string>): void {
    const key = eventNodeId(eventType);
    this.addEvent(eventType);
    if (visited.has(key)) return;
    const nextVisited = new Set(visited).add(key);
    for (const policy of this.routingByEvent.get(eventType) ?? []) {
      const operation = this.operationByKey.get(refKey(policy.dispatch.operation));
      if (!operation) {
        this.addDiagnostic("error", "Missing agent task", `Routing rule "${policy.name}" points to ${refKey(policy.dispatch.operation)}, but that task is not available.`, "routing-policy", policy.id, undefined, "Select an existing task or create the missing task.");
        continue;
      }
      this.addOperation(operation);
      const edgeId = `routing:${policy.id}:${eventType}:${refKey(policy.dispatch.operation)}`;
      this.edges.set(edgeId, {
        kind: "routing",
        id: edgeId,
        from: key,
        to: operationNodeId(policy.dispatch.operation),
        policyId: policy.id,
        policyName: policy.name,
        active: policy.active
      });
      this.walkOperation(operation, nextVisited);
    }
  }

  private walkOperation(operation: AgentOperation, visited: Set<string>): void {
    const key = operationNodeId(operation);
    if (visited.has(key)) return;
    const nextVisited = new Set(visited).add(key);
    for (const policy of this.emissionsByOperation.get(refKey(operation)) ?? []) {
      for (const emission of policy.emissions) {
        this.addEvent(emission.eventType);
        const edgeId = `emission:${policy.id}:${policy.version}:${emission.slot}`;
        this.edges.set(edgeId, {
          kind: "emission",
          id: edgeId,
          from: key,
          to: eventNodeId(emission.eventType),
          policyId: policy.id,
          policyVersion: policy.version,
          slot: emission.slot,
          policyName: policy.name,
          active: policy.active
        });
        this.walkEvent(emission.eventType, nextVisited);
      }
    }
  }

  private addEvent(eventType: string): void {
    const nodeId = eventNodeId(eventType);
    if (this.nodes.has(nodeId)) return;
    const event = this.eventByType.get(eventType);
    if (!event) {
      this.nodes.set(nodeId, {
        kind: "event",
        id: nodeId,
        eventType,
        name: eventType,
        description: "Missing event definition.",
        active: false
      });
      this.addDiagnostic("error", "Missing trigger or result", `Event "${eventType}" is referenced by this Flow but has no event definition.`, "event", eventType, undefined, "Create an event definition for this event.");
      return;
    }
    if (!event.active) {
      this.addDiagnostic("error", "Inactive event", `Event "${event.name || event.eventType}" is referenced by this Flow but is inactive.`, "event", event.id, undefined, "Activate the event or remove it from the Flow.");
    }
    if (event.dataContract && !this.contractByKey.has(refKey(event.dataContract))) {
      this.addDiagnostic("error", "Missing data shape", `Event "${event.name}" uses data shape ${refKey(event.dataContract)}, but that contract is not available.`, "event", event.id, undefined, "Select an existing data shape or create the missing contract.");
    }
    this.nodes.set(nodeId, {
      kind: "event",
      id: nodeId,
      eventType,
      name: event.name || eventType,
      description: event.description,
      dataContract: event.dataContract,
      active: event.active
    });
  }

  private addOperation(operation: AgentOperation): void {
    const nodeId = operationNodeId(operation);
    if (this.nodes.has(nodeId)) return;
    const agent = this.agentById.get(operation.agentId);
    if (!operation.active) {
      this.addDiagnostic("error", "Inactive task", `Task "${operation.name}" is referenced by this Flow but is inactive.`, "operation", operation.id, operation.version, "Activate the task or remove the routing or emission rule that references it.");
    }
    if (!agent) {
      this.addDiagnostic("error", "Missing agent", `Task "${operation.name}" uses agent ${operation.agentId}, but that agent is not configured.`, "operation", operation.id, operation.version, "Choose an existing agent for the task.");
    } else if (operation.active && !agent.enabled) {
      this.addDiagnostic("error", "Disabled agent", `Task "${operation.name}" uses disabled agent ${agent.name}.`, "operation", operation.id, operation.version, "Enable the agent or pause this task before activating the Flow.");
    }
    if (!this.contractByKey.has(refKey(operation.inputContract))) {
      this.addDiagnostic("error", "Missing task input shape", `Task "${operation.name}" uses input ${refKey(operation.inputContract)}, but that contract is not available.`, "operation", operation.id, operation.version, "Select or create the task input data shape.");
    }
    if (!this.contractByKey.has(refKey(operation.outputContract))) {
      this.addDiagnostic("error", "Missing task result shape", `Task "${operation.name}" uses output ${refKey(operation.outputContract)}, but that contract is not available.`, "operation", operation.id, operation.version, "Select or create the task result data shape.");
    }
    this.nodes.set(nodeId, {
      kind: "operation",
      id: nodeId,
      operationId: operation.id,
      version: operation.version,
      name: operation.name,
      description: operation.description,
      agentId: operation.agentId,
      agentName: agent?.name,
      inputContract: operation.inputContract,
      outputContract: operation.outputContract,
      active: operation.active
    });
  }

  private addDiagnostic(
    severity: FlowDiagnosticSeverity,
    title: string,
    explanation: string,
    type: FlowDiagnostic["affectedResource"]["type"],
    id: string,
    version?: number,
    suggestedFix?: string
  ): void {
    this.diagnostics.push({
      severity,
      title,
      explanation,
      affectedResource: { type, id, version },
      suggestedFix
    });
  }

  private addLoopMembershipDiagnostics(): void {
    const loop = this.scope.loop;
    if (!loop) return;

    for (const policyId of loop.routingPolicyIds) {
      const policy = this.data.policies.find((candidate) => candidate.id === policyId);
      if (!policy) {
        this.addDiagnostic("error", "Missing routing rule", `${loop.name} includes missing routing rule ${policyId}.`, "loop", loop.id, loop.version, "Add the routing rule to this Flow or remove it from the Flow settings.");
      } else if (loop.active && !policy.active) {
        this.addDiagnostic("error", "Inactive routing rule", `${loop.name} is active but includes inactive routing rule ${policy.name}.`, "loop", loop.id, loop.version, "Activate the Flow so included routing rules are activated together.");
      }
    }

    for (const policyId of loop.emissionPolicyIds) {
      const matchingPolicies = this.data.emissionPolicies.filter((candidate) => candidate.id === policyId);
      const activePolicies = matchingPolicies.filter((candidate) => candidate.active);
      const policy = matchingPolicies[0];
      if (!policy) {
        this.addDiagnostic("error", "Missing emission rule", `${loop.name} includes missing emission rule ${policyId}.`, "loop", loop.id, loop.version, "Add the emission rule to this Flow or remove it from the Flow settings.");
      } else if (loop.active && activePolicies.length > 1) {
        this.addDiagnostic("error", "Ambiguous emission rule version", `${loop.name} includes ${policyId}, but multiple active versions exist. Pause old versions or create a Flow membership that selects one version.`, "loop", loop.id, loop.version, "Keep only one active version of the emission rule for this Flow.");
      } else if (loop.active && activePolicies.length === 0) {
        this.addDiagnostic("error", "Inactive emission rule", `${loop.name} is active but includes inactive emission rule ${policy.name}.`, "loop", loop.id, loop.version, "Activate the Flow so included emission rules are activated together.");
      }
    }
  }
}

const eventTypesFromPolicies = (policies: RoutingPolicy[]): string[] =>
  [...new Set(policies.map((policy) => policy.consumes.eventType).filter(Boolean))];

const scopedEmissionPolicies = (loop: LoopDefinition, data: AppData): EmissionPolicy[] =>
  loop.emissionPolicyIds.flatMap((policyId) => {
    const matchingPolicies = data.emissionPolicies.filter((policy) => policy.id === policyId);
    const activePolicies = matchingPolicies.filter((policy) => policy.active);
    return activePolicies.length === 1 ? activePolicies : matchingPolicies;
  });

const deriveScope = (loop: LoopDefinition, data: AppData): ProjectionScope => ({
  flowId: loop.id,
  flowVersion: loop.version,
  name: loop.name,
  description: loop.description,
  active: loop.active,
  entryEventTypes: loop.entryEventTypes,
  terminalEventTypes: loop.terminalEventTypes,
  routingPolicies: data.policies.filter((policy) => loop.routingPolicyIds.includes(policy.id)),
  emissionPolicies: scopedEmissionPolicies(loop, data),
  limits: loop.limits,
  loop
});

export const projectFlow = (loop: LoopDefinition, data: AppData): FlowViewModel =>
  new FlowProjectionBuilder(data, deriveScope(loop, data)).build();

export const projectFlows = (data: AppData): FlowViewModel[] => {
  const loopFlows = data.loopDefinitions.map((loop) => projectFlow(loop, data));
  const groupedRouting = new Set(data.loopDefinitions.flatMap((loop) => loop.routingPolicyIds));
  const groupedEmission = new Set(data.loopDefinitions.flatMap((loop) => loop.emissionPolicyIds));
  const ungroupedRouting = data.policies.filter((policy) => !groupedRouting.has(policy.id));
  const ungroupedEmission = data.emissionPolicies.filter((policy) => !groupedEmission.has(policy.id));
  if (ungroupedRouting.length === 0 && ungroupedEmission.length === 0) return loopFlows;

  const ungroupedScope: ProjectionScope = {
    flowId: "__ungrouped__",
    flowVersion: 1,
    name: "Ungrouped flow components",
    description: "Routing and emission rules that are not included in any Flow safety boundary.",
    active: false,
    entryEventTypes: eventTypesFromPolicies(ungroupedRouting),
    terminalEventTypes: [],
    routingPolicies: ungroupedRouting,
    emissionPolicies: ungroupedEmission,
    limits: defaultLimits
  };
  return [...loopFlows, new FlowProjectionBuilder(data, ungroupedScope).build()];
};

export const eventSummary = (event?: EventDefinition): string =>
  event ? event.name || event.eventType : "Missing event definition";
