import type { Agent } from "../../shared/domain/agents.js";
import type {
  Policy,
  ProjectAction,
  ProjectPolicy,
  ProjectTrigger
} from "../../shared/domain/automation.js";
import type { EventDefinition } from "../../shared/domain/events.js";
import type { ProjectRuntime, Runtime } from "../../shared/domain/runtime.js";
import {
  defaultPolicyOutputIds,
  policyActionTokens,
  policyEventTypesForAgentsAndActions,
  policySourceKey,
  resolvePolicyAgent
} from "../../shared/policy-actions.js";

const timestamp = "1970-01-01T00:00:00.000Z";

export const automationPoliciesToEventDefinitions = (
  policies: ProjectPolicy[] = [],
  agents: Agent[] = [],
  triggers: ProjectTrigger[] = [],
  actions: ProjectAction[] = [],
  outputs: Array<{ id: string; type: "event" | "gate" }> = []
): EventDefinition[] =>
  [...new Set([
    ...policyEventTypesForAgentsAndActions(
      agents,
      actions.length > 0
        ? actions
        : policyActionTokens(policies).map((id) => ({ id, outputIds: [...defaultPolicyOutputIds] })),
      outputs
    ),
    ...triggers.map((trigger) => `trigger.${trigger.id}`)
  ])]
    .map((eventType) => ({
      id: eventType,
      name: eventType,
      description: "Generated agent action output event.",
      active: true,
      eventType,
      source: "agentd",
      tags: [],
      producers: [],
      payloadExample: {},
      createdAt: timestamp,
      updatedAt: timestamp
    }));

export const automationPoliciesToPolicies = (policies: ProjectPolicy[], agents: Agent[] = []): Policy[] =>
  policies.map((policy) => ({
    id: policy.id,
    name: policy.id,
    description: "",
    active: policy.enabled,
    match: {
      eventTypes: [policySourceKey(policy)],
      projectId: "*",
      source: "*"
    },
    action: {
      type: "start_agent_run",
      targetAgentId: resolvePolicyAgent(agents, policy.agent)?.id ?? policy.agent
    },
    projectId: "*",
    eventTypes: [policySourceKey(policy)],
    source: "*",
    payloadMetadata: {},
    targetAgentId: resolvePolicyAgent(agents, policy.agent)?.id ?? policy.agent,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

export const automationRuntimesToRuntimes = (runtimes: ProjectRuntime[]): Runtime[] =>
  runtimes.map((runtime) => ({
    id: runtime.id,
    name: runtime.title,
    type: runtime.command === "codex" ? "codex-cli" : "custom",
    command: [runtime.command, ...runtime.args].join(" ").trim(),
    config: {
      args: JSON.stringify(runtime.args)
    },
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
