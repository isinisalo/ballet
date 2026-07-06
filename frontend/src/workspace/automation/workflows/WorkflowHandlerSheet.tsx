import { useId } from "react";
import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type WorkflowHandlerSheetOpenChangeDetails = {
  reason?: string;
};

export type WorkflowHandlerSelectionSource = "node" | "edge";

export type WorkflowHandlerRoute = {
  id: string;
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
  onRemoveRoute
}: {
  open: boolean;
  routes: WorkflowHandlerRoute[];
  selectionSource: WorkflowHandlerSelectionSource;
  agents: Agent[];
  config: ProjectAutomationConfig;
  onOpenChange: (open: boolean, details?: WorkflowHandlerSheetOpenChangeDetails) => void;
  onRouteActionChange: (stepIndex: number, actionId: string) => void;
  onRemoveRoute: (stepIndex: number) => void;
}) {
  const actionFieldId = useId();
  const title = selectionSource === "edge" && routes.length === 1 ? "Output handler" : "Workflow handler";
  const description = routes.length === 1
    ? workflowHandlerRouteDescription(routes[0])
    : `${routes.length} inbound routes`;
  const agentLabel = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId;

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
              const routeActionFieldId = `${actionFieldId}-${route.stepIndex}`;
              const routeDescriptionFieldId = `${actionFieldId}-${route.stepIndex}-description`;

              return (
                <div key={route.id} className="rounded-md border border-divider-strong bg-card/80 p-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <WorkflowHandlerRoutePath route={route} />
                    {routes.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove route ${workflowHandlerRouteDescription(route)}`}
                        title="Remove route"
                        onClick={() => onRemoveRoute(route.stepIndex)}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    ) : null}
                  </div>
                  {route.eventType ? <div className="mt-2 truncate font-mono text-xs text-muted-foreground">{route.eventType}</div> : null}
                  <FieldGroup className="mt-3">
                    <Field className="gap-1.5">
                      <FieldLabel htmlFor={routeActionFieldId}>Handler action</FieldLabel>
                      <Select value={route.actionId} onValueChange={(actionId) => onRouteActionChange(route.stepIndex, actionId)}>
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
                  </FieldGroup>
                </div>
              );
            })}
          </div>
          {routes.length === 1 && routes[0] ? (
            <div className="mt-4 border-t border-divider-strong pt-4">
              <Button type="button" variant="destructive" size="sm" onClick={() => onRemoveRoute(routes[0].stepIndex)}>
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

function WorkflowHandlerRoutePath({ route }: { route: WorkflowHandlerRoute }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 font-mono text-xs">
      <Badge variant="outline" className="max-w-full border-divider-strong bg-muted/50 font-mono">
        <span className="truncate">{route.sourceLabel}</span>
      </Badge>
      {route.outputId ? (
        <>
          <span className="text-muted-foreground">-&gt;</span>
          <Badge variant="outline" className="max-w-full border-primary/50 bg-background font-mono text-primary">
            <span className="truncate">{route.outputId}</span>
          </Badge>
        </>
      ) : null}
      <span className="text-muted-foreground">-&gt;</span>
      <Badge variant="outline" className="max-w-full border-divider-strong bg-muted/50 font-mono text-tertiary">
        <span className="truncate">{route.actionId || "Missing action"}</span>
      </Badge>
    </div>
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
