import { Route } from "lucide-react";
import type { Agent, ProjectAutomationConfig, ProjectDocumentTreeNode, Skill } from "../../../../shared/api/workspace-contracts";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "@/components/ui/sidebar";
import type { RouteState } from "../types";
import { SidebarAutomationMenu } from "./SidebarAutomationMenu";
import { SidebarEnvironmentMenu } from "./SidebarEnvironmentMenu";
import { SidebarProjectMenu } from "./SidebarProjectMenu";

export function AppSidebar({
  route,
  projectId,
  projectDocumentTree,
  automation,
  agents,
  skills,
  navigate
}: {
  route: RouteState;
  projectId?: string;
  projectDocumentTree: ProjectDocumentTreeNode[];
  automation: ProjectAutomationConfig;
  agents: Agent[];
  skills: Skill[];
  navigate: (path: string) => void;
}) {
  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="AgentOps">
              <Route />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">AgentOps</span>
                <span className="text-xs text-muted-foreground">MVP control plane</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarAutomationMenu route={route} automation={automation} navigate={navigate} />
              <SidebarEnvironmentMenu route={route} agents={agents} skills={skills} runtimes={automation.runtimes} navigate={navigate} />
              <SidebarProjectMenu route={route} projectId={projectId} projectDocumentTree={projectDocumentTree} navigate={navigate} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </ShadcnSidebar>
  );
}
