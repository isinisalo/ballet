import type { ProjectAutomationConfig, ProjectWorkflow } from "@shared/api/workspace-contracts";
import { workflowEdgeOutputSlotKind } from "./workflowEdgeOutputSlot";
import { buildWorkflowGraph, workflowCanonicalRecord, type WorkflowGraph, type WorkflowOutputTarget, type WorkflowStepRecord } from "./workflowGraph";
import { workflowCanvasLayoutConfig, workflowNodeSizes } from "./workflowLayoutConfig";
import type { WorkflowCanvasEdge } from "./workflowLayoutEdges";
import { buildWorkflowLayoutGraphDraft } from "./workflowLayoutGraph";
import { positionWorkflowNodes } from "./workflowLayoutPositioning";
import { workflowOutputSourceHandleId, workflowShortestVerticalHandles, workflowSummaryNodeWidth } from "./workflowLayoutSizing";
import type { WorkflowCanvasLayout, WorkflowCanvasLayoutNode, WorkflowLayoutDirection } from "./workflowLayoutTypes";

type WorkflowLayoutRow = {
  workflow: ProjectWorkflow;
  records: WorkflowStepRecord[];
  workflowGraph: WorkflowGraph;
  layout: WorkflowCanvasLayout;
};

type WorkflowTriggerLink = {
  sourceWorkflowId: string;
  targetWorkflowId: string;
  sourceStepIndex: number;
  sourcePolicyId: string;
  outputId: string;
  eventType: string;
};

// This module intentionally centralizes workflow graph layout rules because
// cross-workflow routing depends on the same node, row, and edge geometry.
export { workflowAddActionGhostLabel, workflowCanvasLayoutConfig, workflowNodeSizes } from "./workflowLayoutConfig";
export type { WorkflowCanvasEdge } from "./workflowLayoutEdges";
export {
  workflowCanvasNodeAnchorY,
  workflowOutputSourceHandleId,
  workflowPolicyOutputHandleY,
  workflowPolicyStackHeight
} from "./workflowLayoutSizing";
export type {
  WorkflowCanvasLayout,
  WorkflowCanvasLayoutNode,
  WorkflowCanvasNodeKind,
  WorkflowCanvasOutputEvent,
  WorkflowLayoutDirection
} from "./workflowLayoutTypes";

export function calculateWorkflowCanvasLayout({
  workflowGraph,
  editingPolicyIndex,
  direction = "horizontal"
}: {
  workflowGraph: WorkflowGraph;
  editingPolicyIndex: number | null;
  direction?: WorkflowLayoutDirection;
}): WorkflowCanvasLayout {
  const graphDraft = buildWorkflowLayoutGraphDraft({
    workflowGraph,
    editingPolicyIndex,
    direction
  });
  const positionedNodes = positionWorkflowNodes(graphDraft.nodes, graphDraft.dagreEdges, direction);

  return {
    nodes: positionedNodes,
    edges: workflowEdgesWithDynamicVerticalHandles(graphDraft.canvasEdges, positionedNodes),
    direction
  };
}

export function calculateCompositeWorkflowCanvasLayout({
  config,
  selectedWorkflowId,
  recordsByWorkflowId,
  editingPolicyIndexByWorkflowId = new Map(),
  direction = "horizontal"
}: {
  config: ProjectAutomationConfig;
  selectedWorkflowId: string;
  recordsByWorkflowId: ReadonlyMap<string, WorkflowStepRecord[]>;
  editingPolicyIndexByWorkflowId?: ReadonlyMap<string, number | null>;
  direction?: WorkflowLayoutDirection;
}): WorkflowCanvasLayout {
  const selectedWorkflow = config.workflows.find((workflow) => workflow.id === selectedWorkflowId);
  if (!selectedWorkflow) return { nodes: [], edges: [], direction };

  const policyById = new Map(config.policies.map((policy) => [policy.id, policy]));
  return calculateSelectedWorkflowCanvasLayout({
    config,
    selectedWorkflow,
    recordsByWorkflowId,
    editingPolicyIndexByWorkflowId,
    direction,
    policyById
  });
}

