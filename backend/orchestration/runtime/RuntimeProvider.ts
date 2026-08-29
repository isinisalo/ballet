import type { ExecutionSpecV13 } from "../../../shared/orchestration/execution.js";
import type { ProviderPermissionSpec } from "./ProviderPermissions.js";

export type ProviderTerminal =
  | { kind: "output"; providerOutcomeKey: string; raw: string }
  | { kind: "failure"; providerOutcomeKey: string; errorMessage: string };

export interface OrchestrationRuntimeProvider {
  execute(spec: ExecutionSpecV13, permissions: ProviderPermissionSpec): Promise<ProviderTerminal>;
  cancel?(taskId: string, reason: string): Promise<void>;
}

export class ScriptedRuntimeProvider implements OrchestrationRuntimeProvider {
  readonly calls: Array<{ spec: ExecutionSpecV13; permissions: ProviderPermissionSpec }> = [];
  constructor(private readonly script: ProviderTerminal[]) {}

  async execute(spec: ExecutionSpecV13, permissions: ProviderPermissionSpec): Promise<ProviderTerminal> {
    this.calls.push({ spec, permissions });
    const result = this.script.shift();
    if (!result) throw new Error(`No scripted provider result for ${spec.taskId}.`);
    return result;
  }
}
