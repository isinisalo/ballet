import type { AppData } from "@shared/api/workspace-contracts";
import { EmptyState } from "@/components/shared/workspace-ui";
import { AgentsView } from "./agents/AgentsView";
import { AutomationView } from "./automation/AutomationView";
import { RuntimesView } from "./automation/runtimes/RuntimesView";
import {
  AdrsPage,
  GoalsPage,
  InstructionsPage,
  ProjectDocumentPage,
  ProjectsOverview
} from "./documents/ProjectDocumentPages";
import { SkillsView } from "./skills/SkillsView";
import type { WorkspaceSelection } from "./selection/useWorkspaceSelection";
import type { RouteState } from "./types";
import type { useWorkspaceMutations } from "./data/useWorkspaceMutations";

type WorkspaceMutationCallbacks = ReturnType<typeof useWorkspaceMutations>;

export function WorkspaceRouteOutlet({
  route,
  data,
  selection,
  mutations,
  navigate
}: {
  route: RouteState;
  data: AppData;
  selection: WorkspaceSelection;
  mutations: WorkspaceMutationCallbacks;
  navigate: (path: string) => void;
}) {
  switch (route.view) {
    case "projects":
      return (
        <ProjectsOverview
          project={selection.project}
          saveProjectDocument={mutations.saveProjectDocument}
        />
      );
    case "project-document":
      return <ProjectDocumentPage document={selection.selectedProjectDocument} saveProjectDocument={mutations.saveProjectDocument} />;
    case "project-goals":
      return <GoalsPage project={selection.project} selectedGoal={selection.selectedGoal} saveProjectDocument={mutations.saveProjectDocument} createProjectDocument={mutations.createProjectDocument} />;
    case "project-adrs":
      return <AdrsPage project={selection.project} selectedAdr={selection.selectedAdr} saveProjectDocument={mutations.saveProjectDocument} createProjectDocument={mutations.createProjectDocument} />;
    case "project-instructions":
      return <InstructionsPage project={selection.project} selectedInstruction={selection.selectedInstruction} saveProjectDocument={mutations.saveProjectDocument} createProjectDocument={mutations.createProjectDocument} />;
    case "automation":
      return <AutomationView data={data} activeTab={route.automationTab ?? "workflows"} selectedId={route.automationEntityId} workflowView={route.automationWorkflowView} saveAutomation={mutations.saveAutomation} createEvent={mutations.createEvent} navigate={navigate} />;
    case "runtimes":
      return <RuntimesView data={data} selectedId={route.runtimeId} saveAutomation={mutations.saveAutomation} navigate={navigate} />;
    case "agents":
      return <AgentsView agent={selection.selectedAgent} runtimes={data.runtimes} save={mutations.save} remove={mutations.remove} navigate={navigate} />;
    case "skills":
      return <SkillsView skill={selection.selectedSkill} save={mutations.save} remove={mutations.remove} navigate={navigate} />;
    default:
      return (
        <EmptyState
          title="Unknown workspace route."
          action={`No workspace view is registered for "${String(route.view)}".`}
        />
      );
  }
}
