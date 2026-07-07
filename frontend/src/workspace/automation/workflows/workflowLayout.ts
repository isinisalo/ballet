import type { ProjectAutomationConfig, ProjectWorkflow } from "@shared/api/workspace-contracts";
import { workflowEdgeOutputSlotKind } from "./workflowEdgeOutputSlot";
import { buildWorkflowGraph, workflowCanonicalRecord, type WorkflowGraph, type WorkflowOutputTarget, type WorkflowStepRecord } from "./workflowGraph";
import { workflowCanvasLayoutConfig, workflowNodeSizes } from "./workflowLayoutConfig";
import type { WorkflowCanvasEdge } from "./workflowLayoutEdges";
import { buildWorkflowLayoutGraphDraft } from "./workflowLayoutGraph";
import { positionWorkflowNodes } from "./workflowLayoutPositioning";
import { workflowOutputSourceHandleId, workflowShortestVerticalHandles } from "./workflowLayoutSizing";
import type { WorkflowCanvasLayout, WorkflowCanvasLayoutNode, WorkflowLayoutDirection } from "./workflowLayoutTypes";

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
  const workflowIds = reachableWorkflowIds(config, selectedWorkflowId, recordsByWorkflowId, policyById);
  const rows = config.workflows
    .filter((workflow) => workflowIds.has(workflow.id))
    .map((workflow) => {
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
    });
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

function reachableWorkflowIds(
  config: ProjectAutomationConfig,
  selectedWorkflowId: string,
  recordsByWorkflowId: ReadonlyMap<string, WorkflowStepRecord[]>,
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
) {
  const reachable = new Set<string>();
  const queue = [selectedWorkflowId];

  while (queue.length > 0) {
    const workflowId = queue.shift();
    if (!workflowId || reachable.has(workflowId)) continue;
    reachable.add(workflowId);

    const records = recordsByWorkflowId.get(workflowId) ?? [];
    records.forEach((record) => {
      record.outputTargets?.forEach((target) => {
        if (target.type !== "trigger") return;
        const targetWorkflow = resolveTriggerTargetWorkflow(config, target, policyById);
        if (targetWorkflow && !reachable.has(targetWorkflow.id)) queue.push(targetWorkflow.id);
      });
    });
  }

  return reachable;
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