export function calculateAllWorkflowsCanvasLayout({
  config,
  recordsByWorkflowId,
  editingPolicyIndexByWorkflowId = new Map(),
  direction = "horizontal"
}: {
  config: ProjectAutomationConfig;
  recordsByWorkflowId: ReadonlyMap<string, WorkflowStepRecord[]>;
  editingPolicyIndexByWorkflowId?: ReadonlyMap<string, number | null>;
  direction?: WorkflowLayoutDirection;
}): WorkflowCanvasLayout {
  const policyById = new Map(config.policies.map((policy) => [policy.id, policy]));
  return calculateWorkflowCanvasLayoutRows({
    config,
    workflowIds: new Set(config.workflows.map((workflow) => workflow.id)),
    recordsByWorkflowId,
    editingPolicyIndexByWorkflowId,
    direction,
    policyById
  });
}

function calculateWorkflowCanvasLayoutRows({
  config,
  workflowIds,
  recordsByWorkflowId,
  editingPolicyIndexByWorkflowId,
  direction,
  policyById
}: {
  config: ProjectAutomationConfig;
  workflowIds: ReadonlySet<string>;
  recordsByWorkflowId: ReadonlyMap<string, WorkflowStepRecord[]>;
  editingPolicyIndexByWorkflowId: ReadonlyMap<string, number | null>;
  direction: WorkflowLayoutDirection;
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>;
}): WorkflowCanvasLayout {
  const rows = config.workflows
    .filter((workflow) => workflowIds.has(workflow.id))
    .map((workflow) => workflowLayoutRow({
      workflow,
      recordsByWorkflowId,
      editingPolicyIndexByWorkflowId,
      direction,
      policyById
    }));
  const rowOffsetByWorkflowId = workflowRowOffsets(rows);
  const hiddenLocalNodeKeys = new Set<string>();
  const namespacedNodes: WorkflowCanvasLayoutNode[] = [];
  const namespacedEdges: WorkflowCanvasEdge[] = [];

  rows.forEach((row) => {
    row.layout.nodes.forEach((node) => {
      if (shouldHideTriggerOutputNode(config, node, workflowIds, policyById)) {
        hiddenLocalNodeKeys.add(namespaceWorkflowKey(row.workflow.id, node.key));
        return;
      }
      namespacedNodes.push({
        ...node,
        key: namespaceWorkflowKey(row.workflow.id, node.key),
        workflowId: row.workflow.id,
        y: node.y + (rowOffsetByWorkflowId.get(row.workflow.id) ?? 0),
        record: node.record ? { ...node.record, workflowId: row.workflow.id } : undefined,
        records: node.records?.map((record) => ({ ...record, workflowId: row.workflow.id })),
        triggerPolicy: node.kind === "trigger" ? policyById.get(row.workflow.steps[0] ?? "") : node.triggerPolicy
      });
    });
  });

  rows.forEach((row) => {
    row.layout.edges.forEach((edge) => {
      const sourceNodeKey = namespaceWorkflowKey(row.workflow.id, edge.sourceNodeKey);
      const targetNodeKey = namespaceWorkflowKey(row.workflow.id, edge.targetNodeKey);
      if (hiddenLocalNodeKeys.has(sourceNodeKey) || hiddenLocalNodeKeys.has(targetNodeKey)) return;
      namespacedEdges.push(namespaceWorkflowEdge(row.workflow.id, edge));
    });
  });

  rows.forEach((row) => {
    crossWorkflowTriggerEdges(config, row, workflowIds, policyById).forEach((edge) => namespacedEdges.push(edge));
  });

  return {
    nodes: namespacedNodes,
    edges: workflowEdgesWithDynamicVerticalHandles(namespacedEdges, namespacedNodes),
    direction
  };
}

