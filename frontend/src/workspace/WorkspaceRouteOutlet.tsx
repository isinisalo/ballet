import { EmptyState } from "@/components/shared/workspace-ui";
import type { AgentExecutionState, AppData } from "@shared/api/workspace-contracts";
import type { RuntimeStreamStatus } from "../app/useRuntimeStream";
import { AgentsView } from "./agents/AgentsView";
import { AutomationView } from "./automation/AutomationView";
import type { useWorkspaceMutations } from "./data/useWorkspaceMutations";
import {
    AdrsPage,
    GoalsPage,
    InstructionsPage,
    ProjectDocumentPage,
    ProjectsOverview
} from "./documents/ProjectDocumentPages";
import { RuntimeRegistryView } from "./runtimes";
import type { WorkspaceSelection } from "./selection/useWorkspaceSelection";
import { SkillsView } from "./skills/SkillsView";
import type { RouteState } from "./types";

type WorkspaceMutationCallbacks = ReturnType<typeof useWorkspaceMutations>;

export function WorkspaceRouteOutlet({
  route,
  data,
  selection,
  mutations,
  agentExecutionStates,
  runtimeStreamStatus,
  navigate
}: {
  route: RouteState;
  data: AppData;
  selection: WorkspaceSelection;
  mutations: WorkspaceMutationCallbacks;
  agentExecutionStates: AgentExecutionState[];
  runtimeStreamStatus: RuntimeStreamStatus;
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
      return <AutomationView data={data} agentExecutionStates={agentExecutionStates} selectedId={route.automationEntityId} loopView={route.automationLoopView} mode={route.automationLoopMode ?? "edit"} runtimeStreamStatus={runtimeStreamStatus} saveAutomation={mutations.saveAutomation} navigate={navigate} />;
    case "runtimes":
      return <RuntimeRegistryView selectedDeviceId={route.runtimeDeviceId} onSelectDevice={(deviceId) => navigate(deviceId ? `/runtimes?id=${encodeURIComponent(deviceId)}` : "/runtimes")} />;
    case "agents":
      return <AgentsView agent={selection.selectedAgent} agentExecutionStates={agentExecutionStates} mode={route.agentMode ?? "edit"} save={mutations.save} remove={mutations.remove} navigate={navigate} />;
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
