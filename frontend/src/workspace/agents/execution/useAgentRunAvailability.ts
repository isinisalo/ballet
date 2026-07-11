import { useEffect, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { backendReadiness } from "../../runtimes/runtimeRegistry";
import { agentExecutionApi } from "./agentExecutionApi";
import { executionFormError, formFromBinding } from "./executionOptions";

export function useAgentRunAvailability(agentId: string, enabled = true) {
  const [reason, setReason] = useState<string | undefined>(enabled ? "Checking execution binding…" : undefined);

  useEffect(() => {
    if (!enabled) { setReason(undefined); return; }
    let disposed = false;
    Promise.all([agentExecutionApi.getBinding(agentId), agentExecutionApi.listDevices()]).then(([binding, devices]) => {
      if (disposed) return;
      if (!binding) { setReason("Save an execution binding before starting a run."); return; }
      const bindingError = executionFormError(formFromBinding(binding), devices);
      if (bindingError) { setReason(bindingError); return; }
      const device = devices.find((candidate) => candidate.id === binding.deviceId);
      const backend = device?.backends.find((candidate) => candidate.id === binding.runtimeBackendId);
      if (!device || !backend) { setReason("The bound runtime is no longer available."); return; }
      if (device.projectId !== binding.projectId) { setReason("The bound computer belongs to another project."); return; }
      const readiness = backendReadiness(device, backend);
      if (!readiness.runnable) { setReason(`${backend.provider} runtime is ${readiness.label.toLowerCase()}.`); return; }
      if (!device.checkout) { setReason("The computer has no checkout for the active project."); return; }
      if (device.checkout.projectId !== binding.projectId) { setReason("The computer checkout belongs to another project."); return; }
      if (device.checkout.dirty) { setReason("Commit or discard checkout changes before starting a run."); return; }
      if (!device.checkout.headSha || !device.checkout.configHash) { setReason("The runtime checkout has not reported an immutable project snapshot."); return; }
      setReason(undefined);
    }).catch((caught) => {
      if (!disposed) setReason(toErrorMessage(caught, "Unable to verify execution readiness."));
    });
    return () => { disposed = true; };
  }, [agentId, enabled]);

  return reason;
}
