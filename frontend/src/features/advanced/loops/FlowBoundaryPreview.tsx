import type { SimpleFlowBoundaryViewModel } from "@/features/advanced/loops/flow-boundary-view-model";

export function FlowBoundaryPreview({ steps }: { steps: SimpleFlowBoundaryViewModel["previewSteps"] }) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
      <h3 className="text-sm font-medium">Flow boundary preview</h3>
      {steps.length ? (
        <div className="grid gap-1 font-mono text-xs">
          {steps.map((step, index) => (
            <div key={`${step.type}-${index}`} style={{ paddingLeft: `${step.depth * 1.25}rem` }}>
              {step.depth > 0 ? "-> " : ""}{step.label}
            </div>
          ))}
        </div>
      ) : <div className="text-sm text-muted-foreground">No preview is available yet.</div>}
    </div>
  );
}
