import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LoopHandlerRoute } from "./LoopHandlerSheet";
import {
  loopOutputHandlerSelection,
  loopOutputTargetActionOptions
} from "./loopOutputHandlers";
import { loopActionTokenClassName, loopOutputTokenClassName } from "./loopSheetTokenStyles";

const noTargetAction = "__no_target_action__";

export function LoopOutputHandlerControls({
  config,
  route,
  outputIds,
  label = "Outputs",
  onOutputHandlerRouteChange
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
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {outputIds.length > 0 ? (
        <div className="flex flex-col gap-2">
          {outputIds.map((outputId) => {
            const selection = loopOutputHandlerSelection(config, route.loopId, route.actionId, outputId);
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
              <div key={outputId} className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                <span className={`min-w-0 truncate font-mono text-xs ${loopOutputTokenClassName(outputId)}`} title={outputId}>
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
                    className="h-5 min-h-5 min-w-0 w-full rounded-xl border-primary/60 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary shadow-none"
                    title={targetLoopLabel}
                  >
                    <SelectValue className={loopActionTokenClassName()} />
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
                    className="h-5 min-h-5 min-w-0 w-full rounded-xl border-primary/60 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary shadow-none"
                    title={targetActionLabel}
                  >
                    <SelectValue className={loopActionTokenClassName()} />
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
              </div>
            );
          })}
        </div>
      ) : <span className="text-sm text-muted-foreground">None</span>}
    </Field>
  );
}
