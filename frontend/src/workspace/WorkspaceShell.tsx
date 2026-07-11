import { Menu } from "lucide-react";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { AppSidebar } from "./layout/AppSidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { useNotifications } from "../app/notifications";
import { useRuntimeStream } from "../app/useRuntimeStream";
import { useWorkspaceData } from "./data/useWorkspaceData";
import { useWorkspaceMutations } from "./data/useWorkspaceMutations";
import { useRuntimeNotifications } from "./data/useRuntimeNotifications";
import { useAgentExecutionStates } from "./data/useAgentExecutionStates";
import { WorkspaceRouteOutlet } from "./WorkspaceRouteOutlet";
import { useWorkspaceSelection } from "./selection/useWorkspaceSelection";

export function WorkspaceShell() {
  const { notifications, notify } = useNotifications();
  const { route, navigate } = useWorkspaceNavigation();
  const { data, loading, refresh, selectedProjectId } = useWorkspaceData({ notify, routeProjectId: route.projectId });
  const selection = useWorkspaceSelection({ data, route, selectedProjectId });
  const { states: agentExecutionStates } = useAgentExecutionStates();

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
                runtimeStreamStatus={runtimeStreamStatus}
                navigate={navigate}
              />
            </main>
          </ScrollArea>
        </SidebarInset>
      </SidebarProvider>
  );
}