function calculateSelectedWorkflowCanvasLayout({
  config,
  selectedWorkflow,
  recordsByWorkflowId,
  editingPolicyIndexByWorkflowId,
  direction,
  policyById
}: {
  config: ProjectAutomationConfig;
  selectedWorkflow: ProjectWorkflow;
  recordsByWorkflowId: ReadonlyMap<string, WorkflowStepRecord[]>;
  editingPolicyIndexByWorkflowId: ReadonlyMap<string, number | null>;
  direction: WorkflowLayoutDirection;
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>;
}): WorkflowCanvasLayout {
  const selectedRow = workflowLayoutRow({
    workflow: selectedWorkflow,
    recordsByWorkflowId,
    editingPolicyIndexByWorkflowId,
    direction,
    policyById
  });
  const links = workflowTriggerLinks(config, recordsByWorkflowId, policyById);
  const downstreamWorkflowIds = linkedWorkflowIds(config, links, selectedWorkflow.id, "downstream");
  const downstreamWorkflowIdSet = new Set(downstreamWorkflowIds);
  const upstreamWorkflowIds = linkedWorkflowIds(config, links, selectedWorkflow.id, "upstream")
    .filter((workflowId) => !downstreamWorkflowIdSet.has(workflowId));
  const visibleCompactWorkflowIds = new Set([...upstreamWorkflowIds, ...downstreamWorkflowIds]);
  const upstreamNodes = compactWorkflowNodes({
    config,
    workflowIds: upstreamWorkflowIds,
    y: workflowCanvasLayoutConfig.startY,
    direction,
    policyById
  });
  const selectedStartY = upstreamNodes.length > 0
    ? workflowCanvasLayoutConfig.startY + workflowNodeSizes.workflow.height + workflowCanvasLayoutConfig.selectedCompactWorkflowRowGap
    : workflowCanvasLayoutConfig.startY;
  const selectedBounds = workflowLayoutBounds(selectedRow.layout.nodes);
  const selectedOffsetY = selectedStartY - selectedBounds.minY;
  const hiddenSelectedNodeKeys = new Set<string>();
  const nodes: WorkflowCanvasLayoutNode[] = [...upstreamNodes];
  const edges: WorkflowCanvasEdge[] = [];

  selectedRow.layout.nodes.forEach((node) => {
    if (shouldHideTriggerOutputNode(config, node, visibleCompactWorkflowIds, policyById)) {
      hiddenSelectedNodeKeys.add(namespaceWorkflowKey(selectedWorkflow.id, node.key));
      return;
    }
    nodes.push({
      ...node,
      key: namespaceWorkflowKey(selectedWorkflow.id, node.key),
      workflowId: selectedWorkflow.id,
      y: node.y + selectedOffsetY,
      record: node.record ? { ...node.record, workflowId: selectedWorkflow.id } : undefined,
      records: node.records?.map((record) => ({ ...record, workflowId: selectedWorkflow.id })),
      triggerPolicy: node.kind === "trigger" ? policyById.get(selectedWorkflow.steps[0] ?? "") : node.triggerPolicy
    });
  });

  selectedRow.layout.edges.forEach((edge) => {
    const sourceNodeKey = namespaceWorkflowKey(selectedWorkflow.id, edge.sourceNodeKey);
    const targetNodeKey = namespaceWorkflowKey(selectedWorkflow.id, edge.targetNodeKey);
    if (hiddenSelectedNodeKeys.has(sourceNodeKey) || hiddenSelectedNodeKeys.has(targetNodeKey)) return;
    edges.push(namespaceWorkflowEdge(selectedWorkflow.id, edge));
  });

  const selectedVisibleBounds = workflowLayoutBounds(nodes.filter((node) => node.workflowId === selectedWorkflow.id && node.kind !== "workflow"));
  const downstreamNodes = compactWorkflowNodes({
    config,
    workflowIds: downstreamWorkflowIds,
    y: selectedVisibleBounds.maxY + workflowCanvasLayoutConfig.selectedCompactWorkflowRowGap,
    direction,
    policyById
  });
  nodes.push(...downstreamNodes);

  edges.push(
    ...compactWorkflowTriggerEdges({
      links,
      compactWorkflowIds: visibleCompactWorkflowIds,
      selectedWorkflowId: selectedWorkflow.id
    }),
    ...selectedToCompactWorkflowTriggerEdges({
      selectedRow,
      targetWorkflowIds: downstreamWorkflowIdSet,
      links
    })
  );

  return {
    nodes,
    edges: workflowEdgesWithDynamicVerticalHandles(edges, nodes),
    direction
  };
}

