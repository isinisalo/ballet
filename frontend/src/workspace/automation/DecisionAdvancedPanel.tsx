import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type {
  PolicyPreviewV2, ProjectRepairNode, ProjectSspDecisionStrategyV2
} from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PolicyProjectionView } from "../policy/PolicyProjectionView";
import { DecisionCapabilityEditor } from "./DecisionCapabilityEditor";
import { DecisionModelCatalog } from "./DecisionModelCatalog";
import { DecisionModelSettings } from "./DecisionModelSettings";

export function DecisionAdvancedPanel({ strategy, actionIds, repair, preview, locked, onStrategyChange, onRepairChange }: {
  strategy: ProjectSspDecisionStrategyV2;
  actionIds: string[];
  repair?: ProjectRepairNode;
  preview?: PolicyPreviewV2;
  locked: boolean;
  onStrategyChange: (strategy: ProjectSspDecisionStrategyV2) => void;
  onRepairChange: (repair: ProjectRepairNode) => void;
}) {
  return <Collapsible className="group rounded-lg border border-divider-strong bg-card">
    <CollapsibleTrigger render={<Button variant="ghost" className="h-auto w-full justify-between rounded-lg p-4 text-left" />}><span className="flex items-center gap-3"><SlidersHorizontal className="size-4 text-primary" /><span><span className="block text-sm font-medium">Advanced Model</span><span className="block text-xs font-normal text-muted-foreground">Outcomes, guards, state projection, solver and scoped Repair</span></span></span><ChevronDown className="size-4 transition-transform group-data-panel-open:rotate-180" /></CollapsibleTrigger>
    <CollapsibleContent><div className="grid gap-3 border-t border-divider-strong p-3">
      <details className="rounded border border-divider-strong bg-background/25 p-3"><summary className="cursor-pointer text-xs font-medium">Outcome catalog and action availability</summary><div className="mt-3"><DecisionCapabilityEditor strategy={strategy} actionIds={actionIds} locked={locked} onChange={onStrategyChange} /></div></details>
      <details className="rounded border border-divider-strong bg-background/25 p-3"><summary className="cursor-pointer text-xs font-medium">State features and detailed state definitions</summary><div className="mt-3"><DecisionModelCatalog strategy={strategy} locked={locked} onChange={onStrategyChange} /></div></details>
      <details className="rounded border border-divider-strong bg-background/25 p-3"><summary className="cursor-pointer text-xs font-medium">Solver, projection settings and scoped Repair</summary><div className="mt-3"><DecisionModelSettings strategy={strategy} repair={repair} locked={locked} onStrategyChange={onStrategyChange} onRepairChange={onRepairChange} /></div></details>
      {preview?.projection ? <details className="rounded border border-divider-strong bg-background/25 p-3"><summary className="cursor-pointer text-xs font-medium">Derived policy projection detail</summary><div className="mt-3"><PolicyProjectionView projection={preview.projection} compact /></div></details> : null}
    </div></CollapsibleContent>
  </Collapsible>;
}
