import { z } from "zod";
import { automationConfigSchema, executionProfileSchema, loopThemeSchema } from "../../shared/api/workspace-schemas.js";
import {
  getReachableProjectLoopGraph,
  getReachableProjectNodeIds,
  loopTerminals
} from "../../shared/domain/automation.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { validateProjectAutomationConfig } from "../automation.js";

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
  version: z.literal(4),
  rootLoopId: z.string(),
  project: z.object({
    checkoutRoot: z.string(),
    headSha: z.string(),
    configHash: sha256Schema,
    snapshotHash: sha256Schema
  }).strict(),
  orchestrator: automationConfigSchema.shape.orchestrator,
  loops: automationConfigSchema.shape.loops,
  graph: automationConfigSchema.shape.graph,
  terminals: z.array(z.enum(loopTerminals)).length(loopTerminals.length),
  theme: loopThemeSchema,
  executionProfiles: z.array(executionProfileSchema),
  runtimes: z.array(z.object({
    executionProfileId: z.string(),
    runtime: runtimeSnapshotSchema
  }).strict()),
  resources: z.array(resourceSchema),
  createdAt: z.string()
}).strict().superRefine((snapshot, context) => {
  const automationIssues = validateProjectAutomationConfig({
    version: 11,
    orchestrator: snapshot.orchestrator,
    graph: snapshot.graph,
    loops: snapshot.loops
  }, snapshot.executionProfiles);
  automationIssues.forEach((issue) => context.addIssue({
    code: "custom",
    path: issue.path.split("."),
    message: issue.message
  }));
  const loopIds = new Set(snapshot.loops.map((loop) => loop.id));
  if (!loopIds.has(snapshot.rootLoopId)) context.addIssue({
    code: "custom",
    path: ["rootLoopId"],
    message: `Root Loop ${snapshot.rootLoopId} is missing from the execution snapshot.`
  });
  if (snapshot.terminals.some((terminal, index) => terminal !== loopTerminals[index])) context.addIssue({
    code: "custom",
    path: ["terminals"],
    message: "Execution snapshot Loop terminals are not in canonical order."
  });
  snapshot.loops.forEach((loop, loopIndex) => {
    const reachableNodeIds = getReachableProjectNodeIds(loop);
    if (loop.nodes.some((node) => !reachableNodeIds.has(node.id))) context.addIssue({
      code: "custom",
      path: ["loops", loopIndex, "nodes"],
      message: `Loop ${loop.id} contains a Work Loop Node that is not reachable by Validation OK Edges.`
    });
  });
  snapshot.graph.loopEdges.forEach((edge, edgeIndex) => {
    if (!loopIds.has(edge.source) || !loopIds.has(edge.target)) context.addIssue({
      code: "custom",
      path: ["graph", "loopEdges", edgeIndex],
      message: `Loop Edge ${edge.id} has an endpoint outside the execution snapshot.`
    });
  });
  if (loopIds.has(snapshot.rootLoopId)) {
    const reachable = getReachableProjectLoopGraph(
      snapshot,
      snapshot.rootLoopId,
      snapshot.orchestrator.maxRepairDepth
    );
    snapshot.loops.forEach((loop, loopIndex) => {
      if (!reachable.loopIds.has(loop.id)) context.addIssue({
        code: "custom",
        path: ["loops", loopIndex, "id"],
        message: `Loop ${loop.id} is outside the snapshotted flow and repair graph.`
      });
    });
  }
}) satisfies z.ZodType<RootExecutionSnapshot>;
