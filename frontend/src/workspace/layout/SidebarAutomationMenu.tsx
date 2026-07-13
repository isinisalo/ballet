import { Activity, ChevronRight, Route } from "lucide-react";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { automationAllLoopsPath, automationLoopPath } from "../routing";
import type { RouteState } from "../types";
import { SidebarNavLinkItem } from "./SidebarNavLinkItem";

export function SidebarAutomationMenu({ route, automation, navigate }: {
  route: RouteState;
  automation: ProjectAutomationConfig;
  navigate: (path: string) => void;
}) {
  const active = route.view === "automation" || route.view === "loop-theme" || route.view === "loop-theme-library";

  return (
    <Collapsible defaultOpen={active} className="group/automation">
      <SidebarMenuItem>
        <CollapsibleTrigger render={
          <SidebarMenuButton isActive={active} tooltip="Automation" className="text-muted-foreground data-active:bg-transparent data-active:text-muted-foreground hover:text-sidebar-accent-foreground">
            <Route />
            <span>Automation</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/automation:rotate-90" />
          </SidebarMenuButton>
        } />
        <CollapsibleContent>
          <SidebarMenuSub className="gap-0.5">
            <SidebarNavLinkItem path={automationAllLoopsPath()} isActive={route.view === "automation" && route.automationLoopView === "all"} navigate={navigate}>
              <Activity /> <span>Loops</span>
            </SidebarNavLinkItem>
            {automation.loops.length === 0 ? (
              <SidebarMenuSubItem><span className="block px-2 py-1 text-xs text-muted-foreground">No loops.</span></SidebarMenuSubItem>
            ) : null}
            {automation.loops.map((loop) => (
              <SidebarNavLinkItem
                key={loop.id}
                path={automationLoopPath(loop.id)}
                isActive={(route.view === "automation" && route.automationEntityId === loop.id) || (route.view === "loop-theme" && route.loopThemeLoopId === loop.id)}
                navigate={navigate}
                className="h-6 min-w-0 pl-7 font-mono text-[0.7rem] text-muted-foreground data-active:text-sidebar-accent-foreground"
              >
                <span className="truncate">{loop.id}</span>
              </SidebarNavLinkItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
