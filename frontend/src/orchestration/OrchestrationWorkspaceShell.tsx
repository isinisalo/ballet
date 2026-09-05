import { RuntimesWorkspace } from "./configure/RuntimesWorkspace";
import type { InvalidationEvent } from "@shared/orchestration/httpContracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { OrchestrationConfigureOutlet } from "./configure/OrchestrationConfigureOutlet";
import { OrchestrationFrame } from "./OrchestrationFrame";
import { OrchestrationSidebar } from "./OrchestrationSidebar";
import { useOrchestrationConfigureData } from "./useOrchestrationConfigureData";
import { useOrchestrationInvalidations } from "./useOrchestrationInvalidations";
import { useOrchestrationMutation } from "./useOrchestrationMutation";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useOrchestrationGovernanceData } from "./useOrchestrationGovernanceData";
import { isGovernanceView, OrchestrationGovernanceOutlet } from "./run/OrchestrationGovernanceOutlet";
import { UserStoriesWorkspace } from "./user-stories/UserStoriesWorkspace";

const EventStormingWorkspace = lazy(() => import("./event-storming/EventStormingWorkspace").then((module) => ({ default: module.EventStormingWorkspace })));

export function OrchestrationWorkspaceShell({ route, navigate, setNavigationBlocker }: { route: RouteState; navigate: WorkspaceNavigation["navigate"]; setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"] }) {
  const [dirty, setDirty] = useState(false);
  const configure = useOrchestrationConfigureData(route);
  const governance = useOrchestrationGovernanceData(route);
  const refresh = useCallback(async (events?: InvalidationEvent[]) => { await Promise.all([configure.refresh(events), governance.refresh(events)]); }, [configure.refresh, governance.refresh]);
  useOrchestrationInvalidations(refresh);
  const clearDirty = useCallback(() => setDirty(false), []);
  const mutation = useOrchestrationMutation(refresh, clearDirty);
  useEffect(() => { if (window.location.pathname === "/") navigate("/automation/loops", { bypassBlocker: true, replace: true }); }, [navigate]);
  useEffect(() => { setNavigationBlocker({ isDirty: dirty, message: "Discard unsaved orchestration changes?" }); return () => setNavigationBlocker(null); }, [dirty, setNavigationBlocker]);
  let content = <Alert className="m-4"><AlertDescription>Loading canonical Ballet workspace…</AlertDescription></Alert>;
  const error = configure.error ?? (isGovernanceView(route.workspaceView) ? governance.error : undefined);
  if (route.workspaceView === "runtimes") content = <RuntimesWorkspace selectedId={route.entityId} navigate={navigate} />;
  else if (error && (!configure.data || governance.error)) content = <Alert variant="destructive" className="m-4"><AlertDescription>{error}</AlertDescription></Alert>;
  else if (!configure.loading && configure.data) {
    if (isGovernanceView(route.workspaceView) && !governance.loading && governance.data) content = <div onInput={() => setDirty(true)} onChangeCapture={() => setDirty(true)}><OrchestrationGovernanceOutlet route={route} configure={configure.data} governance={governance.data} navigate={navigate} mutation={mutation} /></div>;
    else if (route.workspaceView === "event-storming") content = <EventStormingWorkspace route={route} locked={configure.data.references.activeRunIds.length > 0} navigate={navigate} onDirty={setDirty} />;
    else if (route.workspaceView === "user-stories") content = <UserStoriesWorkspace route={route} locked={configure.data.references.activeRunIds.length > 0} navigate={navigate} onDirty={setDirty} />;
    else if (!isGovernanceView(route.workspaceView)) content = <div onInput={() => setDirty(true)} onChangeCapture={() => setDirty(true)}><OrchestrationConfigureOutlet route={route} data={configure.data} navigate={navigate} mutation={mutation} onDirty={setDirty} /></div>;
  }
  return <OrchestrationFrame sidebar={<OrchestrationSidebar route={route} data={configure.data} navigate={navigate} />}>{configure.error && configure.data ? <Alert variant="destructive" className="m-4"><AlertDescription>{configure.error}</AlertDescription></Alert> : null}<Suspense fallback={<p role="status" className="p-4">Loading workspace…</p>}>{content}</Suspense></OrchestrationFrame>;
}
