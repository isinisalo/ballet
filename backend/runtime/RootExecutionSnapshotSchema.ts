import { z } from "zod";
import { automationConfigSchema, executionProfileSchema, loopThemeSchema } from "../../shared/api/workspace-schemas.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const runtimeSnapshotSchema = z.object({
  hostname: z.string(),
  provider: z.enum(["codex", "copilot"]),
  cliVersion: z.string(),
  model: z.string(),
  reasoning: z.string(),
  policy: z.object({ network: z.boolean(), readOnlyRoots: z.array(z.string()) }).strict(),
  capabilityHash: sha256Schema
}).strict();

const resourceSchema = z.object({
  kind: z.enum(["system", "primary", "skill"]),
  origin: z.enum(["system", "project"]),
  id: z.string(),
  relativePath: z.string().optional(),
  sourceSha256: sha256Schema,
  content: z.string()
}).strict();

export const rootExecutionSnapshotSchema = z.object({
  version: z.literal(2),
  rootLoopId: z.string(),
  project: z.object({
    checkoutRoot: z.string(),
    headSha: z.string(),
    configHash: sha256Schema,
    snapshotHash: sha256Schema
  }).strict(),
  orchestrator: automationConfigSchema.shape.orchestrator,
  loops: automationConfigSchema.shape.loops,
  loopEdges: automationConfigSchema.shape.loopEdges,
  theme: loopThemeSchema,
  executionProfiles: z.array(executionProfileSchema),
  runtimes: z.array(z.object({
    executionProfileId: z.string(),
    runtime: runtimeSnapshotSchema
  }).strict()),
  resources: z.array(resourceSchema),
  createdAt: z.string()
}).strict().superRefine((snapshot, context) => {
  if (!snapshot.loops.some((loop) => loop.id === snapshot.rootLoopId)) context.addIssue({
    code: "custom",
    path: ["rootLoopId"],
    message: `Root Loop ${snapshot.rootLoopId} is missing from the execution snapshot.`
  });
}) satisfies z.ZodType<RootExecutionSnapshot>;
