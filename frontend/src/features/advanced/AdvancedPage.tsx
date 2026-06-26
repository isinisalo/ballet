import { useMemo } from "react";
import type { AppData } from "backend/shared/domain";
import type { AdvancedRoute } from "@/app/routes";
import type { WorkspaceValidationResult } from "backend/shared/flow";
import { DiagnosticsList } from "@/components/diagnostics/DiagnosticsList";
import { EmptyState, PageHeader, Section } from "@/components/forms/FormControls";
import { Fact } from "@/features/advanced/components/AdvancedPanels";
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
import { cn } from "@/lib/utils";

const advancedRoutes: AdvancedRoute[] = ["contracts", "events", "routing", "emissions", "loops", "runtimes", "skills"];

export function AdvancedPage({
  data,
  validation,
  advancedRoute = "contracts",
  selectedKey,
  navigate,
  refresh = async () => undefined
}: {
  data: AppData;
  validation?: WorkspaceValidationResult;
  advancedRoute?: AdvancedRoute;
  selectedKey?: string;
  navigate?: (path: string) => void;
  refresh?: () => Promise<void>;
}) {
  const items = useMemo(() => resourcesFor(data, advancedRoute, validation), [data, advancedRoute, validation]);
  const selectedItem = items.find((item) => item.key === selectedKey) ?? items[0];

  return (
    <div className="grid gap-4">
      <PageHeader title={labels[advancedRoute]} />
      <div className="flex gap-1 overflow-x-auto border-b">
        {advancedRoutes.map((route) => (
          <button
            key={route}
            type="button"
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              route === advancedRoute
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => navigate?.(`/advanced/${route}`)}
          >
            {labels[route]}
          </button>
        ))}
      </div>
      {validation && !validation.valid ? <DiagnosticsList diagnostics={validation.diagnostics} /> : null}
      {items.length === 0 || !selectedItem ? <EmptyState title={`No ${labels[advancedRoute].toLowerCase()} configured.`} /> : (
        <div className="grid overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ResourceList
            route={advancedRoute}
            items={items}
            selectedKey={selectedItem.key}
            navigate={navigate}
          />
          <ResourceEditor
            item={selectedItem}
            route={advancedRoute}
            data={data}
            refresh={refresh}
          />
        </div>
      )}
    </div>
  );
}

function ResourceList({
  route,
  items,
  selectedKey,
  navigate
}: {
  route: AdvancedRoute;
  items: AdvancedItem[];
  selectedKey: string;
  navigate?: (path: string) => void;
}) {
  return (
    <aside className="border-b border-border bg-card lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h2 className="text-base font-semibold">{labels[route]}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="max-h-72 overflow-auto lg:max-h-[calc(100vh-17rem)]">
        {items.map((item) => {
          const selected = item.key === selectedKey;
          return (
            <button
              key={item.key}
              type="button"
              className={cn(
                "grid w-full gap-2 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/45",
                selected && "border-l-2 border-l-primary bg-muted/35"
              )}
              onClick={() => navigate?.(`/advanced/${route}/${encodeURIComponent(item.key)}`)}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 truncate font-medium">{item.name}</div>
                {item.version !== undefined ? <span className="shrink-0 text-xs text-muted-foreground">v{item.version}</span> : null}
              </div>
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description || item.preview || "No description."}</p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ResourceEditor({
  item,
  route,
  data,
  refresh
}: {
  item: AdvancedItem;
  route: AdvancedRoute;
  data: AppData;
  refresh: () => Promise<void>;
}) {
  return (
    <section className="min-w-0 bg-card">
      <div className="grid gap-4 p-3 md:p-5">
        {item.validationDiagnostics.length ? <DiagnosticsList diagnostics={item.validationDiagnostics} /> : null}
        <div key={item.key} className="contents">
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
          {route === "runtimes" || route === "skills" ? <GenericResourceDetails item={item} /> : null}
        </div>
      </div>
    </section>
  );
}

function GenericResourceDetails({ item }: { item: AdvancedItem }) {
  return (
    <Section title="Overview">
      <div className="grid gap-3 text-sm">
        <Fact label="Description" value={item.description || "No description."} />
      </div>
    </Section>
  );
}
