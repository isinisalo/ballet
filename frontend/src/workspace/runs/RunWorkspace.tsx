import type { AgentExecutionState, AppData, ProjectLoop } from "@shared/api/workspace-contracts";
import { ArrowLeft, Bot, Route } from "lucide-react";
import { EmptyState, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { RuntimeStreamStatus } from "@/app/useRuntimeStream";
import { AgentRunPane } from "../agents/execution/AgentRunPane";
import { LoopRunView } from "../automation/loops/LoopRunView";
import { useLoopRun } from "../automation/loops/useLoopRun";
import { runAgentPath, runLoopPath, runOverviewPath } from "../routing";
import type { RouteState } from "../types";
import type { RunDashboardState } from "./useRunDashboard";
import { RunOverview } from "./RunOverview";

export function RunWorkspace({ route, data, agentExecutionStates, runtimeStreamStatus, dashboard, navigate }: {
  route: RouteState;
  data: AppData;
  agentExecutionStates: AgentExecutionState[];
  runtimeStreamStatus: RuntimeStreamStatus;
  dashboard: RunDashboardState;
  navigate: (path: string) => void;
}) {
  if (!route.runTargetKind || !route.runTargetId) return <RunOverview dashboard={dashboard} navigate={navigate} />;
  if (route.runTargetKind === "loop") {
    const loop = data.automation.loops.find((candidate) => candidate.id === route.runTargetId);
    if (!loop) return <RunMissingTarget kind="Loop" id={route.runTargetId} navigate={navigate} />;
    return <RunLoopWorkspace loop={loop} route={route} data={data} agentExecutionStates={agentExecutionStates} runtimeStreamStatus={runtimeStreamStatus} dashboard={dashboard} navigate={navigate} />;
  }
  const agent = data.agents.find((candidate) => candidate.id === route.runTargetId);
  if (!agent) return <RunMissingTarget kind="agent" id={route.runTargetId} navigate={navigate} />;
  const target = dashboard.targets.agents.find((candidate) => candidate.id === agent.id);
  return (
    <Panel title="Ballet Run" titleExtra={<span className="truncate text-muted-foreground">{agent.name}</span>} icon={<Bot />} contentClassName="p-0" action={<OverviewButton navigate={navigate} />}>
      <AgentRunPane agentId={agent.id} rootRunId={route.rootRunId} rootDetail={dashboard.detail?.rootRunId === route.rootRunId ? dashboard.detail : undefined} disabledReason={target?.ready ? undefined : target?.issues.map((issue) => issue.message).join(" · ")} onRootRunChange={(rootRunId) => navigate(runAgentPath(agent.id, rootRunId))} />
    </Panel>
  );
}

function RunLoopWorkspace({ loop, route, data, agentExecutionStates, runtimeStreamStatus, dashboard, navigate }: {
  loop: ProjectLoop;
  route: RouteState;
  data: AppData;
  agentExecutionStates: AgentExecutionState[];
  runtimeStreamStatus: RuntimeStreamStatus;
  dashboard: RunDashboardState;
  navigate: (path: string) => void;
}) {
  const refreshSignal = `${dashboard.detail?.updatedAt ?? ""}:${dashboard.streamStatus}`;
  const controller = useLoopRun(loop.id, refreshSignal, runtimeStreamStatus, route.rootRunId);
  const target = dashboard.targets.loops.find((candidate) => candidate.id === loop.id);
  const disabledReason = target?.ready ? undefined : target?.issues.map((issue) => issue.message).join(" · ");
  return (
    <Panel title="Ballet Run" titleExtra={<span className="truncate text-muted-foreground">{loop.id}</span>} icon={<Route />} contentClassName="p-0" action={<OverviewButton navigate={navigate} />}>
      <LoopRunView config={data.automation} loop={loop} agents={data.agents} agentExecutionStates={agentExecutionStates} controller={controller} rootDetail={controller.rootDetail ?? (dashboard.detail?.rootRunId === route.rootRunId ? dashboard.detail : undefined)} startDisabledReason={disabledReason} onRootRunChange={(rootRunId) => navigate(runLoopPath(loop.id, rootRunId))} />
    </Panel>
  );
}

function OverviewButton({ navigate }: { navigate: (path: string) => void }) {
  return <Button type="button" variant="outline" size="sm" onClick={() => navigate(runOverviewPath())}><ArrowLeft />Overview</Button>;
}

function RunMissingTarget({ kind, id, navigate }: { kind: string; id: string; navigate: (path: string) => void }) {
  return <div className="grid gap-3 p-4"><EmptyState title={`${kind} not found.`} action={`No Run target is registered for "${id}".`} /><div><Button type="button" variant="outline" onClick={() => navigate(runOverviewPath())}>Open Run Overview</Button></div></div>;
}
