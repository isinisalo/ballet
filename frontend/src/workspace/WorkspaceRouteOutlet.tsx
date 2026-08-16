import { EmptyState } from "@/components/shared/workspace-ui";
import type { AppData } from "@shared/api/workspace-contracts";
import type { AppStreamStatus } from "../app/useAppStream";
import { AutomationView } from "./automation/AutomationView";
import { LoopThemeEditorView } from "./automation/themes/LoopThemeEditorView";
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
import { ExecutionProfilesView } from "./executionProfiles/ExecutionProfilesView";
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
  appStreamStatus,
  runDashboard,
  navigate,
  setNavigationBlocker
}: {
  route: RouteState;
  data: AppData;
  selection: WorkspaceSelection;
  mutations: WorkspaceMutationCallbacks;
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
      return <InstructionsPage project={selection.project} documents={selection.instructionDocuments} instructions={data.instructions} selectedInstruction={selection.selectedInstruction} creating={route.creating} saveProjectDocument={mutations.saveProjectDocument} createProjectDocument={mutations.createProjectDocument} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "automation":
      return <AutomationView data={data} selectedId={route.automationEntityId} level={route.automationLevel ?? "context"} creating={route.creating === true} saveAutomation={mutations.saveAutomation} refreshWorkspace={mutations.refresh} loopModules={mutations.loopModules} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "loop-theme":
      return <LoopThemeEditorView data={data} updateTheme={mutations.updateLoopTheme} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "runtimes":
      return <RuntimeRegistryView runtime={data.runtime} onRefreshed={mutations.refresh} />;
    case "execution-profiles":
      return <ExecutionProfilesView profiles={data.executionProfiles} selectedProfile={selection.selectedExecutionProfile} creating={route.creating} runtime={data.runtime} create={mutations.createExecutionProfile} update={mutations.updateExecutionProfile} remove={mutations.removeExecutionProfile} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "skills":
      return <SkillsView skills={data.skills} skill={selection.selectedSkill} creating={route.creating} save={mutations.save} remove={mutations.remove} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
    case "run":
      return <RunWorkspace route={route} data={data} appStreamStatus={appStreamStatus} dashboard={runDashboard} navigate={navigate} />;
    default:
      return (
        <EmptyState
          title="Unknown workspace route."
          action={`No workspace view is registered for "${String(route.view)}".`}
        />
      );
  }
}
