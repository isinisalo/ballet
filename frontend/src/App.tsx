import { useEffect, useState } from "react";
import { AppLayout } from "@/app/AppLayout";
import { routeFromPath, type RouteState } from "@/app/routes";
import { useWorkspaceData } from "@/app/useWorkspaceData";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { FlowsPage } from "@/features/flows/pages/FlowsPage";
import { RunsPage } from "@/features/runs/RunsPage";
import { AgentsPage } from "@/features/agents/AgentsPage";
import { AdvancedPage } from "@/features/advanced/AdvancedPage";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function App() {
  const [route, setRoute] = useState<RouteState>(() => routeFromPath(`${window.location.pathname}${window.location.search}`));
  const { data, flows, validation, loading, error, refresh } = useWorkspaceData();

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(`${window.location.pathname}${window.location.search}`));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setRoute(routeFromPath(path));
  };

  return (
    <AppLayout route={route} navigate={navigate}>
      {loading ? <Alert><AlertDescription>Loading Ballet workspace...</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {route.main === "overview" ? <OverviewPage data={data} flows={flows} navigate={navigate} /> : null}
      {route.main === "flows" ? <FlowsPage data={data} flows={flows} selectedFlowId={route.id} selectedFlowVersion={route.version} refresh={refresh} navigate={navigate} /> : null}
      {route.main === "runs" ? <RunsPage data={data} flows={flows} selectedRunId={route.id} refresh={refresh} navigate={navigate} /> : null}
      {route.main === "agents" ? <AgentsPage data={data} selectedAgentId={route.id} navigate={navigate} /> : null}
      {route.main === "advanced" ? <AdvancedPage data={data} validation={validation} advancedRoute={route.advanced} refresh={refresh} /> : null}
    </AppLayout>
  );
}

export default App;
