import type { AppData, ProjectLoop } from "@shared/api/workspace-contracts";
import { ArrowLeft, Route } from "lucide-react";
import { EmptyState, Panel } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import type { AppStreamStatus } from "@/app/useAppStream";
import { LoopRunView } from "../automation/loops/LoopRunView";
import { useLoopRun } from "../automation/loops/useLoopRun";
import { runLoopPath, runOverviewPath } from "../routing";
import type { RouteState } from "../types";
import { isRootRunDetailForLoop, rootRunLoopMismatchMessage } from "./rootRunAssociation";
import type { RunDashboardState } from "./useRunDashboard";
import { RunOverview } from "./RunOverview";

export function RunWorkspace({ route, data, appStreamStatus, dashboard, navigate }: {
  route: RouteState;
  data: AppData;
  appStreamStatus: AppStreamStatus;
  dashboard: RunDashboardState;
  navigate: (path: string) => void;
}) {
  if (!route.runTargetKind || !route.runTargetId) return <RunOverview dashboard={dashboard} navigate={navigate} />;
  const liveLoop = data.automation.loops.find((candidate) => candidate.id === route.runTargetId);
  if (route.rootRunId) {
    const explicitDetail = dashboard.detail?.rootRunId === route.rootRunId ? dashboard.detail : undefined;
    if (!explicitDetail && dashboard.loading) return <RunLoadingSnapshot loopId={route.runTargetId} />;
    if (!explicitDetail) return <RunMissingRoot rootRunId={route.rootRunId} loopId={route.runTargetId} navigate={navigate} />;
    if (!isRootRunDetailForLoop(explicitDetail, route.runTargetId, route.rootRunId)) {
      return <RunInvalidAssociation rootRunId={route.rootRunId} loopId={route.runTargetId} navigate={navigate} />;
    }
    const snapshotLoop = explicitDetail.executionSnapshot.loops.find((candidate) => candidate.id === route.runTargetId);
    if (!snapshotLoop) return <RunInvalidAssociation rootRunId={route.rootRunId} loopId={route.runTargetId} navigate={navigate} />;
    return <RunLoopWorkspace key={`${route.runTargetId}:${route.rootRunId}`} loop={snapshotLoop} liveLoop={liveLoop} route={route} data={data} appStreamStatus={appStreamStatus} dashboard={dashboard} navigate={navigate} />;
  }
  if (!liveLoop) return <RunMissingTarget kind="Loop" id={route.runTargetId} navigate={navigate} />;
  return <RunLoopWorkspace key={route.runTargetId} loop={liveLoop} liveLoop={liveLoop} route={route} data={data} appStreamStatus={appStreamStatus} dashboard={dashboard} navigate={navigate} />;
}

function RunLoopWorkspace({ loop, liveLoop, route, data, appStreamStatus, dashboard, navigate }: {
  loop: ProjectLoop;
  liveLoop?: ProjectLoop;
  route: RouteState;
  data: AppData;
  appStreamStatus: AppStreamStatus;
  dashboard: RunDashboardState;
  navigate: (path: string) => void;
}) {
  const refreshSignal = `${dashboard.detail?.updatedAt ?? ""}:${dashboard.streamStatus}`;
  const target = liveLoop ? dashboard.targets.loops.find((candidate) => candidate.id === liveLoop.id) : undefined;
  const detail = dashboard.detail;
  const suppliedRootDetail = detail && route.rootRunId
    && detail.rootRunId === route.rootRunId
    && isRootRunDetailForLoop(detail, loop.id, route.rootRunId)
    ? detail
    : undefined;
  const controller = useLoopRun(loop.id, refreshSignal, appStreamStatus, route.rootRunId, target, suppliedRootDetail);
  const disabledReason = !liveLoop
    ? "This Loop is no longer configured. Historical Run evidence remains available, but starting a new Run requires a configured Loop."
    : !target
      ? "This Loop has no available Run target."
      : target.ready
        ? undefined
        : target.issues.map((issue) => issue.message).join(" · ");
  return (
    <Panel title="Ballet Run" titleExtra={<span className="truncate text-muted-foreground">{loop.id}</span>} icon={<Route />} contentClassName="p-0" action={<OverviewButton navigate={navigate} />}>
      <LoopRunView config={data.automation} loop={loop} executionProfiles={data.executionProfiles} theme={data.loopTheme} controller={controller} rootDetail={controller.rootDetail ?? suppliedRootDetail} startDisabledReason={disabledReason} onRootRunChange={(rootRunId) => navigate(runLoopPath(loop.id, rootRunId))} />
    </Panel>
  );
}

function OverviewButton({ navigate }: { navigate: (path: string) => void }) {
  return <Button type="button" variant="outline" size="sm" onClick={() => navigate(runOverviewPath())}><ArrowLeft />Overview</Button>;
}

function RunMissingTarget({ kind, id, navigate }: { kind: string; id: string; navigate: (path: string) => void }) {
  return <div className="grid gap-3 p-4"><EmptyState title={`${kind} not found.`} action={`No Run target is registered for "${id}".`} /><div><Button type="button" variant="outline" onClick={() => navigate(runOverviewPath())}>Open Run Overview</Button></div></div>;
}

function RunLoadingSnapshot({ loopId }: { loopId: string }) {
  return <div className="p-4"><EmptyState title="Loading historical Run…" action={`Resolving immutable snapshot for "${loopId}".`} /></div>;
}

function RunMissingRoot({ rootRunId, loopId, navigate }: { rootRunId: string; loopId: string; navigate: (path: string) => void }) {
  return <RunUnavailable title="Run not found." message={`Root Run "${rootRunId}" is unavailable for Loop "${loopId}".`} navigate={navigate} />;
}

function RunInvalidAssociation({ rootRunId, loopId, navigate }: { rootRunId: string; loopId: string; navigate: (path: string) => void }) {
  return <RunUnavailable title="Run not found." message={rootRunLoopMismatchMessage(rootRunId, loopId)} navigate={navigate} />;
}

function RunUnavailable({ title, message, navigate }: { title: string; message: string; navigate: (path: string) => void }) {
  return <div className="grid gap-3 p-4"><EmptyState title={title} action={message} /><div><Button type="button" variant="outline" onClick={() => navigate(runOverviewPath())}>Open Run Overview</Button></div></div>;
}
