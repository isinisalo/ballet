import type { RunInvalidationBroadcaster } from "./RunInvalidationBroadcaster.js";

export interface RunInvalidationSources {
  subscribeRuntime: (listener: (signal: string) => void) => () => void;
  subscribeControlPlane: (listener: (type: string, payload: Record<string, unknown>) => void) => () => void;
}

export const bridgeRunInvalidations = (
  broadcaster: RunInvalidationBroadcaster,
  sources: RunInvalidationSources
): (() => void) => {
  const unsubscribeRuntime = sources.subscribeRuntime((signal) => {
    if (runtimeSignals.has(signal)) broadcaster.publish({ reason: signal });
  });
  const unsubscribeControlPlane = sources.subscribeControlPlane((type, payload) => {
    if (!controlPlaneEvents.has(type)) return;
    broadcaster.publish({
      reason: type,
      rootRunId: typeof payload.rootRunId === "string" ? payload.rootRunId : undefined
    });
  });
  return () => {
    unsubscribeRuntime();
    unsubscribeControlPlane();
  };
};

const runtimeSignals = new Set(["loop-runs", "automation", "health"]);
const controlPlaneEvents = new Set([
  "runtime_changed",
  "task_available",
  "task_state",
  "task_terminal",
  "task_cancel_requested",
  "root_finalize_requested",
  "root_finalized"
]);
