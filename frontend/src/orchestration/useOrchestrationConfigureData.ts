import { useCallback, useEffect, useRef, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { orchestrationApi } from "./orchestrationApi";
import type { OrchestrationConfigureData } from "./types";

export function useOrchestrationConfigureData() {
  const [data, setData] = useState<OrchestrationConfigureData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const requestSequence = ++sequence.current;
    try {
      const [project, references, instructions, skills, goals, adrs, constraints, useCases, agents, schedules] = await Promise.all([
        orchestrationApi.project(), orchestrationApi.references(), orchestrationApi.resources("instructions"),
        orchestrationApi.resources("skills"), orchestrationApi.resources("goals"), orchestrationApi.resources("adrs"),
        orchestrationApi.resources("constraints"), orchestrationApi.resources("use-cases"), orchestrationApi.agents(), orchestrationApi.schedules()
      ]);
      if (requestSequence !== sequence.current) return;
      setData({ project, references, instructions, skills, goals, adrs, constraints, useCases, agents, schedules }); setError(undefined);
    } catch (reason) {
      if (requestSequence === sequence.current) setError(toErrorMessage(reason, "Unable to load orchestration workspace."));
    } finally { if (requestSequence === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
