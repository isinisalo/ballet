import { z } from "zod";
import { validateUniqueActionPriority, validateUniqueStateOrder } from "../gates.js";
import { CONTRACT_LIMITS } from "../limits.js";
import { PROJECT_CONFIG_VERSION } from "../versions.js";
import { idListSchema, idSchema, nonEmptyTextSchema } from "./common.js";
import { directionSchema } from "./directionSchemas.js";

export const governanceAgentDefinitionSchema = z.object({
  id: z.enum(["ballet-critic-agent", "ballet-refinement-agent"]),
  name: z.enum(["ballet-critic-agent", "ballet-refinement-agent"]),
  description: nonEmptyTextSchema,
  developerInstructions: nonEmptyTextSchema,
  model: z.enum(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex-spark"]),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh", "max", "ultra"]),
  sandboxMode: z.literal("read-only")
}).strict().superRefine((agent, context) => {
  if (agent.id !== agent.name) context.addIssue({ code: "custom", path: ["name"], message: "Agent name must match its fixed id" });
});

export const agentCompositionSchema = z.object({
  agentId: z.enum(["ballet-critic-agent", "ballet-refinement-agent"]),
  skillResources: idListSchema
}).strict();

export const actionRoleCompositionSchema = z.object({
  instructionResource: idSchema,
  skillResources: idListSchema
}).strict();

export const actionDefinitionSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  priority: z.number().int().safe().positive(),
  maxRetries: z.number().int().min(0).max(CONTRACT_LIMITS.maxRetries),
  validation: actionRoleCompositionSchema,
  work: actionRoleCompositionSchema,
  input: z.json().optional()
}).strict();

export const stateDefinitionSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  order: z.number().int().safe().positive(),
  actions: z.array(actionDefinitionSchema).min(1).max(CONTRACT_LIMITS.actionsPerState)
}).strict();

export const environmentDefinitionSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  states: z.array(stateDefinitionSchema).min(1).max(CONTRACT_LIMITS.states)
}).strict().superRefine((environment, context) => {
  const stateIds = new Set<string>(); const actionIds = new Set<string>();
  for (const [stateIndex, state] of environment.states.entries()) {
    if (stateIds.has(state.id)) context.addIssue({ code: "custom", path: ["states", stateIndex, "id"], message: "State IDs must be unique" });
    stateIds.add(state.id);
    for (const [actionIndex, action] of state.actions.entries()) {
      if (actionIds.has(action.id)) context.addIssue({ code: "custom", path: ["states", stateIndex, "actions", actionIndex, "id"], message: "Action IDs must be unique across the Environment" });
      actionIds.add(action.id);
    }
  }
});

const localTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const criticScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ id: idSchema, kind: z.literal("daily"), timeZone: nonEmptyTextSchema,
    localTimes: z.array(localTimeSchema).min(1).max(16) }).strict(),
  z.object({ id: idSchema, kind: z.literal("weekly"), timeZone: nonEmptyTextSchema,
    localTimes: z.array(localTimeSchema).min(1).max(16),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7) }).strict()
]).superRefine((schedule, context) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: schedule.timeZone }).format(); }
  catch { context.addIssue({ code: "custom", path: ["timeZone"], message: "Invalid IANA timezone" }); }
  if (new Set(schedule.localTimes).size !== schedule.localTimes.length) {
    context.addIssue({ code: "custom", path: ["localTimes"], message: "Local times must be unique" });
  }
  if (schedule.kind === "weekly" && new Set(schedule.weekdays).size !== schedule.weekdays.length) {
    context.addIssue({ code: "custom", path: ["weekdays"], message: "Weekdays must be unique" });
  }
});

const criticConfigurationSchema = z.object({
  version: z.literal(2),
  enabled: z.boolean(),
  schedules: z.array(criticScheduleSchema).max(16),
  agent: agentCompositionSchema
}).strict().superRefine((config, context) => {
  if (new Set(config.schedules.map(({ id }) => id)).size !== config.schedules.length) {
    context.addIssue({ code: "custom", path: ["schedules"], message: "Critic Schedule IDs must be unique" });
  }
});

const refinementConfigurationSchema = z.object({
  version: z.literal(2),
  enabled: z.boolean(),
  agent: agentCompositionSchema,
  allowedRoots: z.tuple([
    z.literal(".codex/agents"), z.literal(".ballet/instructions"), z.literal(".agents/skills")
  ])
}).strict();

export const projectConfigurationV24Schema = z.object({
  version: z.literal(PROJECT_CONFIG_VERSION),
  direction: directionSchema,
  environment: environmentDefinitionSchema,
  critic: criticConfigurationSchema,
  refinement: refinementConfigurationSchema
}).strict().superRefine((config, context) => {
  for (const issue of validateUniqueStateOrder(config.environment.states)) {
    context.addIssue({ code: "custom", path: issue.path.split("."), message: issue.message });
  }
  for (const [stateIndex, state] of config.environment.states.entries()) {
    for (const issue of validateUniqueActionPriority(state.actions)) {
      context.addIssue({ code: "custom", path: ["environment", "states", stateIndex, ...issue.path.split(".")], message: issue.message });
    }
  }
  if (config.critic.agent.agentId !== "ballet-critic-agent") context.addIssue({
    code: "custom", path: ["critic", "agent", "agentId"], message: "Critic must use ballet-critic-agent"
  });
  if (config.refinement.agent.agentId !== "ballet-refinement-agent") context.addIssue({
    code: "custom", path: ["refinement", "agent", "agentId"], message: "Refinement must use ballet-refinement-agent"
  });
});
