import { EmptyState } from "@/components/shared/workspace-ui";
import type { AgentExecutionState, AppData } from "@shared/api/workspace-contracts";
import type { AppStreamStatus } from "../app/useAppStream";
import { AgentsView } from "./agents/AgentsView";
import { AutomationView } from "./automation/AutomationView";
import { LoopThemeEditorView } from "./automation/themes/LoopThemeEditorView";
import { LoopThemeLibrary } from "./automation/themes/LoopThemeLibrary";
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
import { RunWorkspace } from "./runs/RunWorkspace";
import type { RunDashboardState } from "./runs/useRunDashboard";
import type { RouteState } from "./types";
import type { WorkspaceNavigation } from "./useWorkspaceNavigation";

type WorkspaceMutationCallbacks = ReturnType<typeof useWorkspaceMutations>;

export function WorkspaceRouteOutlet({
  route,
  data,
  selection,
  mutations,
  agentExecutionStates,
  appStreamStatus,
  runDashboard,
  navigate,
  setNavigationBlocker
}: {
  route: RouteState;
  data: AppData;
  selection: WorkspaceSelection;
  mutations: WorkspaceMutationCallbacks;
  agentExecutionStates: AgentExecutionState[];
  appStreamStatus: AppStreamStatus;
  runDashboard: RunDashboardState;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  switch (route.view) {
    case "projects":
      return (
        <ProjectsOverview
          project={selection.project}
          saveProjectDocument={mutations.saveProjectDocument}
          setNavigationBlocker={setNavigationBlocker}
        />
      );
    case "project-document":
      return <ProjectDocumentPage document={selection.selectedProjectDocument} saveProjectDocument={mutations.saveProjectDocument} setNavigationBlocker={setNavigationBlocker} />;
    case "project-goals":
      return <GoalsPage project={selection.project} documents={selection.goalDocuments} selectedGoal={selection.selectedGoal} creating={route.creating} saveProjectDocument={mutations.saveProjectDocument} createProjectDocument={mutations.createProjectDocument} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "project-adrs":
      return <AdrsPage project={selection.project} documents={selection.adrDocuments} selectedAdr={selection.selectedAdr} creating={route.creating} saveProjectDocument={mutations.saveProjectDocument} createProjectDocument={mutations.createProjectDocument} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "project-instructions":
      return <InstructionsPage project={selection.project} documents={selection.instructionDocuments} selectedInstruction={selection.selectedInstruction} creating={route.creating} saveProjectDocument={mutations.saveProjectDocument} createProjectDocument={mutations.createProjectDocument} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "automation":
      return <AutomationView data={data} agentExecutionStates={agentExecutionStates} selectedId={route.automationEntityId} loopView={route.automationLoopView} saveAutomation={mutations.saveAutomation} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "loop-theme":
      return <LoopThemeEditorView data={data} themeId={route.loopThemeId} sourceThemeId={route.loopThemeSourceId} loopId={route.loopThemeLoopId} updateTheme={mutations.updateLoopTheme} createTheme={mutations.createLoopTheme} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "loop-theme-library":
      return <LoopThemeLibrary data={data} navigate={navigate} />;
    case "runtimes":
      return <RuntimeRegistryView runtime={data.runtime} onRefreshed={mutations.refresh} />;
    case "agents":
      return <AgentsView agents={data.agents} agent={selection.selectedAgent} creating={route.creating} agentExecutionStates={agentExecutionStates} runtime={data.runtime} runtimeConfiguration={selection.selectedAgent ? data.agentRuntimeConfigurations[selection.selectedAgent.id] : undefined} save={mutations.save} remove={mutations.remove} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "skills":
      return <SkillsView skills={data.skills} skill={selection.selectedSkill} creating={route.creating} save={mutations.save} remove={mutations.remove} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "run":
      return <RunWorkspace route={route} data={data} agentExecutionStates={agentExecutionStates} appStreamStatus={appStreamStatus} dashboard={runDashboard} navigate={navigate} />;
    default:
      return (
        <EmptyState
          title="Unknown workspace route."
          action={`No workspace view is registered for "${String(route.view)}".`}
        />
      );
  }
}
