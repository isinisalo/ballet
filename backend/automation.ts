import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type {
  Agent,
  AgentRunOutput,
  EventDefinition,
  Policy,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectEvent,
  ProjectPolicy,
  ProjectRuntime,
  ProjectWorkflow,
  RoutedEvent,
  Runtime
} from "./shared/domain.js";

const automationConfigPath = (root: string) => path.join(root, ".ballet", "project.json");
const timestamp = "1970-01-01T00:00:00.000Z";

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: 1,
  events: [],
  policies: [],
  workflows: [],
  runtimes: []
});

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

const cloneRecord = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) ? JSON.parse(JSON.stringify(value)) as Record<string, unknown> : undefined;

const normalizeEvent = (value: Record<string, unknown>): ProjectEvent => ({
  id: stringValue(value.id),
  title: stringValue(value.title),
  description: typeof value.description === "string" ? value.description : undefined,
  source: stringValue(value.source),
  payloadSchema: cloneRecord(value.payloadSchema)
});

const normalizePolicy = (value: Record<string, unknown>): ProjectPolicy => {
  const run = isRecord(value.run) ? value.run : {};
  return {
    id: stringValue(value.id),
    title: stringValue(value.title),
    on: stringValue(value.on),
    run: {
      agent: stringValue(run.agent),
      runtime: stringValue(run.runtime)
    },
    enabled: typeof value.enabled === "boolean" ? value.enabled : false
  };
};

const normalizeRuntime = (value: Record<string, unknown>): ProjectRuntime => {
  const outputEvents = isRecord(value.outputEvents)
    ? Object.fromEntries(
      Object.entries(value.outputEvents)
        .filter(([key, item]) => ["completed", "failed", "blocked", "cancelled"].includes(key) && typeof item === "string")
    )
    : {};

  return {
    id: stringValue(value.id),
    title: stringValue(value.title),
    command: stringValue(value.command),
    args: stringArray(value.args),
    outputEvents
  };
};

const normalizeWorkflow = (value: Record<string, unknown>): ProjectWorkflow => ({
  id: stringValue(value.id),
  title: stringValue(value.title),
  steps: stringArray(value.steps)
});

