import { z } from "zod";
import { validateUniqueActionPriority, validateUniqueStateOrder } from "../gates.js";
import { CONTRACT_LIMITS } from "../limits.js";
import { PROJECT_CONFIG_VERSION } from "../versions.js";
import { idListSchema, idSchema, nonEmptyTextSchema } from "./common.js";
import { directionSchema } from "./directionSchemas.js";

export const agentDefinitionSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  description: z.string().max(CONTRACT_LIMITS.text),
  enabled: z.boolean(),
  instructionResource: idSchema,
  skillResources: idListSchema
}).strict();

export const agentCompositionSchema = z.object({
  agentId: idSchema,
  instructionResource: idSchema,
  skillResources: idListSchema
}).strict();

export const actionDefinitionSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  priority: z.number().int().safe().positive(),
  useCaseIds: idListSchema.min(1),
  maxRetries: z.number().int().min(0).max(CONTRACT_LIMITS.maxRetries),
  validation: agentCompositionSchema,
  work: agentCompositionSchema,
  input: z.json().optional()
}).strict();

export const stateDefinitionSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  order: z.number().int().safe().positive(),
  useCaseIds: idListSchema.min(1),
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
    z.literal(".ballet/agents"), z.literal(".ballet/instructions"), z.literal(".agents/skills")
  ])
}).strict();

export const projectConfigurationV21Schema = z.object({
  version: z.literal(PROJECT_CONFIG_VERSION),
  direction: directionSchema,
  agents: z.array(agentDefinitionSchema).max(CONTRACT_LIMITS.agents),
  environment: environmentDefinitionSchema,
  critic: criticConfigurationSchema,
  refinement: refinementConfigurationSchema
}).strict().superRefine((config, context) => {
  for (const issue of validateUniqueStateOrder(config.environment.states)) {
    context.addIssue({ code: "custom", path: issue.path.split("."), message: issue.message });
  }
  const useCaseIds = new Set(config.direction.useCases.map(({ id }) => id));
  for (const [stateIndex, state] of config.environment.states.entries()) {
    for (const issue of validateUniqueActionPriority(state.actions)) {
      context.addIssue({ code: "custom", path: ["environment", "states", stateIndex, ...issue.path.split(".")], message: issue.message });
    }
    for (const id of state.useCaseIds) if (!useCaseIds.has(id)) {
      context.addIssue({ code: "custom", path: ["environment", "states", stateIndex, "useCaseIds"], message: `Unknown Use Case ${id}` });
    }
    for (const [actionIndex, action] of state.actions.entries()) for (const id of action.useCaseIds) {
      if (!useCaseIds.has(id)) context.addIssue({ code: "custom", path: ["environment", "states", stateIndex, "actions", actionIndex, "useCaseIds"], message: `Unknown Use Case ${id}` });
    }
  }
  const agentIds = new Set(config.agents.map(({ id }) => id));
  if (agentIds.size !== config.agents.length) {
    context.addIssue({ code: "custom", path: ["agents"], message: "Agent IDs must be unique" });
  }
  const agents: Array<{ path: string; agent: z.infer<typeof agentCompositionSchema> }> = [
    { path: "critic.agent", agent: config.critic.agent },
    { path: "refinement.agent", agent: config.refinement.agent },
    ...config.environment.states.flatMap((state, stateIndex) => state.actions.flatMap((action, actionIndex) => [
      { path: `environment.states.${stateIndex}.actions.${actionIndex}.validation`, agent: action.validation },
      { path: `environment.states.${stateIndex}.actions.${actionIndex}.work`, agent: action.work }
    ]))
  ];
  for (const { path, agent } of agents) {
    if (!agentIds.has(agent.agentId)) {
      context.addIssue({ code: "custom", path: [...path.split("."), "agentId"], message: "Unknown Agent" });
    }
  }
  for (const [index, agent] of config.agents.entries()) {
    if (!agent.enabled && agents.some(({ agent: composition }) => composition.agentId === agent.id)) {
      context.addIssue({ code: "custom", path: ["agents", index, "enabled"], message: "Referenced Agent must be enabled" });
    }
  }
});
