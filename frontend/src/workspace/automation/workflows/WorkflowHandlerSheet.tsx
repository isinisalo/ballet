import { useId } from "react";
import type { Agent, ProjectAction, ProjectAutomationConfig, ProjectHumanGateResponse, ProjectOutputTarget } from "@shared/api/workspace-contracts";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ActionEditorFields } from "../actions/ActionEditorFields";
import { HumanGateResponsePanel } from "./HumanGateResponsePanel";
import {
  workflowOutputTargetCanSelectTrigger,
  workflowOutputTargetFromSelectValue,
  workflowOutputTargetSelectValue
} from "./workflowOutputTargetRules";

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
  onActionPatch,
  onCreateOutput,
  onRemoveRoute,
  onOutputRouteTargetChange,
  onHumanGateSubmit
}: {
  open: boolean;
  routes: WorkflowHandlerRoute[];
  selectionSource: WorkflowHandlerSelectionSource;
  agents: Agent[];
  config: ProjectAutomationConfig;
  onOpenChange: (open: boolean, details?: WorkflowHandlerSheetOpenChangeDetails) => void;
  onRouteActionChange: (workflowId: string, stepIndex: number, actionId: string) => void;
  onActionPatch: (actionId: string, patch: Partial<ProjectAction>) => void;
  onCreateOutput: (outputId: string) => void;
  onRemoveRoute: (workflowId: string, stepIndex: number) => void;
  onOutputRouteTargetChange: (sourcePolicyId: string, outputId: string, target: ProjectOutputTarget | undefined) => void;
  onHumanGateSubmit: (route: WorkflowHandlerRoute, outputId: string, prompt: string) => void;
}) {
  const actionFieldId = useId();
  const title = selectionSource === "edge" && routes.length === 1 ? "Output handler" : "Workflow handler";
  const description = routes.length === 1
    ? workflowHandlerRouteDescription(routes[0])
    : `${routes.length} inbound routes`;
  const agentLabel = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId;
  const singleRoute = routes.length === 1 ? routes[0] : undefined;
  const singleRouteAction = singleRoute ? config.actions.find((candidate) => candidate.id === singleRoute.actionId) : undefined;
  const singleRouteResponse = singleRoute ? humanGateResponseForRoute(config, singleRoute) : undefined;
  const singleHumanGateRoute = Boolean(singleRoute && singleRouteAction?.humanGate);
  const humanGateRouteEditor = (route: WorkflowHandlerRoute, action: ProjectAction, response?: ProjectHumanGateResponse) => (
    <div className="flex flex-col gap-4">
      <ActionEditorFields
        agents={agents}
        config={config}
        action={action}
        onChange={(patch) => onActionPatch(action.id, patch)}
        onCreateOutput={onCreateOutput}
      />
      <OutputTargetControls
        config={config}
        route={route}
        outputIds={action.outputIds}
        onOutputRouteTargetChange={onOutputRouteTargetChange}
      />
      <HumanGateResponsePanel
        outputIds={action.outputIds}
        response={response}
        onSubmit={(outputId, prompt) => onHumanGateSubmit(route, outputId, prompt)}
      />
    </div>
  );

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
          {singleRoute && singleRouteAction && singleHumanGateRoute ? (
            humanGateRouteEditor(singleRoute, singleRouteAction, singleRouteResponse)
          ) : (
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
                      <WorkflowHandlerRouteEvent route={route} />
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
                    {humanGate && action ? (
                      <div className="mt-3">
                        {humanGateRouteEditor(route, action, response)}
                      </div>
                    ) : (
                      <FieldGroup className="mt-3">
                        <Field className="gap-1.5">
                          <FieldLabel htmlFor={routeActionFieldId}>Handler action</FieldLabel>
                          <Select value={route.actionId} onValueChange={(actionId) => onRouteActionChange(route.workflowId, route.stepIndex, actionId)}>
                            <SelectTrigger id={routeActionFieldId} className="min-w-0 w-full font-mono">
                              <SelectValue />
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
                        <Field className="gap-1.5">
                          <FieldLabel htmlFor={routeDescriptionFieldId}>Description</FieldLabel>
                          <Textarea
                            id={routeDescriptionFieldId}
                            value={action?.description ?? ""}
                            placeholder="No description."
                            readOnly
                            rows={3}
                            className="resize-none text-muted-foreground"
                          />
                        </Field>
                        <ReadOnlyBadges label="Agents" values={agentIds.map(agentLabel)} />
                        <ReadOnlyBadges label="Outputs" values={outputIds} />
                        <OutputTargetControls
                          config={config}
                          route={route}
                          outputIds={outputIds}
                          onOutputRouteTargetChange={onOutputRouteTargetChange}
                        />
                      </FieldGroup>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

function OutputTargetControls({
  config,
  route,
  outputIds,
  onOutputRouteTargetChange
}: {
  config: ProjectAutomationConfig;
  route: WorkflowHandlerRoute;
  outputIds: string[];
  onOutputRouteTargetChange: (sourcePolicyId: string, outputId: string, target: ProjectOutputTarget | undefined) => void;
}) {
  return (
    <Field>
      <FieldLabel>Output targets</FieldLabel>
      {outputIds.length > 0 ? (
        <div className="flex flex-col gap-2">
          {outputIds.map((outputId) => (
            <div key={outputId} className="grid grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)] items-center gap-2">
              <Badge variant="outline" className="min-w-0 justify-start border-divider-strong bg-muted/50 font-mono">
                <span className="truncate">{outputId}</span>
              </Badge>
              <Select
                value={workflowOutputTargetSelectValue(config, route.policyId, outputId)}
                onValueChange={(value) => onOutputRouteTargetChange(route.policyId, outputId, workflowOutputTargetFromSelectValue(value))}
              >
                <SelectTrigger className="min-w-0 w-full font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="event">Event</SelectItem>
                    {workflowOutputTargetCanSelectTrigger(config, route.policyId, outputId) ? config.triggers.map((trigger) => (
                      <SelectItem key={trigger.id} value={`trigger:${trigger.id}`}>
                        Trigger · {trigger.id}
                      </SelectItem>
                    )) : null}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      ) : <span className="text-sm text-muted-foreground">None</span>}
    </Field>
  );
}

function WorkflowHandlerRouteEvent({ route }: { route: WorkflowHandlerRoute }) {
  return (
    <div className="min-w-0 truncate font-mono text-xs" title={route.eventType ?? route.sourceLabel}>
      {route.outputId ? (
        <>
          <span className="text-tertiary">{route.sourceLabel}</span>
          <span className="text-muted-foreground">.</span>
          <span className="text-primary">{route.outputId}</span>
        </>
      ) : (
        <span className="text-tertiary">{route.sourceLabel}</span>
      )}
    </div>
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
