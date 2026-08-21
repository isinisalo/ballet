import type { z } from "zod";
import { getReachableProjectLoopGraph } from "../domain/automation.js";
import type { ProjectConfiguration } from "../domain/projectConfig.js";

export const validateProjectConfigSchema = (
  config: ProjectConfiguration,
  context: z.RefinementCtx
): void => {
  const loopIds = uniqueIds(config.loops, "loop", "loops", context);
  const profileIds = uniqueIds(config.executionProfiles, "execution profile", "executionProfiles", context);
  const repairRouter = config.orchestrator.repairRouter;
  if (repairRouter && !profileIds.has(repairRouter.executionProfileId)) context.addIssue({
    code: "custom",
    path: ["orchestrator", "repairRouter", "executionProfileId"],
    message: `Repair router references unknown execution profile: ${repairRouter.executionProfileId}.`
  });
  if (config.graph.repairEdges.length > 0 && !repairRouter) context.addIssue({
    code: "custom",
    path: ["orchestrator", "repairRouter"],
    message: "A repairRouter is required when the graph contains Repair Edges."
  });
  if (config.issueTracker.orchestrationDirectory === config.issueTracker.workDirectory) context.addIssue({
    code: "custom",
    path: ["issueTracker", "workDirectory"],
    message: "Orchestration and work ticket stores must use different directories."
  });

  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>();
  config.loops.forEach((loop, loopIndex) => {
    loop.workflow.jobNodes.forEach((node, nodeIndex) => {
      addDuplicateIssue(nodeIds, node.id, ["loops", loopIndex, "workflow", "jobNodes", nodeIndex, "id"], "node", context);
      if (node.type !== "human" && !profileIds.has(node.executionProfileId)) context.addIssue({
        code: "custom",
        path: ["loops", loopIndex, "workflow", "jobNodes", nodeIndex, "executionProfileId"],
        message: `JobNode references unknown execution profile: ${node.executionProfileId}.`
      });
    });
    loop.workflow.validationNodes.forEach((node, nodeIndex) => {
      addDuplicateIssue(nodeIds, node.id, ["loops", loopIndex, "workflow", "validationNodes", nodeIndex, "id"], "node", context);
      if (node.type !== "human" && !profileIds.has(node.executionProfileId)) context.addIssue({
        code: "custom",
        path: ["loops", loopIndex, "workflow", "validationNodes", nodeIndex, "executionProfileId"],
        message: `ValidationNode references unknown execution profile: ${node.executionProfileId}.`
      });
    });
    loop.workflow.passEdges.forEach((edge, edgeIndex) =>
      addDuplicateIssue(edgeIds, edge.id, ["loops", loopIndex, "workflow", "passEdges", edgeIndex, "id"], "edge", context));
    loop.workflow.failEdges.forEach((edge, edgeIndex) =>
      addDuplicateIssue(edgeIds, edge.id, ["loops", loopIndex, "workflow", "failEdges", edgeIndex, "id"], "edge", context));
  });

  if (config.loops.length > 0 && !loopIds.has(config.graph.startLoopId)) context.addIssue({
    code: "custom",
    path: ["graph", "startLoopId"],
    message: `Graph startLoopId references an unknown Loop: ${config.graph.startLoopId}.`
  });

  const routeKeys = new Set<string>();
  config.graph.transitions.forEach((transition, index) => {
    const path = ["graph", "transitions", index] as const;
    addDuplicateIssue(edgeIds, transition.id, [...path, "id"], "edge", context);
    if (!loopIds.has(transition.source)) context.addIssue({
      code: "custom", path: [...path, "source"], message: `Transition references an unknown source Loop: ${transition.source}.`
    });
    if ("loopId" in transition.target && !loopIds.has(transition.target.loopId)) context.addIssue({
      code: "custom", path: [...path, "target", "loopId"], message: `Transition references an unknown target Loop: ${transition.target.loopId}.`
    });
    const key = `${transition.source}\u0000${transition.decision}\u0000${transition.outcome}`;
    if (routeKeys.has(key)) context.addIssue({
      code: "custom", path: [...path, "outcome"], message: "Duplicate RunBook transition key."
    });
    routeKeys.add(key);
  });

  config.graph.repairEdges.forEach((edge, index) => {
    const path = ["graph", "repairEdges", index] as const;
    addDuplicateIssue(edgeIds, edge.id, [...path, "id"], "edge", context);
    if (!loopIds.has(edge.source)) context.addIssue({
      code: "custom", path: [...path, "source"], message: `Repair Edge references an unknown source Loop: ${edge.source}.`
    });
    const target = config.loops.find((loop) => loop.id === edge.target);
    if (!target) context.addIssue({
      code: "custom", path: [...path, "target"], message: `Repair Edge references an unknown target Loop: ${edge.target}.`
    });
    if (target && !target.capabilities.provides.includes(edge.capability)) context.addIssue({
      code: "custom", path: [...path, "capability"],
      message: `Repair Edge capability ${edge.capability} is not provided by target Loop ${edge.target}.`
    });
  });

  if (loopIds.has(config.graph.startLoopId)) {
    const reachable = getReachableProjectLoopGraph(
      config,
      config.graph.startLoopId,
      repairRouter?.maxRepairDepth ?? 0
    ).loopIds;
    config.loops.forEach((loop, index) => {
      if (!reachable.has(loop.id)) context.addIssue({
        code: "custom",
        path: ["loops", index, "id"],
        message: `Loop is unreachable from graph.startLoopId: ${loop.id}.`
      });
    });
    if (!config.graph.transitions.some((transition) =>
      reachable.has(transition.source) && "runResult" in transition.target && transition.target.runResult === "DONE")) {
      context.addIssue({
        code: "custom",
        path: ["graph", "transitions"],
        message: "Graph must contain a reachable DONE transition."
      });
    }
  }
};

const uniqueIds = (
  entries: Array<{ id: string }>,
  label: string,
  path: string,
  context: z.RefinementCtx
): Set<string> => {
  const ids = new Set<string>();
  entries.forEach((entry, index) => addDuplicateIssue(ids, entry.id, [path, index, "id"], label, context));
  return ids;
};

const addDuplicateIssue = (
  ids: Set<string>,
  id: string,
  path: Array<string | number>,
  label: string,
  context: z.RefinementCtx
): void => {
  if (ids.has(id)) context.addIssue({ code: "custom", path, message: `Duplicate ${label} id: ${id}.` });
  ids.add(id);
};
