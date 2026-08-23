import { z } from "zod";
import { executionProfileSchema } from "../../shared/api/workspace-schemas.js";
import type { ExecutionSpec } from "../../shared/domain/runtime.js";

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const runtime = z.object({
  hostname: z.string(), provider: z.enum(["codex", "copilot"]), cliVersion: z.string(),
  model: z.string(), reasoning: z.string(),
  policy: z.object({ network: z.boolean(), readOnlyRoots: z.array(z.string()) }).strict(),
  capabilityHash: sha256
}).strict();

export const executionSpecSchema = z.object({
  version: z.literal(11),
  taskId: z.string(),
  kind: z.literal("node_execution"),
  rootRunId: z.string(),
  graphNodeInvocationId: z.string().optional(),
  actionNodeInvocationId: z.string().optional(),
  nodeRunId: z.string(),
  evidence: z.object({
    compositionVersion: z.literal(10),
    graphNodeId: z.string().optional(),
    actionNodeId: z.string().optional(),
    nodeRole: z.enum(["work", "validation"]),
    nodeDefinitionId: z.string(),
    executionProfile: executionProfileSchema,
    resources: z.array(z.object({
      kind: z.enum(["system", "primary", "skill"]), origin: z.enum(["system", "project"]),
      id: z.string(), relativePath: z.string().optional(), sourceSha256: sha256
    }).strict()),
    prompt: z.string(), promptSha256: sha256,
    taskEnvelopeVersion: z.literal(9), taskEnvelopeSha256: sha256,
    outputSchemaVersion: z.literal(9),
    outputSchemaId: z.enum([
      "work-node-outcome-v9", "validation-node-outcome-v9"
    ]),
    outputSchema: z.record(z.string(), z.json()), outputSchemaSha256: sha256
  }).strict(),
  runtime,
  project: z.object({
    checkoutRoot: z.string(), headSha: z.string(), configHash: sha256, snapshotHash: sha256
  }).strict(),
  createdAt: z.string()
}).strict() satisfies z.ZodType<ExecutionSpec>;
