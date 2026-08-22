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
  version: z.literal(9),
  taskId: z.string(),
  kind: z.literal("node_execution"),
  rootRunId: z.string(),
  graphNodeInvocationId: z.string().optional(),
  jobNodeInvocationId: z.string().optional(),
  nodeRunId: z.string(),
  evidence: z.object({
    compositionVersion: z.literal(8),
    graphNodeId: z.string().optional(),
    jobNodeId: z.string().optional(),
    nodeRole: z.enum(["work", "validation", "orchestrator", "repair"]),
    orchestrationScope: z.enum(["graph", "graph_node"]).optional(),
    nodeDefinitionId: z.string(),
    executionProfile: executionProfileSchema,
    resources: z.array(z.object({
      kind: z.enum(["system", "primary", "skill"]), origin: z.enum(["system", "project"]),
      id: z.string(), relativePath: z.string().optional(), sourceSha256: sha256
    }).strict()),
    prompt: z.string(), promptSha256: sha256,
    taskEnvelopeVersion: z.literal(7), taskEnvelopeSha256: sha256,
    outputSchemaVersion: z.literal(7),
    outputSchemaId: z.enum([
      "work-node-outcome-v7", "validation-node-outcome-v7",
      "orchestrator-node-outcome-v7", "repair-node-outcome-v7"
    ]),
    outputSchema: z.record(z.string(), z.json()), outputSchemaSha256: sha256
  }).strict(),
  runtime,
  project: z.object({
    checkoutRoot: z.string(), headSha: z.string(), configHash: sha256, snapshotHash: sha256
  }).strict(),
  createdAt: z.string()
}).strict() satisfies z.ZodType<ExecutionSpec>;