export const normalizeProjectAutomationConfig = (value: unknown): ProjectAutomationConfig => {
  if (!isRecord(value)) return defaultProjectAutomationConfig();

  return {
    version: 1,
    events: recordArray(value.events).map(normalizeEvent),
    policies: recordArray(value.policies).map(normalizePolicy),
    workflows: recordArray(value.workflows).map(normalizeWorkflow),
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

  for (const key of ["events", "policies", "workflows", "runtimes"] as const) {
    if (!Array.isArray(input[key])) {
      issues.push({ path: key, message: `${key} must be an array.` });
    }
  }

  const rawEvents = Array.isArray(input.events) ? input.events : [];
  const rawPolicies = Array.isArray(input.policies) ? input.policies : [];
  const rawWorkflows = Array.isArray(input.workflows) ? input.workflows : [];
  const rawRuntimes = Array.isArray(input.runtimes) ? input.runtimes : [];

  const eventIds = rawEvents.map((event, index) => ({
    id: isRecord(event) ? stringValue(event.id) : "",
    path: `events[${index}].id`
  }));
  const policyIds = rawPolicies.map((policy, index) => ({
    id: isRecord(policy) ? stringValue(policy.id) : "",
    path: `policies[${index}].id`
  }));
  const runtimeIds = rawRuntimes.map((runtime, index) => ({
    id: isRecord(runtime) ? stringValue(runtime.id) : "",
    path: `runtimes[${index}].id`
  }));
  const workflowIds = rawWorkflows.map((workflow, index) => ({
    id: isRecord(workflow) ? stringValue(workflow.id) : "",
    path: `workflows[${index}].id`
  }));

  addUniqueIssues(issues, eventIds, "event");
  addUniqueIssues(issues, policyIds, "policy");
  addUniqueIssues(issues, runtimeIds, "runtime");
  addUniqueIssues(issues, workflowIds, "workflow");

  const eventIdSet = new Set(eventIds.map((item) => item.id).filter(Boolean));
  const policyIdSet = new Set(policyIds.map((item) => item.id).filter(Boolean));
  const runtimeIdSet = new Set(runtimeIds.map((item) => item.id).filter(Boolean));
  const agentIdSet = new Set(agents.map((agent) => agent.id));

  rawEvents.forEach((event, index) => {
    const base = `events[${index}]`;
    if (!isRecord(event)) {
      issues.push({ path: base, message: "Event must be an object." });
      return;
    }
    addRequiredStringIssue(issues, `${base}.id`, event.id, "Event id");
    addRequiredStringIssue(issues, `${base}.title`, event.title, "Event title");
    addRequiredStringIssue(issues, `${base}.source`, event.source, "Event source");
    if (event.payloadSchema !== undefined && !isRecord(event.payloadSchema)) {
      issues.push({ path: `${base}.payloadSchema`, message: "Event payloadSchema must be a JSON object." });
    }
  });

  rawPolicies.forEach((policy, index) => {
    const base = `policies[${index}]`;
    if (!isRecord(policy)) {
      issues.push({ path: base, message: "Policy must be an object." });
      return;
    }
    addRequiredStringIssue(issues, `${base}.id`, policy.id, "Policy id");
    addRequiredStringIssue(issues, `${base}.title`, policy.title, "Policy title");
    addRequiredStringIssue(issues, `${base}.on`, policy.on, "Policy on event");
    if (typeof policy.enabled !== "boolean") {
      issues.push({ path: `${base}.enabled`, message: "Policy enabled must be boolean." });
    }
    if (typeof policy.on === "string" && policy.on && !eventIdSet.has(policy.on)) {
      issues.push({ path: `${base}.on`, message: `Policy references unknown event: ${policy.on}.` });
    }
    if (!isRecord(policy.run)) {
      issues.push({ path: `${base}.run`, message: "Policy run must be an object." });
      return;
    }
    addRequiredStringIssue(issues, `${base}.run.agent`, policy.run.agent, "Policy run.agent");
    addRequiredStringIssue(issues, `${base}.run.runtime`, policy.run.runtime, "Policy run.runtime");
    if (typeof policy.run.runtime === "string" && policy.run.runtime && !runtimeIdSet.has(policy.run.runtime)) {
      issues.push({ path: `${base}.run.runtime`, message: `Policy references unknown runtime: ${policy.run.runtime}.` });
    }
    if (agents.length > 0 && typeof policy.run.agent === "string" && policy.run.agent && !agentIdSet.has(policy.run.agent)) {
      issues.push({ path: `${base}.run.agent`, message: `Policy references unknown agent: ${policy.run.agent}.` });
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
    if (runtime.outputEvents !== undefined && !isRecord(runtime.outputEvents)) {
      issues.push({ path: `${base}.outputEvents`, message: "Runtime outputEvents must be an object." });
      return;
    }
    if (isRecord(runtime.outputEvents)) {
      for (const [status, eventId] of Object.entries(runtime.outputEvents)) {
        if (!["completed", "failed", "blocked", "cancelled"].includes(status)) {
          issues.push({ path: `${base}.outputEvents.${status}`, message: `Unsupported output event status: ${status}.` });
          continue;
        }
        if (typeof eventId !== "string" || !eventId.trim()) {
          issues.push({ path: `${base}.outputEvents.${status}`, message: "Runtime output event id must be a string." });
          continue;
        }
        if (!eventIdSet.has(eventId)) {
          issues.push({ path: `${base}.outputEvents.${status}`, message: `Runtime output event references unknown event: ${eventId}.` });
        }
      }
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
          for (const forbidden of ["on", "event", "agent", "runtime"]) {
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

export const automationEventsToEventDefinitions = (events: ProjectEvent[]): EventDefinition[] =>
  events.map((event) => ({
    id: event.id,
    name: event.title,
    description: event.description ?? "",
    active: true,
    eventType: event.id,
    source: event.source,
    tags: [],
    producers: [],
    payloadExample: {},
    createdAt: timestamp,
    updatedAt: timestamp
  }));

export const automationPoliciesToPolicies = (policies: ProjectPolicy[]): Policy[] =>
  policies.map((policy) => ({
    id: policy.id,
    name: policy.title,
    description: "",
    active: policy.enabled,
    match: {
      eventTypes: [policy.on],
      projectId: "*",
      source: "*"
    },
    action: {
      type: "start_agent_run",
      targetAgentId: policy.run.agent
    },
    projectId: "*",
    eventTypes: [policy.on],
    source: "*",
    payloadMetadata: {},
    targetAgentId: policy.run.agent,
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
      args: JSON.stringify(runtime.args),
      outputEvents: JSON.stringify(runtime.outputEvents)
    },
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

export function mapAgentOutputToEvent(
  runtime: ProjectRuntime,
  output: AgentRunOutput
): RoutedEvent {
  const eventId = runtime.outputEvents[output.status];
  if (!eventId) {
    throw new AutomationValidationError(`Runtime ${runtime.id} has no output event mapping for ${output.status}.`, [{
      path: `runtimes.${runtime.id}.outputEvents.${output.status}`,
      message: `Missing output event mapping for ${output.status}.`
    }]);
  }

  return {
    id: eventId,
    source: runtime.id,
    timestamp: new Date().toISOString(),
    payload: {
      ...(output.runId ? { runId: output.runId } : {}),
      ...(output.agentId ? { agentId: output.agentId } : {}),
      status: output.status,
      ...(output.summary ? { summary: output.summary } : {}),
      ...(output.outputRef ? { outputRef: output.outputRef } : {})
    }
  };
}
