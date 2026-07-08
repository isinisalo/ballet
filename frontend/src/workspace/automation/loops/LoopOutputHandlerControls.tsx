import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LoopHandlerRoute } from "./LoopHandlerSheet";
import { loopOutputHandlerForOutput } from "./loopOutputHandlers";
import { loopActionTokenClassName, loopOutputTokenClassName } from "./loopSheetTokenStyles";

export function LoopOutputHandlerControls({
  config,
  route,
  outputIds,
  label = "Outputs",
  onOutputHandlerActionChange
}: {
  config: ProjectAutomationConfig;
  route: LoopHandlerRoute;
  outputIds: string[];
  label?: string;
  onOutputHandlerActionChange: (loopId: string, stepIndex: number, actionId: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {outputIds.length > 0 ? (
        <div className="flex flex-col gap-2">
          {outputIds.map((outputId) => {
            const handler = loopOutputHandlerForOutput(config, route.loopId, route.actionId, outputId);
            return (
              <div key={outputId} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-2">
                <span className={`min-w-0 truncate font-mono text-xs ${loopOutputTokenClassName(outputId)}`} title={outputId}>
                  {outputId}
                </span>
                {handler?.type === "action" ? (
                  <Select
                    value={handler.actionId}
                    items={config.actions.map((option) => ({ value: option.id, label: option.id }))}
                    onValueChange={(actionId) => onOutputHandlerActionChange(handler.loopId, handler.stepIndex, actionId)}
                  >
                    <SelectTrigger
                      size="sm"
                      className="h-5 min-h-5 min-w-0 w-full rounded-xl border-primary/60 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary shadow-none"
                      title={handler.label}
                    >
                      <SelectValue className={loopActionTokenClassName()} />
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
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">None</span>
                )}
              </div>
            );
          })}
        </div>
      ) : <span className="text-sm text-muted-foreground">None</span>}
    </Field>
  );
}
