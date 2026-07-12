import type { Agent, AgentExecutionState, ProjectAutomationConfig, ProjectDocumentTreeNode, RuntimeConfigurationIssue, Skill } from "@shared/api/workspace-contracts";
import { Sidebar as ShadcnSidebar } from "@/components/ui/sidebar";
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
    <ShadcnSidebar>
      <div data-slot="sidebar-header" data-sidebar="header" className="flex flex-col gap-2 p-2">
        <BalletModeSelect mode={mode} onChange={(nextMode) => navigate(pathForBalletMode({ route, nextMode, agents }))} />
      </div>
      <div data-slot="sidebar-content" data-sidebar="content" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden">
        <div data-slot="sidebar-group" data-sidebar="group" className="relative flex w-full min-w-0 flex-col p-2">
          <div data-slot="sidebar-group-content" data-sidebar="group-content" className="w-full text-sm">
            <ul data-slot="sidebar-menu" data-sidebar="menu" className="flex w-full min-w-0 flex-col gap-0">
              {mode === "run" ? <RunSidebar route={route} dashboard={runDashboard} navigate={navigate} /> : (
                <>
                  <ConfigureGitStatus state={configureGitState} />
                  <ConfigureRuntimeIssues issues={runtimeConfigurationIssues} />
                  <SidebarAutomationMenu route={route} automation={automation} navigate={navigate} />
                  <SidebarEnvironmentMenu route={route} agents={agents} agentExecutionStates={agentExecutionStates} skills={skills} navigate={navigate} />
                  <SidebarProjectMenu route={route} projectDocumentTree={projectDocumentTree} navigate={navigate} />
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </ShadcnSidebar>
  );
}
