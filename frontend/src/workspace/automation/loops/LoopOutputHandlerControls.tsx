import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { findActionOutputRoute } from "@shared/policy-actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LoopHandlerRoute } from "./LoopHandlerSheet";
import {
  loopOutputHandlerSelection,
  loopOutputTargetActionOptions
} from "./loopOutputHandlers";
import { loopOutputTokenClassName } from "./loopSheetTokenStyles";

const noTargetAction = "__no_target_action__";
const outputRouteSelectTriggerClassName = "h-[22px] min-h-[22px] min-w-0 w-full rounded-md border-divider-strong bg-card px-1.5 py-0 font-mono text-[0.66rem] leading-4 text-foreground shadow-none";
const outputRouteSelectValueClassName = "truncate font-mono text-[0.66rem] leading-4";

export function LoopOutputHandlerControls({
  config,
  route,
  outputIds,
  label = "Outputs",
  onOutputHandlerRouteChange,
  onOutputHandlerRouteClear
}: {
  config: ProjectAutomationConfig;
  route: LoopHandlerRoute;
  outputIds: string[];
  label?: string;
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
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {outputIds.length > 0 ? (
        <div className="flex flex-col gap-2">
          {outputIds.map((outputId) => {
            const selection = loopOutputHandlerSelection(config, route.loopId, route.actionId, outputId);
            const selectedRoute = findActionOutputRoute(config.outputRoutes, route.loopId, route.actionId, outputId);
            const targetLoopLabel = selection.targetLoopId || "Loop";
            const targetActionLabel = selection.targetActionId || "Action";
            const selectTargetLoop = (targetLoopId: string) => {
              const nextActionOptions = loopOutputTargetActionOptions(config, targetLoopId);
              const targetActionId = nextActionOptions.some((option) => option.id === selection.targetActionId)
                ? selection.targetActionId
                : nextActionOptions[0]?.id ?? "";
              if (!targetActionId) return;
              onOutputHandlerRouteChange(route.loopId, route.actionId, outputId, targetLoopId, targetActionId);
            };

            return (
              <div key={outputId} className="grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1.5">
                <span className={`min-w-0 truncate font-mono text-[0.66rem] leading-4 ${loopOutputTokenClassName(outputId)}`} title={outputId}>
                  {outputId}
                </span>
                <Select
                  value={selection.targetLoopId}
                  items={config.loops.map((loop) => ({ value: loop.id, label: loop.id }))}
                  onValueChange={selectTargetLoop}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Target loop for ${outputId}`}
                    className={outputRouteSelectTriggerClassName}
                    title={targetLoopLabel}
                  >
                    <SelectValue className={outputRouteSelectValueClassName} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {config.loops.map((loop) => (
                        <SelectItem key={loop.id} value={loop.id}>
                          {loop.id}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  value={selection.targetActionId || noTargetAction}
                  items={[
                    { value: noTargetAction, label: "Action" },
                    ...selection.actionOptions.map((option) => ({ value: option.id, label: option.id }))
                  ]}
                  disabled={selection.actionOptions.length === 0}
                  onValueChange={(targetActionId) => {
                    if (targetActionId === noTargetAction) return;
                    onOutputHandlerRouteChange(route.loopId, route.actionId, outputId, selection.targetLoopId, targetActionId);
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={`Target action for ${outputId}`}
                    className={outputRouteSelectTriggerClassName}
                    title={targetActionLabel}
                  >
                    <SelectValue className={outputRouteSelectValueClassName} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {selection.actionOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <ClearOutputHandlerButton
                  outputId={outputId}
                  disabled={!selectedRoute}
                  onClear={() => onOutputHandlerRouteClear(route.loopId, route.actionId, outputId)}
                />
              </div>
            );
          })}
        </div>
      ) : <span className="text-sm text-muted-foreground">None</span>}
    </Field>
  );
}

function ClearOutputHandlerButton({
  outputId,
  disabled,
  onClear
}: {
  outputId: string;
  disabled: boolean;
  onClear: () => void;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      aria-label={`Clear output handler for ${outputId}`}
      title={`Clear output handler for ${outputId}`}
      disabled={disabled}
      onClick={onClear}
      className="h-[22px] rounded-md px-1.5 py-0 font-mono text-[0.66rem] leading-4 text-muted-foreground shadow-none"
    >
      Clear
    </Button>
  );
}
