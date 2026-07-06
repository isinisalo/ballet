import type { Agent, ProjectAction, ProjectAutomationConfig } from "../../../../../shared/api/workspace-contracts";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ActionEditorFields } from "../actions/ActionEditorFields";

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
  onCreateOutput,
  onRemoveFromWorkflow
}: {
  open: boolean;
  action?: ProjectAction;
  agents: Agent[];
  config: ProjectAutomationConfig;
  onOpenChange: (open: boolean, details?: WorkflowActionSheetOpenChangeDetails) => void;
  onActionChange: (patch: Partial<ProjectAction>) => void;
  onCreateOutput: (id: string) => void;
  onRemoveFromWorkflow: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <SheetContent
        side="right"
        overlayClassName="pointer-events-none"
        className="overflow-y-auto sm:max-w-md"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <SheetHeader>
          <SheetTitle>Action</SheetTitle>
          <SheetDescription>{action?.id ?? "Edit selected workflow action."}</SheetDescription>
        </SheetHeader>
        {action ? (
          <div className="px-4 pb-4">
            <ActionEditorFields
              agents={agents}
              config={config}
              action={action}
              onChange={onActionChange}
              onCreateOutput={onCreateOutput}
            />
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
