import { ShieldCheck, ShieldX } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppData } from "backend/shared/domain";
import type { AdvancedRoute } from "@/app/routes";
import type { SafeDeleteResult, WorkspaceValidationResult } from "backend/shared/flow";
import { api } from "@/api";
import { DiagnosticsList } from "@/components/diagnostics/DiagnosticsList";
import { Button, EmptyState, PageHeader, Section } from "@/components/forms/FormControls";
import { Badge } from "@/components/ui/badge";
import { AdvancedSource, Fact, SafeDeletePanel } from "@/features/advanced/components/AdvancedPanels";
import { ContractDetails } from "@/features/advanced/contracts/ContractDetails";
import { ContractNextVersionEditor } from "@/features/advanced/contracts/ContractNextVersionEditor";
import { EmissionPolicyDetails } from "@/features/advanced/emissions/EmissionPolicyDetails";
import { EventDetails } from "@/features/advanced/events/EventDetails";
import { LoopDefinitionDetails } from "@/features/advanced/loops/LoopDefinitionDetails";
import { RoutingPolicyDetails } from "@/features/advanced/routing/RoutingPolicyDetails";
import {
  isContract,
  isEmissionPolicy,
  isEventDefinition,
  isLoopDefinition,
  isRoutingPolicy,
  labels,
  resourcesFor,
  type AdvancedItem
} from "@/features/advanced/model/advanced-resource-model";

export function AdvancedPage({
  data,
  validation,
  advancedRoute = "contracts",
  refresh = async () => undefined
}: {
  data: AppData;
  validation?: WorkspaceValidationResult;
  advancedRoute?: AdvancedRoute;
  refresh?: () => Promise<void>;
}) {
  const items = useMemo(() => resourcesFor(data, advancedRoute, validation), [data, advancedRoute, validation]);
  const [safeDeleteResults, setSafeDeleteResults] = useState<Record<string, SafeDeleteResult>>({});
  const [safeDeleteError, setSafeDeleteError] = useState("");

  const checkSafeDelete = async (item: AdvancedItem) => {
    setSafeDeleteError("");
    try {
      const result = await api.checkSafeDelete(item.reference);
      setSafeDeleteResults((current) => ({ ...current, [item.key]: result }));
    } catch (error) {
      setSafeDeleteError(error instanceof Error ? error.message : "Unable to check delete safety.");
    }
  };

  return (
    <div className="grid gap-5">
      <PageHeader title={labels[advancedRoute]} description="Expert resource management with forms first and raw source kept behind Advanced source." />
      {validation && !validation.valid ? <DiagnosticsList diagnostics={validation.diagnostics} /> : null}
      {safeDeleteError ? <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">{safeDeleteError}</div> : null}
      {items.length === 0 ? <EmptyState title={`No ${labels[advancedRoute].toLowerCase()} configured.`} /> : (
        <div className="grid gap-3">
          {items.map((item) => (
            <ResourceCard
              key={item.key}
              item={item}
              route={advancedRoute}
              data={data}
              safeDeleteResult={safeDeleteResults[item.key]}
              onCheckDelete={() => void checkSafeDelete(item)}
              refresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceCard({
  item,
  route,
  data,
  safeDeleteResult,
  onCheckDelete,
  refresh
}: {
  item: AdvancedItem;
  route: AdvancedRoute;
  data: AppData;
  safeDeleteResult?: SafeDeleteResult;
  onCheckDelete: () => void;
  refresh: () => Promise<void>;
}) {
  return (
    <Section>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{item.name}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={item.validationDiagnostics.length ? "destructive" : "default"}>
              {item.validationDiagnostics.length ? "needs fixes" : "valid"}
            </Badge>
            {item.active !== undefined ? <Badge variant={item.active ? "default" : "outline"}>{item.active ? "active" : "inactive"}</Badge> : null}
            {item.version !== undefined ? <Badge variant="outline">v{item.version}</Badge> : null}
          </div>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <Fact label="Technical identity" value={item.identity} mono />
          <Fact label="Uses" value={item.uses.length ? item.uses.join(", ") : "No dependencies."} />
          <Fact label="Used by" value={item.usedBy.length ? item.usedBy.join(", ") : "No incoming references."} />
        </div>
        {item.preview ? <div className="rounded-md border bg-background p-3 text-sm">{item.preview}</div> : null}
        {item.validationDiagnostics.length ? <DiagnosticsList diagnostics={item.validationDiagnostics} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCheckDelete}>
            {safeDeleteResult?.allowed === false ? <ShieldX className="size-4" /> : <ShieldCheck className="size-4" />}
            Check delete safety
          </Button>
        </div>
        {safeDeleteResult ? <SafeDeletePanel result={safeDeleteResult} targetName={item.name} /> : null}
        {route === "contracts" && isContract(item.raw) ? (
          <>
            <ContractDetails contract={item.raw} diagnostics={item.validationDiagnostics} />
            <ContractNextVersionEditor contract={item.raw} data={data} refresh={refresh} />
          </>
        ) : null}
        {route === "events" && isEventDefinition(item.raw) ? <EventDetails eventDefinition={item.raw} data={data} diagnostics={item.validationDiagnostics} /> : null}
        {route === "routing" && isRoutingPolicy(item.raw) ? <RoutingPolicyDetails policy={item.raw} data={data} refresh={refresh} /> : null}
        {route === "emissions" && isEmissionPolicy(item.raw) ? <EmissionPolicyDetails policy={item.raw} data={data} refresh={refresh} /> : null}
        {route === "loops" && isLoopDefinition(item.raw) ? <LoopDefinitionDetails loop={item.raw} data={data} refresh={refresh} /> : null}
        <AdvancedSource value={item.raw} />
      </div>
    </Section>
  );
}
