import { z } from "zod";
import {
  loopNodeSizes,
  loopNodeStyles,
  loopCapabilityPattern,
  graphTransitionOutcomePattern,
  maxGraphTransitions,
  maxLoopCapabilities,
  maxLoopCapabilityLength,
  maxJobRetriesLimit,
  maxProjectStateBytes,
  maxProjectLoops,
  maxRepairAttemptsLimit,
  maxRepairDepthLimit,
  type ProjectAutomationConfig,
  type JsonValue
} from "../domain/automation.js";
import type { ExecutionProfile, ProjectConfiguration, ProjectIssueTrackerConfig } from "../domain/projectConfig.js";
import {
  loopConnectionPointStyles,
  loopEdgeLineStyles,
  type LoopTheme
} from "../domain/loopThemes.js";
import type { WorkspaceSaveRequestByCollection } from "./workspace-contracts.js";
import { validateProjectConfigSchema } from "./project-config-schema-validation.js";
import { projectJobScheduleSchema } from "./job-schedule-schema.js";

export { projectJobScheduleSchema } from "./job-schedule-schema.js";

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

export const collectionParamsSchema = z.object({
  collection: z.string().min(1)
}).strict();

export const collectionItemParamsSchema = z.object({
  collection: z.string().min(1),
  id: z.string().min(1)
}).strict();

const collectionUpsertSchemas = {
  skills: skillSchema
} as const;

export type MutableCollectionName = keyof typeof collectionUpsertSchemas;

export const collectionUpsertSchema = <T extends MutableCollectionName>(
  collection: T
): z.ZodType<WorkspaceSaveRequestByCollection[T]> =>
  collectionUpsertSchemas[collection] as unknown as z.ZodType<WorkspaceSaveRequestByCollection[T]>;

export const kebabCaseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const executionProfileIdSchema = z.string()
  .min(1)
  .max(200)
  .regex(kebabCaseIdPattern, "Execution profile id must be lowercase kebab-case.");
export const projectInstructionIdSchema = z.string()
  .regex(/^project:[a-z0-9]+(?:-[a-z0-9]+)*$/, "Primary instruction id must be a project:<lowercase-kebab-case> id.");
