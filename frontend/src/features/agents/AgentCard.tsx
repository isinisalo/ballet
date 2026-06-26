import { Activity, Bot, Power, RotateCw, ScrollText, Settings2 } from "lucide-react";
import type { AppData, AgentRun } from "backend/shared/domain";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/design-system/components/StatusPill";

const runTimestamp = (value: { updatedAt: string; createdAt: string }): number =>
  Date.parse(value.updatedAt || value.createdAt);

export const recentRunForAgent = (agentId: string, runs: AgentRun[]) =>
  runs.filter((run) => run.agentRole === agentId).sort((left, right) => runTimestamp(right) - runTimestamp(left))[0];

export const fleetStateForAgent = (agent: AppData["agents"][number], recentRun?: AgentRun) => {
  if (!agent.enabled) return "disabled";
  if (recentRun?.status === "running" || recentRun?.status === "queued") return "working";
  if (recentRun?.status === "failed" || recentRun?.status === "blocked") return "failed";
  if (agent.status === "offline") return "offline";
  return "idle";
};

const toneForState = (state: string) =>
  state === "working" ? "info" : state === "idle" ? "success" : state === "failed" ? "danger" : state === "disabled" ? "neutral" : "warning";

export function AgentCard({
  agent,
  operations,
  recentRun,
  selected,
  onOpen
}: {
  agent: AppData["agents"][number];
  operations: AppData["operations"];
  recentRun?: AgentRun;
  selected?: boolean;
  onOpen: () => void;
}) {
  const state = fleetStateForAgent(agent, recentRun);
  return (
    <div className={`grid gap-4 rounded-lg border p-4 text-left transition ${selected ? "border-primary/70 bg-primary/10" : "border-white/10 bg-black/15 hover:border-primary/45 hover:bg-primary/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={onOpen}>
          <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-indigo-300/30 bg-indigo-300/10 text-indigo-100">
            <Bot className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold">{agent.name}</div>
            <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{agent.description}</p>
          </div>
        </button>
        <StatusPill tone={toneForState(state)} pulse={state === "working"}>{state}</StatusPill>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <FleetFact label="Runtime model" value={agent.model ? "configured" : "Default model"} />
        <FleetFact label="Reasoning" value={agent.modelReasoningEffort ?? "standard"} />
        <FleetFact label="Operations" value={String(operations.length)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Last active: {recentRun ? new Date(recentRun.updatedAt || recentRun.createdAt).toLocaleString() : "No runs yet"}
        </span>
        <span className="flex gap-1.5">
          <Button type="button" size="icon" variant="ghost" aria-label={`View logs for ${agent.name}`}><ScrollText className="size-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Edit params for ${agent.name}`}><Settings2 className="size-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Open operations for ${agent.name}`}><Activity className="size-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Reboot ${agent.name}`}><RotateCw className="size-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Toggle ${agent.name}`}><Power className="size-4" /></Button>
        </span>
      </div>
    </div>
  );
}

function FleetFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-2">
      <div className="text-[0.62rem] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-xs text-slate-100">{value}</div>
    </div>
  );
}
