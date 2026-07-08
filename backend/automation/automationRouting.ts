import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig, RouteDecision } from "../../shared/domain/automation.js";
import type { EventRecord } from "../../shared/domain/events.js";
import {
  actionOutputEventType,
  actionRouteId,
  eventTypeFromLoopId,
  normalizeActionToken
} from "../../shared/policy-actions.js";

const actionVersion = () => 1;

export const routeAutomationEvent = (
  event: EventRecord,
  config: ProjectAutomationConfig,
  agents: Agent[]
): RouteDecision[] => {
  const actionById = new Map(config.actions.map((action) => [action.id, action]));
  const decisions: RouteDecision[] = [];
  const seen = new Set<string>();

  const addActionRoute = (loopId: string, actionId: string, reason: string) => {
    const normalizedActionId = normalizeActionToken(actionId);
    const action = actionById.get(normalizedActionId);
    if (!action) return;
    const routeId = actionRouteId(loopId, normalizedActionId);
    if (action.humanGate) {
      const key = `${routeId}:human-gate`;
      if (!seen.has(key)) {
        seen.add(key);
        decisions.push({
          actionId: normalizedActionId,
          loopId,
          routeId,
          actionVersion: actionVersion(),
          targetAgentId: "human",
          status: "skipped",
          reason: `Action "${normalizedActionId}" is a human gate and waits for operator input.`
        });
      }
      return;
    }

    if (action.agentIds.length === 0) {
      const key = `${routeId}:no-agent`;
      if (!seen.has(key)) {
        seen.add(key);
        decisions.push({
          actionId: normalizedActionId,
          loopId,
          routeId,
          actionVersion: actionVersion(),
          targetAgentId: "",
          status: "skipped",
          reason: `Action "${normalizedActionId}" has no agents.`
        });
      }
      return;
    }

    action.agentIds.forEach((targetAgentId) => {
      const key = `${routeId}:${targetAgentId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const agent = agents.find((candidate) => candidate.id === targetAgentId);
      if (!agent?.enabled) {
        decisions.push({
          actionId: normalizedActionId,
          loopId,
          routeId,
          actionVersion: actionVersion(),
          targetAgentId,
          status: "skipped",
          reason: `Action "${normalizedActionId}" matched, but target agent ${targetAgentId} is disabled or missing.`
        });
        return;
      }
      decisions.push({
        actionId: normalizedActionId,
        loopId,
        routeId,
        actionVersion: actionVersion(),
        targetAgentId,
        status: "routed",
        reason: `${reason} Routed action "${normalizedActionId}" to ${agent.name}.`
      });
    });
  };

  config.loops.forEach((loop) => {
    if (eventTypeFromLoopId(loop.id) !== event.eventType) return;
    const firstActionId = loop.steps[0];
    if (firstActionId) addActionRoute(loop.id, firstActionId, `Event ${event.eventType} started loop ${loop.id}.`);
  });

  config.outputRoutes.forEach((route) => {
    const outputEventType = actionOutputEventType(
      { loopId: route.sourceLoopId, actionId: route.sourceActionId },
      route.outputId
    );
    if (outputEventType !== event.eventType) return;
    addActionRoute(
      route.targetLoopId,
      route.targetActionId,
      `Output ${route.sourceLoopId}/${route.sourceActionId}.${route.outputId} selected target loop ${route.targetLoopId}.`
    );
  });

  return decisions;
};
