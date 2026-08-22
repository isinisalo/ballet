import { Activity, Network } from "lucide-react";
import { SidebarMenuItem, SidebarMenuButton, SidebarMenuSub } from "@/components/ui/sidebar";
import type { RouteState } from "../types";
import type { RunDashboardState } from "./useRunDashboard";
import { runGraphNodePath, runGraphPath, runOverviewPath } from "../routing";
import { SidebarNavLinkItem } from "../layout/SidebarNavLinkItem";

export function RunSidebar({ route, dashboard, navigate }: {
  route: RouteState;
  dashboard: RunDashboardState;
  navigate: (path: string) => void;
}) {
  return <ul className="grid gap-1">
    <SidebarMenuItem><SidebarMenuButton onClick={() => navigate(runOverviewPath())} isActive={!route.runTargetKind}><Activity /><span>Runs</span></SidebarMenuButton></SidebarMenuItem>
    <SidebarMenuSub>
      <SidebarNavLinkItem path={runGraphPath(dashboard.targets.graph.id, dashboard.targets.graph.activeRootRunId)} isActive={route.runTargetKind === "graph"} navigate={navigate}>
        <Network /><span className="truncate">Graph</span>
      </SidebarNavLinkItem>
      {dashboard.targets.graphNodes.map((target) => <SidebarNavLinkItem
        key={target.id}
        path={runGraphNodePath(target.id, target.activeRootRunId)}
        isActive={route.runTargetKind === "graph_node" && route.runTargetId === target.id}
        navigate={navigate}
      ><span className="truncate font-mono text-[0.7rem]">{target.id}</span></SidebarNavLinkItem>)}
    </SidebarMenuSub>
  </ul>;
}
