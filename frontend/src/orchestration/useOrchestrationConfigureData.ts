import type { RouteState } from "@/workspace/types";
import type { InvalidationEvent } from "@shared/orchestration/httpContracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { orchestrationApi } from "./orchestrationApi";
import type { OrchestrationConfigureData } from "./types";

export function useOrchestrationConfigureData(route: RouteState) {
  const [data, setData] = useState<OrchestrationConfigureData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const sequence = useRef(0);
  const refresh = useCallback(async (events?: InvalidationEvent[]) => {
    if (events && !events.some(({ kind }) => ["project_changed", "run_changed"].includes(kind))) return;
    const requestSequence = ++sequence.current;
    try {
      const view = route.workspaceView;
      const [project, references] = await Promise.all([
        orchestrationApi.project(),
        view === "skills" || view === "instructions" ? orchestrationApi.references()
          : orchestrationApi.environment().then(({ activeRunIds }) => ({ activeRunIds, entries: [], runReferences: [] }))
      ]);
      const resource = (name: Parameters<typeof orchestrationApi.resources>[0], needed: boolean) => needed ? orchestrationApi.resources(name) : [];
      const [instructions, skills, goals, adrs, constraints, useCases, agents] = await Promise.all([
        resource("instructions", view === "instructions"),
        resource("skills", ["skills", "action", "agents"].includes(String(view))),
        resource("goals", view === "goals"), resource("adrs", view === "adrs"),
        resource("constraints", view === "constraints"), resource("use-cases", view === "use-cases"),
        view === "agents" ? orchestrationApi.agents() : { configHash: project.configHash, agents: [] }
      ]);
      const schedules: OrchestrationConfigureData["schedules"] = [];
      if (requestSequence !== sequence.current) return;
      setData({ project, references, instructions, skills, goals, adrs, constraints, useCases, agents, schedules }); setError(undefined);
    } catch (reason) {
      if (requestSequence === sequence.current) setError(toErrorMessage(reason, "Unable to load orchestration workspace."));
    } finally { if (requestSequence === sequence.current) setLoading(false); }
  }, [route.workspaceView]);
  useEffect(() => { setLoading(true); void refresh(); return () => { sequence.current++; }; }, [refresh]);
  return { data, loading, error, refresh };
}
