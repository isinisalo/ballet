import type { AppData } from "backend/shared/domain";
import type { EmissionPolicy } from "backend/shared/emission-policy";
import type { LoopDefinition } from "backend/shared/loop";
import type { RoutingPolicy } from "backend/shared/routing-policy";
import { Fact, FlowStep, PanelHeading, ReferenceList } from "@/features/advanced/components/AdvancedPanels";
import { eventNameFor, findOperation, operationNameFor, refLabel } from "@/features/advanced/model/advanced-resource-model";

export function LoopDefinitionDetails({ loop, data }: { loop: LoopDefinition; data: AppData }) {
  const routingPolicies = loop.routingPolicyIds
    .map((policyId) => data.policies.find((policy) => policy.id === policyId))
    .filter((policy): policy is RoutingPolicy => Boolean(policy));
  const emissionPolicies = loop.emissionPolicyIds
    .map((policyId) => data.emissionPolicies.find((policy) => policy.id === policyId))
    .filter((policy): policy is EmissionPolicy => Boolean(policy));
  const entryEvents = loop.entryEventTypes.map((eventType) => eventNameFor(data, eventType));
  const terminalEvents = loop.terminalEventTypes.map((eventType) => eventNameFor(data, eventType));
  const limitExceededEvent = loop.onLimitExceeded?.eventType ? eventNameFor(data, loop.onLimitExceeded.eventType) : "No event configured.";

  return (
    <div className="grid gap-4 rounded-md border bg-background p-3">
      <PanelHeading title="Flow definition" description="Loop definitions group routing and emission rules into one Flow boundary." />
      <div className="grid gap-3 md:grid-cols-3">
        <FlowStep title="When" items={entryEvents} emptyLabel="No entry events." />
        <FlowStep title="Ask" items={routingPolicies.map((policy) => {
          const operation = findOperation(data, policy.dispatch.operation);
          return operation?.name ?? refLabel(policy.dispatch.operation);
        })} emptyLabel="No routed tasks." />
        <FlowStep title="Publish or stop at" items={terminalEvents} emptyLabel="No terminal events." />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ReferenceList
          title="Included routing rules"
          items={routingPolicies.map((policy) => `${policy.name} · ${eventNameFor(data, policy.consumes.eventType)} to ${operationNameFor(data, policy.dispatch.operation)}`)}
          emptyLabel="No routing rules are included."
        />
        <ReferenceList
          title="Included emission rules"
          items={emissionPolicies.map((policy) => `${policy.name} · ${operationNameFor(data, policy.observes.operation)}`)}
          emptyLabel="No emission rules are included."
        />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Fact label="Maximum steps" value={String(loop.limits.maxHops)} />
        <Fact label="Maximum agent runs" value={String(loop.limits.maxRuns)} />
        <Fact label="Maximum repetitions" value={String(loop.limits.maxIterationsPerStep)} />
        <Fact label="Maximum duration" value={loop.limits.deadlineSeconds ? `${loop.limits.deadlineSeconds} seconds` : "No duration limit."} />
      </div>
      <Fact label="Limit-exceeded behavior" value={limitExceededEvent} />
    </div>
  );
}
