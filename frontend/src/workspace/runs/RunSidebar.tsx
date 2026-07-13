import { Bot, CircleDot, Gauge, Route } from "lucide-react";
import { StatusDot } from "@/components/shared/workspace-ui";
import {
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";
import type { RouteState } from "../types";
import { runAgentPath, runLoopPath, runOverviewPath } from "../routing";
import { SidebarNavLinkItem } from "../layout/SidebarNavLinkItem";
import type { RunDashboardState } from "./useRunDashboard";
import { runSummaryPath } from "./runPresentation";

export function RunSidebar({ route, dashboard, navigate }: {
  route: RouteState;
  dashboard: RunDashboardState;
  navigate: (path: string) => void;
}) {
  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton isActive={!route.runTargetKind} tooltip="Run Overview" onClick={() => navigate(runOverviewPath())}>
          <Gauge /><span>Overview</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <RunSection label="Active runs" icon={<CircleDot className="text-secondary" />} empty="No active runs.">
        {dashboard.active.map((run) => (
          <SidebarNavLinkItem key={run.rootRunId} path={runSummaryPath(run)} isActive={route.rootRunId === run.rootRunId} navigate={navigate} className="h-7 min-w-0 font-mono text-[0.65rem]">
            <StatusDot tone="active" />
            <span className="truncate">{run.targetId}</span>
            <span className="ml-auto text-muted-foreground">{run.status}</span>
          </SidebarNavLinkItem>
        ))}
      </RunSection>
      <RunSection label="Loops" icon={<Route />} empty="No Loops.">
        {dashboard.targets.loops.map((target) => (
          <SidebarNavLinkItem key={target.id} path={runLoopPath(target.id, target.activeRootRunId)} isActive={route.runTargetKind === "loop" && route.runTargetId === target.id} navigate={navigate} className="h-7 min-w-0">
            <ReadinessDot ready={target.ready} active={Boolean(target.activeRootRunId)} /><span className="truncate font-mono text-[0.68rem]">{target.name}</span>
          </SidebarNavLinkItem>
        ))}
      </RunSection>
      <RunSection label="Agents" icon={<Bot />} empty="No agents.">
        {dashboard.targets.agents.map((target) => (
          <SidebarNavLinkItem key={target.id} path={runAgentPath(target.id, target.activeRootRunId)} isActive={route.runTargetKind === "agent" && route.runTargetId === target.id} navigate={navigate} className="h-7 min-w-0">
            <ReadinessDot ready={target.ready} active={Boolean(target.activeRootRunId)} /><span className="truncate">{target.name}</span>
          </SidebarNavLinkItem>
        ))}
      </RunSection>
    </>
  );
}

function RunSection({ label, icon, empty, children }: { label: string; icon: React.ReactNode; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <SidebarMenuItem className="mt-2">
      <SidebarGroupLabel className="h-7 gap-2 px-2 font-mono text-[0.62rem] uppercase tracking-[0.05em]">{icon}{label}</SidebarGroupLabel>
      <SidebarMenuSub className="gap-0.5">
        {hasChildren ? children : <SidebarMenuSubItem><span className="block px-2 py-1 text-xs text-muted-foreground">{empty}</span></SidebarMenuSubItem>}
      </SidebarMenuSub>
    </SidebarMenuItem>
  );
}

function ReadinessDot({ ready, active }: { ready: boolean; active: boolean }) {
  return <StatusDot tone={active ? "active" : ready ? "healthy" : "attention"} className="size-2" />;
}
