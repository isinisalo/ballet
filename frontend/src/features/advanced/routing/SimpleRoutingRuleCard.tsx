import { PlayCircle, SquarePen } from "lucide-react";
import { Button } from "@/components/forms/FormControls";
import { EventToOperationSummary } from "@/components/simple-rules/EventToOperationSummary";
import { RuleHealthBadge } from "@/components/simple-rules/RuleHealthBadge";
import type { SimpleRoutingRuleViewModel } from "@/features/advanced/routing/routing-rule-view-model";

export function SimpleRoutingRuleCard({ rule }: { rule: SimpleRoutingRuleViewModel }) {
  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">
            <EventToOperationSummary eventName={rule.inputEventName} operationName={rule.targetOperationName} />
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{rule.description}</p>
          {rule.targetAgentName ? <p className="mt-1 text-xs text-muted-foreground">Agent: {rule.targetAgentName}</p> : null}
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
