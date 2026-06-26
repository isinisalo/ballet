import type { AppData } from "backend/shared/domain";
import type { FlowSettingsUpdateDraft, FlowViewModel } from "backend/shared/flow";
import { InspectorDrawer } from "@/design-system/components/InspectorDrawer";
import { StatusPill, flowHealthTone } from "@/design-system/components/StatusPill";
import { FlowInspector } from "@/features/flows/components/FlowInspector";
import type { FlowSelection } from "@/features/flows/model/flow-page-model";

const selectionLabel = (flow: FlowViewModel, selection?: FlowSelection): { title: string; subtitle: string } => {
  if (!selection) return { title: "Select a node", subtitle: "Choose a canvas node or edge to inspect runtime contracts." };
  if (selection.kind === "settings") return { title: "Flow settings", subtitle: flow.name };
  if (selection.kind === "event") {
    const node = flow.nodes.find((item): item is Extract<FlowViewModel["nodes"][number], { kind: "event" }> => item.kind === "event" && item.id === selection.id);
    return { title: node?.name ?? "Event", subtitle: node?.eventType ?? selection.id };
  }
  if (selection.kind === "operation") {
    const node = flow.nodes.find((item): item is Extract<FlowViewModel["nodes"][number], { kind: "operation" }> => item.kind === "operation" && item.id === selection.id);
    return { title: node?.name ?? "Agent task", subtitle: node?.agentName ?? node?.operationId ?? selection.id };
  }
  const edge = flow.edges.find((item) => item.id === selection.id);
  return { title: edge?.kind === "routing" ? "Routing rule" : "Result branch", subtitle: edge?.kind === "routing" ? edge.policyName : edge?.policyName ?? selection.id };
};

export function FlowInspectorDrawer({
  data,
  flow,
  selection,
  onUpdateSettings,
  onClose
}: {
  data: AppData;
  flow: FlowViewModel;
  selection?: FlowSelection;
  onUpdateSettings: (flow: FlowViewModel, draft: FlowSettingsUpdateDraft) => Promise<void>;
  onClose?: () => void;
}) {
  const copy = selectionLabel(flow, selection);
  return (
    <InspectorDrawer title={copy.title} subtitle={copy.subtitle} onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        <StatusPill tone={flow.active ? "success" : "neutral"}>{flow.active ? "active" : "draft"}</StatusPill>
        <StatusPill tone={flowHealthTone(flow.health)}>{flow.health}</StatusPill>
        {flow.diagnostics.length ? <StatusPill tone="warning">{flow.diagnostics.length} diagnostics</StatusPill> : null}
      </div>
      {selection ? <FlowInspector data={data} flow={flow} selection={selection} onUpdateSettings={onUpdateSettings} /> : null}
    </InspectorDrawer>
  );
}
