import { z } from "zod";

const id = z.string().uuid();
const nonEmptyText = z.string().trim().min(1).max(20_000);

export const orchestrationRequestSchema = z.object({
  orchestrationRequestId: id,
  rootRunId: id,
  kind: z.enum(["flow", "repair"]),
  sourceLoopRunId: id,
  sourceLoopId: z.string().min(1),
  sourceNodeRunId: id,
  stateRevisionAtRequest: z.number().int().nonnegative(),
  completionSummary: z.string().max(20_000),
  completionEvidence: z.json(),
  requestedCapability: nonEmptyText.optional(),
  expectedOutcome: z.json().optional(),
  repairRequestId: id.optional(),
  orchestratorNodeRunId: id.optional(),
  routedLoopEdgeId: z.string().min(1).optional(),
  routedTargetLoopId: z.string().min(1).optional(),
  targetLoopRunId: id.optional(),
  status: z.enum(["pending", "waiting_for_input", "routed", "dispatched", "failed", "cancelled"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional()
}).strict();

export const orchestratorRouteSchema = z.object({
  routeId: id,
  rootRunId: id,
  orchestrationRequestId: id,
  kind: z.enum(["flow", "repair"]),
  repairRequestId: id.optional(),
  orchestratorNodeRunId: id,
  loopEdgeId: z.string().min(1),
  sourceLoopId: z.string().min(1),
  targetLoopId: z.string().min(1),
  evidence: z.json().optional(),
  createdAt: z.string()
}).strict();

export const rootRunOrchestrationProjectionSchema = z.object({
  requests: z.array(orchestrationRequestSchema).max(256),
  routes: z.array(orchestratorRouteSchema).max(256),
  pendingRequest: orchestrationRequestSchema.optional(),
  selectedRoute: orchestratorRouteSchema.optional()
}).strict();
