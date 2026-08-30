import { z } from "zod";
import { ROOT_SNAPSHOT_VERSION } from "../versions.js";
import { gitObjectIdSchema, idListSchema, idSchema, sha256Schema, timestampSchema } from "./common.js";
import { constraintSchema, directionReferenceSchema } from "./directionSchemas.js";
import { agentCompositionSchema, governanceAgentDefinitionSchema, environmentDefinitionSchema } from "./environmentSchemas.js";

const runtimeCapabilityBase = {
  provider: z.literal("codex"),
  cliVersion: z.string().trim().min(1),
  supportsReadOnly: z.boolean(),
  supportsWorkspaceWrite: z.boolean(),
  capabilitySha256: sha256Schema
};
const roleModelCapabilitySchema = z.object({
  model: z.string().trim().min(1), reasoningEffort: z.string().trim().min(1),
  supportedModels: z.array(z.string().trim().min(1)),
  supportedReasoningEfforts: z.array(z.string().trim().min(1))
}).strict();

export const rootSnapshotV19Schema = z.object({
  version: z.literal(ROOT_SNAPSHOT_VERSION),
  projectHeadSha: gitObjectIdSchema,
  projectConfigSha256: sha256Schema,
  directionSha256: sha256Schema,
  environmentSha256: sha256Schema,
  resourceSha256: sha256Schema,
  environment: environmentDefinitionSchema,
  direction: z.object({
    goals: z.array(directionReferenceSchema.extend({ contentSha256: sha256Schema }).strict()),
    adrs: z.array(directionReferenceSchema.extend({ contentSha256: sha256Schema }).strict()),
    constraints: z.array(constraintSchema.extend({ contentSha256: sha256Schema }).strict())
  }).strict(),
  agents: z.array(governanceAgentDefinitionSchema.extend({ contentSha256: sha256Schema }).strict()).length(2),
  runtimeCapabilities: z.array(z.union([
    z.object({
      ...runtimeCapabilityBase,
      subject: z.object({ kind: z.literal("agent"), agentId: idSchema }).strict(),
      model: z.string().trim().min(1), reasoningEffort: z.string().trim().min(1),
      supportedModels: z.array(z.string().trim().min(1)),
      supportedReasoningEfforts: z.array(z.string().trim().min(1))
    }).strict(),
    z.object({
      ...runtimeCapabilityBase,
      subject: z.object({ kind: z.literal("action"), actionId: idSchema }).strict(),
      roles: z.object({ validation: roleModelCapabilitySchema, work: roleModelCapabilitySchema }).strict()
    }).strict()
  ])),
  resources: z.array(z.object({
    kind: z.enum(["instruction", "skill"]), id: idSchema, relativePath: z.string().trim().min(1),
    content: z.string(), sourceSha256: sha256Schema
  }).strict()),
  permissions: z.array(z.object({
    role: z.enum(["validation", "work", "critic", "refinement"]), actionId: idSchema.optional(),
    toolPolicy: z.enum(["read_only", "workspace_write"]), approvalPolicy: z.literal("never")
  }).strict()),
  governance: z.object({ critic: agentCompositionSchema, refinement: agentCompositionSchema }).strict(),
  lineage: z.object({
    parentRootRunId: idSchema, refinementProposalId: idSchema, refinementApprovalId: idSchema,
    refinementCommitSha: gitObjectIdSchema
  }).strict().optional(),
  createdAt: timestampSchema
}).strict();

const environmentRunStatusSchema = z.enum(["pending", "running", "blocked", "completed", "cancelled", "interrupted"]);
export const environmentRunSchema = z.object({
  id: idSchema,
  environmentId: idSchema,
  status: environmentRunStatusSchema,
  snapshot: rootSnapshotV19Schema,
  continuationOfRunId: idSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  completedAt: timestampSchema.optional()
}).strict();

export const stateExecutionSchema = z.object({
  id: idSchema,
  environmentRunId: idSchema,
  stateId: idSchema,
  order: z.number().int().safe().positive(),
  status: z.enum(["pending", "running", "blocked", "done", "cancelled", "interrupted"]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

export const actionExecutionSchema = z.object({
  id: idSchema,
  stateExecutionId: idSchema,
  actionId: idSchema,
  priority: z.number().int().safe().positive(),
  status: z.enum(["pending", "prechecking", "working", "postchecking", "blocked", "done", "cancelled", "interrupted"]),
  workAttempts: z.number().int().nonnegative(),
  maxRetries: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

const agentRunBase = {
  id: idSchema,
  actionExecutionId: idSchema.optional(),
  environmentRunId: idSchema,
  parentAgentRunId: idSchema.optional(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled", "interrupted"]),
  attempt: z.number().int().positive(),
  outcome: z.json().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
};

export const agentRunSchema = z.union([
  z.object({ ...agentRunBase, role: z.literal("validation"), phase: z.enum(["precheck", "postwork"]) }).strict(),
  z.object({ ...agentRunBase, role: z.literal("work"), phase: z.literal("work") }).strict(),
  z.object({ ...agentRunBase, role: z.literal("critic"), phase: z.literal("proposal") }).strict(),
  z.object({ ...agentRunBase, role: z.literal("refinement"), phase: z.literal("proposal") }).strict()
]);

export const runEvidenceSchema = z.object({
  version: z.literal(1),
  id: idSchema,
  environmentRunId: idSchema,
  commitSha: gitObjectIdSchema,
  changedFiles: z.array(z.string().trim().min(1)),
  artifactRefs: idListSchema,
  validationEvidenceRefs: idListSchema,
  lineage: z.object({ sourceRunId: idSchema.optional(), continuationRunId: idSchema.optional() }).strict(),
  createdAt: timestampSchema
}).strict();

export const continuationRunSchema = z.object({
  sourceRunId: idSchema,
  continuationRunId: idSchema,
  refinementApplyId: idSchema,
  sourceSnapshotSha256: sha256Schema,
  continuationSnapshotSha256: sha256Schema,
  createdAt: timestampSchema
}).strict();

export const controlFlowEventSchema = z.object({
  id: idSchema,
  environmentRunId: idSchema,
  actionExecutionId: idSchema.optional(),
  sequence: z.number().int().positive(),
  kind: z.enum([
    "environment_started", "state_activated", "action_selected", "action_imported", "validation_precheck_dispatched",
    "validation_precheck_done", "work_dispatched", "work_completed", "validation_postwork_dispatched",
    "validation_done", "validation_retry", "action_blocked", "feedback_created", "state_completed",
    "environment_completed", "environment_blocked", "environment_cancelled", "execution_interrupted",
    "continuation_created"
  ]),
  data: z.json().optional(),
  createdAt: timestampSchema
}).strict();
