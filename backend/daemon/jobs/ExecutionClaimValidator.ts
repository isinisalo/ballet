import type { ExecutionSpec, RuntimeProvider } from "../../../shared/domain/runtime.js";
import type { ClaimedExecutionTask } from "../transport/DaemonControlPlane.js";

export const validateExecutionClaim = (
  claim: ClaimedExecutionTask,
  deviceId: string,
  runtimeBackends: ReadonlyArray<{ id: string; provider: RuntimeProvider }>
): ExecutionSpec => {
  const { task } = claim;
  const spec = task.spec;
  if (task.deviceId !== deviceId || spec.runtime.deviceId !== deviceId) {
    throw new Error("Execution task belongs to another runtime device.");
  }
  if (task.projectId !== spec.projectId) throw new Error("Execution task project does not match its immutable specification.");
  if (task.id !== spec.taskId || task.kind !== spec.kind || task.rootRunId !== spec.rootRunId) {
    throw new Error("Execution task identity does not match its immutable specification.");
  }
  if (task.runtimeBackendId !== spec.runtime.runtimeBackendId) {
    throw new Error("Execution task backend does not match its immutable specification.");
  }
  const provider = runtimeBackends.find((backend) => backend.id === task.runtimeBackendId)?.provider;
  if (!provider || provider !== spec.runtime.provider) {
    throw new Error("Execution task provider does not match the configured runtime backend.");
  }
  verifyLease(claim);
  return spec;
};

const verifyLease = (claim: ClaimedExecutionTask): void => {
  if (!claim.taskToken || claim.taskToken.length < 32) throw new Error("Execution claim is missing a scoped task token.");
  if (!Number.isInteger(claim.task.fencing) || claim.task.fencing < 1) throw new Error("Execution claim has an invalid fencing token.");
  if (!Number.isInteger(claim.leaseDurationMs) || claim.leaseDurationMs < 1_000 || claim.leaseDurationMs > 86_400_000
    || !Number.isInteger(claim.renewAfterMs) || claim.renewAfterMs < 250 || claim.renewAfterMs >= claim.leaseDurationMs) {
    throw new Error("Execution claim has invalid lease timing metadata.");
  }
  if (!claim.task.leaseUntil || Number.isNaN(Date.parse(claim.task.leaseUntil))) {
    throw new Error("Execution claim is missing a valid lease deadline.");
  }
};
