import type { AppData } from "backend/shared/domain";
import type { FlowSettingsUpdateDraft, FlowViewModel } from "backend/shared/flow";
import {
  EmissionInspector,
  EventInspector,
  FlowSettingsInspector,
  OperationInspector,
  RoutingInspector
} from "@/features/flows/components/FlowInspectorPanels";
import {
  isFlowEmissionEdge,
  isFlowEventNode,
  isFlowOperationNode,
  isFlowRoutingEdge,
  type FlowSelection
} from "@/features/flows/model/flow-page-model";

export function FlowInspector({
  data,
  flow,
  selection,
  onUpdateSettings
}: {
  data: AppData;
  flow: FlowViewModel;
  selection: FlowSelection;
  onUpdateSettings: (flow: FlowViewModel, draft: FlowSettingsUpdateDraft) => Promise<void>;
}) {
  if (selection.kind === "settings") return <FlowSettingsInspector data={data} flow={flow} onSave={onUpdateSettings} />;
  if (selection.kind === "event") {
    const event = flow.nodes.find((node) => node.id === selection.id);
    if (!isFlowEventNode(event)) return null;
    const definition = data.eventDefinitions.find((item) => item.eventType === event.eventType);
    return <EventInspector event={event} definition={definition} data={data} />;
  }
  if (selection.kind === "operation") {
    const operationNode = flow.nodes.find((node) => node.id === selection.id);
    if (!isFlowOperationNode(operationNode)) return null;
    const operation = data.operations.find((item) => item.id === operationNode.operationId && item.version === operationNode.version);
    return <OperationInspector data={data} operationNode={operationNode} operation={operation} />;
  }
  if (selection.kind === "routing") {
    const edge = flow.edges.find((item) => item.id === selection.id);
    if (!isFlowRoutingEdge(edge)) return null;
    const policy = data.policies.find((item) => item.id === edge.policyId);
    const source = flow.nodes.find((node) => node.id === edge.from);
    const target = flow.nodes.find((node) => node.id === edge.to);
    return <RoutingInspector edge={edge} policy={policy} source={source} target={target} />;
  }
  const edge = flow.edges.find((item) => item.id === selection.id);
  if (!isFlowEmissionEdge(edge)) return null;
  const policy = data.emissionPolicies.find((item) => item.id === edge.policyId && item.version === edge.policyVersion);
  const source = flow.nodes.find((node) => node.id === edge.from);
  const target = flow.nodes.find((node) => node.id === edge.to);
  return <EmissionInspector edge={edge} policy={policy} source={source} target={target} />;
}
