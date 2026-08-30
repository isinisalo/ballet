import { useEffect, useState } from "react";
import type { LocalDaemonStatus } from "@shared/domain/runtime";
import type { ActionResponse } from "../types";
import { orchestrationApi } from "../orchestrationApi";
import { authoringModels } from "./agentModelPolicy";

export function useActionAgents(stateId: string, actionId: string) {
  const [details, setDetails] = useState<ActionResponse>(); const [runtime, setRuntime] = useState<LocalDaemonStatus>();
  const [error, setError] = useState(""); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!stateId || !actionId) { setLoaded(true); return; }
    let active = true;
    void Promise.all([orchestrationApi.action(stateId, actionId), orchestrationApi.localRuntime()])
      .then(([nextDetails, nextRuntime]) => { if (!active) return; setDetails(nextDetails); setRuntime(nextRuntime); setLoaded(true); })
      .catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : "Action Agent load failed."); setLoaded(true); } });
    return () => { active = false; };
  }, [actionId, stateId]);
  const provider = runtime?.providers[0]; const models = authoringModels(provider?.capabilities.models ?? []);
  const readinessIssues: string[] = [];
  if (loaded && !details) readinessIssues.push(error || "Action Agent definitions are unavailable.");
  if (loaded && runtime?.status !== "online") readinessIssues.push(`Local Codex runtime is ${runtime?.status ?? "unavailable"}.`);
  if (loaded && provider?.health !== "ready") readinessIssues.push(provider?.healthMessage ?? "A ready Codex runtime is required.");
  if (loaded && provider && !provider.capabilities.policy.workspaceWrite) readinessIssues.push("Codex cannot provide managed workspace-write for Work.");
  return { details, runtime, models, loaded, error, readinessIssues };
}
