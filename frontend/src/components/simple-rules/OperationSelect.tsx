import type { AgentOperation } from "backend/shared/operations";
import type { Agent } from "backend/shared/domain";

export function OperationSelect({
  label,
  value,
  operations,
  agents,
  onChange
}: {
  label: string;
  value: string;
  operations: AgentOperation[];
  agents: Agent[];
  onChange: (operationId: string, version: number) => void;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-sm font-medium" htmlFor={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-operation`}>{label}</label>
      <select
        id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-operation`}
        className="h-8 w-full min-w-0 rounded-md border border-border bg-[color:var(--input)] px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35"
        value={value}
        onChange={(event) => {
          const [id = "", version = "1"] = event.target.value.split("@@");
          onChange(id, Number(version));
        }}
      >
        <option value="">Choose agent task</option>
        {operations.map((operation) => {
          const agent = agents.find((candidate) => candidate.id === operation.agentId);
          return (
            <option key={`${operation.id}@${operation.version}`} value={`${operation.id}@@${operation.version}`}>
              {operation.name} · {agent?.name ?? operation.agentId}
            </option>
          );
        })}
      </select>
    </div>
  );
}
