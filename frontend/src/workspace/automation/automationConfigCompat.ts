import { defaultProjectAutomationConfig, type ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import {
  defaultActionOutputIds,
  humanGateResponseId,
  normalizeActionToken,
  normalizeLoopId
} from "@shared/policy-actions";

export const ensureAutomationConfig = (config: ProjectAutomationConfig | undefined): ProjectAutomationConfig => {
  const defaults = defaultProjectAutomationConfig();
  const configWithoutLegacy = { ...(config ?? {}) } as ProjectAutomationConfig & {
    triggers?: unknown;
    gates?: unknown;
    gateDecisions?: unknown;
    policies?: unknown;
    outputs?: unknown;
  };
  delete configWithoutLegacy.triggers;
  delete configWithoutLegacy.gates;
  delete configWithoutLegacy.gateDecisions;
  delete configWithoutLegacy.policies;
  delete configWithoutLegacy.outputs;

  const actions = Array.isArray(config?.actions)
    ? config.actions.flatMap((action) => {
      const id = normalizeActionToken(action.id);
      if (!id) return [];
      const humanGate = action.humanGate === true;
      const agentId = !humanGate && typeof action.agentId === "string" && action.agentId.trim() ? action.agentId.trim() : undefined;
      return [{
        id,
        description: typeof action.description === "string" ? action.description : "",
        ...(agentId ? { agentId } : {}),
        ...(humanGate ? { humanGate: true } : {})
      }];
    })
    : defaults.actions;

  return {
    ...defaults,
    ...configWithoutLegacy,
    actions,
    outputRoutes: normalizeOutputRoutes(config?.outputRoutes),
    humanGateResponses: normalizeHumanGateResponses(config?.humanGateResponses),
    loops: normalizeLoops(config?.loops),
    runtimes: Array.isArray(config?.runtimes) ? config.runtimes : defaults.runtimes
  };
};

const normalizeLoops = (rawLoops: unknown): ProjectAutomationConfig["loops"] =>
  Array.isArray(rawLoops)
    ? rawLoops.flatMap((loop) => {
      if (!loop || typeof loop !== "object" || Array.isArray(loop)) return [];
      const record = loop as Record<string, unknown>;
      const id = typeof record.id === "string" ? normalizeLoopId(record.id) : "";
      const steps = Array.isArray(record.steps)
        ? record.steps.filter((step): step is string => typeof step === "string").map(normalizeActionToken).filter(Boolean)
        : [];
      return id ? [{ id, steps }] : [];
    })
    : [];

const normalizeOutputRoutes = (rawRoutes: unknown): ProjectAutomationConfig["outputRoutes"] =>
  Array.isArray(rawRoutes)
    ? rawRoutes.flatMap((route) => {
      if (!route || typeof route !== "object" || Array.isArray(route)) return [];
      const record = route as Record<string, unknown>;
      const sourceLoopId = typeof record.sourceLoopId === "string" ? normalizeLoopId(record.sourceLoopId) : "";
      const sourceActionId = typeof record.sourceActionId === "string" ? normalizeActionToken(record.sourceActionId) : "";
      const outputId = typeof record.outputId === "string" ? normalizeActionToken(record.outputId) : "";
      const targetLoopId = typeof record.targetLoopId === "string" ? normalizeLoopId(record.targetLoopId) : "";
      const targetActionId = typeof record.targetActionId === "string" ? normalizeActionToken(record.targetActionId) : "";
      return sourceLoopId && sourceActionId && targetLoopId && targetActionId && defaultActionOutputIds.some((id) => id === outputId)
        ? [{ sourceLoopId, sourceActionId, outputId, targetLoopId, targetActionId }]
        : [];
    })
    : [];

const normalizeHumanGateResponses = (rawResponses: unknown): ProjectAutomationConfig["humanGateResponses"] =>
  Array.isArray(rawResponses)
    ? rawResponses.flatMap((response) => {
      if (!response || typeof response !== "object" || Array.isArray(response)) return [];
      const record = response as Record<string, unknown>;
      const loopId = typeof record.loopId === "string" ? normalizeLoopId(record.loopId) : "";
      const actionId = typeof record.actionId === "string" ? normalizeActionToken(record.actionId) : "";
      const outputId = typeof record.outputId === "string" ? normalizeActionToken(record.outputId) : "";
      if (!loopId || !actionId || !defaultActionOutputIds.some((id) => id === outputId)) return [];
      const base = {
        loopId,
        actionId,
        outputId,
        prompt: typeof record.prompt === "string" ? record.prompt : "",
        submittedAt: typeof record.submittedAt === "string" ? record.submittedAt : ""
      };
      return [{ ...base, id: typeof record.id === "string" ? record.id : humanGateResponseId(base) }];
    })
    : [];
