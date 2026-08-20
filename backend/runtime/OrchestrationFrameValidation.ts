import type Database from "better-sqlite3";
import type { RepairRequest } from "../../shared/domain/runtime.js";

export interface FrameValidationInput {
  rootRunId: string;
  repairRequestId: string;
  routeId: string;
  callerLoopRunId: string;
  calleeLoopRunId: string;
  parentFrameId?: string;
  returnLoopId: string;
  returnJobNodeId: string;
  returnValidationNodeDefinitionId: string;
  nestingDepth: number;
}

export const assertOrchestrationFrameInput = (
  connection: Database.Database,
  request: RepairRequest,
  input: FrameValidationInput,
  frameId: string
): void => {
  const route = routeOwner(connection, input.routeId);
  if (route.repairRequestId !== request.repairRequestId
    || route.sourceLoopId !== request.returnLoopId
    || route.targetLoopId !== request.routedTargetLoopId) {
    throw new Error(`Orchestration Frame route does not match Repair Request ${input.repairRequestId}.`);
  }
  if (!continuationMatches(request, input)) {
    throw new Error(`Orchestration Frame continuation does not match Repair Request ${input.repairRequestId}.`);
  }
  const caller = loopOwner(connection, input.callerLoopRunId);
  const callee = loopOwner(connection, input.calleeLoopRunId);
  if (!callerMatches(caller, route.sourceLoopId, input)
    || !calleeMatches(callee, route.targetLoopId, request.repairRequestId, input)) {
    throw new Error(`Orchestration Frame caller/callee ownership is invalid for Repair Request ${input.repairRequestId}.`);
  }
  const parent = topFrame(connection, input.rootRunId);
  if (input.parentFrameId !== parent?.frameId
    || (parent && (parent.calleeLoopRunId !== input.callerLoopRunId
      || input.nestingDepth !== parent.nestingDepth + 1))
    || (!parent && input.nestingDepth !== 1)) {
    throw new Error(`Orchestration Frame ${frameId} does not extend the active LIFO continuation.`);
  }
};

const continuationMatches = (request: RepairRequest, input: FrameValidationInput): boolean =>
  request.requesterLoopRunId === input.callerLoopRunId
  && request.returnLoopId === input.returnLoopId
  && request.returnJobNodeId === input.returnJobNodeId
  && request.returnValidationNodeDefinitionId === input.returnValidationNodeDefinitionId;

interface LoopOwner {
  rootRunId: string;
  loopId: string;
  source: string;
  status: string;
  repairRequestId?: string;
}

const callerMatches = (owner: LoopOwner, sourceLoopId: string, input: FrameValidationInput): boolean =>
  owner.rootRunId === input.rootRunId
  && owner.loopId === sourceLoopId
  && owner.status === "waiting_for_input";

const calleeMatches = (
  owner: LoopOwner,
  targetLoopId: string,
  repairRequestId: string,
  input: FrameValidationInput
): boolean => owner.rootRunId === input.rootRunId
  && owner.loopId === targetLoopId
  && ["running", "waiting_for_input"].includes(owner.status)
  && owner.source === "repair"
  && owner.repairRequestId === repairRequestId;

const loopOwner = (connection: Database.Database, loopRunId: string): LoopOwner => {
  const value = connection.prepare(`
    SELECT root_run_id, loop_id, source, status, repair_request_id
    FROM loop_invocations WHERE loop_run_id = ?
  `).get(loopRunId);
  return {
    rootRunId: readString(value, "root_run_id"), loopId: readString(value, "loop_id"),
    source: readString(value, "source"), status: readString(value, "status"),
    repairRequestId: readNullableString(value, "repair_request_id")
  };
};

const routeOwner = (connection: Database.Database, routeId: string) => {
  const value = connection.prepare(`
    SELECT request.repair_request_id, route.source_loop_id, route.target_loop_id
    FROM orchestrator_routes route
    JOIN orchestration_requests request
      ON request.orchestration_request_id = route.orchestration_request_id
    WHERE route.route_id = ? AND route.kind = 'repair'
  `).get(routeId);
  return {
    repairRequestId: readString(value, "repair_request_id"),
    sourceLoopId: readString(value, "source_loop_id"),
    targetLoopId: readString(value, "target_loop_id")
  };
};

const topFrame = (connection: Database.Database, rootRunId: string) => {
  const value = connection.prepare(`
    SELECT frame_id, callee_loop_run_id, nesting_depth FROM orchestration_frames
    WHERE root_run_id = ? AND status = 'open' ORDER BY nesting_depth DESC, created_at DESC, rowid DESC LIMIT 1
  `).get(rootRunId);
  return value ? {
    frameId: readString(value, "frame_id"),
    calleeLoopRunId: readString(value, "callee_loop_run_id"),
    nestingDepth: readNumber(value, "nesting_depth")
  } : undefined;
};

const readString = (value: unknown, key: string): string => {
  const field = fieldOf(value, key);
  if (typeof field === "string") return field;
  throw new Error(`Runtime database returned an invalid ${key} value.`);
};
const readNullableString = (value: unknown, key: string): string | undefined => {
  const field = fieldOf(value, key);
  if (field === null) return undefined;
  if (typeof field === "string") return field;
  throw new Error(`Runtime database returned an invalid ${key} value.`);
};
const readNumber = (value: unknown, key: string): number => {
  const field = fieldOf(value, key);
  if (typeof field === "number" && Number.isSafeInteger(field)) return field;
  throw new Error(`Runtime database returned an invalid ${key} value.`);
};
const fieldOf = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && key in value ? Reflect.get(value, key) : undefined;
