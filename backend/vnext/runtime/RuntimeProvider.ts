import type { ExecutionSpecV12 } from "../../../shared/vnext/execution.js";
import type { ProviderPermissionSpec } from "./ProviderPermissions.js";

export type ProviderTerminal =
  | { kind: "output"; providerOutcomeKey: string; raw: string }
  | { kind: "failure"; providerOutcomeKey: string; errorMessage: string };

export interface VNextRuntimeProvider {
  execute(spec: ExecutionSpecV12, permissions: ProviderPermissionSpec): Promise<ProviderTerminal>;
}

export class ScriptedRuntimeProvider implements VNextRuntimeProvider {
  readonly calls: Array<{ spec: ExecutionSpecV12; permissions: ProviderPermissionSpec }> = [];
  constructor(private readonly script: ProviderTerminal[]) {}

  async execute(spec: ExecutionSpecV12, permissions: ProviderPermissionSpec): Promise<ProviderTerminal> {
    this.calls.push({ spec, permissions });
    const result = this.script.shift();
    if (!result) throw new Error(`No scripted provider result for ${spec.taskId}.`);
    return result;
  }
}
