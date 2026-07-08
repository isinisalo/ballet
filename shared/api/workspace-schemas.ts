import { z } from "zod";
import type { ProjectAutomationConfig } from "../domain/automation.js";
import { automationFieldLimits } from "./automationValidation.js";

export const mutableCollections = ["projects", "goals", "adrs", "agents", "skills"] as const;
export const readableCollections = [...mutableCollections, "runtimes", "policies", "events"] as const;

const stringRecordSchema = z.record(z.string(), z.string());
const unknownRecordSchema = z.record(z.string(), z.unknown());

const markdownBackedFields = {
  frontmatter: unknownRecordSchema.optional(),
  body: z.string().optional(),
  relativePath: z.string().optional(),
  slug: z.string().optional(),
  errors: z.array(z.string()).optional()
};

const skillSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: stringRecordSchema.optional(),
  enabled: z.boolean().optional(),
  ...markdownBackedFields
}).strict();

export const projectDocumentSaveSchema = z.object({
  relativePath: z.string().min(1),
  frontmatter: unknownRecordSchema,
  body: z.string()
}).strict();

export const projectDocumentCreateSchema = z.object({
  directoryPath: z.string().min(1),
  title: z.string().min(1)
}).strict();

export const collectionParamsSchema = z.object({
  collection: z.string().min(1)
}).strict();

export const mutableCollectionParamsSchema = z.object({
  collection: z.string().min(1)
}).strict();

export const collectionItemParamsSchema = z.object({
  collection: z.string().min(1),
  id: z.string().min(1)
}).strict();

const projectUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  ...markdownBackedFields
}).strict();

const goalUpsertSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["not-started", "in-progress", "at-risk", "done"]).optional(),
  targetDate: z.string().optional(),
  owner: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  ...markdownBackedFields
}).strict();

const adrUpsertSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().optional(),
  title: z.string().optional(),
  context: z.string().optional(),
  decision: z.string().optional(),
  consequences: z.string().optional(),
  status: z.enum(["proposed", "accepted", "superseded", "rejected"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  ...markdownBackedFields
}).strict();

const agentUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  skills: z.array(skillSchema).optional(),
  enabled: z.boolean().optional(),
  status: z.enum(["online", "offline"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  model: z.string().optional(),
  modelReasoningEffort: z.string().optional(),
  nicknameCandidates: z.array(z.string()).optional(),
  ...markdownBackedFields
}).strict();

const collectionUpsertSchemas = {
  projects: projectUpsertSchema,
  goals: goalUpsertSchema,
  adrs: adrUpsertSchema,
  agents: agentUpsertSchema,
  skills: skillSchema
} as const;

export type MutableCollectionName = keyof typeof collectionUpsertSchemas;
export type CollectionUpsertPayload = Record<string, unknown> & { id?: string };

export const collectionUpsertSchema = (collection: MutableCollectionName): z.ZodType<CollectionUpsertPayload> =>
  collectionUpsertSchemas[collection] as z.ZodType<CollectionUpsertPayload>;

const automationTokenSchema = z.string().min(automationFieldLimits.token.min).max(automationFieldLimits.token.max);
const automationNameSchema = z.string().min(automationFieldLimits.name.min).max(automationFieldLimits.name.max);
const optionalAutomationDescriptionSchema = z.string().max(automationFieldLimits.description.max);
const automationOutputIdSchema = z.string().min(automationFieldLimits.outputId.min).max(automationFieldLimits.outputId.max);
const automationLoopIdSchema = z.string().min(automationFieldLimits.loopId.min).max(automationFieldLimits.loopId.max);
const automationPolicyIdSchema = z.string().min(automationFieldLimits.policyId.min).max(automationFieldLimits.policyId.max);
const automationHumanGateResponseIdSchema = z.string().min(1).max(260);
const automationHumanGatePromptSchema = z.string().min(1).max(2000);
const automationCommandSchema = z.string().min(automationFieldLimits.command.min).max(automationFieldLimits.command.max);
const automationArgSchema = z.string().min(automationFieldLimits.arg.min).max(automationFieldLimits.arg.max);

const projectActionSchema = z.object({
  id: automationPolicyIdSchema,
  description: optionalAutomationDescriptionSchema,
  outputIds: z.array(automationOutputIdSchema),
  agentIds: z.array(z.string().min(1)),
  humanGate: z.boolean().optional()
}).strict();

const projectOutputSchema = z.object({
  id: automationOutputIdSchema
}).strict();

const projectOutputRouteSchema = z.object({
  sourceLoopId: automationLoopIdSchema,
  sourceActionId: automationPolicyIdSchema,
  outputId: automationOutputIdSchema,
  targetLoopId: automationLoopIdSchema,
  targetActionId: automationPolicyIdSchema
}).strict();

const projectLoopSchema = z.object({
  id: automationLoopIdSchema,
  steps: z.array(automationPolicyIdSchema)
}).strict();

const projectHumanGateResponseSchema = z.object({
  id: automationHumanGateResponseIdSchema,
  loopId: automationLoopIdSchema.optional(),
  actionId: automationPolicyIdSchema,
  outputId: automationOutputIdSchema,
  prompt: automationHumanGatePromptSchema,
  submittedAt: z.string()
}).strict();

const projectRuntimeSchema = z.object({
  id: automationTokenSchema,
  title: automationNameSchema,
  command: automationCommandSchema,
  args: z.array(automationArgSchema)
}).strict();

export const automationConfigSchema = z.object({
  version: z.literal(1),
  actions: z.array(projectActionSchema),
  outputs: z.array(projectOutputSchema),
  outputRoutes: z.array(projectOutputRouteSchema),
  humanGateResponses: z.array(projectHumanGateResponseSchema),
  loops: z.array(projectLoopSchema),
  runtimes: z.array(projectRuntimeSchema)
}).strict() satisfies z.ZodType<ProjectAutomationConfig>;

export const eventIntakeSchema = z.object({
  projectId: z.string().min(1),
  eventType: z.string().min(1),
  source: z.string().optional(),
  subject: z.string().optional(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  dedupeKey: z.string().optional(),
  correlationDepth: z.number().int().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  body: z.string().optional()
}).strict();

export const eventParamsSchema = z.object({
  id: z.string().min(1)
}).strict();

export const agentRunParamsSchema = z.object({
  id: z.string().min(1)
}).strict();
