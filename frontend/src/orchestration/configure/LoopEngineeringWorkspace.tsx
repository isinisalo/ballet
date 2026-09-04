import type { ReactNode } from "react";
import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import { LoopEngineeringCanvas } from "./LoopEngineeringCanvas";

export function LoopEngineeringWorkspace({ environment, selectedStateId, selectedActionId, selectedAgentRole, locked, navigate, children }: {
  environment: EnvironmentDefinition;
  selectedStateId?: string;
  selectedActionId?: string;
  selectedAgentRole?: "validation" | "work";
  locked?: boolean;
  navigate(path: string): void;
  children: ReactNode;
}) {
  return <div className="grid min-w-0 items-stretch xl:grid-cols-2">
    <div className="min-w-0">
      <LoopEngineeringCanvas environment={environment} selectedStateId={selectedStateId} selectedActionId={selectedActionId}
        selectedAgentRole={selectedAgentRole} locked={locked} navigate={navigate} />
    </div>
    <div aria-label="Loop Engineering editor" className="min-w-0 border-t border-border xl:border-t-0 xl:border-l">
      {children}
    </div>
  </div>;
}
