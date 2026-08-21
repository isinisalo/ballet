import { z } from "zod";
import {
  automationConfigSchema, executionProfileSchema, loopThemeSchema, projectIssueTrackerSchema
} from "../../shared/api/workspace-schemas.js";
import {
  getReachableProjectLoopGraph,
  getReachableProjectJobNodeIds
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
  version: z.literal(6),
  rootKind: z.enum(["graph", "loop"]),
  rootLoopId: z.string(),
  project: z.object({
    checkoutRoot: z.string(),
    headSha: z.string(),
    configHash: sha256Schema,
    snapshotHash: sha256Schema
  }).strict(),
  orchestrator: automationConfigSchema.shape.orchestrator,
  issueTracker: projectIssueTrackerSchema,
  loops: automationConfigSchema.shape.loops,
  graph: automationConfigSchema.shape.graph,
  theme: loopThemeSchema,
  executionProfiles: z.array(executionProfileSchema),
  runtimes: z.array(z.object({
    executionProfileId: z.string(),
    runtime: runtimeSnapshotSchema
  }).strict()),
  resources: z.array(resourceSchema),
  createdAt: z.string()
}).strict().superRefine((snapshot, context) => {
  const validationGraph = snapshot.rootKind === "graph" ? snapshot.graph : {
    ...snapshot.graph,
    startLoopId: snapshot.rootLoopId,
    transitions: snapshot.loops.flatMap((loop) => ([
      {
        id: `snapshot-${loop.id}-pass`, source: loop.id, decision: "PASS" as const,
        outcome: "isolated", target: { runResult: "DONE" as const }, description: "Isolated snapshot validation."
      },
      {
        id: `snapshot-${loop.id}-fail`, source: loop.id, decision: "FAIL" as const,
        outcome: "isolated", target: { runResult: "DONE" as const }, description: "Isolated snapshot validation."
      }
    ]))
  };
  const automationIssues = validateProjectAutomationConfig({
    version: 13,
    orchestrator: snapshot.orchestrator,
    graph: validationGraph,
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
  snapshot.loops.forEach((loop, loopIndex) => {
    const reachableNodeIds = getReachableProjectJobNodeIds(loop);
    if (loop.workflow.jobNodes.some((node) => !reachableNodeIds.has(node.id))) context.addIssue({
      code: "custom",
      path: ["loops", loopIndex, "workflow", "jobNodes"],
      message: `Loop ${loop.id} contains a JobNode that is not reachable by PassEdges.`
    });
  });
  snapshot.graph.transitions.forEach((transition, edgeIndex) => {
    if (!loopIds.has(transition.source)
      || ("loopId" in transition.target && !loopIds.has(transition.target.loopId))) context.addIssue({
      code: "custom",
      path: ["graph", "transitions", edgeIndex],
      message: `Transition ${transition.id} has an endpoint outside the execution snapshot.`
    });
  });
  snapshot.graph.repairEdges.forEach((edge, edgeIndex) => {
    if (!loopIds.has(edge.source) || !loopIds.has(edge.target)) context.addIssue({
      code: "custom",
      path: ["graph", "repairEdges", edgeIndex],
      message: `Repair Edge ${edge.id} has an endpoint outside the execution snapshot.`
    });
  });
  if (loopIds.has(snapshot.rootLoopId)) {
    const reachable = getReachableProjectLoopGraph(
      snapshot,
      snapshot.rootLoopId,
      snapshot.orchestrator.repairRouter?.maxRepairDepth ?? 0
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
