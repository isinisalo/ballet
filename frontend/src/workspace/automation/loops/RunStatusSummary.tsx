import type { RootRunDetail } from "@shared/api/workspace-contracts";
import { Badge } from "@/components/ui/badge";

export function RunStatusSummary({ root }: { root: RootRunDetail }) {
  const current = root.current;
  const repair = root.repair;
  const destination = firstDefined(current?.returnDestination, repair.returnDestination);
  const fields = [
    ["Active Loop", value(current?.loopId, current?.loopDescription)],
    ["Work Loop Node", value(current?.workLoopNodeId, current?.workLoopNodeDescription)],
    ["Active role", orDash(current?.nodeRole ? roleLabel(current.nodeRole) : undefined)],
    ["Local attempt", orDash(current?.localRetryAttempt?.toString())],
    ["State revision", `r${root.state.currentRevision}`],
    ["Pending Repair Request", orDash(repair.pendingRepair?.repairRequestId)],
    ["Orchestrator target", orDash(firstDefined(repair.routedTarget?.targetLoopId, current?.routedTargetLoopId))],
    ["Repair depth", orZero(current?.repairDepth?.toString())],
    ["Return destination", destination ? `${destination.loopId}/${destination.workLoopNodeId}/Validation` : "—"],
    ["Finalization", finalizationLabel(root)]
  ];
  return <section className="border-b border-divider-strong bg-card p-3" aria-labelledby="run-position-heading">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 id="run-position-heading" className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Canonical Run position</h2>
      {current?.nodeRole ? <Badge variant="outline">{roleLabel(current.nodeRole)}</Badge> : null}
    </div>
    <dl className="grid gap-px overflow-hidden border border-divider-strong bg-divider-strong sm:grid-cols-2 lg:grid-cols-5">
      {fields.map(([label, fieldValue]) => <div key={label} className="min-w-0 bg-background p-2"><dt className="font-mono text-[0.55rem] uppercase text-muted-foreground">{label}</dt><dd className="mt-0.5 truncate font-mono text-[0.62rem] text-foreground" title={fieldValue}>{fieldValue}</dd></div>)}
    </dl>
  </section>;
}

const value = (id?: string, description?: string): string => id ? `${id}${description ? ` · ${description}` : ""}` : "—";
const roleLabel = (role: NonNullable<RootRunDetail["current"]>["nodeRole"]): string => role === "work" ? "Work" : role === "validation" ? "Validation" : "Orchestrator";
const firstDefined = <Value,>(first?: Value, second?: Value): Value | undefined => first === undefined ? second : first;
const orDash = (value?: string): string => value === undefined ? "—" : value;
const orZero = (value?: string): string => value === undefined ? "0" : value;
const finalizationLabel = (root: RootRunDetail): string => root.finalization?.status
  ? root.finalization.status
  : root.status === "finalizing" ? "finalizing" : "not started";
