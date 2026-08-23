import { BriefcaseBusiness, GitBranch, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import type { ProjectGraphNode, ProjectJobNode } from "@shared/api/workspace-contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollectionAddCard, OperationalStatus } from "@/components/shared/workspace-ui";

type CapabilityNode = ProjectGraphNode | ProjectJobNode;

export function CapabilityCards({ nodes, kind, locked, onAdd, onOpen, onEdit, onRename, onDelete, deleteIssues }: {
  nodes: CapabilityNode[]; kind: "Graph Node" | "Action Node"; locked: boolean; onAdd: () => void;
  onOpen: (id: string) => void; onEdit: (id: string) => void; onRename: (id: string) => void;
  onDelete: (id: string) => void; deleteIssues?: (id: string) => string[];
}) {
  return <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={`${kind} capabilities`}>
    <CollectionAddCard label={`Add ${kind}`} onAdd={onAdd} />
    {nodes.map((node) => {
      const graphNode = "strategy" in node ? node : undefined;
      const strategy = graphNode?.strategy.kind;
      const refs = deleteIssues?.(node.id) ?? [];
      const ready = node.outcomes.length > 0 && (graphNode?.strategy.kind !== "ssp_v2" || graphNode.strategy.model.stateActions.length > 0);
      return <article key={node.id} className="grid min-h-52 min-w-0 grid-rows-[1fr_auto] overflow-hidden rounded-lg border border-divider-strong bg-card">
        <div className="grid content-start gap-3 p-4">
          <header className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 text-primary">{kind === "Graph Node" ? <GitBranch className="size-4" /> : <BriefcaseBusiness className="size-4" />}</span>
            <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-medium">{node.description}</h2><p className="truncate font-mono text-[0.65rem] text-tertiary">{node.id}</p></div>
            <OperationalStatus compact label={ready ? "Contract ready" : "Draft"} tone={ready ? "healthy" : "attention"} />
          </header>
          <p className="line-clamp-2 text-xs text-muted-foreground">{node.description}</p>
          <ContractLine label="Accepts" values={node.capabilities.accepts} />
          <ContractLine label="Provides" values={node.capabilities.provides} />
          <div className="flex flex-wrap gap-1">{node.outcomes.length ? node.outcomes.map((outcome) => <Badge key={outcome.outcomeId} variant={outcome.result === "PASS" ? "secondary" : "destructive"}>{outcome.outcomeId} · {outcome.result}</Badge>) : <span className="font-mono text-[0.65rem] text-muted-foreground">No intrinsic outcomes</span>}</div>
          <div className="font-mono text-[0.65rem] text-muted-foreground">{strategy ? `local routing: ${strategy}` : `retry limit: ${(node as ProjectJobNode).maxRetries}`}</div>
          {refs.length ? <p className="text-[0.7rem] text-destructive" title={refs.join("\n")}>Delete blocked: {refs.length} policy reference{refs.length === 1 ? "" : "s"}</p> : null}
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 border-t border-divider-strong p-2">
          <Button size="sm" onClick={() => onOpen(node.id)}><ShieldCheck /> Open</Button>
          <Button size="icon-sm" variant="outline" aria-label={`Edit ${node.id} contract`} disabled={locked} onClick={() => onEdit(node.id)}><Pencil /></Button>
          <Button size="icon-sm" variant="outline" aria-label={`Rename ${node.id}`} disabled={locked} onClick={() => onRename(node.id)}><GitBranch /></Button>
          <Button size="icon-sm" variant="outline" aria-label={`Delete ${node.id}`} disabled={locked || refs.length > 0} onClick={() => onDelete(node.id)}><Trash2 /></Button>
        </div>
      </article>;
    })}
  </div>;
}

const ContractLine = ({ label, values }: { label: string; values: string[] }) => <div className="min-w-0 text-xs"><span className="font-mono text-[0.65rem] uppercase text-muted-foreground">{label}</span><p className="truncate text-foreground" title={values.join(", ")}>{values.length ? values.join(" · ") : "None"}</p></div>;
