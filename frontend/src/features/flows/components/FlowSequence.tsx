import type { ReactNode } from "react";
import type { FlowViewModel } from "backend/shared/flow";
import { EmptyState } from "@/components/forms/FormControls";
import { cn } from "@/lib/utils";
import type { FlowSelection } from "@/features/flows/model/flow-page-model";

export function FlowSequence({
  flow,
  selected,
  onSelect
}: {
  flow: FlowViewModel;
  selected?: FlowSelection;
  onSelect: (selection: FlowSelection) => void;
}) {
  const events = new Map(flow.nodes.filter((node) => node.kind === "event").map((node) => [node.id, node]));
  const operations = new Map(flow.nodes.filter((node) => node.kind === "operation").map((node) => [node.id, node]));
  const routingByEvent = new Map<string, typeof flow.edges>();
  const emissionsByOperation = new Map<string, typeof flow.edges>();
  for (const edge of flow.edges) {
    if (edge.kind === "routing") {
      routingByEvent.set(edge.from, [...(routingByEvent.get(edge.from) ?? []), edge]);
    } else {
      emissionsByOperation.set(edge.from, [...(emissionsByOperation.get(edge.from) ?? []), edge]);
    }
  }
  const renderAfterEvent = (eventId: string, visited: Set<string>): ReactNode[] => (routingByEvent.get(eventId) ?? []).flatMap((edge) => {
    if (edge.kind !== "routing") return [];
    const sourceEvent = events.get(edge.from);
    const operation = operations.get(edge.to);
    if (!operation) return [];
    const operationVisited = new Set(visited).add(operation.id);
    return [
      <StepCard
        key={`${edge.id}:routing`}
        label="GIVE THE AGENT"
        title="Input mapping"
        detail={`${sourceEvent?.name ?? "Trigger"} data for ${operation.name}`}
        selection={{ kind: "routing", id: edge.id }}
        selected={selected}
        onSelect={onSelect}
      />,
      <StepCard
        key={`${edge.id}:operation`}
        label="ASK"
        title={operation.agentName ?? operation.agentId}
        detail={operation.name}
        selection={{ kind: "operation", id: operation.id }}
        selected={selected}
        onSelect={onSelect}
      />,
      ...(emissionsByOperation.get(operation.id) ?? []).flatMap((emission) => {
        if (emission.kind !== "emission") return [];
        const event = events.get(emission.to);
        const emittedStep = (
          <StepCard
            key={emission.id}
            label={emission.slot === "completed" ? "WHEN COMPLETED" : `WHEN ${emission.slot.toUpperCase()}`}
            title={event?.name ?? emission.to}
            detail={`Publish via ${emission.policyName}`}
            selection={{ kind: "emission", id: emission.id }}
            selected={selected}
            onSelect={onSelect}
          />
        );
        if (!event || operationVisited.has(event.id)) return [emittedStep];
        return [emittedStep, ...renderAfterEvent(event.id, new Set(operationVisited).add(event.id))];
      })
    ];
  });
  return (
    <div className="grid gap-3">
      {flow.entryEvents.map((entry) => (
        <div key={entry.id} className="grid gap-3">
          <StepCard
            label="WHEN"
            title={entry.name}
            detail={entry.description}
            selection={{ kind: "event", id: entry.id }}
            selected={selected}
            onSelect={onSelect}
          />
          {renderAfterEvent(entry.id, new Set([entry.id]))}
        </div>
      ))}
      {flow.entryEvents.length === 0 ? <EmptyState title="This Flow has no entry trigger." /> : null}
    </div>
  );
}

function StepCard({
  label,
  title,
  detail,
  selection,
  selected,
  onSelect
}: {
  label: string;
  title: string;
  detail: string;
  selection: FlowSelection;
  selected?: FlowSelection;
  onSelect: (selection: FlowSelection) => void;
}) {
  const isSelected = selected?.kind === selection.kind && selected.id === selection.id;
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={cn(
        "grid gap-1 rounded-md border bg-background p-3 text-left transition-colors hover:bg-accent",
        isSelected && "border-primary bg-primary/10"
      )}
      onClick={() => onSelect(selection)}
    >
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{detail}</div>
    </button>
  );
}
