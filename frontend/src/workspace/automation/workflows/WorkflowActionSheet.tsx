import { useId } from "react";
import type { Agent, ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type WorkflowActionSheetOpenChangeDetails = {
  reason?: string;
};

export function WorkflowActionSheet({
  open,
  action,
  agents,
  config,
  onOpenChange,
  onActionChange,
  onRemoveFromWorkflow
}: {
  open: boolean;
  action?: ProjectAction;
  agents: Agent[];
  config: ProjectAutomationConfig;
  onOpenChange: (open: boolean, details?: WorkflowActionSheetOpenChangeDetails) => void;
  onActionChange: (actionId: string) => void;
  onRemoveFromWorkflow: () => void;
}) {
  const actionFieldId = useId();
  const descriptionFieldId = useId();
  const agentLabel = (agentId: string) => agents.find((agent) => agent.id === agentId)?.name ?? agentId;
  const selectedAgentIds = action?.agentIds ?? [];
  const selectedOutputIds = action?.outputIds ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <SheetContent
        side="right"
        overlayClassName="pointer-events-none bg-black/5 supports-backdrop-filter:backdrop-blur-[1px]"
        className="overflow-y-auto sm:max-w-md"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <SheetHeader>
          <SheetTitle>Action</SheetTitle>
          <SheetDescription>{action?.id ?? "Edit selected workflow action."}</SheetDescription>
        </SheetHeader>
        {action ? (
          <div className="px-4 pb-4">
            <FieldGroup>
              <Field className="gap-1.5">
                <FieldLabel htmlFor={actionFieldId}>Action ID</FieldLabel>
                <Select value={action.id} onValueChange={onActionChange}>
                  <SelectTrigger id={actionFieldId} className="min-w-0 w-full font-mono">
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
                <FieldLabel htmlFor={descriptionFieldId}>Description</FieldLabel>
                <Textarea
                  id={descriptionFieldId}
                  value={action.description}
                  placeholder="No description."
                  readOnly
                  rows={4}
                  className="resize-none text-muted-foreground"
                />
              </Field>
              <Field>
                <FieldLabel>Agents</FieldLabel>
                <div className="flex min-h-7 flex-wrap items-center gap-2">
                  {selectedAgentIds.length > 0 ? selectedAgentIds.map((agentId) => (
                    <Badge key={agentId} variant="outline" className="border-divider-strong bg-muted/50 font-mono">
                      {agentLabel(agentId)}
                    </Badge>
                  )) : <span className="text-sm text-muted-foreground">None</span>}
                </div>
              </Field>
              <Field>
                <FieldLabel>Outputs</FieldLabel>
                <div className="flex min-h-7 flex-wrap items-center gap-2">
                  {selectedOutputIds.length > 0 ? selectedOutputIds.map((outputId) => (
                    <Badge key={outputId} variant="outline" className="border-divider-strong bg-muted/50 font-mono">
                      {outputId}
                    </Badge>
                  )) : <span className="text-sm text-muted-foreground">None</span>}
                </div>
              </Field>
            </FieldGroup>
            <div className="mt-4 border-t border-divider-strong pt-4">
              <Button type="button" variant="destructive" size="sm" onClick={onRemoveFromWorkflow}>
                <Trash2 data-icon="inline-start" />
                Remove from workflow
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
