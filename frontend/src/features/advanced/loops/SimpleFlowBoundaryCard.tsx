import { Eye, SquarePen } from "lucide-react";
import { Button } from "@/components/forms/FormControls";
import { RuleHealthBadge } from "@/components/simple-rules/RuleHealthBadge";
import type { SimpleFlowBoundaryViewModel } from "@/features/advanced/loops/flow-boundary-view-model";

export function SimpleFlowBoundaryCard({ boundary }: { boundary: SimpleFlowBoundaryViewModel }) {
  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{boundary.name}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{boundary.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Starts: {boundary.entryEvents.map((event) => event.name).join(", ") || "None"} · Routing rules: {boundary.routingRules.filter((rule) => rule.included).length} · Emission rules: {boundary.emissionRules.filter((rule) => rule.included).length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Ends: {boundary.terminalEvents.map((event) => event.name).join(", ") || "No terminal events"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Safety: {boundary.safetyLimits.maxHops} steps, {boundary.safetyLimits.maxRuns} runs, {boundary.safetyLimits.maxIterationsPerStep} repeats{boundary.safetyLimits.deadlineSeconds ? `, ${boundary.safetyLimits.deadlineSeconds}s` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md border bg-background px-2 py-1 text-xs">{boundary.active ? "Active" : "Draft"}</span>
          <RuleHealthBadge health={boundary.health} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline"><SquarePen className="size-4" />Edit</Button>
        <Button type="button" variant="outline"><Eye className="size-4" />Preview</Button>
      </div>
    </div>
  );
}
