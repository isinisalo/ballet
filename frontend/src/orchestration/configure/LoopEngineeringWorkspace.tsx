import type { ReactNode } from "react";
import type { ActionDefinition, EnvironmentDefinition } from "@shared/orchestration/environment";
import { ActionFlow } from "./ActionFlow";
import { LoopEngineeringCanvas } from "./LoopEngineeringCanvas";

export function LoopEngineeringWorkspace({ environment, selectedStateId, selectedActionId, action, canvasMode, navigate, onActionFlowOpen, children }: {
  environment: EnvironmentDefinition;
  selectedStateId?: string;
  selectedActionId?: string;
  action?: ActionDefinition;
  canvasMode?: "flow";
  navigate(path: string): void;
  onActionFlowOpen?(stateId: string, actionId: string): void;
  children: ReactNode;
}) {
  return <div className="grid min-w-0 items-stretch xl:grid-cols-2">
    <div className="min-w-0 p-4 md:p-6 xl:pr-3">
      {canvasMode === "flow" && action
        ? <ActionFlow action={action} />
        : <LoopEngineeringCanvas environment={environment} selectedStateId={selectedStateId} selectedActionId={selectedActionId} navigate={navigate} onActionFlowOpen={onActionFlowOpen} />}
    </div>
    <div aria-label="Loop Engineering editor" className="min-w-0 border-t border-border xl:border-t-0 xl:border-l">
      {children}
    </div>
  </div>;
}
