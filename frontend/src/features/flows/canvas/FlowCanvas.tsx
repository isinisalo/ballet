import { useMemo, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { FlowViewModel } from "backend/shared/flow";
import { Button } from "@/components/ui/button";
import { EmptyVisualState } from "@/design-system/components/EmptyVisualState";
import { FlowEdge } from "./FlowEdge";
import { FlowNodeCard } from "./FlowNodeCard";
import { buildFlowLayout } from "./flow-layout";
import type { FlowSelection } from "@/features/flows/model/flow-page-model";
import { cn } from "@/lib/utils";

export function FlowCanvas({
  flow,
  selected,
  onSelect
}: {
  flow: FlowViewModel;
  selected?: FlowSelection;
  onSelect: (selection: FlowSelection) => void;
}) {
  const [dense, setDense] = useState(false);
  const layout = useMemo(() => buildFlowLayout(flow), [flow]);
  const nodesByKey = new Map(layout.nodes.map((node) => [node.key, node]));
  const vertical = typeof window === "undefined" || window.innerWidth < 1600;

  if (!layout.nodes.length) {
    return <EmptyVisualState title="This Flow has no visual nodes yet." description="Add a trigger, route, task, and result branch to project it on the canvas." />;
  }

  return (
    <section aria-label={`${flow.name} Flow Canvas`} className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Flow Canvas</h2>
          <p className="text-sm text-muted-foreground">Event to routing policy to agent operation to emission policy to event.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setDense((value) => !value)}>
          {dense ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
          {dense ? "Comfort view" : "Dense view"}
        </Button>
      </div>
      <div className="overflow-auto rounded-lg border border-white/10 bg-black/20 p-4">
        <div
          className={cn("relative grid min-w-0 gap-3 xl:min-w-[58rem]", dense ? "xl:gap-x-7 xl:gap-y-5" : "xl:gap-x-10 xl:gap-y-8")}
          style={{
            gridTemplateColumns: vertical ? "1fr" : `repeat(${layout.columns}, minmax(${dense ? "10rem" : "13rem"}, 1fr))`,
            gridTemplateRows: vertical ? undefined : `repeat(${layout.rows}, minmax(${dense ? "7rem" : "9rem"}, auto))`
          }}
        >
          {vertical ? null : layout.edges.map((edge) => <FlowEdge key={edge.id} edge={edge} from={nodesByKey.get(edge.fromKey)} to={nodesByKey.get(edge.toKey)} dense={dense} />)}
          {layout.nodes.map((node) => (
            <div key={node.key} style={vertical ? undefined : { gridColumn: node.column + 1, gridRow: node.row + 1 }}>
              <FlowNodeCard node={node} selected={selected} onSelect={onSelect} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
