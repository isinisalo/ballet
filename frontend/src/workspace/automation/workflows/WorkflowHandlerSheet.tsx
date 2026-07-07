import { useEffect, useId } from "react";
import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { HumanGateResponsePanel } from "./HumanGateResponsePanel";
import { WorkflowOutputHandlerControls } from "./WorkflowOutputHandlerControls";
import { workflowActionTokenClassName, workflowOutputTokenClassName } from "./workflowSheetTokenStyles";

type WorkflowHandlerSheetOpenChangeDetails = {
  reason?: string;
};

export type WorkflowHandlerSelectionSource = "node" | "edge";

export type WorkflowHandlerRoute = {
  id: string;
  workflowId: string;
  stepIndex: number;
  policyId: string;
  sourceLabel: string;
  outputId?: string;
  eventType?: string;
  actionId: string;
};

export function WorkflowHandlerSheet({
  open,
  routes,
  selectionSource,
  agents,
  config,
  onOpenChange,
  onRouteActionChange,
  onRemoveRoute,
  onOutputHandlerActionChange,
  onHumanGateSubmit
}: {
  open: boolean;
  routes: WorkflowHandlerRoute[];
  selectionSource: WorkflowHandlerSelectionSource;
  agents: Agent[];
  config: ProjectAutomationConfig;
  onOpenChange: (open: boolean, details?: WorkflowHandlerSheetOpenChangeDetails) => void;
  onRouteActionChange: (workflowId: string, stepIndex: number, actionId: string) => void;
  onRemoveRoute: (workflowId: string, stepIndex: number) => void;
  onOutputHandlerActionChange: (workflowId: string, stepIndex: number, actionId: string) => void;
  onHumanGateSubmit: (route: WorkflowHandlerRoute, outputId: string, prompt: string) => void;
}) {
  const actionFieldId = useId();
  const title = selectionSource === "edge" && routes.length === 1 ? "Output handler" : "Workflow handler";
  const description = routes.length === 1
    ? workflowHandlerRouteDescription(routes[0])
    : `${routes.length} inbound routes`;
  const agentLabel = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId;

  useWorkflowHandlerEscapeClose(open, onOpenChange);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <SheetContent
        side="right"
        overlayClassName="pointer-events-none bg-black/5 supports-backdrop-filter:backdrop-blur-[1px]"
        className="overflow-y-auto sm:max-w-md"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <div className="flex flex-col gap-3">
            {routes.map((route) => {
              const action = config.actions.find((candidate) => candidate.id === route.actionId);
              const outputIds = action?.outputIds ?? [];
              const agentIds = action?.agentIds ?? [];
              const humanGate = Boolean(action?.humanGate);
              const response = humanGateResponseForRoute(config, route);
              const routeActionFieldId = `${actionFieldId}-${route.stepIndex}`;
              const routeDescriptionFieldId = `${actionFieldId}-${route.stepIndex}-description`;

              return (
                <div key={route.id} className="rounded-md border border-divider-strong bg-card/80 p-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium leading-snug">Input</span>
                      <WorkflowHandlerRouteEvent route={route} />
                    </div>
                    {routes.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove route ${workflowHandlerRouteDescription(route)}`}
                        title="Remove route"
                        onClick={() => onRemoveRoute(route.workflowId, route.stepIndex)}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    ) : null}
                  </div>
                  <FieldGroup className="mt-3">
                    <WorkflowRouteActionSelect
                      id={routeActionFieldId}
                      route={route}
                      config={config}
                      onRouteActionChange={onRouteActionChange}
                    />
                    <WorkflowRouteDescriptionField
                      id={routeDescriptionFieldId}
                      description={action?.description ?? ""}
                    />
                    {humanGate ? <HumanOperatorField /> : <ReadOnlyBadges label="Agents" values={agentIds.map(agentLabel)} />}
                    <WorkflowOutputHandlerControls
                      config={config}
                      route={route}
                      outputIds={outputIds}
                      label={humanGate ? "Output routing" : "Outputs"}
                      onOutputHandlerActionChange={onOutputHandlerActionChange}
                    />
                    {humanGate ? (
                      <HumanGateResponsePanel
                        outputIds={outputIds}
                        response={response}
                        onSubmit={(outputId, prompt) => onHumanGateSubmit(route, outputId, prompt)}
                      />
                    ) : null}
                  </FieldGroup>
                </div>
              );
            })}
          </div>
          {routes.length === 1 && routes[0] ? (
            <div className="mt-4 border-t border-divider-strong pt-4">
              <Button type="button" variant="destructive" size="sm" onClick={() => onRemoveRoute(routes[0].workflowId, routes[0].stepIndex)}>
                <Trash2 data-icon="inline-start" />
                Remove from workflow
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function useWorkflowHandlerEscapeClose(
  open: boolean,
  onOpenChange: (open: boolean, details?: WorkflowHandlerSheetOpenChangeDetails) => void
) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onOpenChange(false, { reason: "escape-key" });
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);
}

function WorkflowHandlerRouteEvent({ route }: { route: WorkflowHandlerRoute }) {
  return (
    <div className="min-w-0 truncate font-mono text-xs" title={route.eventType ?? route.sourceLabel}>
      {route.outputId ? (
        <>
          <span className={workflowActionTokenClassName()}>{route.sourceLabel}</span>
          <span className="text-muted-foreground">.</span>
          <span className={workflowOutputTokenClassName(route.outputId)}>{route.outputId}</span>
        </>
      ) : (
        <span className={workflowActionTokenClassName()}>{route.sourceLabel}</span>
      )}
    </div>
  );
}

function WorkflowRouteActionSelect({
  id,
  route,
  config,
  onRouteActionChange
}: {
  id: string;
  route: WorkflowHandlerRoute;
  config: ProjectAutomationConfig;
  onRouteActionChange: (workflowId: string, stepIndex: number, actionId: string) => void;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>Handler action</FieldLabel>
      <Select
        value={route.actionId}
        items={config.actions.map((option) => ({ value: option.id, label: option.id }))}
        onValueChange={(actionId) => onRouteActionChange(route.workflowId, route.stepIndex, actionId)}
      >
        <SelectTrigger
          id={id}
          size="sm"
          className="h-5 min-h-5 w-fit max-w-full rounded-xl border-primary/60 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary shadow-none"
          title={route.actionId}
        >
          <SelectValue className={workflowActionTokenClassName()} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {config.actions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.description ? `${option.id} · ${option.description}` : option.id}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function WorkflowRouteDescriptionField({ id, description }: { id: string; description: string }) {
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>Description</FieldLabel>
      <Textarea
        id={id}
        value={description}
        placeholder="No description."
        readOnly
        rows={3}
        className="resize-none text-muted-foreground"
      />
    </Field>
  );
}

function HumanOperatorField() {
  return (
    <Field>
      <FieldLabel>Agents</FieldLabel>
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-tertiary/60 bg-tertiary/10 font-mono text-tertiary">
          <ShieldCheck data-icon="inline-start" />
          Human operator
        </Badge>
      </div>
    </Field>
  );
}

function humanGateResponseForRoute(config: ProjectAutomationConfig, route: WorkflowHandlerRoute) {
  return config.humanGateResponses.find((candidate) =>
    candidate.workflowId === route.workflowId &&
    candidate.policyId === route.policyId &&
    candidate.actionId === route.actionId
  );
}

function ReadOnlyBadges({ label, values }: { label: string; values: string[] }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        {values.length > 0 ? values.map((value) => (
          <Badge key={value} variant="outline" className="border-divider-strong bg-muted/50 font-mono">
            {value}
          </Badge>
        )) : <span className="text-sm text-muted-foreground">None</span>}
      </div>
    </Field>
  );
}

function workflowHandlerRouteDescription(route: WorkflowHandlerRoute | undefined) {
  if (!route) return "Edit selected workflow handler.";
  return route.outputId
    ? `${route.sourceLabel} -> ${route.outputId} -> ${route.actionId}`
    : `${route.sourceLabel} -> ${route.actionId}`;
}
