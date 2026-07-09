import { useEffect, useId } from "react";
import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { actionOutputIds } from "@shared/policy-actions";
import { HumanGateResponsePanel } from "./HumanGateResponsePanel";
import { LoopOutputHandlerControls } from "./LoopOutputHandlerControls";
import { loopActionTokenClassName } from "./loopSheetTokenStyles";

type LoopHandlerSheetOpenChangeDetails = {
  reason?: string;
};

export type LoopHandlerSelectionSource = "node" | "edge";

export type LoopHandlerRoute = {
  id: string;
  loopId: string;
  stepIndex: number;
  sourceLabel: string;
  outputId?: string;
  eventType?: string;
  actionId: string;
  actionLabel: string;
};

export function LoopHandlerSheet({
  open,
  routes,
  selectionSource,
  agents,
  config,
  onOpenChange,
  onRouteActionChange,
  onRemoveRoute,
  onOutputHandlerRouteChange,
  onOutputHandlerRouteClear,
  onHumanGateSubmit
}: {
  open: boolean;
  routes: LoopHandlerRoute[];
  selectionSource: LoopHandlerSelectionSource;
  agents: Agent[];
  config: ProjectAutomationConfig;
  onOpenChange: (open: boolean, details?: LoopHandlerSheetOpenChangeDetails) => void;
  onRouteActionChange: (loopId: string, stepIndex: number, actionId: string) => void;
  onRemoveRoute: (loopId: string, stepIndex: number) => void;
  onOutputHandlerRouteChange: (
    sourceLoopId: string,
    sourceActionId: string,
    outputId: string,
    targetLoopId: string,
    targetActionId: string
  ) => void;
  onOutputHandlerRouteClear: (
    sourceLoopId: string,
    sourceActionId: string,
    outputId: string
  ) => void;
  onHumanGateSubmit: (route: LoopHandlerRoute, outputId: string, prompt: string) => void;
}) {
  const actionFieldId = useId();
  const title = selectionSource === "edge" && routes.length === 1 ? "Output handler" : "Loop handler";
  const description = routes.length === 1
    ? "Edit selected loop handler."
    : `${routes.length} selected loop handlers`;
  const agentLabel = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId;

  useLoopHandlerEscapeClose(open, onOpenChange);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <SheetContent
        side="right"
        overlayClassName="pointer-events-none bg-black/5 supports-backdrop-filter:backdrop-blur-[1px]"
        className="overflow-y-auto"
        style={{ width: "min(98vw, 56rem)", maxWidth: "56rem" }}
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
              const slotIds = action ? actionOutputIds(config.actions, action.id) : [];
              const agentId = action?.agentId;
              const humanGate = Boolean(action?.humanGate);
              const response = humanGateResponseForRoute(config, route);
              const routeActionFieldId = `${actionFieldId}-${route.stepIndex}`;
              const routeDescriptionFieldId = `${actionFieldId}-${route.stepIndex}-description`;

              return (
                <div key={route.id} className="rounded-md border border-divider-strong bg-card/80 p-3">
                  {routes.length > 1 ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove route ${route.actionLabel}`}
                        title="Remove route"
                        onClick={() => onRemoveRoute(route.loopId, route.stepIndex)}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  ) : null}
                  <FieldGroup className={routes.length > 1 ? "mt-2" : undefined}>
                    <LoopRouteActionSelect
                      id={routeActionFieldId}
                      route={route}
                      config={config}
                      onRouteActionChange={onRouteActionChange}
                    />
                    {action ? (
                      <>
                        <LoopRouteDescriptionField
                          id={routeDescriptionFieldId}
                          description={action.description}
                        />
                        {humanGate ? <HumanOperatorField /> : <ReadOnlyBadges label="Agent" values={agentId ? [agentLabel(agentId)] : []} />}
                        <LoopOutputHandlerControls
                          config={config}
                          route={route}
                          slotIds={slotIds}
                          label={humanGate ? "Output routing" : "Outputs"}
                          onOutputHandlerRouteChange={onOutputHandlerRouteChange}
                          onOutputHandlerRouteClear={onOutputHandlerRouteClear}
                        />
                        {humanGate ? (
                          <HumanGateResponsePanel
                            slotIds={slotIds}
                            response={response}
                            onSubmit={(outputId, prompt) => onHumanGateSubmit(route, outputId, prompt)}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </FieldGroup>
                </div>
              );
            })}
          </div>
          {routes.length === 1 && routes[0] && config.actions.some((action) => action.id === routes[0]?.actionId) ? (
            <div className="mt-4 border-t border-divider-strong pt-4">
              <Button type="button" variant="destructive" size="sm" onClick={() => onRemoveRoute(routes[0].loopId, routes[0].stepIndex)}>
                <Trash2 data-icon="inline-start" />
                Remove from loop
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function useLoopHandlerEscapeClose(
  open: boolean,
  onOpenChange: (open: boolean, details?: LoopHandlerSheetOpenChangeDetails) => void
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

function LoopRouteActionSelect({
  id,
  route,
  config,
  onRouteActionChange
}: {
  id: string;
  route: LoopHandlerRoute;
  config: ProjectAutomationConfig;
  onRouteActionChange: (loopId: string, stepIndex: number, actionId: string) => void;
}) {
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>Handler action</FieldLabel>
      <Select
        value={route.actionId || undefined}
        onValueChange={(actionId) => onRouteActionChange(route.loopId, route.stepIndex, actionId)}
      >
        <SelectTrigger
          id={id}
          size="sm"
          className="h-5 min-h-5 w-full max-w-full rounded-xl border-primary/60 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary shadow-none"
          title={route.actionLabel || "Select handler action"}
        >
          <SelectValue className={route.actionId ? loopActionTokenClassName() : "text-muted-foreground"} placeholder={route.actionId || "Action"} />
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

function LoopRouteDescriptionField({ id, description }: { id: string; description: string }) {
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
      <FieldLabel>Agent</FieldLabel>
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-tertiary/60 bg-tertiary/10 font-mono text-tertiary">
          <ShieldCheck data-icon="inline-start" />
          Human operator
        </Badge>
      </div>
    </Field>
  );
}

function humanGateResponseForRoute(config: ProjectAutomationConfig, route: LoopHandlerRoute) {
  return config.humanGateResponses.find((candidate) =>
    candidate.loopId === route.loopId &&
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
