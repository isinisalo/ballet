import { useCallback, useEffect, useState } from "react";
import type { AppData } from "backend/shared/domain";
import type { FlowViewModel, WorkspaceValidationResult } from "backend/shared/flow";
import { api } from "@/api";

const emptyData: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [],
  skills: [],
  runtimes: [],
  contracts: [],
  operations: [],
  policies: [],
  emissionPolicies: [],
  loopDefinitions: [],
  loopInstances: [],
  eventDefinitions: [],
  events: [],
  agentRuns: [],
  projectDocumentTree: []
};

export function useWorkspaceData() {
  const [data, setData] = useState<AppData>(emptyData);
  const [flows, setFlows] = useState<FlowViewModel[]>([]);
  const [validation, setValidation] = useState<WorkspaceValidationResult | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextData, nextFlows, nextValidation] = await Promise.all([
        api.getData(),
        api.getFlows(),
        api.getWorkspaceValidation()
      ]);
      setData(nextData);
      setFlows(nextFlows);
      setValidation(nextValidation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Ballet workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const source = new EventSource("/api/runtime/stream");
    const handleChange = () => void refresh();
    source.addEventListener("change", handleChange);
    source.onerror = () => source.close();
    return () => {
      source.removeEventListener("change", handleChange);
      source.close();
    };
  }, [refresh]);

  return {
    data,
    flows,
    validation,
    loading,
    error,
    refresh
  };
}
