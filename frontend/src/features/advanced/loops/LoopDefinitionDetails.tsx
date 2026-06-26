import { Save } from "lucide-react";
import { useState } from "react";
import type { AppData } from "backend/shared/domain";
import type { LoopDefinition } from "backend/shared/loop";
import { api } from "@/api";
import { Button, TextAreaField, TextField } from "@/components/forms/FormControls";
import { EventSelect } from "@/components/simple-rules/EventSelect";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FlowBoundaryPreview } from "@/features/advanced/loops/FlowBoundaryPreview";
import { SimpleFlowBoundaryCard } from "@/features/advanced/loops/SimpleFlowBoundaryCard";
import { SimpleFlowBoundaryEditor } from "@/features/advanced/loops/SimpleFlowBoundaryEditor";
import {
  deriveReachableRulesFromEntryEvent,
  loopDefinitionFromSimpleBoundaryDraft,
  simpleFlowBoundaryFromLoop,
  suggestTerminalEvents
} from "@/features/advanced/loops/flow-boundary-view-model";
import { PanelHeading } from "@/features/advanced/components/AdvancedPanels";
import { eventNameFor, operationNameFor } from "@/features/advanced/model/advanced-resource-model";

export function LoopDefinitionDetails({ loop, data, refresh = async () => undefined }: { loop: LoopDefinition; data: AppData; refresh?: () => Promise<void> }) {
  const [name, setName] = useState(loop.name);
  const [description, setDescription] = useState(loop.description);
  const [active, setActive] = useState(loop.active);
  const [entryEventType, setEntryEventType] = useState(loop.entryEventTypes[0] ?? "");
  const [routingPolicyIds, setRoutingPolicyIds] = useState(loop.routingPolicyIds);
  const [emissionPolicyIds, setEmissionPolicyIds] = useState(loop.emissionPolicyIds);
  const [terminalEventTypes, setTerminalEventTypes] = useState(loop.terminalEventTypes);
  const [limitExceededEventType, setLimitExceededEventType] = useState(loop.onLimitExceeded?.eventType ?? "");
  const [maxHops, setMaxHops] = useState(String(loop.limits.maxHops));
  const [maxRuns, setMaxRuns] = useState(String(loop.limits.maxRuns));
  const [maxIterationsPerStep, setMaxIterationsPerStep] = useState(String(loop.limits.maxIterationsPerStep));
  const [deadlineSeconds, setDeadlineSeconds] = useState(loop.limits.deadlineSeconds === undefined ? "" : String(loop.limits.deadlineSeconds));
  const [message, setMessage] = useState("");
  const boundary = simpleFlowBoundaryFromLoop({ ...loop, name, description, active, entryEventTypes: entryEventType ? [entryEventType] : [], routingPolicyIds, emissionPolicyIds, terminalEventTypes, onLimitExceeded: limitExceededEventType ? { eventType: limitExceededEventType } : undefined, limits: { maxHops: Number(maxHops) || loop.limits.maxHops, maxRuns: Number(maxRuns) || loop.limits.maxRuns, maxIterationsPerStep: Number(maxIterationsPerStep) || loop.limits.maxIterationsPerStep, ...(deadlineSeconds ? { deadlineSeconds: Number(deadlineSeconds) } : {}) } }, data);

  const toggle = (value: string, values: string[], setValues: (values: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const createFromRules = () => {
    if (!entryEventType) return;
    const reachable = deriveReachableRulesFromEntryEvent(data, entryEventType);
    setRoutingPolicyIds(reachable.routingPolicyIds);
    setEmissionPolicyIds(reachable.emissionPolicyIds);
    setTerminalEventTypes(suggestTerminalEvents(data, reachable.routingPolicyIds, reachable.emissionPolicyIds));
  };

  const save = async () => {
    setMessage("");
    try {
      await api.save("loopDefinitions", loopDefinitionFromSimpleBoundaryDraft(loop, {
        name,
        description,
        active,
        entryEventTypes: entryEventType ? [entryEventType] : [],
        routingPolicyIds,
        emissionPolicyIds,
        terminalEventTypes,
        limitExceededEventType: limitExceededEventType || undefined,
        limits: {
          maxHops: Number(maxHops) || 30,
          maxRuns: Number(maxRuns) || 50,
          maxIterationsPerStep: Number(maxIterationsPerStep) || 5,
          ...(deadlineSeconds ? { deadlineSeconds: Number(deadlineSeconds) } : {})
        }
      }));
      setMessage("Flow boundary saved.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save Flow boundary.");
    }
  };

  return (
    <SimpleFlowBoundaryEditor>
      <SimpleFlowBoundaryCard boundary={boundary} />
      <PanelHeading title="Flow boundary" description="A Flow boundary groups routing and emission rules so Ballet knows which event starts the Flow, which rules belong to it, when the Flow is finished, and how to stop it safely if it loops too long." />
      {message ? <div role="status" className="rounded-md border bg-muted/20 p-3 text-sm">{message}</div> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} />
        <EventSelect label="Starts when" value={entryEventType} events={data.eventDefinitions.filter((event) => event.active)} onChange={setEntryEventType} />
        <div className="md:col-span-2">
          <TextAreaField label="Description" value={description} onChange={setDescription} rows={2} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id={`flow-boundary-enabled-${loop.id}`} checked={active} onCheckedChange={setActive} />
        <Label htmlFor={`flow-boundary-enabled-${loop.id}`}>Enabled</Label>
      </div>
      <div>
        <Button type="button" variant="outline" onClick={createFromRules}>Create Flow boundary from rules</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CheckboxList
          title="Routing rules included"
          items={data.policies.map((policy) => ({ id: policy.id, label: `${eventNameFor(data, policy.consumes.eventType)} -> ${operationNameFor(data, policy.dispatch.operation)}` }))}
          selected={routingPolicyIds}
          onToggle={(id) => toggle(id, routingPolicyIds, setRoutingPolicyIds)}
        />
        <CheckboxList
          title="Emission rules included"
          items={data.emissionPolicies.map((policy) => ({ id: policy.id, label: `${operationNameFor(data, policy.observes.operation)} -> ${policy.emissions.map((emission) => eventNameFor(data, emission.eventType)).join(", ")}` }))}
          selected={emissionPolicyIds}
          onToggle={(id) => toggle(id, emissionPolicyIds, setEmissionPolicyIds)}
        />
      </div>
      <CheckboxList
        title="Ends when"
        items={data.eventDefinitions.map((event) => ({ id: event.eventType, label: event.name }))}
        selected={terminalEventTypes}
        onToggle={(id) => toggle(id, terminalEventTypes, setTerminalEventTypes)}
      />
      <EventSelect label="If limits are exceeded" value={limitExceededEventType} events={data.eventDefinitions.filter((event) => event.active)} onChange={setLimitExceededEventType} />
      <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
        <h3 className="text-sm font-medium">Safety</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <TextField label="Maximum steps" value={maxHops} onChange={setMaxHops} type="number" />
          <TextField label="Maximum agent runs" value={maxRuns} onChange={setMaxRuns} type="number" />
          <TextField label="Maximum repetitions of one step" value={maxIterationsPerStep} onChange={setMaxIterationsPerStep} type="number" />
          <TextField label="Maximum duration" value={deadlineSeconds} onChange={setDeadlineSeconds} type="number" />
        </div>
      </div>
      <FlowBoundaryPreview steps={boundary.previewSteps} />
      <div className="flex justify-end">
        <Button type="button" onClick={() => void save()}><Save className="size-4" />Save Flow boundary</Button>
      </div>
    </SimpleFlowBoundaryEditor>
  );
}

function CheckboxList({
  title,
  items,
  selected,
  onToggle
}: {
  title: string;
  items: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {items.length ? items.map((item) => (
        <label key={item.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
          {item.label}
        </label>
      )) : <div className="text-sm text-muted-foreground">No options available.</div>}
    </div>
  );
}
