import { z } from "zod";
import {
  canvasNodeSizes,
  canvasNodeStyles,
  maxGraphNodeJobNodes,
  maxJobRetriesLimit,
  maxNodeCapabilities,
  maxNodeCapabilityLength,
  maxOrchestratorTransitions,
  maxProjectGraphNodes,
  maxProjectStateBytes,
  maxRepairAttemptsLimit,
  maxRepairDepthLimit,
  maxRouteAttemptsLimit,
  nodeCapabilityPattern,
  type JsonValue,
  type ProjectAutomationConfig
} from "../domain/automation.js";
import {
  canvasConnectionLineStyles,
  canvasConnectionPointStyles,
  type CanvasTheme
} from "../domain/canvasTheme.js";
import type { ExecutionProfile, ProjectConfiguration, ProjectIssueTrackerConfig } from "../domain/projectConfig.js";
import type { WorkspaceSaveRequestByCollection } from "./workspace-contracts.js";
import { validateProjectConfigSchema } from "./project-config-schema-validation.js";

const stringRecordSchema = z.record(z.string(), z.string());
const unknownRecordSchema = z.record(z.string(), z.unknown());

const editableMarkdownFields = {
  frontmatter: unknownRecordSchema.optional(),
  body: z.string().optional()
};

const serverManagedFields = {
  relativePath: z.unknown().optional(),
  slug: z.unknown().optional(),
  errors: z.unknown().optional(),
  projectId: z.unknown().optional(),
  origin: z.unknown().optional(),
  valid: z.unknown().optional(),
  sourceSha256: z.unknown().optional(),
  contentSha256: z.unknown().optional(),
  sizeBytes: z.unknown().optional()
};

const omitServerManagedFields = <T extends Record<string, unknown>>(value: T) => {
  const result = { ...value };
  for (const key of [
    "relativePath", "slug", "errors", "createdAt", "updatedAt", "projectId", "origin", "valid",
    "sourceSha256", "contentSha256", "sizeBytes"
  ]) delete result[key];
  return result;
};

const skillSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: stringRecordSchema.optional(),
  ...editableMarkdownFields,
  ...serverManagedFields
}).strict().transform(omitServerManagedFields);

export const projectDocumentSaveSchema = z.object({
  relativePath: z.string().min(1),
  frontmatter: unknownRecordSchema,
  body: z.string()
}).strict();

export const projectDocumentCreateSchema = z.object({
  directoryPath: z.string().min(1),
  title: z.string().min(1)
}).strict();

export const collectionParamsSchema = z.object({ collection: z.string().min(1) }).strict();
export const collectionItemParamsSchema = z.object({
  collection: z.string().min(1),
  id: z.string().min(1)
}).strict();

const collectionUpsertSchemas = { skills: skillSchema } as const;
export type MutableCollectionName = keyof typeof collectionUpsertSchemas;
export const collectionUpsertSchema = <T extends MutableCollectionName>(
  collection: T
): z.ZodType<WorkspaceSaveRequestByCollection[T]> =>
  collectionUpsertSchemas[collection] as unknown as z.ZodType<WorkspaceSaveRequestByCollection[T]>;

export const kebabCaseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const executionProfileIdSchema = z.string().min(1).max(200)
  .regex(kebabCaseIdPattern, "Execution profile id must be lowercase kebab-case.");
export const projectInstructionIdSchema = z.string()
  .regex(/^project:[a-z0-9]+(?:-[a-z0-9]+)*$/, "Primary instruction id must be a project:<lowercase-kebab-case> id.");
export const projectSkillIdSchema = z.string().regex(
  /^project:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
  "Skill id must be a project:<lowercase-kebab-case/path> id."
);
export const executionProfileSchema = z.object({
  id: executionProfileIdSchema,
  name: z.string().trim().min(1).max(200),
  provider: z.enum(["codex", "copilot"]),
  model: z.string().trim().min(1).max(200),
  reasoningEffort: z.string().trim().min(1).max(100),
  networkAccess: z.boolean()
}).strict() satisfies z.ZodType<ExecutionProfile>;
export const executionProfileSaveSchema = executionProfileSchema.omit({ id: true });
export const executionProfileParamsSchema = z.object({ executionProfileId: executionProfileIdSchema }).strict();