function workflowLayoutRow({
  workflow,
  recordsByWorkflowId,
  editingPolicyIndexByWorkflowId,
  direction,
  policyById
}: {
  workflow: ProjectWorkflow;
  recordsByWorkflowId: ReadonlyMap<string, WorkflowStepRecord[]>;
  editingPolicyIndexByWorkflowId: ReadonlyMap<string, number | null>;
  direction: WorkflowLayoutDirection;
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>;
}): WorkflowLayoutRow {
  const records = (recordsByWorkflowId.get(workflow.id) ?? []).map((record) => ({
    ...record,
    workflowId: workflow.id,
    policy: record.policy ?? policyById.get(record.policyId)
  }));
  const workflowGraph = buildWorkflowGraph(records);

  return {
    workflow,
    records,
    workflowGraph,
    layout: calculateWorkflowCanvasLayout({
      workflowGraph,
      editingPolicyIndex: editingPolicyIndexByWorkflowId.get(workflow.id) ?? null,
      direction
    })
  };
}

function workflowTriggerLinks(
  config: ProjectAutomationConfig,
  recordsByWorkflowId: ReadonlyMap<string, WorkflowStepRecord[]>,
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
): WorkflowTriggerLink[] {
  return config.workflows.flatMap((workflow) => {
    const records = recordsByWorkflowId.get(workflow.id) ?? [];
    return records.flatMap((record) =>
      (record.outputTargets ?? [])
        .filter((target): target is Extract<WorkflowOutputTarget, { type: "trigger" }> => target.type === "trigger")
        .flatMap((target) => {
          const targetWorkflow = resolveTriggerTargetWorkflow(config, target, policyById);
          if (!targetWorkflow || targetWorkflow.id === workflow.id) return [];
          return [{
            sourceWorkflowId: workflow.id,
            targetWorkflowId: targetWorkflow.id,
            sourceStepIndex: record.index,
            sourcePolicyId: record.policyId,
            outputId: target.outputId,
            eventType: target.eventType
          } satisfies WorkflowTriggerLink];
        })
    );
  });
}

function linkedWorkflowIds(
  config: ProjectAutomationConfig,
  links: WorkflowTriggerLink[],
  selectedWorkflowId: string,
  direction: "upstream" | "downstream"
): string[] {
  const visited = new Set<string>();
  const queue = [selectedWorkflowId];

  while (queue.length > 0) {
    const workflowId = queue.shift();
    if (!workflowId) continue;
    const candidates = links.filter((link) =>
      direction === "downstream"
        ? link.sourceWorkflowId === workflowId
        : link.targetWorkflowId === workflowId
    );
    candidates.forEach((link) => {
      const linkedWorkflowId = direction === "downstream" ? link.targetWorkflowId : link.sourceWorkflowId;
      if (linkedWorkflowId === selectedWorkflowId || visited.has(linkedWorkflowId)) return;
      visited.add(linkedWorkflowId);
      queue.push(linkedWorkflowId);
    });
  }

  return config.workflows.map((workflow) => workflow.id).filter((workflowId) => visited.has(workflowId));
}

