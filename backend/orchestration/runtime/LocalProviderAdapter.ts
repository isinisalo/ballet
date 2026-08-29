import type { ExecutionProfile } from "../../../shared/orchestration/environment.js";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import type { RuntimeCapabilitySnapshot } from "../../../shared/orchestration/runtime.js";
import type { LocalRuntimeService } from "../../execution/LocalRuntimeService.js";
import type { RuntimePermissionPolicy } from "../../execution/providers/CliRuntimeAdapter.js";
import {
  authorizeProviderPath, authorizeProviderReadPath, type ProviderPermissionSpec
} from "./ProviderPermissions.js";
import type { OrchestrationProviderPreflightPort } from "./EnvironmentRunPlanner.js";
import type { ProviderTerminal, OrchestrationRuntimeProvider } from "./RuntimeProvider.js";
import type { ExecutionSpecV12 } from "../../../shared/orchestration/execution.js";

export class LocalProviderAdapter implements OrchestrationRuntimeProvider, OrchestrationProviderPreflightPort {
  constructor(private readonly runtime: LocalRuntimeService) {}

  async inspect(profile: ExecutionProfile): Promise<RuntimeCapabilitySnapshot> {
    const status = this.runtime.providerStatus(profile.provider);
    if (status.health !== "ready" || !status.cliVersion) throw new Error(status.healthMessage ?? `${profile.provider} is unavailable.`);
    const supportedModels = status.capabilities.models.map(({ id }) => id).sort();
    if (profile.model === "provider-default") supportedModels.push("provider-default");
    if (!supportedModels.includes(profile.model) && profile.model !== "provider-default") {
      throw new Error(`Model ${profile.model} is unavailable.`);
    }
    const supportedReasoningEfforts = [...new Set(status.capabilities.models.flatMap(({ reasoningOptions }) => reasoningOptions))].sort();
    if (profile.reasoningEffort === "provider-default") supportedReasoningEfforts.push("provider-default");
    const content = {
      executionProfileId: profile.id, provider: profile.provider, cliVersion: status.cliVersion,
      supportedModels, supportedReasoningEfforts, supportsReadOnly: true,
      supportsWorkspaceWrite: status.capabilities.policy.workspaceWrite
    };
    return { ...content, capabilitySha256: hash(content) };
  }

  async execute(spec: ExecutionSpecV12, permissions: ProviderPermissionSpec): Promise<ProviderTerminal> {
    if (permissions.approvalPolicy !== "never" || permissions.provider !== spec.runtime.provider) {
      throw new Error("orchestration provider permission snapshot differs from the ExecutionSpec.");
    }
    const adapter = this.runtime.adapter(spec.runtime.provider);
    let output: string | undefined;
    try {
      for await (const event of adapter.execute({
        executionId: spec.taskId, prompt: spec.evidence.prompt,
        workingDirectory: spec.project.checkoutRoot, model: spec.runtime.model,
        reasoning: spec.runtime.reasoningEffort,
        policy: { network: permissions.networkAccess, readOnlyRoots: [] },
        workspaceAccess: permissions.sandbox,
        permissionPolicy: permissionPolicy(permissions)
      })) {
        if (event.type === "execution.completed") output = event.output;
        if (event.type === "execution.failed") throw new Error(event.message);
      }
      if (!output) throw new Error("Provider completed without structured output text.");
      return { kind: "output", providerOutcomeKey: `${spec.runtime.provider}:${spec.taskId}`, raw: output };
    } catch (error) {
      return { kind: "failure", providerOutcomeKey: `${spec.runtime.provider}:${spec.taskId}`,
        errorMessage: error instanceof Error ? error.message : String(error) };
    }
  }

  async cancel(taskId: string, reason: string): Promise<void> {
    await Promise.allSettled([
      this.runtime.adapter("codex").cancel(taskId, reason),
      this.runtime.adapter("copilot").cancel(taskId, reason)
    ]);
  }
}

const permissionPolicy = (permissions: ProviderPermissionSpec): RuntimePermissionPolicy => ({
  authorize: (request) => request.kind === "network" ? permissions.networkAccess
    : request.kind === "read" && request.path ? authorizeProviderReadPath(permissions, request.path)
      : request.path ? authorizeProviderPath(permissions, request.path, () => undefined) : false
});
const hash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value)) as JsonValue));
