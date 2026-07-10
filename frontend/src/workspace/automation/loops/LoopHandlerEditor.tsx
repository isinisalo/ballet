import { useId } from "react";
import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputIds } from "@shared/policy-actions";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HumanGateResponsePanel } from "./HumanGateResponsePanel";
import type { LoopHandlerRoute } from "./LoopHandlerSheet";
import { LoopOutputHandlerControls } from "./LoopOutputHandlerControls";
import { loopActionTokenClassName } from "./loopSheetTokenStyles";

export function LoopHandlerEditor({
  routes,
  agents,
  config,
  onRouteActionChange,
  onRemoveRoute,
  onOutputHandlerRouteChange,
  onOutputHandlerRouteClear,
  onHumanGateSubmit
}: {
  routes: LoopHandlerRoute[];
  agents: Agent[];
  config: ProjectAutomationConfig;
  onRouteActionChange: (loopId: string, stepIndex: number, actionId: string) => void;
  onRemoveRoute: (loopId: string, stepIndex: number) => void;
  onOutputHandlerRouteChange: (sourceLoopId: string, sourceActionId: string, outputId: string, targetLoopId: string, targetActionId: string) => void;
  onOutputHandlerRouteClear: (sourceLoopId: string, sourceActionId: string, outputId: string) => void;
  onHumanGateSubmit: (route: LoopHandlerRoute, outputId: string, prompt: string) => void;
}) {
  const actionFieldId = useId();
  const agentLabel = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId;

  return (
    <section aria-label="Loop handler editor" className="min-w-0 overflow-y-auto px-3 py-2.5 text-xs">
      <div className="divide-y divide-divider-strong">
        {routes.map((route) => {
          const action = config.actions.find((candidate) => candidate.id === route.actionId);
          const slotIds = action ? actionOutputIds(config.actions, action.id) : [];
          const agentId = action?.agentId;
          const humanGate = Boolean(action?.humanGate);
          const response = humanGateResponseForRoute(config, route);
          const routeActionFieldId = `${actionFieldId}-${route.stepIndex}`;
          const routeDescriptionFieldId = `${actionFieldId}-${route.stepIndex}-description`;

          return (
            <div key={route.id} className="py-3 first:pt-0 last:pb-0">
              {routes.length > 1 ? (
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[0.65rem] text-muted-foreground">{route.sourceLabel}</span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove route ${route.actionLabel}`} title="Remove route" onClick={() => onRemoveRoute(route.loopId, route.stepIndex)}>
                    <Trash2 data-icon="inline-start" />
                  </Button>
                </div>
              ) : null}
              <FieldGroup className="gap-3">
                <LoopRouteActionSelect id={routeActionFieldId} route={route} config={config} onRouteActionChange={onRouteActionChange} />
                {action ? (
                  <>
                    <LoopRouteDescriptionField id={routeDescriptionFieldId} description={action.description} />
                    {humanGate ? <HumanOperatorField /> : <ReadOnlyBadges label="Agent" values={agentId ? [agentLabel(agentId)] : []} />}
                    <LoopOutputHandlerControls
                      config={config}
                      route={route}
                      slotIds={slotIds}
                      label={humanGate ? "Output routing" : "Outputs"}
                      onOutputHandlerRouteChange={onOutputHandlerRouteChange}
                      onOutputHandlerRouteClear={onOutputHandlerRouteClear}
                    />
                    {humanGate ? <HumanGateResponsePanel slotIds={slotIds} response={response} onSubmit={(outputId, prompt) => onHumanGateSubmit(route, outputId, prompt)} /> : null}
                  </>
                ) : null}
              </FieldGroup>
            </div>
          );
        })}
      </div>
      {routes.length === 1 && routes[0] && config.actions.some((action) => action.id === routes[0]?.actionId) ? (
        <div className="mt-3 border-t border-divider-strong pt-2">
          <Button type="button" variant="ghost" size="xs" className="px-1 text-destructive hover:text-destructive" onClick={() => onRemoveRoute(routes[0].loopId, routes[0].stepIndex)}>
            <Trash2 data-icon="inline-start" />
            Remove from loop
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function LoopRouteActionSelect({ id, route, config, onRouteActionChange }: {
  id: string;
  route: LoopHandlerRoute;
  config: ProjectAutomationConfig;
  onRouteActionChange: (loopId: string, stepIndex: number, actionId: string) => void;
}) {
  return (
    <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
      <FieldLabel htmlFor={id} className="text-xs font-normal text-muted-foreground">Action</FieldLabel>
      <Select value={route.actionId || undefined} onValueChange={(actionId) => onRouteActionChange(route.loopId, route.stepIndex, actionId)}>
        <SelectTrigger id={id} size="sm" aria-label="Handler action" className="h-[22px] min-h-[22px] w-full max-w-full rounded-md border-primary/50 bg-primary/10 px-1.5 py-0 font-mono text-[0.66rem] text-primary shadow-none" title={route.actionLabel || "Select handler action"}>
          <SelectValue className={route.actionId ? loopActionTokenClassName() : "text-muted-foreground"} placeholder="" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {config.actions.map((option) => <SelectItem key={option.id} value={option.id}>{option.description ? `${option.id} · ${option.description}` : option.id}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function LoopRouteDescriptionField({ id, description }: { id: string; description: string }) {
  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id} className="text-xs font-normal text-muted-foreground">Description</FieldLabel>
      <p id={id} className="min-w-0 text-xs leading-4 text-foreground">{description || "No description."}</p>
    </Field>
  );
}

function HumanOperatorField() {
  return (
    <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
      <FieldLabel className="text-xs font-normal text-muted-foreground">Agent</FieldLabel>
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-tertiary">
        <ShieldCheck className="size-3.5 shrink-0" />
        <span className="truncate">Human operator</span>
      </div>
    </Field>
  );
}

function humanGateResponseForRoute(config: ProjectAutomationConfig, route: LoopHandlerRoute) {
  return config.humanGateResponses.find((candidate) => candidate.loopId === route.loopId && candidate.actionId === route.actionId);
}

function ReadOnlyBadges({ label, values }: { label: string; values: string[] }) {
  return (
    <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
      <FieldLabel className="text-xs font-normal text-muted-foreground">{label}</FieldLabel>
      <div className="min-w-0">
        {values.length > 0 ? values.map((value) => <span key={value} className="block break-words text-xs leading-4 text-foreground">{value}</span>) : <span className="text-xs text-muted-foreground">None</span>}
      </div>
    </Field>
  );
}
