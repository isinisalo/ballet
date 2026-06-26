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
    <div className="grid gap-1.5">
      <label className="text-sm font-medium" htmlFor={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-operation`}>{label}</label>
      <select
        id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-operation`}
        className="h-10 rounded-md border bg-background px-3 text-sm"
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
              {operation.name} · {agent?.name ?? operation.agentId} · {operation.id}@{operation.version}
            </option>
          );
        })}
      </select>
    </div>
  );
}
