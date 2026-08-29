import { z } from "zod";
import { VNEXT_ROOT_SNAPSHOT_VERSION } from "../versions.js";
import { gitObjectIdSchema, idListSchema, idSchema, sha256Schema, timestampSchema } from "./common.js";

export const rootSnapshotV13Schema = z.object({
  version: z.literal(VNEXT_ROOT_SNAPSHOT_VERSION),
  projectHeadSha: gitObjectIdSchema,
  projectConfigSha256: sha256Schema,
  directionSha256: sha256Schema,
  environmentSha256: sha256Schema,
  resourceSha256: sha256Schema,
  createdAt: timestampSchema
}).strict();

const environmentRunStatusSchema = z.enum(["pending", "running", "blocked", "completed", "cancelled", "interrupted"]);
export const environmentRunSchema = z.object({
  id: idSchema,
  environmentId: idSchema,
  status: environmentRunStatusSchema,
  snapshot: rootSnapshotV13Schema,
  continuationOfRunId: idSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  completedAt: timestampSchema.optional()
}).strict();

export const stateExecutionSchema = z.object({
  id: idSchema,
  environmentRunId: idSchema,
  stateId: idSchema,
  order: z.number().int().safe().nonnegative(),
  status: z.enum(["pending", "running", "blocked", "done", "cancelled", "interrupted"]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
}).strict();

export const actionExecutionSchema = z.object({
  id: idSchema,
  stateExecutionId: idSchema,
  actionId: idSchema,
  priority: z.number().int().safe().nonnegative(),
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

export const productSnapshotSchema = z.object({
  id: idSchema,
  environmentRunId: idSchema,
  commitSha: gitObjectIdSchema,
  artifactRefs: idListSchema,
  evidenceRefs: idListSchema,
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
    "environment_started", "state_activated", "action_selected", "validation_precheck_dispatched",
    "validation_precheck_done", "work_dispatched", "work_completed", "validation_postwork_dispatched",
    "validation_done", "validation_retry", "action_blocked", "feedback_created", "state_completed",
    "environment_completed", "environment_blocked", "environment_cancelled", "execution_interrupted",
    "continuation_created"
  ]),
  data: z.json().optional(),
  createdAt: timestampSchema
}).strict();
