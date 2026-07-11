import type { Agent, AgentExecutionState, ProjectAutomationConfig, ProjectDocumentTreeNode, RuntimeConfigurationIssue, Skill } from "@shared/api/workspace-contracts";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarRail
} from "@/components/ui/sidebar";
import type { RouteState } from "../types";
import { balletModeFromRoute } from "../routing";
import { pathForBalletMode } from "../balletModeNavigation";
import type { RunDashboardState } from "../runs/useRunDashboard";
import { RunSidebar } from "../runs/RunSidebar";
import { BalletModeSelect } from "./BalletModeSelect";
import { ConfigureGitStatus, type ConfigureGitState } from "./ConfigureGitStatus";
import { ConfigureRuntimeIssues } from "./ConfigureRuntimeIssues";
import { SidebarAutomationMenu } from "./SidebarAutomationMenu";
import { SidebarEnvironmentMenu } from "./SidebarEnvironmentMenu";
import { SidebarProjectMenu } from "./SidebarProjectMenu";

export function AppSidebar({
  route,
  projectId,
  projectDocumentTree,
  automation,
  agents,
  agentExecutionStates,
  skills,
  runDashboard,
  configureGitState,
  runtimeConfigurationIssues,
  navigate
}: {
  route: RouteState;
  projectId?: string;
  projectDocumentTree: ProjectDocumentTreeNode[];
  automation: ProjectAutomationConfig;
  agents: Agent[];
  agentExecutionStates: AgentExecutionState[];
  skills: Skill[];
  runDashboard: RunDashboardState;
  configureGitState?: ConfigureGitState;
  runtimeConfigurationIssues: RuntimeConfigurationIssue[];
  navigate: (path: string) => void;
}) {
  const mode = balletModeFromRoute(route);
  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader>
        <BalletModeSelect mode={mode} onChange={(nextMode) => navigate(pathForBalletMode({ route, nextMode, agents }))} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mode === "run" ? <RunSidebar route={route} dashboard={runDashboard} navigate={navigate} /> : (
                <>
                  <ConfigureGitStatus state={configureGitState} />
                  <ConfigureRuntimeIssues issues={runtimeConfigurationIssues} />
                  <SidebarAutomationMenu route={route} automation={automation} navigate={navigate} />
                  <SidebarEnvironmentMenu route={route} agents={agents} agentExecutionStates={agentExecutionStates} skills={skills} navigate={navigate} />
                  <SidebarProjectMenu route={route} projectId={projectId} projectDocumentTree={projectDocumentTree} navigate={navigate} />
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </ShadcnSidebar>
  );
}