function compactWorkflowNodes({
  config,
  workflowIds,
  y,
  direction,
  policyById
}: {
  config: ProjectAutomationConfig;
  workflowIds: string[];
  y: number;
  direction: WorkflowLayoutDirection;
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>;
}): WorkflowCanvasLayoutNode[] {
  let nextX = workflowCanvasLayoutConfig.startX;

  return workflowIds.flatMap((workflowId) => {
    const workflow = config.workflows.find((candidate) => candidate.id === workflowId);
    if (!workflow) return [];
    const firstPolicy = policyById.get(workflow.steps[0] ?? "");
    const label = compactWorkflowLabel(workflow, firstPolicy);
    const width = workflowSummaryNodeWidth(workflow.id);
    const node: WorkflowCanvasLayoutNode = {
      key: compactWorkflowNodeKey(workflow.id),
      workflowId: workflow.id,
      kind: "workflow",
      x: nextX,
      y,
      width,
      height: workflowNodeSizes.workflow.height,
      direction,
      workflowSummary: {
        workflowId: workflow.id,
        label,
        trigger: firstPolicy?.source === "trigger" ? firstPolicy.trigger : undefined,
        action: firstPolicy?.action
      }
    };
    nextX += width + compactWorkflowColumnGap();
    return [node];
  });
}

function compactWorkflowTriggerEdges({
  links,
  compactWorkflowIds,
  selectedWorkflowId
}: {
  links: WorkflowTriggerLink[];
  compactWorkflowIds: ReadonlySet<string>;
  selectedWorkflowId: string;
}): WorkflowCanvasEdge[] {
  return links.flatMap((link) => {
    const sourceIsCompact = compactWorkflowIds.has(link.sourceWorkflowId);
    const targetIsCompact = compactWorkflowIds.has(link.targetWorkflowId);
    const targetIsSelected = link.targetWorkflowId === selectedWorkflowId;
    if (!sourceIsCompact || (!targetIsCompact && !targetIsSelected)) return [];

    return [{
      key: `workflow:${link.sourceWorkflowId}:output:${link.sourceStepIndex}:${link.outputId}:to:${link.targetWorkflowId}:workflow`,
      sourceNodeKey: compactWorkflowNodeKey(link.sourceWorkflowId),
      targetNodeKey: targetIsSelected ? namespaceWorkflowKey(selectedWorkflowId, "trigger") : compactWorkflowNodeKey(link.targetWorkflowId),
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: link.eventType,
      label: link.outputId,
      tone: "cross-workflow",
      route: {
        sourceWorkflowId: link.sourceWorkflowId,
        targetWorkflowId: link.targetWorkflowId,
        sourceStepIndex: link.sourceStepIndex,
        sourcePolicyId: link.sourcePolicyId,
        eventType: link.eventType,
        outputId: link.outputId
      }
    } satisfies WorkflowCanvasEdge];
  });
}

function selectedToCompactWorkflowTriggerEdges({
  selectedRow,
  targetWorkflowIds,
  links
}: {
  selectedRow: WorkflowLayoutRow;
  targetWorkflowIds: ReadonlySet<string>;
  links: WorkflowTriggerLink[];
}): WorkflowCanvasEdge[] {
  return links
    .filter((link) => link.sourceWorkflowId === selectedRow.workflow.id && targetWorkflowIds.has(link.targetWorkflowId))
    .flatMap((link) => {
      const record = selectedRow.records.find((candidate) => candidate.index === link.sourceStepIndex);
      if (!record) return [];
      const canonicalRecord = workflowCanonicalRecord(selectedRow.workflowGraph, record);

      return [{
        key: `workflow:${selectedRow.workflow.id}:output:${link.sourceStepIndex}:${link.outputId}:to:${link.targetWorkflowId}:workflow`,
        sourceNodeKey: namespaceWorkflowKey(selectedRow.workflow.id, `policy-${canonicalRecord.index}`),
        targetNodeKey: compactWorkflowNodeKey(link.targetWorkflowId),
        sourceHandleId: workflowOutputSourceHandleId({ outputId: link.outputId, eventType: link.eventType }),
        targetHandleId: "left",
        eventType: link.eventType,
        label: link.outputId,
        tone: "cross-workflow",
        route: {
          sourceWorkflowId: selectedRow.workflow.id,
          targetWorkflowId: link.targetWorkflowId,
          sourceStepIndex: link.sourceStepIndex,
          sourcePolicyId: link.sourcePolicyId,
          eventType: link.eventType,
          outputId: link.outputId
        }
      } satisfies WorkflowCanvasEdge];
    });
}

