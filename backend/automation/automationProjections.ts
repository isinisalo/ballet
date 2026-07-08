import type {
  ProjectAction,
  ProjectLoop,
  ProjectOutputRoute
} from "../../shared/domain/automation.js";
import type { EventDefinition } from "../../shared/domain/events.js";
import type { ProjectRuntime, Runtime } from "../../shared/domain/runtime.js";
import {
  actionEventTypes,
  actionOutputEventTypes
} from "../../shared/policy-actions.js";

const timestamp = "1970-01-01T00:00:00.000Z";

export const automationActionsToEventDefinitions = (
  actions: ProjectAction[] = [],
  outputs: Array<{ id: string }> = [],
  outputRoutes: ProjectOutputRoute[] = [],
  loops: ProjectLoop[] = []
): EventDefinition[] =>
  [...new Set([
    ...actionEventTypes(actions, outputs, loops, outputRoutes),
    ...loops.flatMap((loop) => loop.steps.flatMap((actionId) =>
      actionOutputEventTypes({ loopId: loop.id, actionId }, actions, outputs)
    ))
  ])]
    .map((eventType) => ({
      id: eventType,
      name: eventType,
      description: "Generated automation action event.",
      active: true,
      eventType,
      source: "automation",
      tags: [],
      producers: [],
      payloadExample: {},
      createdAt: timestamp,
      updatedAt: timestamp
    }));

export const automationRuntimesToRuntimes = (runtimes: ProjectRuntime[]): Runtime[] =>
  runtimes.map((runtime) => ({
    id: runtime.id,
    name: runtime.title,
    type: runtime.command === "codex" ? "codex-cli" : "custom",
    command: [runtime.command, ...runtime.args].join(" ").trim(),
    config: {
      args: JSON.stringify(runtime.args)
    },
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp
  }));
