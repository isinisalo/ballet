import type { FlowViewModel } from "backend/shared/flow";
import type { FlowSelection } from "@/features/flows/model/flow-page-model";

export type FlowVisualKind = "event" | "routing" | "operation" | "emission" | "terminal";

export interface FlowVisualNode {
  id: string;
  key: string;
  kind: FlowVisualKind;
  column: number;
  row: number;
  label: string;
  title: string;
  subtitle: string;
  ariaLabel?: string;
  status: "active" | "draft" | "invalid" | "warning" | "terminal";
  selection: FlowSelection;
  diagnosticCount: number;
}

export interface FlowVisualEdge {
  id: string;
  fromKey: string;
  toKey: string;
  label: string;
  kind: "routing" | "emission";
  selection: FlowSelection;
}

export interface FlowLayout {
  nodes: FlowVisualNode[];
  edges: FlowVisualEdge[];
  columns: number;
  rows: number;
}

const statusFor = (active: boolean, flow: FlowViewModel, resourceId?: string): FlowVisualNode["status"] => {
  const hasError = resourceId && flow.diagnostics.some((diagnostic) => diagnostic.affectedResource.id === resourceId && diagnostic.severity === "error");
  if (hasError || flow.health === "invalid") return "invalid";
  if (flow.health === "warning") return "warning";
  return active ? "active" : "draft";
};

const edgeNodeKey = (edgeId: string, kind: "routing" | "emission") => `${kind}:${edgeId}`;

export function buildFlowLayout(flow: FlowViewModel): FlowLayout {
  const eventById = new Map(flow.nodes.filter((node) => node.kind === "event").map((node) => [node.id, node]));
  const operationById = new Map(flow.nodes.filter((node) => node.kind === "operation").map((node) => [node.id, node]));
  const routingByEvent = new Map<string, Extract<FlowViewModel["edges"][number], { kind: "routing" }>[]>();
  const emissionsByOperation = new Map<string, Extract<FlowViewModel["edges"][number], { kind: "emission" }>[]>();

  for (const edge of flow.edges) {
    if (edge.kind === "routing") routingByEvent.set(edge.from, [...(routingByEvent.get(edge.from) ?? []), edge]);
    else emissionsByOperation.set(edge.from, [...(emissionsByOperation.get(edge.from) ?? []), edge]);
  }

  const nodes: FlowVisualNode[] = [];
  const edges: FlowVisualEdge[] = [];
  const seen = new Set<string>();
  let nextRow = 0;

  const addNode = (node: FlowVisualNode) => {
    if (seen.has(node.key)) return;
    seen.add(node.key);
    nodes.push(node);
  };

  const visitEvent = (eventId: string, column: number, row: number, visited: Set<string>) => {
    const event = eventById.get(eventId);
    if (!event) return;
    const terminal = flow.terminalEvents.some((terminalEvent) => terminalEvent.id === event.id);
    addNode({
      id: event.id,
      key: `event:${event.id}`,
      kind: terminal && column > 0 ? "terminal" : "event",
      column,
      row,
      label: terminal && column > 0 ? "Terminal event" : column === 0 ? "Event / Trigger" : "Emitted event",
      title: event.name,
      subtitle: event.eventType,
      status: terminal && column > 0 ? "terminal" : statusFor(event.active, flow, event.id),
      selection: { kind: "event", id: event.id },
      diagnosticCount: flow.diagnostics.filter((diagnostic) => diagnostic.affectedResource.id === event.id).length
    });

    if (visited.has(event.id)) return;
    const nextVisited = new Set(visited).add(event.id);
    const routes = routingByEvent.get(event.id) ?? [];
    routes.forEach((route, routeIndex) => {
      const branchRow = routeIndex === 0 ? row : nextRow++;
      const operation = operationById.get(route.to);
      const sourceEvent = eventById.get(route.from);
      const routingKey = edgeNodeKey(route.id, "routing");
      addNode({
        id: route.id,
        key: routingKey,
        kind: "routing",
        column: column + 1,
        row: branchRow,
        label: "Routing rule",
        title: route.policyName,
        subtitle: `maps trigger to ${operation?.name ?? route.to}`,
        ariaLabel: `GIVE THE AGENT Input mapping ${sourceEvent?.name ?? "Trigger"} data for ${operation?.name ?? route.to}`,
        status: statusFor(route.active, flow, route.policyId),
        selection: { kind: "routing", id: route.id },
        diagnosticCount: flow.diagnostics.filter((diagnostic) => diagnostic.affectedResource.id === route.policyId).length
      });
      edges.push({ id: `${event.id}->${route.id}`, fromKey: `event:${event.id}`, toKey: routingKey, label: "condition", kind: "routing", selection: { kind: "routing", id: route.id } });
      if (!operation) return;
      const operationKey = `operation:${operation.id}`;
      addNode({
        id: operation.id,
        key: operationKey,
        kind: "operation",
        column: column + 2,
        row: branchRow,
        label: "Agent task",
        title: operation.name,
        subtitle: operation.agentName ? `${operation.agentName} · ${operation.operationId}` : operation.operationId,
        ariaLabel: `ASK ${operation.agentName ?? operation.agentId} ${operation.name}`,
        status: statusFor(operation.active, flow, operation.operationId),
        selection: { kind: "operation", id: operation.id },
        diagnosticCount: flow.diagnostics.filter((diagnostic) => diagnostic.affectedResource.id === operation.operationId || diagnostic.affectedResource.id === operation.agentId).length
      });
      edges.push({ id: `${route.id}->${operation.id}`, fromKey: routingKey, toKey: operationKey, label: "input", kind: "routing", selection: { kind: "routing", id: route.id } });

      const emissions = emissionsByOperation.get(operation.id) ?? [];
      emissions.forEach((emission, emissionIndex) => {
        const emissionRow = emissionIndex === 0 ? branchRow : nextRow++;
        const eventTarget = eventById.get(emission.to);
        const emissionKey = edgeNodeKey(emission.id, "emission");
        addNode({
          id: emission.id,
          key: emissionKey,
          kind: "emission",
          column: column + 3,
          row: emissionRow,
        label: "Result branch",
        title: emission.slot,
        subtitle: emission.policyName,
        ariaLabel: `WHEN ${emission.slot.toUpperCase()} ${eventTarget?.name ?? emission.to} Publish via ${emission.policyName}`,
          status: statusFor(emission.active, flow, emission.policyId),
          selection: { kind: "emission", id: emission.id },
          diagnosticCount: flow.diagnostics.filter((diagnostic) => diagnostic.affectedResource.id === emission.policyId).length
        });
        edges.push({ id: `${operation.id}->${emission.id}`, fromKey: operationKey, toKey: emissionKey, label: emission.slot, kind: "emission", selection: { kind: "emission", id: emission.id } });
        if (!eventTarget) return;
        const targetKey = `event:${eventTarget.id}`;
        visitEvent(eventTarget.id, column + 4, emissionRow, nextVisited);
        edges.push({ id: `${emission.id}->${eventTarget.id}`, fromKey: emissionKey, toKey: targetKey, label: "publishes", kind: "emission", selection: { kind: "emission", id: emission.id } });
      });
    });
  };

  nextRow = flow.entryEvents.length || 1;
  flow.entryEvents.forEach((event, index) => visitEvent(event.id, 0, index, new Set()));

  return {
    nodes,
    edges,
    columns: Math.max(1, ...nodes.map((node) => node.column + 1)),
    rows: Math.max(1, ...nodes.map((node) => node.row + 1))
  };
}
