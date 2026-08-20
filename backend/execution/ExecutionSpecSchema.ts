import { z } from "zod";
import { executionProfileSchema } from "../../shared/api/workspace-schemas.js";
import type { ExecutionSpec } from "../../shared/domain/runtime.js";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const runtimeSchema = z.object({
  hostname: z.string(), provider: z.enum(["codex", "copilot"]), cliVersion: z.string(),
  model: z.string(), reasoning: z.string(),
  policy: z.object({ network: z.boolean(), readOnlyRoots: z.array(z.string()) }).strict(),
  capabilityHash: sha256Schema
}).strict();
const projectSchema = z.object({
  checkoutRoot: z.string(), headSha: z.string(), configHash: sha256Schema, snapshotHash: sha256Schema
}).strict();

export const executionSpecSchema = z.object({
  version: z.literal(7),
  taskId: z.string(),
  kind: z.literal("node_execution"),
  rootRunId: z.string(),
  loopRunId: z.string(),
  jobRunId: z.string().optional(),
  nodeRunId: z.string(),
  evidence: z.object({
    compositionVersion: z.literal(6), loopId: z.string(), jobNodeId: z.string().optional(), workflowNodeId: z.string().optional(),
    nodeRole: z.enum(["job", "validation", "orchestrator"]), nodeDefinitionId: z.string(),
    executionProfile: executionProfileSchema,
    resources: z.array(z.object({
      kind: z.enum(["system", "primary", "skill"]), origin: z.enum(["system", "project"]),
      id: z.string(), relativePath: z.string().optional(), sourceSha256: sha256Schema
    }).strict()),
    prompt: z.string(), promptSha256: sha256Schema,
    taskEnvelopeVersion: z.literal(5), taskEnvelopeSha256: sha256Schema,
    outputSchemaVersion: z.literal(5),
    outputSchemaId: z.enum([
      "job-node-outcome-v5", "validation-node-outcome-v5", "orchestrator-node-outcome-v5"
    ]),
    outputSchema: z.record(z.string(), z.json()), outputSchemaSha256: sha256Schema
  }).strict(),
  runtime: runtimeSchema,
  project: projectSchema,
  createdAt: z.string()
}).strict() satisfies z.ZodType<ExecutionSpec>;
