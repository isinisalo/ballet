import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    SidebarProvider,
    SidebarTrigger
} from "@/components/ui/sidebar";
import { Menu } from "lucide-react";
import { useNotifications } from "../app/notifications";
import { useAppStream } from "../app/useAppStream";
import { useAppStreamNotifications } from "../app/useAppStreamNotifications";
import { useWorkspaceData } from "./data/useWorkspaceData";
import { useWorkspaceMutations } from "./data/useWorkspaceMutations";
import { AppSidebar } from "./layout/AppSidebar";
import { useConfigureGitStatus } from "./layout/useConfigureGitStatus";
import { useRunDashboard } from "./runs/useRunDashboard";
import { useWorkspaceSelection } from "./selection/useWorkspaceSelection";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { WorkspaceRouteOutlet } from "./WorkspaceRouteOutlet";

export function WorkspaceShell() {
  const { notify } = useNotifications();
  const { route, navigate, setNavigationBlocker } = useWorkspaceNavigation();
  const { data, loading, refresh } = useWorkspaceData({ notify });
  const selection = useWorkspaceSelection({ data, route });
  const runDashboardData = useRunDashboard({ enabled: route.view === "run", rootRunId: route.rootRunId, targets: data.runTargets });
  const configureGitState = useConfigureGitStatus({ enabled: route.view !== "run", refreshSignal: data });
  const runtimeConfigurationIssues = Object.values(data.agentRuntimeConfigurations).flatMap((configuration) => configuration.issues);
  const appStreamStatus = useAppStream({
    onWorkspaceChanged: refresh,
    onRunsChanged: async () => {
      await Promise.all([refresh(), runDashboardData.refresh()]);
    }
  });
  useAppStreamNotifications({ notify, streamStatus: appStreamStatus });
  const runDashboard = { ...runDashboardData, streamStatus: appStreamStatus };
  const mutations = useWorkspaceMutations({
    notify,
    refresh,
    navigate
  });

  return (
      <SidebarProvider>
        <AppSidebar
          route={route}
          projectDocumentTree={selection.projectDocumentTree}
          automation={data.automation}
          agents={data.agents}
          agentExecutionStates={data.executionStates}
          skills={data.skills}
          runDashboard={runDashboard}
          configureGitState={configureGitState}
          runtimeConfigurationIssues={runtimeConfigurationIssues}
          navigate={navigate}
        />
        <div data-slot="sidebar-inset" className="relative flex w-full flex-1 flex-col bg-background">
          <ScrollArea className="h-svh">
            <main className="flex min-h-svh flex-col bg-background">
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
                agentExecutionStates={data.executionStates}
                appStreamStatus={appStreamStatus}
                runDashboard={runDashboard}
                navigate={navigate}
                setNavigationBlocker={setNavigationBlocker}
              />
            </main>
          </ScrollArea>
        </div>
      </SidebarProvider>
  );
}
