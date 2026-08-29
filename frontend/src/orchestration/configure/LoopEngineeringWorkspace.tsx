import type { ReactNode } from "react";
import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import { LoopEngineeringCanvas } from "./LoopEngineeringCanvas";

export function LoopEngineeringWorkspace({ environment, selectedStateId, selectedActionId, navigate, children }: {
  environment: EnvironmentDefinition;
  selectedStateId?: string;
  selectedActionId?: string;
  navigate(path: string): void;
  children: ReactNode;
}) {
  return <div className="grid min-w-0 xl:grid-cols-2">
    <div className="min-w-0 p-4 md:p-6 xl:pr-3">
      <LoopEngineeringCanvas environment={environment} selectedStateId={selectedStateId} selectedActionId={selectedActionId} navigate={navigate} />
    </div>
    <div aria-label="Loop Engineering editor" className="min-w-0 border-t border-border xl:border-t-0 xl:border-l">
      {children}
    </div>
  </div>;
}