function compactWorkflowLabel(
  workflow: ProjectWorkflow,
  firstPolicy: ProjectAutomationConfig["policies"][number] | undefined
) {
  const source = firstPolicy?.action
    ? firstPolicy.action.replace(/^create-/, "")
    : workflow.id.replace(/\.loop$/, "");
  const label = source
    .split("-")
    .filter(Boolean)
    .join(" ");

  return label ? `${label} workflow` : "workflow";
}

function compactWorkflowNodeKey(workflowId: string) {
  return `workflow:${workflowId}:workflow`;
}

function compactWorkflowColumnGap() {
  return workflowCanvasLayoutConfig.columnGap * 2;
}

function resolveTriggerTargetWorkflow(
  config: ProjectAutomationConfig,
  target: Extract<WorkflowOutputTarget, { type: "trigger" }>,
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
): ProjectWorkflow | undefined {
  if (target.workflowId) {
    const explicitWorkflow = config.workflows.find((workflow) => workflow.id === target.workflowId);
    if (explicitWorkflow) return explicitWorkflow;
  }

  return config.workflows.find((workflow) => {
    const firstPolicy = policyById.get(workflow.steps[0] ?? "");
    return firstPolicy?.source === "trigger" && firstPolicy.trigger === target.trigger;
  });
}

function workflowRowOffsets(rows: Array<{ workflow: ProjectWorkflow; layout: WorkflowCanvasLayout }>) {
  const offsets = new Map<string, number>();
  let nextRowY = workflowCanvasLayoutConfig.startY;

  rows.forEach(({ workflow, layout }) => {
    const bounds = workflowLayoutBounds(layout.nodes);
    offsets.set(workflow.id, nextRowY - bounds.minY);
    nextRowY += bounds.height + compositeWorkflowRowGap();
  });

  return offsets;
}

function workflowLayoutBounds(nodes: WorkflowCanvasLayoutNode[]) {
  if (nodes.length === 0) {
    return {
      minY: workflowCanvasLayoutConfig.startY,
      maxY: workflowCanvasLayoutConfig.startY,
      height: workflowNodeSizes.trigger.height
    };
  }
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { minY, maxY, height: maxY - minY };
}

function compositeWorkflowRowGap() {
  return workflowCanvasLayoutConfig.branchGap * 2 + workflowNodeSizes.policy.height;
}

function shouldHideTriggerOutputNode(
  config: ProjectAutomationConfig,
  node: WorkflowCanvasLayoutNode,
  workflowIds: ReadonlySet<string>,
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
) {
  if (node.kind !== "output-event" || node.outputEvent?.outputType !== "trigger" || !node.outputEvent.trigger) return false;
  const targetWorkflow = resolveTriggerTargetWorkflow(config, {
    outputId: node.outputEvent.outputId,
    eventType: node.outputEvent.eventType,
    type: "trigger",
    trigger: node.outputEvent.trigger,
    workflowId: node.outputEvent.workflowId
  }, policyById);
  return Boolean(targetWorkflow && workflowIds.has(targetWorkflow.id));
}

