import { useMemo, useState } from "react";
import { Menu } from "lucide-react";
import {
  findProjectTreeDirectory,
  findProjectTreeDocument,
  selectedProjectTreeDocument
} from "./documents/projectDocuments";
import { type ProjectDocumentCreateKind } from "./types";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";
import { AppSidebar } from "./layout/AppSidebar";
import { AgentsView } from "./agents/AgentsView";
import { SkillsView } from "./skills/SkillsView";
import { AutomationView } from "./automation/AutomationView";
import { RuntimesView } from "./automation/runtimes/RuntimesView";
import { defaultProjectAutomationConfig } from "../../../shared/api/workspace-contracts";
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
import {
  AdrsPage,
  GoalsPage,
  InstructionsPage,
  ProjectDocumentPage,
  ProjectsOverview
} from "./documents/ProjectDocumentPages";
import { CreateProjectDocumentDialog } from "./documents/CreateProjectDocumentDialog";

export function WorkspaceShell() {
  const { notifications, notify } = useNotifications();
  const { route, navigate } = useWorkspaceNavigation();
  const [createDocumentKind, setCreateDocumentKind] = useState<ProjectDocumentCreateKind | null>(null);
  const { data, loading, refresh, selectedProjectId } = useWorkspaceData({ notify, routeProjectId: route.projectId });

  const project = data.projects.find((item) => item.id === (route.projectId ?? selectedProjectId)) ?? data.projects.find((item) => item.id === selectedProjectId) ?? data.projects[0];
  const projectDocumentTree = data.projectDocumentTree ?? [];
  const selectedProjectDocument = useMemo(
    () => findProjectTreeDocument(projectDocumentTree, route.documentPath),
    [projectDocumentTree, route.documentPath]
  );
  const adrDirectory = useMemo(
    () => findProjectTreeDirectory(projectDocumentTree, ".ballet/adr"),
    [projectDocumentTree]
  );
  const goalsDirectory = useMemo(
    () => findProjectTreeDirectory(projectDocumentTree, ".ballet/goals"),
    [projectDocumentTree]
  );
  const instructionsDirectory = useMemo(
    () => findProjectTreeDirectory(projectDocumentTree, ".ballet/instructions"),
    [projectDocumentTree]
  );
  const selectedAdr = useMemo(
    () => selectedProjectTreeDocument(adrDirectory, route.documentPath),
    [adrDirectory, route.documentPath]
  );
  const selectedGoal = useMemo(
    () => selectedProjectTreeDocument(goalsDirectory, route.documentPath),
    [goalsDirectory, route.documentPath]
  );
  const selectedInstruction = useMemo(
    () => selectedProjectTreeDocument(instructionsDirectory, route.documentPath),
    [instructionsDirectory, route.documentPath]
  );
  const selectedAgent = useMemo(
    () => route.view === "agents" && !route.documentPath
      ? undefined
      : data.agents.find((agent) => agent.relativePath === route.documentPath) ?? data.agents[0],
    [data.agents, route.documentPath, route.view]
  );
  const selectedSkill = useMemo(
    () => data.skills.find((skill) => skill.relativePath === route.documentPath) ?? data.skills[0],
    [data.skills, route.documentPath]
  );

  const runtimeStreamStatus = useRuntimeStream(refresh);
  useRuntimeNotifications({ notifications, notify, runtimeStreamStatus });
  const { save, saveProjectDocument, createProjectDocument, remove, saveAutomation } = useWorkspaceMutations({
    notify,
    refresh,
    project,
    navigate
  });

  return (
      <SidebarProvider>
        <AppSidebar
          route={route}
          projectId={project?.id}
          projectDocumentTree={projectDocumentTree}
          automation={data.automation ?? defaultProjectAutomationConfig()}
          agents={data.agents}
          skills={data.skills}
          navigate={navigate}
        />
        <SidebarInset>
          <ScrollArea className="h-svh">
            <main className="flex min-h-svh flex-col gap-4 bg-muted/30 p-3 md:p-4">
              <header className="flex flex-col gap-4 md:hidden">
                <div className="flex items-start gap-2">
                  <SidebarTrigger className="md:hidden">
                    <Menu />
                  </SidebarTrigger>
                </div>
              </header>

              {loading ? <Alert><AlertDescription>Loading workspace data...</AlertDescription></Alert> : null}

              {route.view === "projects" ? (
                <ProjectsOverview
                  project={project}
                  saveProjectDocument={saveProjectDocument}
                />
              ) : null}
              {route.view === "project-document" ? <ProjectDocumentPage document={selectedProjectDocument} saveProjectDocument={saveProjectDocument} onCreateDocument={setCreateDocumentKind} /> : null}
              {route.view === "project-goals" ? <GoalsPage project={project} selectedGoal={selectedGoal} saveProjectDocument={saveProjectDocument} onCreateDocument={setCreateDocumentKind} /> : null}
              {route.view === "project-adrs" ? <AdrsPage project={project} selectedAdr={selectedAdr} saveProjectDocument={saveProjectDocument} onCreateDocument={setCreateDocumentKind} /> : null}
              {route.view === "project-instructions" ? <InstructionsPage project={project} selectedInstruction={selectedInstruction} onCreateDocument={setCreateDocumentKind} /> : null}
              {route.view === "automation" ? <AutomationView data={data} activeTab={route.automationTab ?? "workflows"} selectedId={route.automationEntityId} saveAutomation={saveAutomation} navigate={navigate} /> : null}
              {route.view === "runtimes" ? <RuntimesView data={data} selectedId={route.runtimeId} saveAutomation={saveAutomation} navigate={navigate} /> : null}
              {route.view === "agents" ? <AgentsView agent={selectedAgent} runtimes={data.runtimes} save={save} remove={remove} navigate={navigate} /> : null}
              {route.view === "skills" ? <SkillsView skill={selectedSkill} save={save} remove={remove} navigate={navigate} /> : null}
            </main>
          </ScrollArea>
          <CreateProjectDocumentDialog
            kind={createDocumentKind}
            onOpenChange={(open) => {
              if (!open) setCreateDocumentKind(null);
            }}
            onCreate={createProjectDocument}
          />
        </SidebarInset>
      </SidebarProvider>
  );
}