const descriptionSchema = z.string().trim().min(1).max(2_000);
const taskSchema = z.string().trim().min(1).max(20_000);
const entityIdSchema = z.string().min(1).max(160)
  .regex(kebabCaseIdPattern, "Node id must be lowercase kebab-case.")
  .refine((value) => value !== "pass" && value !== "fail", "Node id is reserved for a terminal result.");
const ruleIdSchema = z.string().min(1).max(200).regex(kebabCaseIdPattern, "Rule id must be lowercase kebab-case.");
export const nodeCapabilitySchema = z.string().trim().min(1).max(maxNodeCapabilityLength)
  .regex(nodeCapabilityPattern, "Capability must use a namespaced lowercase id such as namespace:capability.name.");
const capabilityListSchema = z.array(nodeCapabilitySchema).max(maxNodeCapabilities)
  .refine((values) => new Set(values).size === values.length, "Capabilities must be unique.");

const themeColorSchema = z.string().regex(/^#[0-9a-f]{6}$/, "Expected a six-digit lowercase hex color.");
export const canvasThemeSchema = z.object({
  version: z.literal(4),
  node: z.object({ labelColor: themeColorSchema, glowColor: themeColorSchema }).strict(),
  edge: z.object({
    color: themeColorSchema,
    labelColor: themeColorSchema,
    style: z.enum(canvasConnectionLineStyles),
    repairStyle: z.enum(canvasConnectionLineStyles),
    crossScopeStyle: z.enum(canvasConnectionLineStyles)
  }).strict(),
  connectionPoint: z.object({ style: z.enum(canvasConnectionPointStyles), color: themeColorSchema }).strict()
}).strict() satisfies z.ZodType<CanvasTheme>;

const appearanceFields = { nodeStyle: z.enum(canvasNodeStyles), nodeSize: z.enum(canvasNodeSizes) };
const compositionFields = {
  executionProfileId: executionProfileIdSchema,
  primaryInstructionId: projectInstructionIdSchema,
  skillIds: z.array(projectSkillIdSchema)
    .refine((ids) => new Set(ids).size === ids.length, "Skill ids must be unique.")
};
const executableFields = { ...appearanceFields, id: entityIdSchema, description: descriptionSchema, task: taskSchema };
export const projectWorkNodeSchema = z.discriminatedUnion("type", [
  z.object({ ...executableFields, ...compositionFields, type: z.literal("agent") }).strict(),
  z.object({ ...executableFields, type: z.literal("human") }).strict()
]);
export const projectValidationNodeSchema = z.discriminatedUnion("type", [
  z.object({ ...executableFields, ...compositionFields, type: z.literal("agent") }).strict(),
  z.object({ ...executableFields, type: z.literal("human") }).strict()
]);
const capabilitiesSchema = z.object({ accepts: capabilityListSchema, provides: capabilityListSchema }).strict();
const jobNodeSchema = z.object({
  ...appearanceFields,
  id: entityIdSchema,
  description: descriptionSchema,
  capabilities: capabilitiesSchema,
  maxRetries: z.number().int().min(0).max(maxJobRetriesLimit),
  workNode: projectWorkNodeSchema,
  validationNode: projectValidationNodeSchema
}).strict();

const terminalTargetSchema = z.object({ terminal: z.enum(["PASS", "FAIL"]) }).strict();
const graphTargetSchema = z.union([
  z.object({ graphNodeId: entityIdSchema }).strict(),
  terminalTargetSchema
]);
const graphNodeTargetSchema = z.union([
  z.object({ jobNodeId: entityIdSchema }).strict(),
  terminalTargetSchema
]);
const candidateSchema = <T extends z.ZodTypeAny>(target: T) => z.object({
  target,
  description: descriptionSchema
}).strict();
const routingSchema = <T extends z.ZodTypeAny>(target: T) => {
  const candidate = candidateSchema(target);
  return z.object({
    start: z.object({ id: ruleIdSchema, candidates: z.array(candidate).min(1) }).strict(),
    continuation: z.array(z.object({
      id: ruleIdSchema,
      sourceId: entityIdSchema,
      result: z.enum(["PASS", "FAIL"]),
      candidates: z.array(candidate).min(1)
    }).strict()).max(maxOrchestratorTransitions),
    repair: z.array(z.object({
      id: ruleIdSchema,
      sourceId: entityIdSchema,
      capability: nodeCapabilitySchema,
      candidates: z.array(candidate).min(1)
    }).strict()).max(maxOrchestratorTransitions)
  }).strict();
};
const orchestratorSchema = <T extends z.ZodTypeAny>(target: T) => z.object({
  ...appearanceFields,
  ...compositionFields,
  id: entityIdSchema,
  description: descriptionSchema,
  maxTransitions: z.number().int().min(1).max(maxOrchestratorTransitions),
  maxRouteAttempts: z.number().int().min(1).max(maxRouteAttemptsLimit),
  routing: routingSchema(target)
}).strict();
const repairNodeSchema = z.object({
  ...appearanceFields,
  ...compositionFields,
  id: entityIdSchema,
  description: descriptionSchema,
  task: taskSchema,
  maxRepairDepth: z.number().int().min(0).max(maxRepairDepthLimit),
  maxRepairAttempts: z.number().int().min(1).max(maxRepairAttemptsLimit)
}).strict();

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)
]));
const initialStateSchema = jsonValueSchema.refine((value) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxProjectStateBytes,
`Initial Graph state must not exceed ${maxProjectStateBytes} bytes.`);
const graphNodeSchema = z.object({
  ...appearanceFields,
  id: entityIdSchema,
  description: descriptionSchema,
  capabilities: capabilitiesSchema,
  stateContract: z.object({ description: descriptionSchema }).strict(),
  orchestrator: orchestratorSchema(graphNodeTargetSchema),
  repairNode: repairNodeSchema.optional(),
  jobNodes: z.array(jobNodeSchema).min(1).max(maxGraphNodeJobNodes)
}).strict();
const graphSchema = z.object({
  id: entityIdSchema,
  name: z.string().trim().min(1).max(200),
  state: z.object({ description: descriptionSchema, initial: initialStateSchema }).strict(),
  orchestrator: orchestratorSchema(graphTargetSchema),
  repairNode: repairNodeSchema.optional(),
  graphNodes: z.array(graphNodeSchema).min(1).max(maxProjectGraphNodes)
}).strict();

const trackerDirectorySchema = z.string()
  .regex(/^\.tickets\/[a-z0-9]+(?:-[a-z0-9]+)*$/, "Tracker directory must be a direct child of .tickets.");
export const projectIssueTrackerSchema = z.object({
  kind: z.literal("tk"),
  testedRevision: z.string().regex(/^[0-9a-f]{40}$/, "testedRevision must be a full lowercase Git commit SHA."),
  orchestrationDirectory: trackerDirectorySchema,
  workDirectory: trackerDirectorySchema
}).strict() satisfies z.ZodType<ProjectIssueTrackerConfig>;

export const automationConfigSchema = z.object({
  version: z.literal(14),
  graph: graphSchema
}).strict() as z.ZodType<ProjectAutomationConfig>;

export const projectConfigSchema = z.object({
  version: z.literal(14),
  executionProfiles: z.array(executionProfileSchema),
  issueTracker: projectIssueTrackerSchema,
  graph: graphSchema
}).strict().superRefine(validateProjectConfigSchema) as z.ZodType<ProjectConfiguration>;
