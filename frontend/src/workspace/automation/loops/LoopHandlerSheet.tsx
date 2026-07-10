import { useEffect, useId } from "react";
import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoopHandlerAgentInstructions } from "./LoopHandlerAgentInstructions";
import { LoopHandlerEditor } from "./LoopHandlerEditor";

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
  onOutputHandlerRouteChange: (sourceLoopId: string, sourceActionId: string, outputId: string, targetLoopId: string, targetActionId: string) => void;
  onOutputHandlerRouteClear: (sourceLoopId: string, sourceActionId: string, outputId: string) => void;
  onHumanGateSubmit: (route: LoopHandlerRoute, outputId: string, prompt: string) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const title = selectionSource === "edge" && routes.length === 1 ? "Output handler" : "Loop handler";
  const description = routes.length === 1 ? "Edit selected handler." : `${routes.length} selected handlers`;

  useLoopHandlerEscapeClose(open, onOpenChange);
  if (!open) return null;

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] md:hidden" />
      <aside
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="fixed inset-y-0 right-0 z-50 flex h-svh w-full min-w-0 flex-col overflow-hidden border-l border-divider-strong bg-popover text-sm text-popover-foreground shadow-lg md:static md:z-auto md:h-auto md:min-h-0 md:w-auto md:shadow-none"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-divider-strong px-3 py-2">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-sm font-medium text-foreground">{title}</h2>
            <p id={descriptionId} className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Close" onClick={() => onOpenChange(false, { reason: "close-press" })}>
            <X />
          </Button>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto sm:grid-cols-[3fr_2fr] sm:overflow-hidden">
          <LoopHandlerAgentInstructions routes={routes} agents={agents} config={config} />
          <LoopHandlerEditor
            routes={routes}
            agents={agents}
            config={config}
            onRouteActionChange={onRouteActionChange}
            onRemoveRoute={onRemoveRoute}
            onOutputHandlerRouteChange={onOutputHandlerRouteChange}
            onOutputHandlerRouteClear={onOutputHandlerRouteClear}
            onHumanGateSubmit={onHumanGateSubmit}
          />
        </div>
      </aside>
    </>
  );
}

function useLoopHandlerEscapeClose(open: boolean, onOpenChange: (open: boolean, details?: LoopHandlerSheetOpenChangeDetails) => void) {
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
