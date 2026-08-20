import { z } from "zod";
import { statePatchSchema } from "../../shared/api/runtime-schemas.js";
import type {
  RootRunOrchestrationProjection, RootRunRepairProjection, RootRunStateProjection
} from "../../shared/domain/runs.js";
import {
  maxReadStatePatchEvidenceBytes, maxReadStateRevisionMetadata
} from "../../shared/domain/runtime.js";
import type { ControlFlowEvent } from "../../shared/domain/runtime.js";
import type { ControlFlowStore } from "./ControlFlowStore.js";
import type { LoopStateStore } from "./LoopStateStore.js";
import type { OrchestrationStore } from "./OrchestrationStore.js";
import type { RepairResultStore } from "./RepairResultStore.js";
import type { RepairStore } from "./RepairStore.js";
import { canonicalJson } from "./state/CanonicalJson.js";
import { statePatchSha256 } from "./state/StatePatch.js";
import type Database from "better-sqlite3";

const nullableString = z.string().nullable();
const stateMetadataRowSchema = z.object({
  root_run_id: z.string(),
  revision: z.number().int().nonnegative(),
  parent_revision: z.number().int().nonnegative().nullable(),
  state_hash: z.string().regex(/^[a-f0-9]{64}$/),
  patch_json: nullableString,
  patch_hash: nullableString,
  source_node_run_id: nullableString,
  created_at: z.string()
}).strict().refine((row) => (row.patch_json === null) === (row.patch_hash === null), {
  message: "State revision patch JSON and hash must be present together."
});
const countRowSchema = z.object({ count: z.number().int().nonnegative() }).strict();

export interface RootRuntimeReadProjection {
  state: RootRunStateProjection;
  orchestration: RootRunOrchestrationProjection;
  repair: RootRunRepairProjection;
  controlFlowEvents: ControlFlowEvent[];
}

export class RootRuntimeReadStore {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly states: LoopStateStore,
    private readonly orchestration: OrchestrationStore,
    private readonly repairs: RepairStore,
    private readonly repairResults: RepairResultStore,
    private readonly control: ControlFlowStore
  ) {}

  read(rootRunId: string): RootRuntimeReadProjection {
    return {
      state: this.stateProjection(rootRunId),
      orchestration: this.orchestrationProjection(rootRunId),
      repair: this.repairProjection(rootRunId),
      controlFlowEvents: this.control.listByRoot(rootRunId)
    };
  }

  orchestrationProjection(rootRunId: string): RootRunOrchestrationProjection {
    const requests = this.orchestration.list(rootRunId);
    const routes = this.orchestration.listRoutes(rootRunId);
    const pendingRequest = requests.filter(({ status }) =>
      ["pending", "waiting_for_input", "routed"].includes(status)).at(-1);
    const focus = pendingRequest ?? requests.at(-1);
    return {
      requests,
      routes,
      pendingRequest,
      selectedRoute: focus
        ? routes.find(({ orchestrationRequestId }) =>
          orchestrationRequestId === focus.orchestrationRequestId)
        : routes.at(-1)
    };
  }

  stateProjection(rootRunId: string): RootRunStateProjection {
    const current = this.states.current(rootRunId);
    const { count } = countRowSchema.parse(this.connection().prepare(`
      SELECT COUNT(*) AS count FROM state_revisions WHERE root_run_id = ?
    `).get(rootRunId));
    const rows = this.connection().prepare(`
      SELECT root_run_id, revision, parent_revision, state_hash, patch_json,
        patch_hash, source_node_run_id, created_at
      FROM state_revisions WHERE root_run_id = ? ORDER BY revision DESC LIMIT ?
    `).all(rootRunId, maxReadStateRevisionMetadata).map((row) => stateMetadataRowSchema.parse(row));
    let remainingPatchBytes = maxReadStatePatchEvidenceBytes;
    const revisions = rows.map((row) => {
      const source = row.patch_json;
      const size = source === null ? 0 : Buffer.byteLength(source, "utf8");
      const includePatch = source !== null && size <= remainingPatchBytes;
      if (includePatch) remainingPatchBytes -= size;
      const patch = includePatch ? parsePatchEvidence(source, row.patch_hash, rootRunId, row.revision) : undefined;
      return {
        rootRunId: row.root_run_id,
        revision: row.revision,
        parentRevision: row.parent_revision ?? undefined,
        stateSha256: row.state_hash,
        sourceNodeRunId: row.source_node_run_id ?? undefined,
        patch,
        patchOmitted: source !== null && !includePatch,
        createdAt: row.created_at
      };
    }).reverse();
    return {
      currentRevision: current.revision,
      currentState: current.state,
      currentStateSha256: current.stateSha256,
      revisions,
      totalRevisionCount: count,
      historyTruncated: count > revisions.length
    };
  }

  repairProjection(rootRunId: string): RootRunRepairProjection {
    const requests = this.repairs.listRequests(rootRunId);
    const routes = this.orchestration.listRoutes(rootRunId).filter((route) => route.kind === "repair");
    const continuations = this.repairs.listFrames(rootRunId);
    const activeContinuationChain = continuations
      .filter(({ status }) => status === "open")
      .sort((left, right) => left.nestingDepth - right.nestingDepth);
    const pendingRepair = requests.filter(({ status }) => status === "pending" || status === "routed").at(-1);
    const focusRequest = pendingRepair ?? requests.at(-1);
    const routedTarget = focusRequest
      ? routes.find(({ repairRequestId }) => repairRequestId === focusRequest.repairRequestId)
      : routes.at(-1);
    const returnDestination = focusRequest ? {
      loopId: focusRequest.returnLoopId,
      jobNodeId: focusRequest.returnJobNodeId,
      validationNodeDefinitionId: focusRequest.returnValidationNodeDefinitionId
    } : undefined;
    return {
      requests,
      routes,
      continuations,
      results: this.repairResults.list(rootRunId),
      activeContinuationChain,
      pendingRepair,
      routedTarget,
      returnDestination
    };
  }
}

const parsePatchEvidence = (
  source: string,
  hash: string | null,
  rootRunId: string,
  revision: number
) => {
  if (!hash) throw new Error(`Root Run ${rootRunId} state revision ${revision} is missing its patch hash.`);
  let value: unknown;
  try { value = JSON.parse(source); }
  catch { throw new Error(`Root Run ${rootRunId} state revision ${revision} has invalid patch JSON.`); }
  const patch = statePatchSchema.parse(value);
  if (statePatchSha256(patch) !== hash) {
    throw new Error(`Root Run ${rootRunId} state revision ${revision} has invalid patch hash evidence.`);
  }
  // Serialize once here so the read budget and returned evidence use the same canonical bytes.
  if (Buffer.byteLength(canonicalJson(patch), "utf8") > maxReadStatePatchEvidenceBytes) {
    throw new Error(`Root Run ${rootRunId} state revision ${revision} exceeds the read patch evidence limit.`);
  }
  return { patch, patchSha256: hash };
};
