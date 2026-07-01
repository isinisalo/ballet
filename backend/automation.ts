import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type {
  ProjectAction,
  Policy,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectPolicy,
  ProjectTrigger,
  ProjectWorkflow
} from "../shared/domain/automation.js";
import type { Agent } from "../shared/domain/agents.js";
import type { EventDefinition, RoutedEvent } from "../shared/domain/events.js";
import type { AgentRunOutput, ProjectRuntime, Runtime } from "../shared/domain/runtime.js";
import {
  agentTokenCandidates,
  generatedPolicyId,
  normalizePolicyOutputEventType,
  normalizePolicyToken,
  policyActionTokens,
  policyEventTypesForAgentsAndActions,
  policyOutputEventType,
  policySourceKey,
  resolvePolicyAgent
} from "../shared/policy-actions.js";
import { defaultProjectAutomationConfig } from "./automation/defaultConfig.js";

const automationConfigPath = (root: string) => path.join(root, ".ballet", "project.json");
const timestamp = "1970-01-01T00:00:00.000Z";

export { defaultProjectAutomationConfig };

export class AutomationValidationError extends Error {
  constructor(
    message: string,
    readonly issues: ProjectAutomationIssue[]
  ) {
    super(message);
    this.name = "AutomationValidationError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const recordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const normalizeAgentPolicyToken = (value: string): string =>
  normalizePolicyToken(value).replace(/-agent$/, "");

const normalizeTrigger = (value: Record<string, unknown>): ProjectTrigger => ({
  id: normalizePolicyToken(stringValue(value.id)),
  description: stringValue(value.description)
});

const normalizeAction = (value: Record<string, unknown>): ProjectAction => ({
  id: normalizePolicyToken(stringValue(value.id)),
  description: stringValue(value.description)
});

const inferLegacyPolicyAction = (value: Record<string, unknown>): string => {
  const haystack = [value.action, value.id, value.title, value.name]
    .map(stringValue)
    .join(" ")
    .toLowerCase();
  if (haystack.includes("implement")) return "implementation";
  if (haystack.includes("plan")) return "planning";
  if (haystack.includes("review")) return "review";
  return "run";
};

const normalizePolicy = (value: Record<string, unknown>): ProjectPolicy => {
  const run = isRecord(value.run) ? value.run : {};
  const event = normalizePolicyOutputEventType(stringValue(value.event) || stringValue(value.on));
  const trigger = normalizePolicyToken(stringValue(value.trigger));
  const source: ProjectPolicy["source"] = stringValue(value.source) === "trigger" || trigger ? "trigger" : "event";
  const agent = normalizeAgentPolicyToken(stringValue(value.agent) || stringValue(run.agent));
  const action = normalizePolicyToken(stringValue(value.action) || inferLegacyPolicyAction(value));
  const normalized = {
    id: "",
    source,
    event: source === "event" ? event : undefined,
    trigger: source === "trigger" ? trigger : undefined,
    agent,
    action,
    enabled: typeof value.enabled === "boolean" ? value.enabled : false
  };
  return {
    ...normalized,
    id: generatedPolicyId(normalized)
  };
};

const normalizeRuntime = (value: Record<string, unknown>): ProjectRuntime => ({
  id: stringValue(value.id),
  title: stringValue(value.title),
  command: stringValue(value.command),
  args: stringArray(value.args)
});

const normalizeWorkflow = (value: Record<string, unknown>, policyIdMap: Map<string, string>): ProjectWorkflow => ({
  id: stringValue(value.id),
  title: stringValue(value.title),
  steps: stringArray(value.steps).map((step) => policyIdMap.get(step) ?? step)
});

export const normalizeProjectAutomationConfig = (value: unknown): ProjectAutomationConfig => {
  if (!isRecord(value)) return defaultProjectAutomationConfig();
  const rawPolicies = recordArray(value.policies);
  const policyPairs = rawPolicies.map((policy) => ({
    rawId: stringValue(policy.id),
    normalized: normalizePolicy(policy)
  }));
  const policyIdMap = new Map(policyPairs
    .filter((pair) => pair.rawId && pair.rawId !== pair.normalized.id)
    .map((pair) => [pair.rawId, pair.normalized.id]));

  const policies = policyPairs.map((pair) => pair.normalized);
  const actions = Array.isArray(value.actions)
    ? recordArray(value.actions).map(normalizeAction)
    : policyActionTokens(policies).map((id) => ({ id, description: "" }));

  return {
    version: 1,
    triggers: recordArray(value.triggers).map(normalizeTrigger),
    actions,
    policies,
    workflows: recordArray(value.workflows).map((workflow) => normalizeWorkflow(workflow, policyIdMap)),
    runtimes: recordArray(value.runtimes).map(normalizeRuntime)
  };
};

const addRequiredStringIssue = (issues: ProjectAutomationIssue[], pathName: string, value: unknown, label: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path: pathName, message: `${label} is required.` });
  }
};

