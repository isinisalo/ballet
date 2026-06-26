import { PlayCircle, SquarePen } from "lucide-react";
import { Button } from "@/components/forms/FormControls";
import { OperationToEventSummary } from "@/components/simple-rules/OperationToEventSummary";
import { RuleHealthBadge } from "@/components/simple-rules/RuleHealthBadge";
import type { SimpleEmissionRuleViewModel } from "@/features/advanced/emissions/emission-rule-view-model";

export function SimpleEmissionRuleCard({ rule }: { rule: SimpleEmissionRuleViewModel }) {
  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{rule.emittedEventName}</h3>
          <p className="mt-1 text-sm">
            <OperationToEventSummary operationName={rule.operationName} eventName={rule.emittedEventName} />
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{rule.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">When: {rule.conditionSummary}</p>
          <p className="mt-1 text-xs text-muted-foreground">Checks: {rule.gateSummary.join(", ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md border bg-background px-2 py-1 text-xs">{rule.active ? "Enabled" : "Disabled"}</span>
          <RuleHealthBadge health={rule.health} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline"><SquarePen className="size-4" />Edit</Button>
        <Button type="button" variant="outline"><PlayCircle className="size-4" />Test</Button>
      </div>
    </div>
  );
}
