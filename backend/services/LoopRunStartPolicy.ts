import type { AppData } from "../../shared/api/workspace-contracts.js";
import { BLUEPRINT_LOOP_ID, GATED_LOOP_IDS } from "../../shared/domain/loopHandoff.js";
import { LoopRunStateError } from "../runtime/LoopRunErrors.js";

/**
 * Enforces the built-in linear engineering chain. Only the blueprint Loop is
 * a valid manual root; all downstream Loops must be created by a human-gate
 * cross-Loop transition.
 */
export const validateLoopRunStart = async (data: AppData, loopId: string, input?: string): Promise<void> => {
  void input;
  const loop = data.automation.loops.find((candidate) => candidate.id === loopId);
  if (!loop) return;
  if (loopId === BLUEPRINT_LOOP_ID) return;
  if ((GATED_LOOP_IDS as readonly string[]).includes(loopId)) {
    throw new LoopRunStateError(`${loopId} can only start from its approved human-gate transition.`);
  }
  throw new LoopRunStateError(`${loopId} is not a manual root in the engineering Loop chain.`);
};
