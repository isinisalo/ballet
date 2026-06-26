import { useEffect, useState } from "react";
import { AppLayout } from "@/app/AppLayout";
import { routeFromPath, type RouteState } from "@/app/routes";
import { useWorkspaceData } from "@/app/useWorkspaceData";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { FlowsPage } from "@/features/flows/pages/FlowsPage";
import { RunsPage } from "@/features/runs/RunsPage";
import { AgentsPage } from "@/features/agents/AgentsPage";
import { RuntimeConsolePage } from "@/features/runtime-console/RuntimeConsolePage";
import { ProjectKnowledgePage } from "@/features/project-knowledge/ProjectKnowledgePage";
import { AdvancedPage } from "@/features/advanced/AdvancedPage";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { applyThemeMode, getStoredThemeMode, persistThemeMode, type ThemeMode } from "@/theme";

function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());

  useEffect(() => {
    persistThemeMode(themeMode);
    applyThemeMode(themeMode);

    if (themeMode !== "system") return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemeMode("system");

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  return [themeMode, setThemeMode] as const;
}

export function App() {
  const [themeMode, setThemeMode] = useThemeMode();
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
    <AppLayout route={route} data={data} navigate={navigate} themeMode={themeMode} onThemeModeChange={setThemeMode}>
      {loading ? <Alert><AlertDescription>Loading Ballet workspace...</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {route.main === "overview" ? <OverviewPage data={data} flows={flows} navigate={navigate} /> : null}
      {route.main === "flows" ? <FlowsPage data={data} flows={flows} selectedFlowId={route.id} selectedFlowVersion={route.version} refresh={refresh} navigate={navigate} /> : null}
      {route.main === "runs" ? <RunsPage data={data} flows={flows} selectedRunId={route.id} refresh={refresh} navigate={navigate} /> : null}
      {route.main === "agents" ? <AgentsPage data={data} selectedAgentId={route.id} navigate={navigate} /> : null}
      {route.main === "runtime-console" ? <RuntimeConsolePage data={data} flows={flows} navigate={navigate} /> : null}
      {route.main === "knowledge" ? <ProjectKnowledgePage data={data} selectedDocumentId={route.id} /> : null}
      {route.main === "advanced" ? (
        <AdvancedPage
          data={data}
          validation={validation}
          advancedRoute={route.advanced}
          selectedKey={route.id}
          refresh={refresh}
          navigate={navigate}
        />
      ) : null}
    </AppLayout>
  );
}

export default App;
