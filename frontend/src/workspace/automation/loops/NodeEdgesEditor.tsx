import {
  isProjectNodeTerminalTarget,
  loopTerminals,
  type ProjectLoop,
  type ProjectNodeEdgeTarget
} from "@shared/api/workspace-contracts";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SelectField } from "@/components/shared/workspace-ui";

const targetValue = (target: ProjectNodeEdgeTarget | undefined) => {
  if (!target) return "terminal:completed";
  return isProjectNodeTerminalTarget(target) ? `terminal:${target.terminal}` : `node:${target.nodeId}`;
};

const targetFromValue = (value: string): ProjectNodeEdgeTarget => value.startsWith("terminal:")
  ? { terminal: value.slice("terminal:".length) as "completed" | "blocked" | "failed" }
  : { nodeId: value.slice("node:".length) };

export function NodeEdgesEditor({ loop, disabled, onChange }: {
  loop: ProjectLoop;
  disabled: boolean;
  onChange: (sourceNodeId: string, target: ProjectNodeEdgeTarget) => void;
}) {
  const options = [
    ...loop.nodes.map((node) => ({ value: `node:${node.id}`, label: `Work Loop Node · ${node.id}` })),
    ...loopTerminals.map((terminal) => ({ value: `terminal:${terminal}`, label: `Terminal · ${terminal}` }))
  ];
  return (
    <section aria-labelledby="node-edges-heading" className="grid gap-3 rounded-lg border border-divider-strong bg-card p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-secondary" aria-hidden="true" />
        <h3 id="node-edges-heading" className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Validation OK edges</h3>
      </div>
      <p className="text-xs text-muted-foreground">Each Validation OK output has exactly one editable target. Terminals are Loop boundaries, not executable nodes.</p>
      {loop.nodes.map((node) => {
        const edge = loop.edges.find((candidate) => candidate.source === node.id);
        return (
          <div key={node.id} className="grid gap-2 rounded border border-divider-strong bg-background p-2 sm:grid-cols-[minmax(7rem,0.8fr)_auto_minmax(10rem,1.2fr)] sm:items-end">
            <div className="grid gap-1"><span className="font-mono text-[0.62rem] uppercase text-muted-foreground">Source</span><span className="truncate font-mono text-xs">{node.id}</span></div>
            <ArrowRight className="mb-1 size-4 text-secondary" aria-label="Validation OK goes to" />
            <SelectField
              label={`${node.id} Validation OK target`}
              value={targetValue(edge?.target)}
              options={options}
              disabled={disabled}
              density="compact"
              onChange={(value) => onChange(node.id, targetFromValue(value))}
            />
          </div>
        );
      })}
      {loop.nodes.length === 0 ? <p className="text-xs text-muted-foreground">Add a Work Loop Node to define an OK edge.</p> : null}
    </section>
  );
}
