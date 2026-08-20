import type { z } from "zod";
import type { ProjectConfiguration } from "../domain/projectConfig.js";

export const validateProjectConfigSchema = (
  config: ProjectConfiguration,
  context: z.RefinementCtx
): void => {
  const loopIds = uniqueIds(config.loops, "loop", "loops", context);
  const profileIds = uniqueIds(config.executionProfiles, "execution profile", "executionProfiles", context);
  if (config.orchestrator.executionProfileId && !profileIds.has(config.orchestrator.executionProfileId)) context.addIssue({
    code: "custom",
    path: ["orchestrator", "executionProfileId"],
    message: `Orchestrator references unknown execution profile: ${config.orchestrator.executionProfileId}.`
  });

  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>();
  config.loops.forEach((loop, loopIndex) => {
    loop.workflow.jobNodes.forEach((node, nodeIndex) => {
      addDuplicateIssue(nodeIds, node.id, ["loops", loopIndex, "workflow", "jobNodes", nodeIndex, "id"], "node", context);
      if (node.type !== "human" && !profileIds.has(node.executionProfileId)) {
        context.addIssue({
          code: "custom",
          path: ["loops", loopIndex, "workflow", "jobNodes", nodeIndex, "executionProfileId"],
          message: `JobNode references unknown execution profile: ${node.executionProfileId}.`
        });
      }
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

  const routeCandidates = new Set<string>();
  config.graph.loopEdges.forEach((edge, edgeIndex) => {
    const path = ["graph", "loopEdges", edgeIndex] as const;
    addDuplicateIssue(edgeIds, edge.id, [...path, "id"], "edge", context);
    if (!loopIds.has(edge.source)) context.addIssue({
      code: "custom", path: [...path, "source"], message: `Loop Edge references an unknown source Loop: ${edge.source}.`
    });
    const target = config.loops.find((loop) => loop.id === edge.target);
    if (!target) context.addIssue({
      code: "custom", path: [...path, "target"], message: `Loop Edge references an unknown target Loop: ${edge.target}.`
    });
    if (target && edge.kind === "flow" && !target.capabilities.accepts.includes(edge.capability)) context.addIssue({
      code: "custom", path: [...path, "capability"],
      message: `Flow Loop Edge capability ${edge.capability} is not accepted by target Loop ${edge.target}.`
    });
    if (target && edge.kind === "repair" && !target.capabilities.provides.includes(edge.capability)) context.addIssue({
      code: "custom", path: [...path, "capability"],
      message: `Repair Loop Edge capability ${edge.capability} is not provided by target Loop ${edge.target}.`
    });
    const candidate = `${edge.source}\u0000${edge.target}\u0000${edge.kind}\u0000${edge.capability}`;
    if (routeCandidates.has(candidate)) context.addIssue({
      code: "custom", path: [...path, "capability"], message: "Duplicate Loop Edge route candidate."
    });
    routeCandidates.add(candidate);
  });
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