export const projectSkillIdSchema = z.string()
  .regex(
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
const automationDescriptionSchema = z.string().trim().min(1).max(2000);
const taskDescriptionSchema = z.string().trim().min(1).max(20_000).refine(
  (value) => value.trim().length > 0,
  "Task description must be non-empty."
);
const automationLoopIdSchema = z.string().min(2).max(101);
const automationNodeIdSchema = z.string()
  .min(1)
  .max(160)
  .regex(kebabCaseIdPattern, "Node id must be lowercase kebab-case.")
  .refine((value) => value !== "pass" && value !== "fail", "Node id is reserved for a Workflow result.");
const automationEdgeIdSchema = z.string()
  .min(1)
  .max(200)
  .regex(kebabCaseIdPattern, "Edge id must be lowercase kebab-case.");
const kebabLoopIdSchema = automationLoopIdSchema.regex(kebabCaseIdPattern, "Loop id must be lowercase kebab-case.");
export const loopCapabilitySchema = z.string()
  .trim()
  .min(1, "Capability must be non-empty.")
  .max(maxLoopCapabilityLength, `Capability must not exceed ${maxLoopCapabilityLength} characters.`)
  .regex(
    loopCapabilityPattern,
    "Capability must use a namespaced lowercase id such as namespace:capability.name."
  );
const loopCapabilityListSchema = z.array(loopCapabilitySchema)
  .max(maxLoopCapabilities, `Capability lists must not contain more than ${maxLoopCapabilities} values.`)
  .refine((values) => new Set(values).size === values.length, "Capabilities must be unique.");
const loopThemeColorSchema = z.string()
  .regex(/^#[0-9a-f]{6}$/, "Expected a six-digit lowercase hex color.");

export const loopThemeSchema = z.object({
  version: z.literal(4),
  node: z.object({
    labelColor: loopThemeColorSchema,
    glowColor: loopThemeColorSchema
  }).strict(),
  edge: z.object({
    color: loopThemeColorSchema,
    labelColor: loopThemeColorSchema,
    style: z.enum(loopEdgeLineStyles),
    repairStyle: z.enum(loopEdgeLineStyles),
    crossLoopStyle: z.enum(loopEdgeLineStyles)
  }).strict(),
  connectionPoint: z.object({
    style: z.enum(loopConnectionPointStyles),
    color: loopThemeColorSchema
  }).strict()
}).strict() satisfies z.ZodType<LoopTheme>;
const nodeVisualBase = {
  nodeStyle: z.enum(loopNodeStyles),
  nodeSize: z.enum(loopNodeSizes)
};
const executableNodeBase = {
  ...nodeVisualBase,
  id: automationNodeIdSchema,
  description: automationDescriptionSchema,
  task: taskDescriptionSchema
};
const executionComposition = {
  executionProfileId: executionProfileIdSchema,
  primaryInstructionId: projectInstructionIdSchema,
  skillIds: z.array(projectSkillIdSchema).refine(
    (ids) => new Set(ids).size === ids.length,
    "Skill ids must be unique."
  )
};
const jobNodeFields = {
  ...executableNodeBase,
  validationNodeId: automationNodeIdSchema,
  maxRetries: z.number().int().min(0).max(maxJobRetriesLimit)
};
const projectJobNodeSchema = z.discriminatedUnion("type", [
  z.object({ ...jobNodeFields, ...executionComposition, type: z.literal("agent") }).strict(),
  z.object({ ...jobNodeFields, type: z.literal("human") }).strict(),
  z.object({
    ...jobNodeFields,
    ...executionComposition,
    type: z.literal("scheduled"),
    schedule: projectJobScheduleSchema
  }).strict()
]);
const projectValidationNodeSchema = z.discriminatedUnion("type", [
  z.object({ ...executableNodeBase, ...executionComposition, type: z.literal("agent") }).strict(),
  z.object({ ...executableNodeBase, type: z.literal("human") }).strict()
]);
const projectPassEdgeSchema = z.object({
  id: automationEdgeIdSchema,
  sourceValidationNodeId: automationNodeIdSchema,
  target: z.union([
    z.object({ jobNodeId: automationNodeIdSchema }).strict(),
    z.object({ workflowResult: z.literal("PASS") }).strict()
  ])
}).strict();
const projectFailEdgeSchema = z.object({
  id: automationEdgeIdSchema,
  sourceValidationNodeId: automationNodeIdSchema,
  target: z.object({ workflowResult: z.literal("FAIL") }).strict()
}).strict();
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema)
]));
const stateInitialSchema = jsonValueSchema.refine((value) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxProjectStateBytes,
`Initial Loop state must not exceed ${maxProjectStateBytes} bytes.`);
const projectLoopSchema = z.object({
  id: kebabLoopIdSchema,
  description: automationDescriptionSchema,
  capabilities: z.object({
    accepts: loopCapabilityListSchema,
    provides: loopCapabilityListSchema
  }).strict(),
  state: z.object({
    description: automationDescriptionSchema,
    initial: stateInitialSchema
  }).strict(),
  workflow: z.object({
    startJobNodeId: automationNodeIdSchema,
    jobNodes: z.array(projectJobNodeSchema).min(1),
    validationNodes: z.array(projectValidationNodeSchema).min(1),
    passEdges: z.array(projectPassEdgeSchema),
    failEdges: z.array(projectFailEdgeSchema)
  }).strict()
}).strict();
const orchestratorComposition = {
  executionProfileId: executionProfileIdSchema,
  primaryInstructionId: projectInstructionIdSchema,
  skillIds: executionComposition.skillIds
};
const repairRouterSchema = z.object({
  ...orchestratorComposition,
  maxRepairDepth: z.number().int().min(0).max(maxRepairDepthLimit),
  maxRepairAttempts: z.number().int().min(1).max(maxRepairAttemptsLimit)
}).strict();
const orchestratorSchema = z.object({
  mode: z.literal("runbook"),
  maxTransitions: z.number().int().min(1).max(maxGraphTransitions),
  repairRouter: repairRouterSchema.optional()
}).strict();
const projectGraphTransitionSchema = z.object({
  id: automationEdgeIdSchema,
  source: kebabLoopIdSchema,
  decision: z.enum(["PASS", "FAIL"]),
  outcome: z.string().min(1).max(64).regex(graphTransitionOutcomePattern, "Outcome must be lowercase snake_case."),
  target: z.union([
    z.object({ loopId: kebabLoopIdSchema }).strict(),
    z.object({ runResult: z.literal("DONE") }).strict()
  ]),
  description: automationDescriptionSchema
}).strict();
const projectRepairEdgeSchema = z.object({
  id: automationEdgeIdSchema,
  source: kebabLoopIdSchema,
  target: kebabLoopIdSchema,
  capability: loopCapabilitySchema,
  description: automationDescriptionSchema
}).strict();

const graphSchema = z.object({
  id: kebabLoopIdSchema,
  name: z.string().trim().min(1).max(200),
  startLoopId: z.union([kebabLoopIdSchema, z.literal("")]),
  transitions: z.array(projectGraphTransitionSchema).max(maxGraphTransitions),
  repairEdges: z.array(projectRepairEdgeSchema)
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
  version: z.literal(13),
  orchestrator: orchestratorSchema,
  graph: graphSchema,
  loops: z.array(projectLoopSchema).max(maxProjectLoops)
}).strict() satisfies z.ZodType<ProjectAutomationConfig>;

export const projectConfigSchema = z.object({
  version: z.literal(13),
  executionProfiles: z.array(executionProfileSchema),
  issueTracker: projectIssueTrackerSchema,
  orchestrator: orchestratorSchema,
  graph: graphSchema,
  loops: z.array(projectLoopSchema).max(maxProjectLoops)
}).strict().superRefine(validateProjectConfigSchema) satisfies z.ZodType<ProjectConfiguration>;
