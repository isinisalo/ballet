import { useEffect, useState } from "react";
import type { AgentExecutionBinding, RuntimeDevice } from "@shared/domain/runtime";
import { orchestrationApi } from "../orchestrationApi";

export function useAgentExecutionProfile(agentId?: string) {
  const [devices, setDevices] = useState<RuntimeDevice[]>([]); const [binding, setBinding] = useState<AgentExecutionBinding | null>(null);
  const [deviceId, setDeviceId] = useState(""); const [backendId, setBackendId] = useState(""); const [model, setModel] = useState(""); const [reasoning, setReasoning] = useState("");
  const [network, setNetwork] = useState(false); const [readOnlyRoots, setReadOnlyRoots] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!agentId) return;
    let active = true;
    void Promise.all([orchestrationApi.runtimeDevices(), orchestrationApi.agentBinding(agentId)]).then(([nextDevices, nextBinding]) => {
      if (!active) return;
      setDevices(nextDevices); setBinding(nextBinding); setDeviceId(nextBinding?.deviceId ?? ""); setBackendId(nextBinding?.runtimeBackendId ?? ""); setModel(nextBinding?.model ?? ""); setReasoning(nextBinding?.reasoning ?? ""); setNetwork(nextBinding?.policy.network ?? false); setReadOnlyRoots(nextBinding?.policy.readOnlyRoots.join("\n") ?? "");
    }).catch((reason) => { if (active) setError(message(reason)); });
    return () => { active = false; };
  }, [agentId]);
  const device = devices.find(({ id }) => id === deviceId); const backends = device?.backends ?? []; const backend = backends.find(({ id }) => id === backendId);
  const models = backend?.capabilities.models ?? []; const modelCapability = models.find(({ id }) => id === model); const reasoningOptions = modelCapability?.reasoningOptions ?? [];
  const selectDevice = (id: string) => { setDeviceId(id); setBackendId(""); setModel(""); setReasoning(""); };
  const selectBackend = (id: string) => { const next = backends.find((item) => item.id === id); const first = next?.capabilities.models[0]; setBackendId(id); setModel(first?.id ?? ""); setReasoning(first?.defaultReasoning ?? first?.reasoningOptions[0] ?? "default"); };
  const save = async () => { if (!agentId || !backendId || !model || !reasoning) return; setPending(true); setError(""); try { setBinding(await orchestrationApi.saveAgentBinding(agentId, { runtimeBackendId: backendId, model, reasoning, policy: { network, readOnlyRoots: readOnlyRoots.split("\n").map((value) => value.trim()).filter(Boolean) } })); } catch (reason) { setError(message(reason)); } finally { setPending(false); } };
  return { devices, binding, deviceId, backendId, model, reasoning, network, readOnlyRoots, error, pending, backends, backend, models, reasoningOptions, selectDevice, selectBackend, setModel, setReasoning, setNetwork, setReadOnlyRoots, save, canSave: Boolean(agentId && backendId && model && reasoning) };
}

export type AgentExecutionProfileState = ReturnType<typeof useAgentExecutionProfile>;
const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Agent operation failed.";
