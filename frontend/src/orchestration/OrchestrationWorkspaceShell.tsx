import { EventStormingWorkspace } from "./event-storming/EventStormingWorkspace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { OrchestrationConfigureOutlet } from "./configure/OrchestrationConfigureOutlet";
import { OrchestrationFrame } from "./OrchestrationFrame";
import { OrchestrationSidebar } from "./OrchestrationSidebar";
import { useOrchestrationConfigureData } from "./useOrchestrationConfigureData";
import { useOrchestrationInvalidations } from "./useOrchestrationInvalidations";
import { useOrchestrationMutation } from "./useOrchestrationMutation";
import { useCallback, useEffect, useState } from "react";
import { useOrchestrationGovernanceData } from "./useOrchestrationGovernanceData";
import { isGovernanceView, OrchestrationGovernanceOutlet } from "./run/OrchestrationGovernanceOutlet";
import { UserStoriesWorkspace } from "./user-stories/UserStoriesWorkspace";

export function OrchestrationWorkspaceShell({ route, navigate, setNavigationBlocker }: { route: RouteState; navigate: WorkspaceNavigation["navigate"]; setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"] }) {
  const [dirty, setDirty] = useState(false);
  const configure = useOrchestrationConfigureData();
  const governance = useOrchestrationGovernanceData(route);
  const refresh = useCallback(async () => { await Promise.all([configure.refresh(), governance.refresh()]); }, [configure.refresh, governance.refresh]);
  useOrchestrationInvalidations(refresh);
  const clearDirty = useCallback(() => setDirty(false), []);
  const mutation = useOrchestrationMutation(refresh, clearDirty);
  useEffect(() => { if (window.location.pathname === "/") navigate("/automation/loops", { bypassBlocker: true, replace: true }); }, [navigate]);
  useEffect(() => { setNavigationBlocker({ isDirty: dirty, message: "Discard unsaved orchestration changes?" }); return () => setNavigationBlocker(null); }, [dirty, setNavigationBlocker]);
  let content = <Alert className="m-4"><AlertDescription>Loading canonical Ballet workspace…</AlertDescription></Alert>;
  const error = configure.error ?? (isGovernanceView(route.workspaceView) ? governance.error : undefined);
  if (error) content = <Alert variant="destructive" className="m-4"><AlertDescription>{error}</AlertDescription></Alert>;
  else if (!configure.loading && configure.data && isGovernanceView(route.workspaceView) && !governance.loading && governance.data) content = <div onInput={() => setDirty(true)} onChangeCapture={() => setDirty(true)} onClickCapture={(event) => { if ((event.target as HTMLElement).closest("form")) setDirty(true); }}><OrchestrationGovernanceOutlet route={route} configure={configure.data} governance={governance.data} navigate={navigate} mutation={mutation} /></div>;
  else if (!configure.loading && configure.data && route.workspaceView === "event-storming") content = <EventStormingWorkspace route={route} locked={configure.data.references.activeRunIds.length > 0} navigate={navigate} onDirty={setDirty} />;
  else if (!configure.loading && configure.data && route.workspaceView === "user-stories") content = <UserStoriesWorkspace route={route} locked={configure.data.references.activeRunIds.length > 0} navigate={navigate} onDirty={setDirty} />;
  else if (!configure.loading && configure.data && !isGovernanceView(route.workspaceView)) content = <div onInput={() => setDirty(true)} onChangeCapture={() => setDirty(true)} onClickCapture={(event) => { if ((event.target as HTMLElement).closest("form")) setDirty(true); }}><OrchestrationConfigureOutlet route={route} data={configure.data} navigate={navigate} mutation={mutation} /></div>;
  return <OrchestrationFrame sidebar={<OrchestrationSidebar route={route} data={configure.data} navigate={navigate} />}>{content}</OrchestrationFrame>;
}
