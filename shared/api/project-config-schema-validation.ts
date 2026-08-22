import type { z } from "zod";
import {
  graphNodeRoutingChildIds,
  graphRoutingChildIds,
  routingTerminalResults
} from "../domain/automationReachability.js";
import type {
  ProjectCandidateRouting,
  ProjectExecutionComposition,
  ProjectGraphNodeRouteTarget,
  ProjectGraphRouteTarget,
  ProjectOrchestrator
} from "../domain/automation.js";
import type { ProjectConfiguration } from "../domain/projectConfig.js";

export const validateProjectConfigSchema = (config: ProjectConfiguration, context: z.RefinementCtx): void => {
  if (config.issueTracker.orchestrationDirectory === config.issueTracker.workDirectory) add(
    context, ["issueTracker", "workDirectory"], "Orchestration and work ticket stores must use different directories."
  );
  const profileIds = uniqueIds(config.executionProfiles, "execution profile", ["executionProfiles"], context);
  const resource = (value: ProjectExecutionComposition, path: Array<string | number>, label: string) => {
    if (!profileIds.has(value.executionProfileId)) add(
      context, [...path, "executionProfileId"], `${label} references unknown execution profile: ${value.executionProfileId}.`
    );
  };

  resource(config.graph.orchestrator, ["graph", "orchestrator"], "Graph Orchestrator");
  if (config.graph.repairNode) resource(config.graph.repairNode, ["graph", "repairNode"], "Graph Repair Node");
  const graphNodeIds = uniqueIds(config.graph.graphNodes, "Graph Node", ["graph", "graphNodes"], context);
  validateRouting(
    config.graph.orchestrator,
    graphNodeIds,
    "graphNodeId",
    ["graph", "orchestrator", "routing"],
    Boolean(config.graph.repairNode),
    context
  );

  const allNestedIds = new Set<string>();
  config.graph.graphNodes.forEach((graphNode, graphNodeIndex) => {
    const base = ["graph", "graphNodes", graphNodeIndex] as Array<string | number>;
    resource(graphNode.orchestrator, [...base, "orchestrator"], "Graph Node Orchestrator");
    if (graphNode.repairNode) resource(graphNode.repairNode, [...base, "repairNode"], "Graph Node Repair Node");
    const jobIds = uniqueIds(graphNode.jobNodes, "Job Node", [...base, "jobNodes"], context);
    validateRouting(
      graphNode.orchestrator,
      jobIds,
      "jobNodeId",
      [...base, "orchestrator", "routing"],
      Boolean(graphNode.repairNode),
      context
    );
    graphNode.jobNodes.forEach((jobNode, jobIndex) => {
      const jobBase = [...base, "jobNodes", jobIndex];
      addUnique(allNestedIds, jobNode.id, [...jobBase, "id"], "Job Node", context);
      addUnique(allNestedIds, jobNode.workNode.id, [...jobBase, "workNode", "id"], "Work Node", context);
      addUnique(allNestedIds, jobNode.validationNode.id, [...jobBase, "validationNode", "id"], "Validation Node", context);
      if (jobNode.workNode.type === "agent") resource(jobNode.workNode, [...jobBase, "workNode"], "Work Node");
      if (jobNode.validationNode.type === "agent") resource(jobNode.validationNode, [...jobBase, "validationNode"], "Validation Node");
    });
  });
};

const validateRouting = <TTarget extends ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget>(
  orchestrator: ProjectOrchestrator<TTarget>,
  childIds: Set<string>,
  targetKey: "graphNodeId" | "jobNodeId",
  path: Array<string | number>,
  repairAvailable: boolean,
  context: z.RefinementCtx
) => {
  const routing = orchestrator.routing as ProjectCandidateRouting<ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget>;
  const routedChildIds = targetKey === "graphNodeId"
    ? graphRoutingChildIds(routing as ProjectCandidateRouting<ProjectGraphRouteTarget>)
    : graphNodeRoutingChildIds(routing as ProjectCandidateRouting<ProjectGraphNodeRouteTarget>);
  for (const childId of childIds) if (!routedChildIds.has(childId)) add(
    context, path, `${labelFor(targetKey)} is unreachable from the Orchestrator candidate union: ${childId}.`
  );
  const terminals = routingTerminalResults(routing);
  for (const result of ["PASS", "FAIL"] as const) if (!terminals.has(result)) add(
    context, path, `Orchestrator candidate rules must make terminal ${result} reachable.`
  );
  if (routing.repair.length > 0 && !repairAvailable) add(
    context, [...path, "repair"], "Repair candidate rules require a Repair Node in the same scope."
  );
  const rules = [routing.start, ...routing.continuation, ...routing.repair];
  const ruleIds = new Set<string>();
  rules.forEach((rule, ruleIndex) => {
    if (ruleIds.has(rule.id)) add(context, path, `Duplicate routing rule id: ${rule.id}.`);
    ruleIds.add(rule.id);
    if ("sourceId" in rule && typeof rule.sourceId === "string" && !childIds.has(rule.sourceId)) add(
      context, [...path, ruleIndex, "sourceId"], `Routing rule references an unknown source ${labelFor(targetKey)}: ${rule.sourceId}.`
    );
    rule.candidates.forEach((candidate, candidateIndex) => {
      if (targetKey in candidate.target) {
        const childId = (candidate.target as unknown as Record<string, string>)[targetKey];
        if (!childIds.has(childId)) add(
          context, [...path, ruleIndex, "candidates", candidateIndex, "target", targetKey],
          `Routing candidate references an unknown ${labelFor(targetKey)}: ${childId}.`
        );
      }
    });
  });
};

const labelFor = (key: "graphNodeId" | "jobNodeId") => key === "graphNodeId" ? "Graph Node" : "Job Node";
const uniqueIds = (
  entries: Array<{ id: string }>, label: string, path: Array<string | number>, context: z.RefinementCtx
): Set<string> => {
  const ids = new Set<string>();
  entries.forEach((entry, index) => addUnique(ids, entry.id, [...path, index, "id"], label, context));
  return ids;
};
const addUnique = (
  ids: Set<string>, id: string, path: Array<string | number>, label: string, context: z.RefinementCtx
) => {
  if (ids.has(id)) add(context, path, `Duplicate ${label} id: ${id}.`);
  ids.add(id);
};
const add = (context: z.RefinementCtx, path: Array<string | number>, message: string) =>
  context.addIssue({ code: "custom", path, message });