function crossWorkflowTriggerEdges(
  config: ProjectAutomationConfig,
  row: {
    workflow: ProjectWorkflow;
    records: WorkflowStepRecord[];
    workflowGraph: WorkflowGraph;
  },
  workflowIds: ReadonlySet<string>,
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
): WorkflowCanvasEdge[] {
  return row.records.flatMap((record) =>
    (record.outputTargets ?? [])
      .filter((target): target is Extract<WorkflowOutputTarget, { type: "trigger" }> => target.type === "trigger")
      .flatMap((target) => {
        const targetWorkflow = resolveTriggerTargetWorkflow(config, target, policyById);
        if (!targetWorkflow || !workflowIds.has(targetWorkflow.id)) return [];
        const canonicalRecord = workflowCanonicalRecord(row.workflowGraph, record);
        const sourceNodeKey = namespaceWorkflowKey(row.workflow.id, `policy-${canonicalRecord.index}`);
        const targetNodeKey = namespaceWorkflowKey(targetWorkflow.id, "trigger");
        return [{
          key: `workflow:${row.workflow.id}:output:${record.index}:${target.outputId}:to:${targetWorkflow.id}:trigger`,
          sourceNodeKey,
          targetNodeKey,
          sourceHandleId: workflowOutputSourceHandleId(target),
          targetHandleId: "left",
          eventType: target.eventType,
          label: target.outputId,
          tone: "cross-workflow",
          route: {
            sourceWorkflowId: row.workflow.id,
            targetWorkflowId: targetWorkflow.id,
            sourceStepIndex: record.index,
            sourcePolicyId: record.policyId,
            eventType: target.eventType,
            outputId: target.outputId
          }
        } satisfies WorkflowCanvasEdge];
      })
  );
}

function namespaceWorkflowEdge(workflowId: string, edge: WorkflowCanvasEdge): WorkflowCanvasEdge {
  return {
    ...edge,
    key: namespaceWorkflowKey(workflowId, edge.key),
    sourceNodeKey: namespaceWorkflowKey(workflowId, edge.sourceNodeKey),
    targetNodeKey: namespaceWorkflowKey(workflowId, edge.targetNodeKey),
    route: edge.route
      ? {
        ...edge.route,
        sourceWorkflowId: edge.route.sourceWorkflowId ?? workflowId,
        handlerWorkflowId: edge.route.handlerWorkflowId ?? workflowId
      }
      : undefined
  };
}

function namespaceWorkflowKey(workflowId: string, key: string) {
  return `workflow:${workflowId}:${key}`;
}

function workflowEdgesWithDynamicVerticalHandles(
  edges: WorkflowCanvasEdge[],
  nodes: WorkflowCanvasLayoutNode[]
) {
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));

  return edges.map((edge) => {
    const outputSlotKind = workflowEdgeOutputSlotKind(edge);
    if (outputSlotKind === "approval") {
      return {
        ...edge,
        sourceHandleId: "right",
        targetHandleId: "left"
      };
    }
    const isDynamicVerticalEdge = edge.tone === "return" || outputSlotKind === "rework";
    if (!isDynamicVerticalEdge) return edge;
    const sourceNode = nodeByKey.get(edge.sourceNodeKey);
    const targetNode = nodeByKey.get(edge.targetNodeKey);
    if (!sourceNode || !targetNode) return edge;
    const isUpwardEdge = targetNode.y + targetNode.height / 2 < sourceNode.y + sourceNode.height / 2;
    if (outputSlotKind === "rework" && (edge.tone === "return" || isUpwardEdge)) {
      return {
        ...edge,
        sourceHandleId: "top",
        targetHandleId: "top"
      };
    }
    const { sourceHandleId, targetHandleId } = workflowShortestVerticalHandles(
      sourceNode,
      targetNode,
      outputSlotKind === "rework"
    );

    return {
      ...edge,
      sourceHandleId,
      targetHandleId
    };
  });
}
