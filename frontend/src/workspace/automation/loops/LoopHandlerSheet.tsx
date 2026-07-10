import { useEffect } from "react";
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
  const title = selectionSource === "edge" && routes.length === 1 ? "Output handler" : "Loop handler";

  useLoopHandlerEscapeClose(open, onOpenChange);
  if (!open) return null;

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] md:hidden" />
      <aside
        role="dialog"
        aria-modal="false"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-50 flex h-svh w-full min-w-0 flex-col overflow-hidden border-l border-divider-strong bg-popover text-sm text-popover-foreground shadow-lg md:static md:z-auto md:h-auto md:min-h-0 md:w-auto md:shadow-none"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Close" className="absolute top-1.5 right-1.5 z-20" onClick={() => onOpenChange(false, { reason: "close-press" })}>
          <X />
        </Button>
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
