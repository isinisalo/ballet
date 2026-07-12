import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger
} from "@/components/ui/sidebar";
import { Menu } from "lucide-react";
import { useNotifications } from "../app/notifications";
import { useRuntimeStream } from "../app/useRuntimeStream";
import { useAgentExecutionStates } from "./data/useAgentExecutionStates";
import { useRuntimeNotifications } from "./data/useRuntimeNotifications";
import { useWorkspaceData } from "./data/useWorkspaceData";
import { useWorkspaceMutations } from "./data/useWorkspaceMutations";
import { AppSidebar } from "./layout/AppSidebar";
import { useConfigureGitStatus } from "./layout/useConfigureGitStatus";
import { useRuntimeConfigurationIssues } from "./layout/useRuntimeConfigurationIssues";
import { useRunDashboard } from "./runs/useRunDashboard";
import { useWorkspaceSelection } from "./selection/useWorkspaceSelection";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { WorkspaceRouteOutlet } from "./WorkspaceRouteOutlet";

export function WorkspaceShell() {
  const { notifications, notify } = useNotifications();
  const { route, navigate, setNavigationBlocker } = useWorkspaceNavigation();
  const { data, loading, refresh, selectedProjectId } = useWorkspaceData({ notify, routeProjectId: route.projectId });
  const selection = useWorkspaceSelection({ data, route, selectedProjectId });
  const { states: agentExecutionStates } = useAgentExecutionStates();
  const runDashboard = useRunDashboard({ enabled: route.view === "run", rootRunId: route.rootRunId });
  const configureGitState = useConfigureGitStatus({ enabled: route.view !== "run", refreshSignal: data });
  const runtimeConfigurationIssues = useRuntimeConfigurationIssues({ enabled: route.view !== "run", refreshSignal: data });

  const runtimeStreamStatus = useRuntimeStream(refresh);
  useRuntimeNotifications({ notifications, notify, runtimeStreamStatus });
  const mutations = useWorkspaceMutations({
    notify,
    refresh,
    project: selection.project,
    navigate
  });

  return (
      <SidebarProvider>
        <AppSidebar
          route={route}
          projectId={selection.project?.id}
          projectDocumentTree={selection.projectDocumentTree}
          automation={data.automation}
          agents={data.agents}
          agentExecutionStates={agentExecutionStates}
          skills={data.skills}
          runDashboard={runDashboard}
          configureGitState={configureGitState}
          runtimeConfigurationIssues={runtimeConfigurationIssues}
          navigate={navigate}
        />
        <SidebarInset>
          <ScrollArea className="h-svh">
            <main className="flex min-h-svh flex-col bg-muted/30">
              <header className="flex flex-col gap-4 p-3 pb-0 md:hidden">
                <div className="flex items-start gap-2">
                  <SidebarTrigger className="md:hidden">
                    <Menu />
                  </SidebarTrigger>
                </div>
              </header>

              {loading ? <Alert><AlertDescription>Loading workspace data...</AlertDescription></Alert> : null}

              <WorkspaceRouteOutlet
                route={route}
                data={data}
                selection={selection}
                mutations={mutations}
                agentExecutionStates={agentExecutionStates}
                runtimeStreamStatus={runtimeStreamStatus}
                runDashboard={runDashboard}
                navigate={navigate}
                setNavigationBlocker={setNavigationBlocker}
              />
            </main>
          </ScrollArea>
        </SidebarInset>
      </SidebarProvider>
  );
}
