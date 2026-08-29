import { z } from "zod";
import { validateRunnableEnvironment } from "../gates.js";
import { VNEXT_LIMITS } from "../limits.js";
import { VNEXT_PROJECT_CONFIG_VERSION } from "../versions.js";
import { idListSchema, idSchema, nonEmptyTextSchema } from "./common.js";
import { directionSchema } from "./directionSchemas.js";

export const executionProfileSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  provider: z.enum(["codex", "copilot"]),
  model: nonEmptyTextSchema,
  reasoningEffort: nonEmptyTextSchema,
  networkAccess: z.boolean()
}).strict();

export const agentCompositionSchema = z.object({
  executionProfileId: idSchema,
  instructionResource: idSchema,
  skillResources: idListSchema,
  toolPolicy: z.enum(["read_only", "workspace_write"])
}).strict();

export const actionDefinitionSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  priority: z.number().int().safe().nonnegative(),
  useCaseIds: idListSchema.min(1),
  maxRetries: z.number().int().min(0).max(VNEXT_LIMITS.maxRetries),
  validation: agentCompositionSchema,
  work: agentCompositionSchema,
  input: z.json().optional()
}).strict();

export const stateDefinitionSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  order: z.number().int().safe().nonnegative(),
  useCaseIds: idListSchema.min(1),
  actions: z.array(actionDefinitionSchema).min(1).max(VNEXT_LIMITS.actionsPerState)
}).strict();

export const environmentDefinitionSchema = z.object({
  id: idSchema,
  name: nonEmptyTextSchema,
  description: nonEmptyTextSchema,
  states: z.array(stateDefinitionSchema).min(1).max(VNEXT_LIMITS.states)
}).strict();

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
  version: z.literal(1),
  enabled: z.boolean(),
  schedules: z.array(criticScheduleSchema).max(16),
  agent: agentCompositionSchema
}).strict().superRefine((config, context) => {
  if (new Set(config.schedules.map(({ id }) => id)).size !== config.schedules.length) {
    context.addIssue({ code: "custom", path: ["schedules"], message: "Critic Schedule IDs must be unique" });
  }
});

const refinementConfigurationSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  agent: agentCompositionSchema,
  allowedRoots: z.tuple([z.literal(".ballet/instructions"), z.literal(".agents/skills")])
}).strict();

export const projectConfigurationV20Schema = z.object({
  version: z.literal(VNEXT_PROJECT_CONFIG_VERSION),
  direction: directionSchema,
  executionProfiles: z.array(executionProfileSchema).max(VNEXT_LIMITS.executionProfiles),
  environment: environmentDefinitionSchema,
  critic: criticConfigurationSchema,
  refinement: refinementConfigurationSchema
}).strict().superRefine((config, context) => {
  for (const issue of validateRunnableEnvironment(config.environment, config.direction)) {
    context.addIssue({ code: "custom", path: issue.path.split("."), message: issue.message });
  }
  const profileIds = new Set(config.executionProfiles.map(({ id }) => id));
  if (profileIds.size !== config.executionProfiles.length) {
    context.addIssue({ code: "custom", path: ["executionProfiles"], message: "Execution Profile IDs must be unique" });
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
    if (!profileIds.has(agent.executionProfileId)) {
      context.addIssue({ code: "custom", path: [...path.split("."), "executionProfileId"], message: "Unknown Execution Profile" });
    }
  }
  if (config.critic.agent.toolPolicy !== "read_only") {
    context.addIssue({ code: "custom", path: ["critic", "agent", "toolPolicy"], message: "Critic must be read-only" });
  }
  if (config.refinement.agent.toolPolicy !== "read_only") {
    context.addIssue({ code: "custom", path: ["refinement", "agent", "toolPolicy"], message: "Refinement proposal must be read-only" });
  }
});