const addUniqueIssues = (issues: ProjectAutomationIssue[], ids: Array<{ id: string; path: string }>, label: string) => {
  const seen = new Map<string, string>();
  for (const item of ids) {
    if (!item.id) continue;
    const previousPath = seen.get(item.id);
    if (previousPath) {
      issues.push({ path: item.path, message: `Duplicate ${label} id: ${item.id}.` });
    } else {
      seen.set(item.id, item.path);
    }
  }
};

export const validateProjectAutomationConfig = (
  input: unknown,
  agents: Agent[] = []
): ProjectAutomationIssue[] => {
  const issues: ProjectAutomationIssue[] = [];
  if (!isRecord(input)) {
    return [{ path: "$", message: "Automation config must be a JSON object." }];
  }

  if (input.version !== 1) {
    issues.push({ path: "version", message: "version must be 1." });
  }

  for (const key of ["triggers", "actions", "policies", "workflows", "runtimes"] as const) {
    if ((key === "triggers" || key === "actions") && input[key] === undefined) continue;
    if (!Array.isArray(input[key])) {
      issues.push({ path: key, message: `${key} must be an array.` });
    }
  }

  const rawTriggers = Array.isArray(input.triggers) ? input.triggers : [];
  const rawActions = Array.isArray(input.actions) ? input.actions : [];
  const rawPolicies = Array.isArray(input.policies) ? input.policies : [];
  const rawWorkflows = Array.isArray(input.workflows) ? input.workflows : [];
  const rawRuntimes = Array.isArray(input.runtimes) ? input.runtimes : [];
  const normalized = normalizeProjectAutomationConfig(input);

  const policyIds = normalized.policies.map((policy, index) => ({
    id: policy.id,
    path: `policies[${index}].id`
  }));
  const rawPolicyIds = rawPolicies
    .map((policy) => isRecord(policy) ? stringValue(policy.id) : "")
    .filter(Boolean);
  const runtimeIds = rawRuntimes.map((runtime, index) => ({
    id: isRecord(runtime) ? stringValue(runtime.id) : "",
    path: `runtimes[${index}].id`
  }));
  const workflowIds = rawWorkflows.map((workflow, index) => ({
    id: isRecord(workflow) ? stringValue(workflow.id) : "",
    path: `workflows[${index}].id`
  }));

  addUniqueIssues(issues, policyIds, "policy");
  addUniqueIssues(issues, normalized.triggers.map((trigger, index) => ({ id: trigger.id, path: `triggers[${index}].id` })), "trigger");
  addUniqueIssues(issues, normalized.actions.map((action, index) => ({ id: action.id, path: `actions[${index}].id` })), "action");
  addUniqueIssues(issues, runtimeIds, "runtime");
  addUniqueIssues(issues, workflowIds, "workflow");

  const generatedEventIds = policyEventTypesForAgentsAndActions(agents, normalized.actions.map((action) => action.id));
  const eventIdSet = new Set(generatedEventIds);
  const triggerIdSet = new Set(normalized.triggers.map((trigger) => trigger.id));
  const actionIdSet = new Set(normalized.actions.map((action) => action.id));
  const policyIdSet = new Set([...policyIds.map((item) => item.id).filter(Boolean), ...rawPolicyIds]);
  const agentTokenSet = new Set(agents.flatMap(agentTokenCandidates));

  rawTriggers.forEach((trigger, index) => {
    const base = `triggers[${index}]`;
    if (!isRecord(trigger)) {
      issues.push({ path: base, message: "Trigger must be an object." });
      return;
    }
    addRequiredStringIssue(issues, `${base}.id`, trigger.id, "Trigger id");
    addRequiredStringIssue(issues, `${base}.description`, trigger.description, "Trigger description");
  });

  rawActions.forEach((action, index) => {
    const base = `actions[${index}]`;
    if (!isRecord(action)) {
      issues.push({ path: base, message: "Action must be an object." });
      return;
    }
    addRequiredStringIssue(issues, `${base}.id`, action.id, "Action id");
    if (action.description !== undefined && typeof action.description !== "string") {
      issues.push({ path: `${base}.description`, message: "Action description must be a string." });
    }
  });

  rawPolicies.forEach((policy, index) => {
    const base = `policies[${index}]`;
    if (!isRecord(policy)) {
      issues.push({ path: base, message: "Policy must be an object." });
      return;
    }
    const run = isRecord(policy.run) ? policy.run : undefined;
    const rawEvent = stringValue(policy.event) || stringValue(policy.on);
    const normalizedEvent = normalizePolicyOutputEventType(rawEvent);
    const rawTrigger = stringValue(policy.trigger);
    const rawSource = stringValue(policy.source);
    const rawAgent = stringValue(policy.agent) || stringValue(run?.agent);
    const rawAction = stringValue(policy.action);
    const legacyPolicy = policy.event === undefined && policy.agent === undefined && run !== undefined;
    const normalizedPolicy = normalized.policies[index];
    const isTriggerPolicy = normalizedPolicy?.source === "trigger";

    if (rawSource && !["event", "trigger"].includes(rawSource)) {
      issues.push({ path: `${base}.source`, message: "Policy source must be event or trigger." });
    }
    if (rawEvent && rawTrigger) {
      issues.push({ path: base, message: "Policy must reference either event or trigger, not both." });
    }
    if (isTriggerPolicy) {
      addRequiredStringIssue(issues, `${base}.trigger`, rawTrigger, "Policy trigger");
    } else {
      addRequiredStringIssue(issues, `${base}.event`, rawEvent, "Policy event");
    }
    addRequiredStringIssue(issues, `${base}.agent`, rawAgent, "Policy agent");
    if (!legacyPolicy) {
      addRequiredStringIssue(issues, `${base}.action`, rawAction, "Policy action");
    }
    if (normalizedPolicy?.action && !actionIdSet.has(normalizedPolicy.action)) {
      issues.push({ path: `${base}.action`, message: `Policy references unknown action: ${rawAction || normalizedPolicy.action}.` });
    }
    if (typeof policy.enabled !== "boolean") {
      issues.push({ path: `${base}.enabled`, message: "Policy enabled must be boolean." });
    }
    if (!isTriggerPolicy && normalizedEvent && !eventIdSet.has(normalizedEvent)) {
      issues.push({ path: `${base}.event`, message: `Policy references unknown event: ${rawEvent}.` });
    }
    if (isTriggerPolicy && normalizedPolicy?.trigger && !triggerIdSet.has(normalizedPolicy.trigger)) {
      issues.push({ path: `${base}.trigger`, message: `Policy references unknown trigger: ${rawTrigger}.` });
    }
    if (agents.length > 0 && rawAgent && normalizedPolicy && !agentTokenSet.has(normalizedPolicy.agent)) {
      issues.push({ path: `${base}.agent`, message: `Policy references unknown agent: ${rawAgent}.` });
    }
  });

  rawRuntimes.forEach((runtime, index) => {
    const base = `runtimes[${index}]`;
    if (!isRecord(runtime)) {
      issues.push({ path: base, message: "Runtime must be an object." });
      return;
    }
    addRequiredStringIssue(issues, `${base}.id`, runtime.id, "Runtime id");
    addRequiredStringIssue(issues, `${base}.title`, runtime.title, "Runtime title");
    addRequiredStringIssue(issues, `${base}.command`, runtime.command, "Runtime command");
    if (!Array.isArray(runtime.args) || runtime.args.some((item) => typeof item !== "string")) {
      issues.push({ path: `${base}.args`, message: "Runtime args must be a string array." });
    }
  });

  rawWorkflows.forEach((workflow, index) => {
    const base = `workflows[${index}]`;
    if (!isRecord(workflow)) {
      issues.push({ path: base, message: "Workflow must be an object." });
      return;
    }
    addRequiredStringIssue(issues, `${base}.id`, workflow.id, "Workflow id");
    addRequiredStringIssue(issues, `${base}.title`, workflow.title, "Workflow title");
    if (!Array.isArray(workflow.steps)) {
      issues.push({ path: `${base}.steps`, message: "Workflow steps must be an array." });
      return;
    }
    workflow.steps.forEach((step, stepIndex) => {
      const stepPath = `${base}.steps[${stepIndex}]`;
      if (typeof step !== "string") {
        issues.push({ path: stepPath, message: "Workflow step must be a policy id string." });
        if (isRecord(step)) {
          for (const forbidden of ["on", "event", "agent", "runtime", "action"]) {
            if (forbidden in step) {
              issues.push({ path: `${stepPath}.${forbidden}`, message: `Workflow step must not contain ${forbidden}.` });
            }
          }
        }
        return;
      }
      if (!step.trim()) {
        issues.push({ path: stepPath, message: "Workflow step policy id is required." });
        return;
      }
      if (!policyIdSet.has(step)) {
        issues.push({ path: stepPath, message: `Workflow references unknown policy: ${step}.` });
      }
    });
  });

  return issues;
};

