import { useEffect, useState } from "react";
import type { RootRunDetail } from "@shared/api/workspace-contracts";
import { TerminalSquare } from "lucide-react";
import { SelectField } from "@/components/shared/workspace-ui";
import { CliRunConsole } from "../../components/CliRunConsole";

export function RunTaskConsole({ root }: { root: RootRunDetail }) {
  const currentTaskId = root.current?.taskId;
  const [selectedTaskId, setSelectedTaskId] = useState(currentTaskId ?? root.tasks.at(-1)?.id ?? "");
  useEffect(() => { if (currentTaskId) setSelectedTaskId(currentTaskId); }, [currentTaskId]);
  const task = root.tasks.find(({ id }) => id === selectedTaskId) ?? root.tasks.find(({ id }) => id === currentTaskId) ?? [...root.tasks].reverse()[0];
  const role = task?.spec.evidence.nodeRole;
  return <section className="grid min-w-0 gap-2 border border-divider-strong bg-card p-3" aria-labelledby="run-console-heading">
    <header className="flex min-w-0 items-center justify-between gap-2">
      <h2 id="run-console-heading" className="flex items-center gap-2 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground"><TerminalSquare className="size-3.5" /> Execution task console</h2>
      <span className="truncate font-mono text-[0.58rem] text-muted-foreground">{role ? `${roleLabel(role)} · ` : ""}{task?.id ?? "No provider task"}</span>
    </header>
    {root.tasks.length > 1 ? <SelectField label="Execution task" density="compact" value={task?.id ?? ""} onChange={setSelectedTaskId} options={root.tasks.map((candidate) => ({
      value: candidate.id,
      label: `${roleLabel(candidate.spec.evidence.nodeRole)} · ${candidate.status} · ${candidate.id}`
    }))} /> : null}
    {task ? <CliRunConsole taskId={task.id} provider={task.spec.runtime.provider} active={["queued", "running"].includes(task.status)} />
      : <p className="text-xs text-muted-foreground">Human phases do not create provider execution tasks.</p>}
  </section>;
}

const roleLabel = (role: "work" | "validation" | "orchestrator"): string => role === "work" ? "Work" : role === "validation" ? "Validation" : "Orchestrator";
