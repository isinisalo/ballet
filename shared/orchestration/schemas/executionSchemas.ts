import { z } from "zod";
import { sha256 } from "../primitives.js";
import {
  EXECUTION_SPEC_VERSION,
  PROMPT_COMPOSITION_VERSION,
  ROLE_OUTCOME_VERSION,
  TASK_ENVELOPE_VERSION
} from "../versions.js";
import { actionAgentDefinitionSchema, governanceAgentDefinitionSchema } from "./environmentSchemas.js";
import { gitObjectIdSchema, idSchema, nonEmptyTextSchema, sha256Schema, timestampSchema } from "./common.js";

const resourceEvidenceSchema = z.object({
  kind: z.enum(["system", "primary", "skill"]),
  origin: z.enum(["system", "project"]),
  id: idSchema,
  relativePath: nonEmptyTextSchema.optional(),
  sourceSha256: sha256Schema
}).strict();

export const executionPromptEvidenceV16Schema = z.object({
  compositionVersion: z.literal(PROMPT_COMPOSITION_VERSION),
  role: z.enum(["validation", "work", "critic", "refinement"]),
  phase: z.enum(["precheck", "work", "postwork", "proposal"]),
  subject: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("action_agent"), actionId: idSchema,
      role: z.enum(["validation", "work"]), agent: actionAgentDefinitionSchema.extend({ contentSha256: sha256Schema }).strict() }).strict(),
    z.object({ kind: z.literal("agent"), agent: governanceAgentDefinitionSchema.extend({ contentSha256: sha256Schema }).strict() }).strict()
  ]),
  resources: z.array(resourceEvidenceSchema).max(256),
  prompt: nonEmptyTextSchema,
  promptSha256: sha256Schema,
  taskEnvelopeVersion: z.literal(TASK_ENVELOPE_VERSION),
  taskEnvelopeSha256: sha256Schema,
  outputSchemaVersion: z.literal(ROLE_OUTCOME_VERSION),
  outputSchemaId: z.enum(["validation-outcome-v11", "work-outcome-v11", "critic-outcome-v11", "refinement-outcome-v11"]),
  outputSchemaSha256: sha256Schema
}).strict().superRefine((evidence, context) => {
  if (sha256(evidence.prompt) !== evidence.promptSha256) {
    context.addIssue({ code: "custom", path: ["promptSha256"], message: "Prompt hash does not match" });
  }
  const expectedPhase = evidence.role === "validation"
    ? ["precheck", "postwork"]
    : [evidence.role === "work" ? "work" : "proposal"];
  if (!expectedPhase.includes(evidence.phase)) {
    context.addIssue({ code: "custom", path: ["phase"], message: "Role and phase do not match" });
  }
  const expectedSchema = `${evidence.role}-outcome-v11`;
  if (evidence.outputSchemaId !== expectedSchema) {
    context.addIssue({ code: "custom", path: ["outputSchemaId"], message: "Role and output schema do not match" });
  }
});

const executionRuntimeSnapshotSchema = z.object({
  subject: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("action_agent"), actionId: idSchema,
      role: z.enum(["validation", "work"]), agentId: idSchema }).strict(),
    z.object({ kind: z.literal("agent"), agentId: idSchema }).strict()
  ]),
  provider: z.literal("codex"),
  cliVersion: nonEmptyTextSchema,
  model: nonEmptyTextSchema,
  reasoningEffort: nonEmptyTextSchema,
  capabilityHash: sha256Schema
}).strict();

export const executionSpecV18Schema = z.object({
  version: z.literal(EXECUTION_SPEC_VERSION),
  taskId: idSchema,
  kind: z.literal("agent_execution"),
  environmentRunId: idSchema,
  actionExecutionId: idSchema.optional(),
  agentRunId: idSchema,
  evidence: executionPromptEvidenceV16Schema,
  runtime: executionRuntimeSnapshotSchema,
  permissions: z.object({
    workspaceAccess: z.enum(["read-only", "workspace-write"]),
    approvalPolicy: z.literal("never")
  }).strict(),
  project: z.object({
    checkoutRoot: nonEmptyTextSchema,
    headSha: gitObjectIdSchema,
    configHash: sha256Schema,
    snapshotHash: sha256Schema
  }).strict(),
  input: z.json().optional(),
  createdAt: timestampSchema
}).strict();