const parseAutomationJson = async (root: string): Promise<{ exists: boolean; value: unknown }> => {
  try {
    const source = await readFile(automationConfigPath(root), "utf8");
    return { exists: true, value: JSON.parse(source) as unknown };
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { exists: false, value: defaultProjectAutomationConfig() };
    }
    throw error;
  }
};

export const loadProjectAutomationConfigWithIssues = async (
  root: string,
  agents: Agent[] = []
): Promise<{ config: ProjectAutomationConfig; issues: ProjectAutomationIssue[] }> => {
  const { exists, value } = await parseAutomationJson(root);
  if (!exists) return { config: defaultProjectAutomationConfig(), issues: [] };
  return {
    config: normalizeProjectAutomationConfig(value),
    issues: validateProjectAutomationConfig(value, agents)
  };
};

export const loadProjectAutomationConfig = async (
  root: string,
  agents: Agent[] = []
): Promise<ProjectAutomationConfig> => {
  const { config, issues } = await loadProjectAutomationConfigWithIssues(root, agents);
  if (issues.length > 0) {
    throw new AutomationValidationError("Automation config is invalid.", issues);
  }
  return config;
};

export const saveProjectAutomationConfig = async (
  root: string,
  config: ProjectAutomationConfig,
  agents: Agent[] = []
): Promise<ProjectAutomationConfig> => {
  const issues = validateProjectAutomationConfig(config, agents);
  if (issues.length > 0) {
    throw new AutomationValidationError("Automation config is invalid.", issues);
  }

  const normalized = normalizeProjectAutomationConfig(config);
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await writeFile(automationConfigPath(root), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
};

export const automationPoliciesToEventDefinitions = (
  policies: ProjectPolicy[] = [],
  agents: Agent[] = [],
  triggers: ProjectTrigger[] = [],
  actions: ProjectAction[] = []
): EventDefinition[] =>
  [...new Set([
    ...policyEventTypesForAgentsAndActions(agents, actions.length > 0 ? actions.map((action) => action.id) : policyActionTokens(policies)),
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

export function mapAgentOutputToEvent(
  policy: ProjectPolicy,
  output: AgentRunOutput
): RoutedEvent {
  return {
    id: policyOutputEventType(policy, output.status),
    source: "agentd",
    timestamp: new Date().toISOString(),
    payload: {
      agent: policy.agent,
      action: policy.action,
      status: output.status,
      ...(output.outcome ? { outcome: output.outcome } : {}),
      ...(output.summary ? { summary: output.summary } : {}),
      ...(output.runId ? { run_id: output.runId } : {}),
      ...(output.triggerEventId ? { trigger_event_id: output.triggerEventId } : {}),
      ...(output.policyId ? { policy_id: output.policyId } : {}),
      ...(output.policyVersion ? { policy_version: output.policyVersion } : {}),
      ...(output.payload ? { payload: output.payload } : {})
    }
  };
}
