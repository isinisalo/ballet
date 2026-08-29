import { OrchestrationWorkspaceShell } from "../orchestration/OrchestrationWorkspaceShell";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

export function WorkspaceShell() {
  const { route, navigate, setNavigationBlocker } = useWorkspaceNavigation();
  return <OrchestrationWorkspaceShell route={route} navigate={navigate} setNavigationBlocker={setNavigationBlocker} />;
}
